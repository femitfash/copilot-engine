/**
 * Standalone execute route — uses the active project's imports directly.
 * For built-in mode, use mountCopilot() from src/mount.ts instead.
 */
import { createExecuteRoute } from "../src/engine/route-factories";
import { project } from "./copilot";

const router = createExecuteRoute(project);

export default router;
