import { Router, Request, Response } from "express";
import { executeWriteTool } from "../projects/aisoar/tool-executor";
import { getConfig } from "../src/config";

const router = Router();

router.post("/api/copilot/execute", async (req: Request, res: Response) => {
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

    const config = getConfig();
    const ctx = { userToken, config };

    const result = await executeWriteTool(name, input, ctx);

    res.json({ success: true, result, toolCallId });
  } catch (err: any) {
    console.error("Execute error:", err);
    res.status(500).json({ error: err.message || "Execution failed" });
  }
});

export default router;
