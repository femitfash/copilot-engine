/**
 * Lightweight, in-memory "what is Copilot doing right now" side-channel.
 *
 * The main SSE response (route-factories.ts) writes nothing to the client
 * until the whole agentic loop finishes — a request that polls a long-running
 * LaunchPad test run to completion can take real wall-clock time with no
 * visible progress. Rather than change how the primary response streams (the
 * client deliberately buffers it via res.text(), not incremental reads, for
 * Windows compatibility — see copilot-service.ts), this store lets the client
 * poll a separate, cheap GET for the latest tool-call status while it waits.
 *
 * Single-process, best-effort only: entries expire on their own (TTL) and a
 * lost entry just means the client falls back to a generic "thinking"
 * indicator, never a hard failure.
 */

export interface ProgressEntry {
  toolName: string;
  isWrite: boolean;
  summary?: string;
  at: number;
}

const TTL_MS = 5 * 60 * 1000;
const store = new Map<string, ProgressEntry>();

export function setProgress(
  conversationId: string | undefined,
  entry: Omit<ProgressEntry, "at">
): void {
  if (!conversationId) return;
  store.set(conversationId, { ...entry, at: Date.now() });
  sweep();
}

export function getProgress(conversationId: string | undefined): ProgressEntry | null {
  if (!conversationId) return null;
  const entry = store.get(conversationId);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    store.delete(conversationId);
    return null;
  }
  return entry;
}

export function clearProgress(conversationId: string | undefined): void {
  if (!conversationId) return;
  store.delete(conversationId);
}

function sweep(): void {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (now - entry.at > TTL_MS) store.delete(id);
  }
}
