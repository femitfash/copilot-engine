import express, { Express, RequestHandler } from "express";
import cors from "cors";
import { validateToken } from "./auth/validate-token";
import { createCopilotRoute, createExecuteRoute } from "./engine/route-factories";
import type { ProjectConfig } from "./engine/project-config";

export interface MountOptions {
  /**
   * Base path for copilot routes.
   * Default: "/api/copilot"
   *
   * Routes created:
   *   POST {basePath}          — SSE chat
   *   POST {basePath}/execute  — action execution
   *   GET  {basePath}/health   — health check
   */
  basePath?: string;

  /**
   * Auth middleware. If provided, replaces the built-in validateToken.
   * Set to `false` to skip auth entirely (e.g., dev mode or app handles auth upstream).
   * Default: built-in token extractor (Bearer, Cookie, x-copilot-auth).
   */
  auth?: RequestHandler | false;

  /**
   * CORS origins for copilot routes.
   * Set to `false` if your app already handles CORS (default).
   * Pass an array of origins to add CORS middleware to copilot routes only.
   */
  cors?: string[] | false;

  /**
   * Add express.json() body parser to copilot routes.
   * Default: false (assumes your app already has a JSON body parser).
   */
  bodyParser?: boolean;
}

/**
 * Mount copilot routes onto an existing Express app.
 *
 * Usage:
 *   import { mountCopilot } from "./copilot";
 *   mountCopilot(app, project);
 *
 * Or with options:
 *   mountCopilot(app, project, { basePath: "/ai", auth: false });
 */
export function mountCopilot(
  app: Express,
  project: ProjectConfig,
  options: MountOptions = {}
): void {
  const basePath = options.basePath || "/api/copilot";

  // Optional CORS for copilot routes
  if (options.cors && Array.isArray(options.cors)) {
    app.use(
      basePath,
      cors({ origin: options.cors, credentials: true }) as RequestHandler
    );
  }

  // Optional body parser
  if (options.bodyParser) {
    app.use(basePath, express.json({ limit: "10mb" }));
  }

  // Auth middleware
  if (options.auth === false) {
    // Skip auth entirely
  } else if (typeof options.auth === "function") {
    app.use(basePath, options.auth);
  } else {
    app.use(basePath, validateToken);
  }

  // Mount route factories
  app.use(basePath, createCopilotRoute(project));
  app.use(basePath, createExecuteRoute(project));

  // Health check (no auth)
  app.get(`${basePath}/health`, (_req, res) => {
    res.json({ status: "ok", service: "copilot-engine", mode: "built-in" });
  });
}

export type { ProjectConfig } from "./engine/project-config";
export type { Tool } from "./engine/llm-types";
export type { PendingAction, AgenticResult } from "./engine/agentic-loop";
