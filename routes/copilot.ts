/**
 * Standalone copilot route — uses the active project's imports directly.
 * For built-in mode, use mountCopilot() from src/mount.ts instead.
 */
import {
  AISOAR_SYSTEM_PROMPT,
  getResponseModeInstruction,
} from "../projects/aisoar/system-prompt";
import {
  ALL_TOOLS,
  WRITE_TOOL_NAMES,
} from "../projects/aisoar/tools";
import { executeReadTool, executeWriteTool } from "../projects/aisoar/tool-executor";
import { getConfig } from "../src/config";
import { createCopilotRoute } from "../src/engine/route-factories";
import type { ProjectConfig } from "../src/engine/project-config";

const project: ProjectConfig = {
  systemPrompt: AISOAR_SYSTEM_PROMPT,
  getResponseModeInstruction,
  allTools: ALL_TOOLS,
  writeToolNames: WRITE_TOOL_NAMES,
  executeReadTool,
  executeWriteTool,
  getConfig: getConfig as () => Record<string, string>,
};

// Create router at /api/copilot path for standalone mode
const router = createCopilotRoute(project);

export default router;
export { project };
