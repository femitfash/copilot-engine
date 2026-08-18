import type { LLMConfig, TextBlock } from "./llm-types";
import { createProvider } from "./providers";

export interface HistoryMessage {
  role: string;
  content: string;
}

export interface HistorySplit {
  older: HistoryMessage[];
  recent: HistoryMessage[];
}

/**
 * Splits conversation history into an "older" portion (to be summarized)
 * and a "recent" portion (replayed verbatim). No-op when history already
 * fits within maxRecent.
 */
export function splitHistoryForSummary(
  history: HistoryMessage[],
  maxRecent: number
): HistorySplit {
  if (history.length <= maxRecent) {
    return { older: [], recent: history };
  }
  return {
    older: history.slice(0, history.length - maxRecent),
    recent: history.slice(history.length - maxRecent),
  };
}

const SUMMARY_FALLBACK = "[Earlier conversation history could not be summarized.]";

const SUMMARY_SYSTEM_PROMPT =
  "Summarize the following conversation between a user and an AI assistant. " +
  "Capture key facts, decisions, and unresolved questions the user raised. " +
  "Be concise (a few sentences to a short paragraph) — this summary replaces " +
  "the full conversation history for context, so preserve anything the assistant " +
  "would need to remember.";

/**
 * Condenses the "older" slice of history into a short summary via a single,
 * non-agentic LLM call. Falls back to a static placeholder on failure so a
 * summarization error never surfaces as the request-too-large error itself.
 */
export async function summarizeOlderHistory(
  older: HistoryMessage[],
  config: LLMConfig
): Promise<string> {
  if (older.length === 0) return "";

  try {
    const provider = createProvider(config);
    const transcript = older.map((m) => `${m.role}: ${m.content}`).join("\n\n");

    const response = await provider.createMessage({
      model: config.model,
      maxTokens: 1024,
      system: SUMMARY_SYSTEM_PROMPT,
      tools: [],
      messages: [{ role: "user", content: transcript }],
    });

    const text = response.content
      .filter((b): b is TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return text.trim() || SUMMARY_FALLBACK;
  } catch (err) {
    console.error("History summarization failed:", err);
    return SUMMARY_FALLBACK;
  }
}
