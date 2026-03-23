import { Router, Request, Response } from "express";
import { runAgenticLoop } from "../src/engine/agentic-loop";
import { streamWords, sendDone, sendError } from "../src/engine/sse-stream";
import {
  AISOAR_SYSTEM_PROMPT,
  getResponseModeInstruction,
} from "../projects/aisoar/system-prompt";
import {
  ALL_TOOLS,
  WRITE_TOOL_NAMES,
} from "../projects/aisoar/tools";
import { executeReadTool } from "../projects/aisoar/tool-executor";
import { getConfig } from "../src/config";

const router = Router();

router.post("/api/copilot", async (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders(); // Ensure headers are sent immediately so browser opens the stream

  const userToken = (req as any).userToken;

  if (!userToken) {
    sendError(res, "Unauthorized");
    return;
  }

  // 10-minute timeout
  const timeout = setTimeout(() => {
    sendError(res, "Request timed out");
  }, 600_000);

  try {
    const { message, conversationId, context, history, responseMode } =
      req.body;

    // Build context-enriched system prompt (limit context size)
    const contextJson = context ? JSON.stringify(context, null, 2) : "";
    const contextBlock = contextJson
      ? `\n\n## CURRENT CONTEXT\n${contextJson.substring(0, 2000)}`
      : "";
    const modeInstruction = getResponseModeInstruction(responseMode);
    const fullPrompt = AISOAR_SYSTEM_PROMPT + contextBlock + modeInstruction;

    const config = getConfig();
    const ctx = { userToken, config };

    // Let client know we're processing
    res.write(`data: ${JSON.stringify({ type: "text", text: "" })}\n\n`);

    // Run agentic loop
    const result = await runAgenticLoop(
      fullPrompt,
      message,
      history || [],
      ALL_TOOLS,
      WRITE_TOOL_NAMES,
      executeReadTool,
      ctx
    );

    // Stream text word-by-word
    await streamWords(result.text, res);

    // Send done event with pending actions
    sendDone(res, result.pendingActions);
  } catch (err: any) {
    console.error("Copilot error:", err.message || err);
    const userMessage = err.status === 400 && err.message?.includes("too long")
      ? "The request was too large. Please try a shorter message or clear the conversation."
      : (err.message || "Internal server error");
    sendError(res, userMessage);
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
