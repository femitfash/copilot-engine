import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMProvider,
  LLMResponse,
  Tool,
  Message,
  ContentBlock,
} from "../llm-types";

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async createMessage(params: {
    model: string;
    maxTokens: number;
    system: string;
    tools: Tool[];
    messages: Message[];
  }): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      tools: params.tools as Anthropic.Tool[],
      messages: params.messages as Anthropic.MessageParam[],
    });

    // Map Anthropic response to generic format
    const content: ContentBlock[] = response.content.map((block) => {
      if (block.type === "text") {
        return { type: "text" as const, text: block.text };
      }
      if (block.type === "tool_use") {
        return {
          type: "tool_use" as const,
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      }
      // Fallback for any other block types
      return { type: "text" as const, text: "" };
    });

    return {
      content,
      stopReason: response.stop_reason === "tool_use" ? "tool_use" : "end_turn",
    };
  }
}
