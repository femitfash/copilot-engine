import OpenAI from "openai";
import type {
  LLMProvider,
  LLMResponse,
  Tool,
  Message,
  ContentBlock,
  ToolResult,
} from "../llm-types";

/**
 * OpenAI provider — supports GPT-4.1 mini, GPT-4o, and any model
 * that supports function calling / tool use.
 */
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async createMessage(params: {
    model: string;
    maxTokens: number;
    system: string;
    tools: Tool[];
    messages: Message[];
  }): Promise<LLMResponse> {
    // Convert generic tools to OpenAI function format
    const tools: OpenAI.ChatCompletionTool[] = params.tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema as unknown as Record<string, unknown>,
      },
    }));

    // Convert generic messages to OpenAI format
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: params.system },
    ];
    for (const m of params.messages) {
      const converted = this.toOpenAIMessages(m);
      openaiMessages.push(...converted);
    }

    const response = await this.client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens,
      tools,
      messages: openaiMessages,
    });

    const choice = response.choices[0];
    if (!choice) {
      return { content: [], stopReason: "end_turn" };
    }

    // Map OpenAI response to generic format
    const content: ContentBlock[] = [];

    if (choice.message.content) {
      content.push({ type: "text", text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type === "function") {
          content.push({
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments || "{}"),
          });
        }
      }
    }

    const stopReason =
      choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn";

    return { content, stopReason };
  }

  /**
   * Convert a generic Message to one or more OpenAI message params.
   * Tool results expand to multiple "tool" role messages.
   */
  private toOpenAIMessages(
    msg: Message
  ): OpenAI.ChatCompletionMessageParam[] {
    // Simple text message
    if (typeof msg.content === "string") {
      return [{ role: msg.role, content: msg.content } as OpenAI.ChatCompletionMessageParam];
    }

    // Tool results (user role with tool_result blocks)
    if (
      Array.isArray(msg.content) &&
      msg.content.length > 0 &&
      "tool_use_id" in msg.content[0]
    ) {
      // OpenAI expects separate tool messages for each result
      const results = msg.content as ToolResult[];
      return results.map((r) => ({
        role: "tool" as const,
        tool_call_id: r.tool_use_id,
        content: r.content,
      }));
    }

    // Assistant message with content blocks (text + tool_use)
    if (Array.isArray(msg.content)) {
      const contentBlocks = msg.content as ContentBlock[];
      const textParts = contentBlocks
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");

      const toolCalls = contentBlocks
        .filter((b) => b.type === "tool_use")
        .map((b) => {
          const tu = b as { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
          return {
            id: tu.id,
            type: "function" as const,
            function: {
              name: tu.name,
              arguments: JSON.stringify(tu.input),
            },
          };
        });

      if (toolCalls.length > 0) {
        return [{
          role: "assistant" as const,
          content: textParts || null,
          tool_calls: toolCalls,
        }];
      }

      return [{ role: msg.role, content: textParts } as OpenAI.ChatCompletionMessageParam];
    }

    return [{ role: msg.role, content: String(msg.content) } as OpenAI.ChatCompletionMessageParam];
  }
}
