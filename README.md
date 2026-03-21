# Copilot Engine

A reusable, project-agnostic backend for building Claude-powered AI copilots with agentic tool use, SSE streaming, and action approval workflows.

**Ships with:** agentic loop (up to 4 Claude iterations), READ/WRITE tool separation, word-by-word SSE streaming, auth middleware, and a pluggable project system — swap the system prompt, tools, and executor to adapt to any domain.

> Includes a reference implementation (`projects/zerotrusted/`) showing a production integration with the [ZeroTrusted AI Governance platform](https://zerotrusted.ai) — 14 READ + 10 WRITE tools covering PII detection, compliance, health checks, and more. Use `projects/example/` as a starter template for your own project.

---

## Quick Start

```bash
git clone https://github.com/femitfash/copilot-engine.git
cd copilot-engine
npm install
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY
npm run dev
# Server running on http://localhost:3100
```

Test it:

```bash
curl -N -X POST http://localhost:3100/api/copilot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{"message":"Hello","history":[],"responseMode":"concise","context":{}}'
```

---

## Architecture

```
User sends message
  → POST /api/copilot (SSE stream)
    → Auth middleware validates token
      → Build system prompt + context
        → Agentic loop (up to 4 iterations):
           READ tools  → auto-execute, feed result back to Claude
           WRITE tools → queue as pendingActions (NOT executed)
        → Collect final text
      → Stream response word-by-word via SSE
      → Send "done" event with pendingActions[]
    → User approves/rejects actions in frontend
  → POST /api/copilot/execute
    → Execute approved action against your API
    → Return result
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **READ/WRITE separation** | Read tools auto-execute safely; write tools require human approval |
| **SSE over WebSocket** | Simpler, HTTP-native, works through proxies and CDNs |
| **Pluggable projects** | Same engine serves multiple apps — only tools/prompt change |
| **Token forwarding** | Engine forwards user's auth token to your APIs — no separate auth |
| **Result truncation** | Tool results capped at 8KB to prevent Claude token overflow |

---

## Project Structure

```
copilot-engine/
├── src/
│   ├── index.ts                    # Express app, CORS, middleware
│   ├── config.ts                   # Environment → config object
│   ├── engine/
│   │   ├── agentic-loop.ts         # Claude API loop with tool routing
│   │   └── sse-stream.ts           # Word-by-word SSE streaming
│   └── auth/
│       └── validate-token.ts       # Bearer token extraction middleware
├── routes/
│   ├── copilot.ts                  # POST /api/copilot (SSE)
│   └── execute.ts                  # POST /api/copilot/execute
├── projects/
│   └── zerotrusted/                # Example project implementation
│       ├── system-prompt.ts        # Domain system prompt
│       ├── tools.ts                # READ + WRITE tool definitions
│       └── tool-executor.ts        # API call mappings
├── scaffold/
│   └── init.ts                     # CLI tool for frontend integration
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Creating a New Project

To adapt copilot-engine for your app, create a new directory under `projects/`:

### Step 1: System Prompt

```typescript
// projects/your-app/system-prompt.ts
export const SYSTEM_PROMPT = `You are the [Your App] Copilot...`;

export function getResponseModeInstruction(mode: string): string {
  switch (mode) {
    case "concise": return "\n\nKeep responses to 2-4 sentences.";
    case "detailed": return "\n\nProvide thorough explanations.";
    default: return "";
  }
}
```

### Step 2: Tool Definitions

```typescript
// projects/your-app/tools.ts
export const READ_TOOLS = [
  {
    name: "get_items",
    description: "List all items",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

export const WRITE_TOOLS = [
  {
    name: "create_item",
    description: "Create a new item",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
];

export const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map(t => t.name));
export const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];
```

### Step 3: Tool Executor

```typescript
// projects/your-app/tool-executor.ts
export async function executeReadTool(name: string, input: any, ctx: any): Promise<string> {
  const headers = { Authorization: `Bearer ${ctx.userToken}` };
  switch (name) {
    case "get_items":
      const res = await fetch(`${ctx.config.apiUrl}/items`, { headers });
      return JSON.stringify(await res.json());
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export async function executeWriteTool(name: string, input: any, ctx: any): Promise<any> {
  const headers = { Authorization: `Bearer ${ctx.userToken}`, "Content-Type": "application/json" };
  switch (name) {
    case "create_item":
      const res = await fetch(`${ctx.config.apiUrl}/items`, {
        method: "POST", headers, body: JSON.stringify(input),
      });
      return res.json();
    default:
      throw new Error(`Unknown write tool: ${name}`);
  }
}
```

### Step 4: Update Routes

In `routes/copilot.ts`, import your project's files instead of zerotrusted's:

```typescript
import { SYSTEM_PROMPT, getResponseModeInstruction } from "../projects/your-app/system-prompt";
import { ALL_TOOLS, WRITE_TOOL_NAMES } from "../projects/your-app/tools";
import { executeReadTool } from "../projects/your-app/tool-executor";
```

---

## Frontend Integration

### API Contract

#### `POST /api/copilot` — Chat (SSE)

**Request:**
```json
{
  "message": "What are my settings?",
  "conversationId": "uuid",
  "history": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }],
  "responseMode": "concise",
  "context": { "currentPage": "/dashboard" }
}
```

**SSE Response Events:**
```
data: {"type":"text","text":"Here "}
data: {"type":"text","text":"are "}
data: {"type":"text","text":"your "}
data: {"type":"text","text":"settings..."}
data: {"type":"done","pendingActions":[{"id":"toolu_123","name":"update_settings","input":{...},"status":"pending"}]}
```

#### `POST /api/copilot/execute` — Execute Approved Action

**Request:**
```json
{
  "toolCallId": "toolu_123",
  "name": "update_settings",
  "input": { "theme": "dark" }
}
```

**Response:**
```json
{ "success": true, "result": { ... }, "toolCallId": "toolu_123" }
```

### Frontend SSE Reader (Recommended Pattern)

```typescript
// Use response.text() — NOT ReadableStream reader (unreliable on Windows)
const response = await fetch(`${copilotUrl}/api/copilot`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ message, history, responseMode, context }),
});

const responseText = await response.text();
const lines = responseText.split('\n');

for (const line of lines) {
  if (!line.trim().startsWith('data: ')) continue;
  const data = JSON.parse(line.trim().slice(6));
  if (data.type === 'text') onChunk(data.text);
  else if (data.type === 'done') onDone(data.pendingActions || []);
  else if (data.type === 'error') onError(data.error);
}
```

### Inline Action Syntax

Claude's responses can include interactive elements:

```
[suggest:prompt text]Button Label[/suggest]     → Sends follow-up message
[navigate:/route-path]Go to Page[/navigate]     → Client-side navigation
```

Parse these BEFORE HTML-escaping in your frontend renderer.

---

## CLI Scaffold Tool

Quickly add copilot UI to any Angular application:

```bash
cd copilot-engine
npx ts-node scaffold/init.ts --app-path=/path/to/your/angular-app
```

This will:
1. Create copilot component files (panel, message, action-card, thinking)
2. Create copilot services (service, context, events)
3. Add translation keys to your i18n files
4. Add `CopilotApiUrl` to your config template
5. Print instructions for manual wiring (sidebar button, app.component integration)

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Claude API key |
| `PORT` | No | `3100` | Server port |
| `ALLOWED_ORIGINS` | No | `http://localhost:4000` | CORS origins (comma-separated) |
| Project-specific URLs | Depends | — | API endpoints your tools call |

---

## Known Issues

See [KNOWN-ISSUES.md](KNOWN-ISSUES.md) for comprehensive documentation of common pitfalls and their fixes, including:

- Token overflow from large API responses
- SSE streaming issues on Windows
- Angular dark mode with view encapsulation
- Font legibility in dark mode
- Z-index conflicts with host app menus

---

## License

MIT
