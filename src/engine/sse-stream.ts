import { Response } from "express";
import { PendingAction } from "./agentic-loop";

/**
 * Stream text word-by-word via SSE at ~40 words/second.
 * Returns a promise that resolves when streaming is complete.
 */
export function streamWords(text: string, res: Response): Promise<void> {
  return new Promise((resolve) => {
    if (!text) {
      resolve();
      return;
    }

    const words = text.split(/(\s+)/);
    let i = 0;

    const interval = setInterval(() => {
      if (i >= words.length) {
        clearInterval(interval);
        resolve();
        return;
      }

      const chunk = words[i];
      res.write(`data: ${JSON.stringify({ type: "text", text: chunk })}\n\n`);
      i++;
    }, 25);
  });
}

/**
 * Send the "done" event with any pending actions, then end the response.
 */
export function sendDone(res: Response, pendingActions: PendingAction[]): void {
  res.write(
    `data: ${JSON.stringify({ type: "done", pendingActions })}\n\n`
  );
  res.end();
}

/**
 * Send an error event and end the response.
 */
export function sendError(res: Response, error: string): void {
  res.write(`data: ${JSON.stringify({ type: "error", error })}\n\n`);
  res.end();
}
