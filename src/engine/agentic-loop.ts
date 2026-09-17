import type { Tool, Message, ToolResult, ToolUseBlock, LLMProvider, LLMConfig } from "./llm-types";
import { getLLMConfig, createProvider } from "./providers";
import { splitHistoryForSummary, summarizeOlderHistory } from "./history-summarizer";

const MAX_ITERATIONS = 6;
const MAX_TOOL_RESULT_CHARS = 8000;
const MAX_HISTORY_MESSAGES = 20;

// Best-effort, cheap extraction of a human-readable progress line from a
// tool's raw JSON result — only worth it for the handful of tools whose
// result shape commonly answers "how far along is this." Anything else
// (including a parse failure) just falls back to no summary; the caller
// still has the tool name.
function summarizeToolResult(result: string): string | undefined {
  try {
    const parsed = JSON.parse(result);
    if (parsed && typeof parsed === "object") {
      const status = typeof parsed.status === "string" ? parsed.status : undefined;
      const completed = typeof parsed.completedCount === "number" ? parsed.completedCount : undefined;
      const total = typeof parsed.unitCount === "number" ? parsed.unitCount : undefined;
      const score = parsed.score && typeof parsed.score.overall === "number" ? parsed.score.overall : undefined;
      const parts: string[] = [];
      if (status) parts.push(status);
      if (completed !== undefined && total !== undefined) parts.push(`${completed}/${total} units done`);
      if (score !== undefined) parts.push(`score ${score}`);
      if (parts.length > 0) return parts.join(" — ");
    }
  } catch {
    // not JSON, or not the shape we know how to summarize — fine
  }
  return undefined;
}

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

export interface ToolProgress {
  toolName: string;
  isWrite: boolean;
  summary?: string;
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
  ctx: any,
  llmConfig?: LLMConfig,
  onProgress?: (progress: ToolProgress) => void
): Promise<AgenticResult> {
  const config = llmConfig ?? getLLMConfig();
  const provider: LLMProvider = createProvider(config);
  const pendingActions: PendingAction[] = [];
  let collectedText = "";

  // Build messages array — cap replayed history and summarize anything
  // dropped so long conversations don't overflow the model's context window.
  const { older, recent } = splitHistoryForSummary(history, MAX_HISTORY_MESSAGES);
  const summaryMessages: Message[] = [];
  if (older.length > 0) {
    const summary = await summarizeOlderHistory(older, config);
    summaryMessages.push({
      role: "user",
      content: `[CONVERSATION SUMMARY — earlier messages, condensed for context]\n${summary}`,
    });
  }

  const messages: Message[] = [
    ...summaryMessages,
    ...recent.map((m) => ({
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
        onProgress?.({ toolName: toolCall.name, isWrite: true });
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
          onProgress?.({
            toolName: toolCall.name,
            isWrite: false,
            summary: summarizeToolResult(result),
          });
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
