import Anthropic from "@anthropic-ai/sdk";

const MAX_ITERATIONS = 4;
const MODEL = "claude-sonnet-4-20250514";
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
  tools: Anthropic.Tool[],
  writeToolNames: Set<string>,
  executeReadTool: (
    name: string,
    input: Record<string, unknown>,
    ctx: any
  ) => Promise<string>,
  ctx: any
): Promise<AgenticResult> {
  const client = new Anthropic();
  const pendingActions: PendingAction[] = [];
  let collectedText = "";

  // Build messages array
  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
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
      (b): b is Anthropic.ContentBlockParam & { type: "tool_use" } =>
        b.type === "tool_use"
    );

    if (toolUseBlocks.length === 0 || response.stop_reason !== "tool_use") {
      break; // No more tool calls, we're done
    }

    // Process tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolCall of toolUseBlocks) {
      if (writeToolNames.has(toolCall.name)) {
        // WRITE tool: queue for approval, do NOT execute
        pendingActions.push({
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.input as Record<string, unknown>,
          status: "pending",
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolCall.id,
          content:
            "ACTION NOT YET EXECUTED. This action has been QUEUED for user approval. " +
            "Do NOT say it was completed. Tell the user it's been queued and they can approve it.",
        });
      } else {
        // READ tool: execute immediately and feed result back
        try {
          const result = await executeReadTool(
            toolCall.name,
            toolCall.input as Record<string, unknown>,
            ctx
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolCall.id,
            content: truncateResult(result),
          });
        } catch (err: any) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolCall.id,
            content: `Error executing ${toolCall.name}: ${err.message}`,
            is_error: true,
          });
        }
      }
    }

    // Add assistant response + tool results to message history for next iteration
    messages.push({ role: "assistant", content: response.content as any });
    messages.push({ role: "user", content: toolResults });
  }

  return { text: collectedText, pendingActions };
}
