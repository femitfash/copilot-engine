/**
 * Offline checks for src/engine/agentic-loop.ts — no API key or server needed.
 * Swaps providers.createProvider for a scripted fake, then asserts the loop's exit behavior:
 * iteration cap notice, max_tokens handling, text separation, and the normal path.
 * Run: npx ts-node tools/verify-agentic-loop.ts
 */
import assert from "node:assert/strict";
import * as providers from "../src/engine/providers";
import { runAgenticLoop } from "../src/engine/agentic-loop";
import type { LLMConfig, LLMProvider, LLMResponse, Tool } from "../src/engine/llm-types";

const CONFIG = { provider: "anthropic", model: "fake", apiKey: "fake" } as unknown as LLMConfig;
const TOOLS: Tool[] = [];

function scripted(next: (call: number) => LLMResponse): { provider: LLMProvider; calls: () => number } {
  let n = 0;
  return {
    provider: { createMessage: async () => next(n++) },
    calls: () => n,
  };
}

async function run(fake: { provider: LLMProvider }): Promise<{ text: string; executed: number }> {
  (providers as { createProvider: unknown }).createProvider = () => fake.provider;
  let executed = 0;
  const result = await runAgenticLoop(
    "system",
    "user message",
    [],
    TOOLS,
    new Set<string>(),
    async () => {
      executed++;
      return "{}";
    },
    {},
    CONFIG
  );
  return { text: result.text, executed };
}

async function main(): Promise<void> {
  // 1. Always asking for another tool call -> hits the cap, says so, and separates iterations.
  const looping = scripted((i) => ({
    content: [
      { type: "text", text: `round ${i + 1}` },
      { type: "tool_use", id: `t${i}`, name: "read_thing", input: {} },
    ],
    stopReason: "tool_use",
  }));
  const capped = await run(looping);
  assert.equal(looping.calls(), 12, "loop should stop at the 12-iteration cap");
  assert.match(capped.text, /step limit/, "cap must be announced to the user");
  assert.match(capped.text, /round 1\n\nround 2/, "iteration text must be separated by a blank line");
  console.log("✅  iteration cap: stops at 12, announces it, separates text");

  // 2. Truncated reply carrying a (possibly cut-off) tool call -> not executed, user told.
  const truncated = scripted(() => ({
    content: [
      { type: "text", text: "Let me patch that" },
      { type: "tool_use", id: "t0", name: "read_thing", input: {} },
    ],
    stopReason: "max_tokens",
  }));
  const cut = await run(truncated);
  assert.equal(cut.executed, 0, "tool calls from a truncated reply must not run");
  assert.match(cut.text, /cut off/, "truncation must be announced");
  console.log("✅  max_tokens: tool call skipped, truncation announced");

  // 3. Normal path: one tool round then a final answer -> no notices.
  const normal = scripted((i) =>
    i === 0
      ? { content: [{ type: "tool_use", id: "t0", name: "read_thing", input: {} }], stopReason: "tool_use" }
      : { content: [{ type: "text", text: "All done." }], stopReason: "end_turn" }
  );
  const ok = await run(normal);
  assert.equal(ok.executed, 1);
  assert.equal(ok.text, "All done.", "a normal completion must carry no notice");
  console.log("✅  normal completion: unchanged");
}

main().catch((err) => {
  console.error("❌  agentic-loop verification failed:", err);
  process.exit(1);
});
