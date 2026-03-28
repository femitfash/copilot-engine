import type { Tool } from "../../src/engine/llm-types";

// ─── READ Tools (auto-execute in agentic loop) ─────────────────────────────

export const READ_TOOLS: Tool[] = [
  // ── Site Info ──
  {
    name: "get_site_settings",
    description:
      "Get WordPress site settings including title, tagline, URL, timezone, date/time format, and language. Use this to understand the site's basic configuration.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_site_health",
    description:
      "Get WordPress Site Health status including critical issues, recommended improvements, and passed tests. Shows PHP version, database status, HTTPS, and update connectivity.",
    input_schema: { type: "object", properties: {}, required: [] },
  },

  // ── Content ──
  {
    name: "list_posts",
    description:
      "List WordPress posts with optional filters. Returns title, status, date, author, categories, and excerpt.",
    input_schema: {
      type: "object",
      properties: {
        per_page: { type: "number", description: "Posts per page (default 10, max 100)" },
        page: { type: "number", description: "Page number for pagination" },
        status: { type: "string", description: "Filter by status: publish, draft, pending, private, trash" },
        search: { type: "string", description: "Search posts by keyword" },
        categories: { type: "string", description: "Filter by category ID(s), comma-separated" },
        orderby: { type: "string", description: "Sort by: date, title, modified, id (default: date)" },
        order: { type: "string", description: "Sort order: asc or desc (default: desc)" },
      },
      required: [],
    },
  },
  {
    name: "get_post",
    description: "Get a specific WordPress post by ID, including full content, meta, categories, and tags.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Post ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_pages",
    description: "List WordPress pages with optional filters.",
    input_schema: {
      type: "object",
      properties: {
        per_page: { type: "number", description: "Pages per page (default 10)" },
        status: { type: "string", description: "Filter by status: publish, draft, pending, private" },
        search: { type: "string", description: "Search pages by keyword" },
      },
      required: [],
    },
  },

  // ── Categories & Tags ──
  {
    name: "list_categories",
    description: "List all WordPress categories with post counts.",
    input_schema: {
      type: "object",
      properties: {
        per_page: { type: "number", description: "Items per page (default 100)" },
      },
      required: [],
    },
  },
  {
    name: "list_tags",
    description: "List all WordPress tags with post counts.",
    input_schema: {
      type: "object",
      properties: {
        per_page: { type: "number", description: "Items per page (default 100)" },
      },
      required: [],
    },
  },

  // ── Media ──
  {
    name: "list_media",
    description: "List media library items (images, documents, videos). Returns filename, URL, dimensions, and file size.",
    input_schema: {
      type: "object",
      properties: {
        per_page: { type: "number", description: "Items per page (default 10)" },
        media_type: { type: "string", description: "Filter by type: image, video, audio, application" },
        search: { type: "string", description: "Search media by filename or title" },
      },
      required: [],
    },
  },

  // ── Users ──
  {
    name: "list_users",
    description: "List WordPress users with roles and registration dates. Requires admin capabilities.",
    input_schema: {
      type: "object",
      properties: {
        per_page: { type: "number", description: "Users per page (default 10)" },
        roles: { type: "string", description: "Filter by role: administrator, editor, author, contributor, subscriber" },
      },
      required: [],
    },
  },
  {
    name: "get_current_user",
    description: "Get the currently authenticated user's profile, roles, and capabilities.",
    input_schema: { type: "object", properties: {}, required: [] },
  },

  // ── Comments ──
  {
    name: "list_comments",
    description: "List WordPress comments with optional filters.",
    input_schema: {
      type: "object",
      properties: {
        per_page: { type: "number", description: "Comments per page (default 10)" },
        status: { type: "string", description: "Filter by status: approved, hold, spam, trash" },
        post: { type: "number", description: "Filter by post ID" },
      },
      required: [],
    },
  },

  // ── Plugins & Themes ──
  {
    name: "list_plugins",
    description:
      "List all installed WordPress plugins with status (active/inactive), version, and update availability. Use this to check what's installed and if anything needs updating.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_themes",
    description:
      "List installed WordPress themes with active status, version, and type (block/classic).",
    input_schema: { type: "object", properties: {}, required: [] },
  },

  // ── Menus ──
  {
    name: "list_menus",
    description: "List WordPress navigation menus and their locations.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

// ─── WRITE Tools (queued for user approval) ─────────────────────────────────

export const WRITE_TOOLS: Tool[] = [
  // ── Content ──
  {
    name: "create_post",
    description:
      "Create a new WordPress post. Content can be plain text or block markup. Set status to 'draft' to save without publishing.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Post title" },
        content: { type: "string", description: "Post content (HTML or block markup)" },
        status: {
          type: "string",
          enum: ["publish", "draft", "pending", "private"],
          description: "Post status (default: draft)",
        },
        categories: {
          type: "array",
          items: { type: "number" },
          description: "Category IDs to assign",
        },
        tags: {
          type: "array",
          items: { type: "number" },
          description: "Tag IDs to assign",
        },
        excerpt: { type: "string", description: "Post excerpt/summary" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "update_post",
    description: "Update an existing WordPress post (title, content, status, categories, etc.).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Post ID to update" },
        title: { type: "string", description: "New title" },
        content: { type: "string", description: "New content" },
        status: { type: "string", description: "New status: publish, draft, pending, private, trash" },
        categories: { type: "array", items: { type: "number" }, description: "Category IDs" },
        tags: { type: "array", items: { type: "number" }, description: "Tag IDs" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_post",
    description: "Move a WordPress post to trash (or permanently delete if already trashed).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Post ID to delete" },
        force: { type: "boolean", description: "Permanently delete instead of trashing (default: false)" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_page",
    description: "Create a new WordPress page.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Page title" },
        content: { type: "string", description: "Page content (HTML or block markup)" },
        status: { type: "string", enum: ["publish", "draft", "pending", "private"], description: "Page status (default: draft)" },
        parent: { type: "number", description: "Parent page ID for hierarchy" },
      },
      required: ["title", "content"],
    },
  },

  // ── Categories & Tags ──
  {
    name: "create_category",
    description: "Create a new WordPress category.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Category name" },
        description: { type: "string", description: "Category description" },
        parent: { type: "number", description: "Parent category ID" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_tag",
    description: "Create a new WordPress tag.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tag name" },
        description: { type: "string", description: "Tag description" },
      },
      required: ["name"],
    },
  },

  // ── Comments ──
  {
    name: "moderate_comment",
    description: "Approve, spam, or trash a comment.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Comment ID" },
        status: { type: "string", enum: ["approved", "hold", "spam", "trash"], description: "New comment status" },
      },
      required: ["id", "status"],
    },
  },

  // ── Plugins ──
  {
    name: "toggle_plugin",
    description: "Activate or deactivate a WordPress plugin.",
    input_schema: {
      type: "object",
      properties: {
        plugin: { type: "string", description: "Plugin slug (e.g., 'akismet/akismet.php')" },
        action: { type: "string", enum: ["activate", "deactivate"], description: "Action to perform" },
      },
      required: ["plugin", "action"],
    },
  },

  // ── Settings ──
  {
    name: "update_site_settings",
    description: "Update WordPress site settings (title, tagline, timezone, etc.).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Site title" },
        description: { type: "string", description: "Site tagline" },
        timezone_string: { type: "string", description: "Timezone (e.g., 'America/New_York')" },
        date_format: { type: "string", description: "Date format (e.g., 'F j, Y')" },
        time_format: { type: "string", description: "Time format (e.g., 'g:i a')" },
      },
      required: [],
    },
  },

  // ── Users ──
  {
    name: "create_user",
    description: "Create a new WordPress user account.",
    input_schema: {
      type: "object",
      properties: {
        username: { type: "string", description: "Login username" },
        email: { type: "string", description: "User email address" },
        password: { type: "string", description: "User password" },
        roles: { type: "array", items: { type: "string" }, description: "User roles (e.g., ['editor'])" },
        first_name: { type: "string", description: "First name" },
        last_name: { type: "string", description: "Last name" },
      },
      required: ["username", "email", "password"],
    },
  },
];

export const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));
export const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];
