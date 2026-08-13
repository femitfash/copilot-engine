import { Router, Request, Response } from "express";
import { runAgenticLoop } from "./agentic-loop";
import { streamWords, sendDone, sendError } from "./sse-stream";
import type { ProjectConfig } from "./project-config";
import type { LLMConfig } from "./llm-types";

/**
 * Create the SSE copilot chat route.
 * POST {basePath} — streams LLM response with tool use.
 */
export function createCopilotRoute(project: ProjectConfig): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

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
      const modeInstruction = project.getResponseModeInstruction(responseMode);
      const fullPrompt = project.systemPrompt + contextBlock + modeInstruction;

      const config = project.getConfig();
      const identity = (req as any).aisoarIdentity;
      const ctx = { userToken, identity, config };

      let llmConfig: LLMConfig | undefined;
      if (project.resolveLlmConfig) {
        const resolution = await project.resolveLlmConfig({
          identity,
          headers: {
            "x-copilot-provider-id": req.headers["x-copilot-provider-id"] as string | undefined,
          },
        });
        if (resolution.status === "not_configured") {
          clearTimeout(timeout);
          sendError(
            res,
            "No LLM provider is configured for this workspace.",
            "llm_not_configured"
          );
          return;
        }
        llmConfig = resolution.config;
      }

      // Let client know we're processing
      res.write(`data: ${JSON.stringify({ type: "text", text: "" })}\n\n`);

      // Run agentic loop
      const result = await runAgenticLoop(
        fullPrompt,
        message,
        history || [],
        project.allTools,
        project.writeToolNames,
        project.executeReadTool,
        ctx,
        llmConfig
      );

      // Stream text word-by-word
      await streamWords(result.text, res);

      // Send done event with pending actions
      sendDone(res, result.pendingActions);
    } catch (err: any) {
      console.error("Copilot error:", err.status || "", err.message || err);
      let userMessage = "Internal server error";
      let code: string | undefined;
      if (err.status === 400) {
        userMessage = "The request was too large. Please clear the conversation and try again.";
      } else if (err.status === 429) {
        userMessage = "Rate limited — please wait a moment and try again.";
      } else if (err.status === 401 || err.status === 403) {
        userMessage = "LLM API key is invalid or expired.";
        code = "llm_auth_failed";
      } else if (err.message) {
        userMessage = err.message;
      }
      sendError(res, userMessage, code);
    } finally {
      clearTimeout(timeout);
    }
  });

  return router;
}

/**
 * Create the action execution route.
 * POST {basePath}/execute — executes a WRITE tool after user approval.
 */
export function createExecuteRoute(project: ProjectConfig): Router {
  const router = Router();

  router.post("/execute", async (req: Request, res: Response) => {
    try {
      const { toolCallId, name, input } = req.body;
      const userToken = (req as any).userToken;

      if (!userToken) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!name || !input) {
        res.status(400).json({ error: "Missing required fields: name, input" });
        return;
      }

      const config = project.getConfig();
      const identity = (req as any).aisoarIdentity;
      const ctx = { userToken, identity, toolCallId, config };

      const result = await project.executeWriteTool(name, input, ctx);

      res.json({ success: true, result, toolCallId });
    } catch (err: any) {
      console.error("Execute error:", err);
      res.status(500).json({ error: err.message || "Execution failed" });
    }
  });

  return router;
}
