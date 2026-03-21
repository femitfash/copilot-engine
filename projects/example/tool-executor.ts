/**
 * Example tool executor — replace API calls with your app's endpoints.
 *
 * The `ctx` object contains:
 *   - userToken: the user's auth token (forwarded from the frontend)
 *   - config: API URLs from environment variables (see src/config.ts)
 */

export interface ToolExecutionContext {
  userToken: string;
  config: {
    settingsApiUrl: string;
    [key: string]: string;
  };
}

// ─── READ Tool Executor ─────────────────────────────────────────────────

export async function executeReadTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${ctx.userToken}`,
    "Content-Type": "application/json",
  };

  switch (toolName) {
    case "get_settings": {
      const res = await fetch(`${ctx.config.settingsApiUrl}/api/settings`, {
        headers,
      });
      return JSON.stringify(await res.json());
    }

    case "list_items": {
      const limit = input.limit || 20;
      const res = await fetch(
        `${ctx.config.settingsApiUrl}/api/items?limit=${limit}`,
        { headers }
      );
      return JSON.stringify(await res.json());
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ─── WRITE Tool Executor (called after user approval) ───────────────────

export async function executeWriteTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${ctx.userToken}`,
    "Content-Type": "application/json",
  };

  switch (toolName) {
    case "create_item": {
      const res = await fetch(`${ctx.config.settingsApiUrl}/api/items`, {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      });
      return res.json();
    }

    case "update_settings": {
      const res = await fetch(`${ctx.config.settingsApiUrl}/api/settings`, {
        method: "PUT",
        headers,
        body: JSON.stringify(input.settings),
      });
      return res.json();
    }

    default:
      throw new Error(`Unknown write tool: ${toolName}`);
  }
}
