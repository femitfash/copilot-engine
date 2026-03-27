# Architecture — Copilot Engine

## Data Flow

```
User Message (HTTP POST /api/copilot)
    │
    ▼
validateToken middleware (src/auth/validate-token.ts)
    │  Bearer token | Session cookie | x-copilot-auth dev header
    │
    ▼
routes/copilot.ts
    │  Sets SSE headers, flushes immediately
    │  Builds enriched system prompt (caps context at 2000 chars)
    │
    ▼
src/engine/agentic-loop.ts  ──── up to 4 iterations ────┐
    │                                                      │
    │  Call LLM via provider adapter                       │
    │  (Anthropic or OpenAI — set via LLM_PROVIDER)       │
    │  with system prompt + user message + history         │
    │                                                      │
    │  ┌──── tool_use block? ────┐                        │
    │  │                         │                        │
    │  ▼ READ tool               ▼ WRITE tool             │
    │  Execute immediately       Queue as pendingAction   │
    │  via executeReadTool()     Feed back "NOT YET       │
    │  Truncate to 8000 chars    EXECUTED" message        │
    │  Feed result back          to the LLM                │
    │                                                      │
    └──────────────────── loop ───────────────────────────┘
    │
    ▼
Returns { text: string, pendingActions: PendingAction[] }
    │
    ▼
src/engine/sse-stream.ts
    │  streamWords() — word-by-word at ~40 words/sec
    │  sendDone()   — final event with pendingActions array
    │
    ▼
Frontend receives SSE events:
    {"type":"text","text":"word"}       ← streamed live
    {"type":"done","pendingActions":[]} ← final
```

## Action Approval Flow

```
Frontend shows action cards (WRITE tools) from pendingActions
    │
    ▼
User clicks Approve
    │
    ▼
POST /api/copilot/execute  (routes/execute.ts)
    │  body: { toolCallId, name, input }
    │
    ▼
executeWriteTool()  (projects/{app}/tool-executor.ts)
    │  Makes actual API call to backend
    │
    ▼
Returns { success: true, result, toolCallId }
```

## Pluggable Projects Pattern

Each `projects/{name}/` directory contains exactly three files:

| File | Exports | Purpose |
|------|---------|---------|
| `system-prompt.ts` | `SYSTEM_PROMPT: string` | Domain-specific LLM instructions |
| `tools.ts` | `ALL_TOOLS`, `WRITE_TOOL_NAMES` | Tool definitions (provider-agnostic format) |
| `tool-executor.ts` | `executeReadTool`, `executeWriteTool` | API call implementations |

To add a new project:
1. Copy `projects/example/` to `projects/{your-app}/`
2. Update the `import` statements in `routes/copilot.ts` and `routes/execute.ts`
3. Restart the dev server

## Key Design Decisions

- **SSE over WebSocket** — simpler, HTTP-native, no upgrade handshake, works through all proxies
- **READ/WRITE separation** — READ tools are safe to auto-execute; WRITE tools require user approval (safety + UX)
- **Token forwarding** — the user's auth token/cookie is forwarded to every API call in the tool executor
- **LLM-agnostic** — provider abstraction layer supports Anthropic and OpenAI; swap with one env var
- **Result truncation** — all tool results are capped at 8000 chars to prevent LLM token overflow
- **Max 4 agentic iterations** — prevents runaway loops; sufficient for multi-hop tool chaining

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLM_PROVIDER` | `anthropic` | LLM provider: `anthropic` or `openai` |
| `LLM_MODEL` | per-provider | Model override (e.g., `gpt-4.1-mini`) |
| `ANTHROPIC_API_KEY` | (required if anthropic) | Anthropic API key |
| `OPENAI_API_KEY` | (required if openai) | OpenAI API key |
| `PORT` | `3100` | Server port |
| `ALLOWED_ORIGINS` | `http://localhost:4000` | CORS whitelist (comma-separated) |
| `AISOAR_API_URL` | `http://localhost:5000` | AISOAR backend URL |
