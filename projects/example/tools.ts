import Anthropic from "@anthropic-ai/sdk";

/**
 * Example tool definitions — replace with your app's domain tools.
 *
 * READ tools: auto-execute in the agentic loop, results fed back to Claude
 * WRITE tools: queued as pendingActions, shown to user for approval
 */

export const READ_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_settings",
    description: "Get the user's current application settings",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_items",
    description: "List all items in the user's workspace",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max items to return (default 20)",
        },
      },
      required: [],
    },
  },
];

export const WRITE_TOOLS: Anthropic.Tool[] = [
  {
    name: "create_item",
    description: "Create a new item in the workspace",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Item name" },
        description: { type: "string", description: "Item description" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_settings",
    description: "Update application settings",
    input_schema: {
      type: "object" as const,
      properties: {
        settings: {
          type: "object",
          description: "Settings object with fields to update",
        },
      },
      required: ["settings"],
    },
  },
];

export const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));
export const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];
