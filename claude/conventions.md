# Coding Conventions — Copilot Engine

## TypeScript

- **Strict mode is on** — `tsconfig.json` has `"strict": true`
- No `any` types — use `unknown` + type guard, or a proper interface
- Explicit return types on all exported functions
- Prefer `interface` over `type` for object shapes
- Use `Record<string, string>` not `{ [key: string]: string }` where possible

## Tool Results — Truncation

Every tool executor **must** truncate its output before returning:

```typescript
const MAX_RESULT_SIZE = 8000;

function truncate(json: string): string {
  if (json.length <= MAX_RESULT_SIZE) return json;
  return json.substring(0, MAX_RESULT_SIZE) + '..."truncated"}';
}
```

Without this, a large API response will overflow Claude's context window and cause a 400 error.

## READ / WRITE Tool Separation

- **READ tools** — safe, idempotent, execute immediately inside the agentic loop
- **WRITE tools** — mutating, require user approval, **never** auto-execute
- Maintain `WRITE_TOOL_NAMES: Set<string>` in `tools.ts` — this is the gate in `agentic-loop.ts`
- If a tool is ambiguous, default to WRITE (safer)

## Fetch / HTTP

- Node v18+ native `fetch` is used throughout — **do not add node-fetch**
- Always forward the user's auth cookie: `headers["Cookie"] = cookies`
- Always set `Origin` header for CSRF bypass: `headers["Origin"] = baseUrl.origin`
- Always use `credentials: "include"` for session-based backends

## Auth

Three modes (checked in order in `validate-token.ts`):
1. `Authorization: Bearer <token>` — standard JWT/API key
2. `Cookie: <session>` — session-based apps (AISOAR)
3. `x-copilot-auth: <value>` — dev bypass header

Do not remove any auth mode without confirming the project doesn't use it.

## CORS

- **Never** use `origin: "*"` with `credentials: true` — browsers block this
- `ALLOWED_ORIGINS` env var is comma-separated; always `.trim()` each entry
- Default falls back to `http://localhost:4000` for local dev

## SSE Streaming

- Call `res.flushHeaders()` before the first `res.write()` — required for SSE to start streaming
- Send a `:keep-alive` event immediately after headers flush (prevents proxy timeouts)
- Event format: `data: {...}\n\n` (double newline is required by SSE spec)
- Three event types: `text`, `done`, `error`

## Error Handling

- Tool executor errors should return a structured error object, not throw:
  ```typescript
  return JSON.stringify({ error: true, status: res.status, message: "..." });
  ```
- The agentic loop handles `context_length_exceeded` errors from Claude (returns what was collected so far)
- Frontend should handle both string and object error formats

## SCSS (for consuming Angular apps)

BEM nesting rules for Sass (pre-dart/Angular bundled versions):

| Valid | Invalid |
|-------|---------|
| `&.pending { }` | `.pending & { }` |
| `&__icon { }` (at root of block) | `&.pending { &__icon { } }` |
| `&.pending { &__icon { } }` if `&__icon` selects a child | `&.pending &__icon { }` inline |

- Place button rules (`.btn-approve`, `.btn-reject`) at the **block root**, not inside `&__actions`
- Use `[class.copilot-dark]="isDark"` binding instead of `:host-context(.dark)` for dark mode
- Dark text: body `#e8e8e8`, bold/headers `#ffffff`, minimum grey `#d0d0d0`

## Commit Style

- Descriptive imperative subject line: `Add Node version guard to startup`
- Reference the error number from KNOWN-ISSUES.md if fixing a known issue
- Never skip pre-commit hooks (`--no-verify`)
