import type { LLMConfig, Tool } from "./llm-types";

export type LlmResolution =
  | { status: "ok"; config: LLMConfig }
  | { status: "not_configured" };

/**
 * Project-specific configuration injected into copilot routes.
 *
 * In standalone mode, this is assembled from projects/{app}/ imports.
 * In built-in mode, this is assembled from src/copilot/ files.
 */
export interface ProjectConfig {
  /** Domain-specific system prompt for the LLM */
  systemPrompt: string;

  /** Returns additional instruction text based on response mode (concise, detailed, actions) */
  getResponseModeInstruction: (mode: string) => string;

  /** All tool definitions (READ + WRITE) */
  allTools: Tool[];

  /** Names of tools that require user approval before execution */
  writeToolNames: Set<string>;

  /** Executes a READ tool and returns the result as a string */
  executeReadTool: (
    name: string,
    input: Record<string, unknown>,
    ctx: any
  ) => Promise<string>;

  /** Executes a WRITE tool (after user approval) and returns the result */
  executeWriteTool: (
    name: string,
    input: Record<string, unknown>,
    ctx: any
  ) => Promise<unknown>;

  /** Returns project-specific API configuration (URLs, etc.) */
  getConfig: () => Record<string, unknown>;

  /**
   * Resolves the LLM provider/model/key to use for this request.
   * Optional — when omitted, the engine falls back to env-var-based
   * `getLLMConfig()` for backward compatibility with projects that don't
   * have a per-tenant credential store (e.g. `projects/wordpress`,
   * `projects/example`).
   */
  resolveLlmConfig?: (ctx: {
    identity: any;
    headers: Record<string, string | undefined>;
  }) => Promise<LlmResolution>;
}
