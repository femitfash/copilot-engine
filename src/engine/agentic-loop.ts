import type { Tool, Message, ToolResult, ToolUseBlock, LLMProvider } from "./llm-types";
import { getLLMConfig, createProvider } from "./providers";

const MAX_ITERATIONS = 6;
const MAX_TOOL_RESULT_CHARS = 8000;

function truncateResult(result: string): string {
  if (result.length <= MAX_TOOL_RESULT_CHARS) return result;
  return result.substring(0, MAX_TOOL_RESULT_CHARS) + "\n\n[... truncated — result too large. Show the user a summary of what you received.]";
}

export interface PendingAction {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: "pending";
}

export interface AgenticResult {
  text: string;
  pendingActions: PendingAction[];
}

export async function runAgenticLoop(
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  tools: Tool[],
  writeToolNames: Set<string>,
  executeReadTool: (
    name: string,
    input: Record<string, unknown>,
    ctx: any
  ) => Promise<string>,
  ctx: any
): Promise<AgenticResult> {
  const config = getLLMConfig();
  const provider: LLMProvider = createProvider(config);
  const pendingActions: PendingAction[] = [];
  let collectedText = "";

  // Build messages array
  const messages: Message[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await provider.createMessage({
      model: config.model,
      maxTokens: config.maxTokens || 16384,
      system: systemPrompt,
      tools,
      messages,
    });

    // Extract text blocks
    for (const block of response.content) {
      if (block.type === "text") {
        collectedText += block.text;
      }
    }

    // Check for tool use
    const toolUseBlocks = response.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use"
    );

    if (response.stopReason === "max_tokens") {
      // Response was truncated — return what we have
      break;
    }

    if (toolUseBlocks.length === 0 || response.stopReason !== "tool_use") {
      break; // No more tool calls, we're done
    }

    // Process tool calls
    const toolResults: ToolResult[] = [];

    for (const toolCall of toolUseBlocks) {
      if (writeToolNames.has(toolCall.name)) {
        // WRITE tool: queue for approval, do NOT execute
        pendingActions.push({
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.input,
          status: "pending",
        });
        toolResults.push({
          tool_use_id: toolCall.id,
          content:
            "[SYSTEM] ACTION NOT EXECUTED — QUEUED FOR USER APPROVAL. " +
            "The action has NOT been performed yet. The user will see an Approve/Reject card in the UI. " +
            "You MUST tell the user: \"I've queued [action] for your approval.\" " +
            "NEVER say the action was completed, created, done, or successful.",
        });
      } else {
        // READ tool: execute immediately and feed result back
        try {
          const result = await executeReadTool(
            toolCall.name,
            toolCall.input,
            ctx
          );
          toolResults.push({
            tool_use_id: toolCall.id,
            content: truncateResult(result),
          });
        } catch (err: any) {
          toolResults.push({
            tool_use_id: toolCall.id,
            content: `Error executing ${toolCall.name}: ${err.message}`,
            is_error: true,
          });
        }
      }
    }

    // Add assistant response + tool results to message history for next iteration
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: toolResults.map((r) => ({
        type: "tool_result" as const,
        tool_use_id: r.tool_use_id,
        content: r.content,
        ...(r.is_error ? { is_error: true } : {}),
      })),
    });
  }

  return { text: collectedText, pendingActions };
}
