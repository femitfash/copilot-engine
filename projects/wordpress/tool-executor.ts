export interface ToolExecutionContext {
  userToken: string;
  config: {
    wpApiUrl: string;
    [key: string]: string;
  };
}

const MAX_RESULT_SIZE = 8000;

function truncate(json: string): string {
  if (json.length <= MAX_RESULT_SIZE) return json;
  return json.substring(0, MAX_RESULT_SIZE) + '..."truncated"}';
}

/**
 * WordPress REST API call helper.
 * Uses Application Password auth (Basic Auth with username:app_password).
 */
async function wpApi(
  url: string,
  options: RequestInit,
  userToken: string
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Basic ${userToken}`,
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
    });

    // Handle empty responses (204, etc.)
    const text = await res.text();
    if (!text) {
      return JSON.stringify({ status: res.status, message: res.statusText || "No content" });
    }

    try {
      const data = JSON.parse(text);
      if (!res.ok) {
        return truncate(JSON.stringify({ error: true, status: res.status, message: data.message || res.statusText, code: data.code }));
      }
      return truncate(JSON.stringify(data));
    } catch {
      return truncate(JSON.stringify({ status: res.status, body: text.substring(0, 500) }));
    }
  } catch (err: any) {
    return JSON.stringify({ error: true, message: err.message });
  }
}

function buildQuery(params: Record<string, unknown>): string {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return query ? `?${query}` : "";
}

// ─── READ Tool Executor ─────────────────────────────────────────────────

export async function executeReadTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<string> {
  const base = ctx.config.wpApiUrl;
  const api = `${base}/wp-json/wp/v2`;

  switch (toolName) {
    case "get_site_settings":
      return wpApi(`${api}/settings`, { method: "GET" }, ctx.userToken);

    case "get_site_health": {
      // Site health endpoint is under a different namespace
      const healthUrl = `${base}/wp-json/wp-site-health/v1/tests`;
      return wpApi(healthUrl, { method: "GET" }, ctx.userToken);
    }

    case "list_posts": {
      const q = buildQuery({
        per_page: input.per_page || 10,
        page: input.page,
        status: input.status,
        search: input.search,
        categories: input.categories,
        orderby: input.orderby,
        order: input.order,
      });
      return wpApi(`${api}/posts${q}`, { method: "GET" }, ctx.userToken);
    }

    case "get_post":
      return wpApi(`${api}/posts/${input.id}`, { method: "GET" }, ctx.userToken);

    case "list_pages": {
      const q = buildQuery({
        per_page: input.per_page || 10,
        status: input.status,
        search: input.search,
      });
      return wpApi(`${api}/pages${q}`, { method: "GET" }, ctx.userToken);
    }

    case "list_categories": {
      const q = buildQuery({ per_page: input.per_page || 100 });
      return wpApi(`${api}/categories${q}`, { method: "GET" }, ctx.userToken);
    }

    case "list_tags": {
      const q = buildQuery({ per_page: input.per_page || 100 });
      return wpApi(`${api}/tags${q}`, { method: "GET" }, ctx.userToken);
    }

    case "list_media": {
      const q = buildQuery({
        per_page: input.per_page || 10,
        media_type: input.media_type,
        search: input.search,
      });
      return wpApi(`${api}/media${q}`, { method: "GET" }, ctx.userToken);
    }

    case "list_users": {
      const q = buildQuery({
        per_page: input.per_page || 10,
        roles: input.roles,
      });
      return wpApi(`${api}/users${q}`, { method: "GET" }, ctx.userToken);
    }

    case "get_current_user":
      return wpApi(`${api}/users/me?context=edit`, { method: "GET" }, ctx.userToken);

    case "list_comments": {
      const q = buildQuery({
        per_page: input.per_page || 10,
        status: input.status,
        post: input.post,
      });
      return wpApi(`${api}/comments${q}`, { method: "GET" }, ctx.userToken);
    }

    case "list_plugins":
      return wpApi(`${api}/plugins`, { method: "GET" }, ctx.userToken);

    case "list_themes":
      return wpApi(`${api}/themes`, { method: "GET" }, ctx.userToken);

    case "list_menus":
      return wpApi(`${api}/menu-locations`, { method: "GET" }, ctx.userToken);

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ─── WRITE Tool Executor (called after user approval) ───────────────────

export async function executeWriteTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<unknown> {
  const base = ctx.config.wpApiUrl;
  const api = `${base}/wp-json/wp/v2`;

  switch (toolName) {
    case "create_post":
      return wpApi(
        `${api}/posts`,
        { method: "POST", body: JSON.stringify({ ...input, status: input.status || "draft" }) },
        ctx.userToken
      );

    case "update_post": {
      const { id, ...data } = input;
      return wpApi(
        `${api}/posts/${id}`,
        { method: "POST", body: JSON.stringify(data) },
        ctx.userToken
      );
    }

    case "delete_post": {
      const q = input.force ? "?force=true" : "";
      return wpApi(
        `${api}/posts/${input.id}${q}`,
        { method: "DELETE" },
        ctx.userToken
      );
    }

    case "create_page":
      return wpApi(
        `${api}/pages`,
        { method: "POST", body: JSON.stringify({ ...input, status: input.status || "draft" }) },
        ctx.userToken
      );

    case "create_category":
      return wpApi(
        `${api}/categories`,
        { method: "POST", body: JSON.stringify(input) },
        ctx.userToken
      );

    case "create_tag":
      return wpApi(
        `${api}/tags`,
        { method: "POST", body: JSON.stringify(input) },
        ctx.userToken
      );

    case "moderate_comment":
      return wpApi(
        `${api}/comments/${input.id}`,
        { method: "POST", body: JSON.stringify({ status: input.status }) },
        ctx.userToken
      );

    case "toggle_plugin": {
      const action = input.action === "activate" ? "active" : "inactive";
      return wpApi(
        `${api}/plugins/${encodeURIComponent(String(input.plugin))}`,
        { method: "POST", body: JSON.stringify({ status: action }) },
        ctx.userToken
      );
    }

    case "update_site_settings":
      return wpApi(
        `${api}/settings`,
        { method: "POST", body: JSON.stringify(input) },
        ctx.userToken
      );

    case "create_user":
      return wpApi(
        `${api}/users`,
        { method: "POST", body: JSON.stringify(input) },
        ctx.userToken
      );

    default:
      throw new Error(`Unknown write tool: ${toolName}`);
  }
}
