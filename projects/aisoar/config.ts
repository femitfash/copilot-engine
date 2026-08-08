/**
 * Standalone-mode config for the AISOAR project. Only used when copilot-engine
 * runs as its own server (routes/copilot.ts, src/index.ts) against a remote
 * AISOAR instance over HTTP.
 *
 * When AISOAR mounts this project in-process via mountCopilot(), it supplies
 * its own getConfig() (including executeGovernedTool) instead of this file —
 * see server/index.ts. Standalone mode has no in-process governed executor to
 * inject, so WRITE tools that require one (run_sast_scan, run_dast_scan,
 * generate_report) will throw if invoked in that mode.
 */
export function getConfig() {
  return {
    aisoarApiUrl: process.env.AISOAR_API_URL || "http://localhost:5000",
  };
}
