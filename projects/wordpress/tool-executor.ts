import { getPatternCatalog, assemblePage } from "./pattern-engine";

export interface ToolExecutionContext {
  userToken: string;
  config: {
    wpApiUrl: string;
    wpPatternsDir: string;
    wpThemeUrl: string;
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
  if (!userToken || userToken.trim() === "") {
    return JSON.stringify({
      error: true,
      message: "WordPress auth token is not configured. Go to Settings → Copilot in wp-admin and set your Application Password token.",
    });
  }

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
      return wpApi(`${api}/posts/${input.id}?context=edit`, { method: "GET" }, ctx.userToken);

    case "get_page":
      return wpApi(`${api}/pages/${input.id}?context=edit`, { method: "GET" }, ctx.userToken);

    case "list_pages": {
      const q = buildQuery({
        per_page: input.per_page || 10,
        status: input.status,
        search: input.search,
        _fields: "id,title,status,link,date,modified",
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

    case "list_patterns": {
      try {
        const catalog = getPatternCatalog(
          ctx.config.wpPatternsDir,
          ctx.config.wpThemeUrl
        );
        let filtered = catalog;
        if (input.category) {
          const cat = String(input.category).toLowerCase();
          filtered = catalog.filter((p) =>
            p.categories.some((c) => c.toLowerCase().includes(cat))
          );
        }
        // Return compact format to stay within 8KB
        const compact = filtered.map((p) => ({
          slug: p.slug,
          title: p.title,
          categories: p.categories,
          description: p.description,
          slots: p.slots.map((s) => s.key),
        }));
        return truncate(JSON.stringify(compact));
      } catch (err: any) {
        return JSON.stringify({ error: true, message: err.message });
      }
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

    case "update_page": {
      const { id: pageId, ...pageData } = input;
      return wpApi(
        `${api}/pages/${pageId}`,
        { method: "POST", body: JSON.stringify(pageData) },
        ctx.userToken
      );
    }

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

    case "export_to_fastgrc": {
      const fastgrcUrl = ctx.config.fastgrcApiUrl || "https://www.fastgrc.ai";
      try {
        const res = await fetch(`${fastgrcUrl}/api/v1/wordpress-signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: input.email,
            findings: input.findings,
            site_url: input.site_url || ctx.config.wpApiUrl,
            site_name: input.site_name || "WordPress Site",
          }),
        });
        const data = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          throw new Error((data.error as string) || `FastGRC API returned ${res.status}`);
        }
        return JSON.stringify(data);
      } catch (err: any) {
        throw new Error(`FastGRC export failed: ${err.message}`);
      }
    }

    case "build_page": {
      try {
        const sections = (input.sections as Array<{ pattern: string; content?: Record<string, string> }>) || [];
        const pageContent = assemblePage(
          ctx.config.wpPatternsDir,
          ctx.config.wpThemeUrl,
          sections
        );

        const pageData: Record<string, unknown> = {
          title: input.title,
          content: pageContent,
          status: input.status || "draft",
        };

        if (input.page_id) {
          // Update existing page
          return wpApi(
            `${api}/pages/${input.page_id}`,
            { method: "POST", body: JSON.stringify(pageData) },
            ctx.userToken
          );
        } else {
          // Create new page
          return wpApi(
            `${api}/pages`,
            { method: "POST", body: JSON.stringify(pageData) },
            ctx.userToken
          );
        }
      } catch (err: any) {
        throw new Error(`build_page failed: ${err.message}`);
      }
    }

    default:
      throw new Error(`Unknown write tool: ${toolName}`);
  }
}
