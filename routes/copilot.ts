/**
 * Standalone copilot route — uses the active project's imports directly.
 * For built-in mode (e.g. AISOAR's own server), use mountCopilot() from
 * src/mount.ts instead — this file only serves copilot-engine running as
 * its own standalone process.
 *
 * Select the project with COPILOT_PROJECT=wordpress|aisoar (defaults to
 * "wordpress" to preserve existing standalone-mode behavior).
 */
import { createCopilotRoute } from "../src/engine/route-factories";
import type { ProjectConfig } from "../src/engine/project-config";

import {
  SYSTEM_PROMPT as WORDPRESS_SYSTEM_PROMPT,
  getResponseModeInstruction as wordpressResponseModeInstruction,
} from "../projects/wordpress/system-prompt";
import {
  ALL_TOOLS as WORDPRESS_ALL_TOOLS,
  WRITE_TOOL_NAMES as WORDPRESS_WRITE_TOOL_NAMES,
} from "../projects/wordpress/tools";
import {
  executeReadTool as wordpressExecuteReadTool,
  executeWriteTool as wordpressExecuteWriteTool,
} from "../projects/wordpress/tool-executor";
import { getConfig as getWordpressConfig } from "../src/config";

import {
  AISOAR_SYSTEM_PROMPT,
  getResponseModeInstruction as aisoarResponseModeInstruction,
} from "../projects/aisoar/system-prompt";
import {
  ALL_TOOLS as AISOAR_ALL_TOOLS,
  WRITE_TOOL_NAMES as AISOAR_WRITE_TOOL_NAMES,
} from "../projects/aisoar/tools";
import {
  executeReadTool as aisoarExecuteReadTool,
  executeWriteTool as aisoarExecuteWriteTool,
} from "../projects/aisoar/tool-executor";
import { getConfig as getAisoarConfig } from "../projects/aisoar/config";

const PROJECTS: Record<string, ProjectConfig> = {
  wordpress: {
    systemPrompt: WORDPRESS_SYSTEM_PROMPT,
    getResponseModeInstruction: wordpressResponseModeInstruction,
    allTools: WORDPRESS_ALL_TOOLS,
    writeToolNames: WORDPRESS_WRITE_TOOL_NAMES,
    executeReadTool: wordpressExecuteReadTool,
    executeWriteTool: wordpressExecuteWriteTool,
    getConfig: getWordpressConfig as () => Record<string, string>,
  },
  aisoar: {
    systemPrompt: AISOAR_SYSTEM_PROMPT,
    getResponseModeInstruction: aisoarResponseModeInstruction,
    allTools: AISOAR_ALL_TOOLS,
    writeToolNames: AISOAR_WRITE_TOOL_NAMES,
    executeReadTool: aisoarExecuteReadTool as ProjectConfig["executeReadTool"],
    executeWriteTool: aisoarExecuteWriteTool as ProjectConfig["executeWriteTool"],
    getConfig: getAisoarConfig,
  },
};

const project: ProjectConfig = PROJECTS[process.env.COPILOT_PROJECT || "wordpress"];

// Create router at /api/copilot path for standalone mode
const router = createCopilotRoute(project);

export default router;
export { project };
