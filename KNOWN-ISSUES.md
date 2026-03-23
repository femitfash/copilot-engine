# Copilot Known Issues & Preemptive Checks

Common issues encountered during copilot development and deployment. **All new deployments must verify these are addressed before launch.**

---

## 1. Token Overflow — Agentic Loop

**Symptom**: `400 invalid_request_error: prompt is too long: N tokens > 200000 maximum`

**Root Cause**: READ tool results from external APIs can return massive JSON payloads (100KB+). These accumulate in the agentic loop's message history across iterations, quickly exceeding Claude's context limit.

**Fix**: Truncate all tool results before feeding them back into the loop.

```typescript
const MAX_TOOL_RESULT_CHARS = 8000;

function truncateResult(result: string): string {
  if (result.length <= MAX_TOOL_RESULT_CHARS) return result;
  return result.substring(0, MAX_TOOL_RESULT_CHARS) +
    "\n\n[... truncated — result too large. Show the user a summary.]";
}
```

**Also**: Truncate the context block injected into the system prompt (cap at ~2000 chars).

**Checklist**:
- [ ] All `executeReadTool` results are truncated before pushing to `toolResults`
- [ ] Context JSON injected into system prompt is capped
- [ ] Conversation history passed from frontend is limited (e.g., last 20 messages)

---

## 2. SSE Streaming — Browser Never Receives Data

**Symptom**: Frontend shows thinking indicator indefinitely; cursor blinks but no text appears. Backend logs show successful Claude API responses.

**Root Cause**: Express does not flush HTTP headers until the first `res.write()`. Browsers wait for headers before opening the ReadableStream. If the agentic loop takes 10-30s (calling external APIs), the browser may time out or the SSE connection appears stuck.

**Fix**: Call `res.flushHeaders()` immediately after setting SSE headers, and send an initial empty text event.

```typescript
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
res.setHeader("X-Accel-Buffering", "no");
res.flushHeaders();

// Send keepalive so browser knows connection is open
res.write(`data: ${JSON.stringify({ type: "text", text: "" })}\n\n`);
```

**Checklist**:
- [ ] `res.flushHeaders()` called immediately after setting SSE headers
- [ ] Initial empty event sent before agentic loop begins
- [ ] `X-Accel-Buffering: no` header set (for Nginx proxies)

---

## 3. SSE ReadableStream — Partial Response on Windows/Some Browsers

**Symptom**: Response starts streaming (e.g., "Here") then stops. Backend logs show complete response. Only the first chunk is received by the frontend.

**Root Cause**: The `ReadableStream` reader approach (`response.body.getReader()`) is unreliable on Windows and some browser configurations when reading SSE from cross-origin `fetch()`. The reader gets the first chunk, then `done` becomes `true` prematurely.

**Fix**: Use `response.text()` instead of streaming reader. Since the copilot-engine's agentic loop completes entirely before word-by-word streaming begins, there's no real-time streaming benefit — all SSE data arrives as one payload.

```typescript
// RELIABLE: Read full response then parse
const responseText = await response.text();
const lines = responseText.split('\n');
let doneReceived = false;

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data: ')) continue;
  try {
    const data = JSON.parse(trimmed.slice(6));
    if (data.type === 'text') onChunk(data.text);
    else if (data.type === 'done') { doneReceived = true; onDone(data.pendingActions || []); }
    else if (data.type === 'error') { doneReceived = true; onError(data.error); }
  } catch { /* skip malformed */ }
}
if (!doneReceived) onDone([]);
```

**Checklist**:
- [ ] Use `response.text()` instead of `response.body.getReader()` for SSE parsing
- [ ] Handle missing `done` event with a fallback `onDone([])`
- [ ] Track `doneReceived` flag to avoid duplicate `onDone` calls

---

## 4. CORS — Cross-Origin SSE Fetch Blocked

**Symptom**: Browser console shows CORS errors. Fetch request to copilot-engine rejected.

**Root Cause**: The frontend app and copilot-engine are on different origins (different ports or domains).

**Fix**: Configure CORS in Express with the correct allowed origins.

```typescript
app.use(cors({
  origin: ["http://localhost:4000", "https://app.yourdomain.com"],
  credentials: true,
}));
```

**Checklist**:
- [ ] `ALLOWED_ORIGINS` env var includes all frontend origins (dev + staging + prod)
- [ ] `credentials: true` set in CORS config
- [ ] No wildcard (`*`) origin when using credentials

---

## 5. Dark Mode — `:host-context()` Fails with Angular View Encapsulation

**Symptom**: Dark mode styles have no effect. Copilot panel remains light-themed when the host app switches to dark mode.

**Root Cause**: Angular's `ViewEncapsulation.Emulated` (the default) adds attribute selectors to CSS rules. `:host-context(.dark)` does NOT reliably match a class on `<html>` across component boundaries. This is a known Angular limitation.

**Fix**: Do NOT use `:host-context()`. Instead, inject the theme state directly:

1. Subscribe to the host app's `ThemeService` in the panel component
2. Expose an `isDark` boolean property
3. Bind `[class.copilot-dark]="isDark"` on each component's root element
4. Pass `[isDark]="isDark"` as `@Input()` to all child components
5. Use `.copilot-dark` class in SCSS for all dark mode overrides

```typescript
// Panel component
constructor(private themeService: ThemeService) {
  this.themeSub = this.themeService.theme$.subscribe((theme) => {
    this.isDark = theme === 'dark';
    this.cdr.markForCheck();
  });
}
```

```html
<!-- Root div -->
<div class="copilot-panel" [class.copilot-dark]="isDark">
  <app-copilot-message [isDark]="isDark" ...></app-copilot-message>
</div>
```

```scss
// SCSS — use .copilot-dark, NOT :host-context(.dark)
.copilot-dark {
  background: #212121;
  .title { color: #ffffff; }
}
```

**Checklist**:
- [ ] NO usage of `:host-context(.dark)` in any copilot component
- [ ] Panel subscribes to host app's theme service
- [ ] `isDark` passed as `@Input()` to ALL child components
- [ ] Every component binds `[class.copilot-dark]="isDark"` on its root element
- [ ] All dark mode SCSS uses `.copilot-dark` class selector

---

## 6. Dark Mode — Text Illegible (Grey on Dark Background)

**Symptom**: Text in assistant messages and UI elements appears as grey on dark background, making it hard to read. Bold text and headers may be white, but regular paragraph text is grey.

**Root Cause**: Three compounding issues:
1. CSS custom properties (`var(--copilot-text-primary)`) don't cascade into `[innerHTML]` rendered content via `::ng-deep`
2. Angular `::ng-deep` selectors must explicitly target ALL HTML elements rendered by `[innerHTML]` — bare text nodes inside `<div>` wrappers won't inherit from targeted selectors like `strong, em, li`
3. User message bubbles (blue background) also need explicit white text in dark mode

**Fix**: Use blanket element selectors in `::ng-deep` and explicitly override user message colors:

```scss
// Assistant messages
.message.copilot-dark {
  &.assistant-message .message-bubble {
    background: #2a2a2a;
    color: #e8e8e8;

    ::ng-deep {
      div, p, span, li, td, th, strong, em, h3, h4, label, a {
        color: #e8e8e8;
      }
      strong, h3, h4 { color: #ffffff; }
    }
  }

  // User messages — white text on blue
  &.user-message .message-bubble {
    background: #2563eb;
    color: #ffffff;

    ::ng-deep {
      div, p, span, li, strong, em { color: #ffffff; }
    }
  }
}
```

**Color guidelines for dark mode**:
- Primary text (body): `#e8e8e8` (light grey-white)
- Emphasis text (bold, headers): `#ffffff` (pure white)
- Secondary text (labels, timestamps): `#e0e0e0`
- User message text: `#ffffff` on `#2563eb` background
- Never use grey below `#d0d0d0` on dark backgrounds

**Checklist**:
- [ ] All elements inside `::ng-deep` have explicit color overrides (use blanket `div, p, span, li, ...` selector)
- [ ] User message bubbles have explicit `#ffffff` text in dark mode
- [ ] Bold/headers use `#ffffff`, body text uses `#e8e8e8`
- [ ] No grey text below `#d0d0d0` on any dark background
- [ ] Test with real content (long responses with lists, tables, code blocks)

---

## 7. Dark Mode — Colors Not Matching Host App

**Symptom**: Copilot dark theme uses blue-tinted or different shade colors than the host app.

**Fix**: Extract actual dark palette from the host app's existing components (sidebar, header, content area):

```bash
# Search for the host app's dark background colors
grep -r "bg-\[#" src/app/app.component.html
grep -r "--header-bg\|--dropdown-bg" src/app/components/header/
```

**Typical mapping**:
| Host Element | Color | Copilot Element |
|---|---|---|
| Sidebar background | `#010101` | Panel header/footer |
| Content area | `#212121` | Panel body |
| Header dropdowns | `#1a1a1a` | Input area, header |
| Cards/surfaces | `#2a2a2a` | Message bubbles, action cards |
| Borders | `#3a3a3a` | All borders |

**Checklist**:
- [ ] Dark colors extracted from host app's actual components
- [ ] No hardcoded blue-tinted dark colors (`#1a1a2e`, `#16213e`, etc.)

---

## 8. Navigation Prompts Sent to Claude Instead of Executing

**Symptom**: Clicking a navigation prompt (e.g., "Go to Dashboard") sends the `[navigate:/path]` text as a message to Claude instead of navigating.

**Root Cause**: The prompt library's `selectPrompt()` method doesn't distinguish navigation prompts from action prompts.

**Fix**: Check for `[navigate:]` syntax in the prompt and execute `router.navigateByUrl()` directly.

```typescript
selectPrompt(prompt: CopilotPrompt): void {
  const navMatch = prompt.prompt.match(/\[navigate:(.*?)\]/);
  if (navMatch) {
    this.router.navigateByUrl(navMatch[1]);
    return;
  }
  this.sendMessage(prompt.prompt);
}
```

**Checklist**:
- [ ] `selectPrompt()` checks for `[navigate:]` before sending to backend
- [ ] All navigation routes in prompts are verified against the app's routing module
- [ ] `Router` is injected in the panel component

---

## 9. `[suggest:]` / `[navigate:]` Buttons Not Clickable

**Symptom**: Buttons rendered in messages are visible but clicking does nothing.

**Root Cause**: Two possible causes:
1. `escapeHtml()` runs before syntax parsing, destroying the `[suggest:]` brackets
2. `ngOnChanges` doesn't fire for mutated objects during SSE streaming

**Fix**:
1. Extract `[suggest:]`/`[navigate:]` tokens BEFORE HTML escaping, replace with placeholders, escape, then restore
2. Use `ngDoCheck` instead of `ngOnChanges` to detect content mutations

```typescript
private renderContent(content: string): SafeHtml {
  let processed = content;
  const tokens: { ph: string; html: string }[] = [];

  // Extract BEFORE escaping
  processed = processed.replace(/\[suggest:(.*?)\](.*?)\[\/suggest\]/g, (_, prompt, label) => {
    const ph = `__SUGGEST_${tokens.length}__`;
    tokens.push({ ph, html: `<button class="copilot-suggest-btn" data-prompt="${prompt}">${label}</button>` });
    return ph;
  });

  let html = this.escapeHtml(processed);
  for (const t of tokens) html = html.replace(t.ph, t.html);
  // ... rest of markdown rendering
}
```

**Checklist**:
- [ ] Token extraction happens BEFORE `escapeHtml()`
- [ ] `ngDoCheck` used instead of `ngOnChanges` for streaming message updates
- [ ] Click handler uses event delegation on the bubble container
- [ ] Button data attributes are properly escaped

---

## 10. Thinking Bubble Shows Duplicate Avatar

**Symptom**: When the copilot is "thinking", the UI shows the assistant avatar twice.

**Root Cause**: The panel creates an empty assistant message placeholder AND shows the thinking indicator simultaneously.

**Fix**: Hide the message component when the message is streaming and has no content yet.

```html
<app-copilot-message
  *ngIf="!(msg.isStreaming && !msg.content)"
  [message]="msg">
</app-copilot-message>
```

**Checklist**:
- [ ] Empty streaming messages are hidden while thinking indicator is shown
- [ ] Thinking indicator only shows when `isLoading && lastMessage.content === ''`

---

## 11. Z-Index Conflicts — Copilot Covers Host App Menus

**Symptom**: Header dropdowns, modals, or tooltips appear behind the copilot panel.

**Fix**: Set copilot panel z-index BELOW the host app's dropdown/modal layers.

```
z-index: 10     — Copilot panel (desktop)
z-index: 40     — Copilot panel (mobile overlay)
z-index: 50     — Header dropdowns
z-index: 100    — Notifications
z-index: 1000   — Modals
z-index: 9999   — Mobile sidebar
```

**Checklist**:
- [ ] Audit the host app's z-index values
- [ ] Copilot panel z-index is lower than all dropdown/modal layers

---

## 12. Private Property Access in Templates

**Symptom**: `TS2341: Property 'X' is private and only accessible within class`

**Fix**: Use a public method instead of directly accessing private services in templates.

```typescript
// BAD: (close)="http.copilotToggle.next(false)"
// GOOD:
closeCopilot(): void {
  this.showCopilot = false;
  this.http.copilotToggle.next(false);
}
```

**Checklist**:
- [ ] No private/protected members referenced in component templates
- [ ] Run `ng build --aot` to catch these errors early

---

## 13. Error Messages Showing Raw JSON

**Symptom**: Error messages in chat show raw JSON like `{"type":"error","error":{...}}`

**Fix**: Handle both string and object error formats in the SSE parser.

```typescript
if (data.type === 'error') {
  const errMsg = typeof data.error === 'string'
    ? data.error
    : (data.error?.message || data.error?.error?.message || 'An error occurred');
  onError(errMsg);
}
```

**Checklist**:
- [ ] Frontend SSE parser handles error as string or object
- [ ] Backend sends clean user-friendly messages

---

## 14. CSRF Blocks Write Tool Execution

**Symptom**: Copilot reads data fine, but approved write actions fail with `403: Missing CSRF token or origin header`.

**Root Cause**: Many apps implement CSRF protection that requires an `Origin` or `Referer` header (or a CSRF token cookie+header pair). When copilot-engine's tool executor makes server-to-server API calls, no `Origin` header is set, so CSRF middleware rejects the request.

**Fix**: Set the `Origin` header in the tool executor's `apiCall` function to match the target API's origin:

```typescript
const baseUrl = new URL(url);
headers["Origin"] = baseUrl.origin;
```

For apps using double-submit CSRF cookies, you may also need to forward the CSRF cookie and set the `x-csrf-token` header.

**Checklist**:
- [ ] Tool executor sets `Origin` header on all API calls
- [ ] CSRF cookie is forwarded if the app uses double-submit pattern
- [ ] Test write tool execution after approval (not just read tools)

---

## 15. Cross-Origin Fetch Blocked — Browser Cannot Reach Copilot Engine

**Symptom**: Copilot panel shows "Cannot reach the copilot engine" even though `curl http://localhost:3100/health` returns 200. The copilot-engine is running but the browser fetch fails.

**Root Cause**: Even with CORS properly configured, some environments (corporate proxies, browser extensions, strict CSP) block cross-origin fetch from `localhost:3000` to `localhost:3100`. This is especially common in enterprise environments.

**Fix**: Instead of making the browser call the copilot-engine directly, add a **same-origin proxy** in the host app's server. The browser calls `/api/copilot` on the same origin, and the server proxies to the copilot-engine.

```typescript
// In host app's Express server
const COPILOT_ENGINE_URL = process.env.COPILOT_ENGINE_URL || "http://localhost:3100";

app.post("/api/copilot", async (req, res) => {
  try {
    const upstream = await fetch(`${COPILOT_ENGINE_URL}/api/copilot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}),
      },
      body: JSON.stringify(req.body),
    });
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    const text = await upstream.text();
    res.write(text);
    res.end();
  } catch {
    res.status(502).json({ error: "Copilot engine is not reachable" });
  }
});

// Same for /api/copilot/execute
```

Then set the frontend's copilot URL to empty string (same origin):
```typescript
const COPILOT_URL = import.meta.env.VITE_COPILOT_API_URL || "";
```

**Checklist**:
- [ ] Add proxy routes in host app's server for `/api/copilot` and `/api/copilot/execute`
- [ ] Frontend copilot URL defaults to same-origin (empty string)
- [ ] Proxy forwards cookies for session-based auth
- [ ] `COPILOT_ENGINE_URL` env var configurable

---

## 16. Node v24 ESM Resolution — SDK Packages Fail to Load

**Symptom**: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...internal/utils/uuid.mjs'` when starting the app with `tsx` on Node v24.

**Root Cause**: Node v24's ESM resolver does not correctly follow the `exports` map in newer versions of `openai` (v6+) and `@anthropic-ai/sdk` (v0.70+) packages. The `client.mjs` file imports from `./internal/utils/uuid.mjs` but the package's `exports` field doesn't expose that path, and `tsx` can't resolve it.

**Fix**: Pin to compatible versions:
- `openai`: v4.x (e.g., `4.77.0`)
- `@anthropic-ai/sdk`: v0.39.x

Or use Node v22 LTS instead of v24.

**Checklist**:
- [ ] Check Node version (`node --version`) — if v24+, watch for ESM resolution issues
- [ ] Pin SDK versions if using Node v24 with `tsx`

---

## 17. Windows — `listen ENOTSUP` on `0.0.0.0`

**Symptom**: `Error: listen ENOTSUP: operation not supported on socket 0.0.0.0:PORT`

**Root Cause**: Node v24 on Windows does not support `reusePort` and may fail to bind to `0.0.0.0` in some configurations.

**Fix**: Bind to `127.0.0.1` instead of `0.0.0.0`, and remove `reusePort: true`:
```typescript
server.listen({ port, host: "127.0.0.1" }, () => { ... });
```

**Checklist**:
- [ ] Server binds to `127.0.0.1` (not `0.0.0.0`) on Windows
- [ ] No `reusePort` option on Windows

---

## 18. Welcome Layout — Centered Icon vs Chat Bubble

**Symptom**: Generated copilot shows a centered sparkle icon with tabbed categories instead of the standard chat-bubble welcome with inline pill buttons.

**Root Cause**: The COPILOT_SKILL.md previously described "prompt library with category tabs" which led Claude Code to generate a tab-based category layout with vertical text lists. This doesn't match the established ZeroTrusted.ai / FastGRC copilot design.

**Fix**: Updated COPILOT_SKILL.md (March 2026) now specifies the exact chat-bubble welcome pattern. If your copilot was generated before this update, refactor the panel's empty state to use:
- Bot avatar (left) + chat bubble with greeting
- "Navigate" section with inline pill buttons
- "Actions" section with inline pill buttons
- "Or just type your question below."

See the updated `COPILOT_SKILL.md` Step 3 "Welcome / Empty State Layout" section.

**Checklist**:
- [ ] Welcome state uses chat-bubble layout (not centered icon)
- [ ] Prompts are inline pills (not tabbed categories with text lists)
- [ ] Only 2 groups: Navigate + Actions

---

## 19. Write Tool Fails — Missing Required DB Fields

**Symptom**: Approved write action returns `500: Failed to create [resource]`. Copilot shows "Executed" but nothing was actually created.

**Root Cause**: The LLM provides only the fields defined in the tool's `input_schema` (e.g., `name`, `type`, `description`), but the host app's database schema has additional NOT NULL columns that aren't in the tool definition (e.g., `fipsImpactLevel`, `organizationName`, `ownerEmail`).

**Fix**: In the tool executor's write handlers, fill in sensible defaults for all NOT NULL fields before calling the API:

```typescript
case "create_profile": {
  const profileData = {
    // Defaults for required fields
    systemName: input.name || "System",
    systemVersion: "1.0",
    organizationName: "Organization",
    ownerName: "System Owner",
    fipsImpactLevel: "High",
    // ... all other NOT NULL fields ...
    ...input, // LLM-provided values override defaults
  };
  return apiCall(url, { method: "POST", body: JSON.stringify(profileData) }, cookies);
}
```

**Prevention**: When defining WRITE tools in `tools.ts`, cross-reference the host app's database schema (`schema.ts`) to identify all NOT NULL columns. Either:
1. Add them to the tool's `input_schema` so the LLM provides them, OR
2. Fill defaults in the tool executor

**Checklist**:
- [ ] Cross-reference tool `input_schema` with DB schema for NOT NULL columns
- [ ] Tool executor fills defaults for any NOT NULL fields not in the tool schema
- [ ] Test each write tool end-to-end (approve → verify in DB)

---

## 20. Post-Action — No Navigation or Stale Cache

**Symptom**: After approving a write action, the user has no way to see what was created. If they manually navigate to the page, data doesn't appear until a hard refresh.

**Root Cause**: Two issues:
1. The copilot doesn't auto-navigate to the relevant page after action execution
2. The host app's data-fetching layer (e.g., React Query, Angular HttpClient cache) still holds stale data

**Fix**:

**Auto-navigation**: Map tool names to routes and navigate after execution:
```typescript
const TOOL_ROUTES = {
  create_profile: "/profiles",
  create_poam_item: "/poam",
  // ...
};

// After successful execution:
const route = TOOL_ROUTES[action.name];
if (route) setTimeout(() => navigate(route), 600);
```

**Cache invalidation**: Invalidate the relevant query cache keys:
```typescript
const TOOL_QUERY_KEYS = {
  create_profile: ["/api/profiles"],
  create_poam_item: ["/api/poam-items"],
  // ...
};

// After successful execution:
for (const key of TOOL_QUERY_KEYS[action.name] || []) {
  queryClient.invalidateQueries({ queryKey: [key] });
}
```

**Also update the system prompt** to instruct the LLM to include `[navigate:]` buttons in its response after write actions are queued.

**Checklist**:
- [ ] Action card auto-navigates to relevant page after execution
- [ ] Query cache invalidated for affected endpoints
- [ ] System prompt includes post-action navigation mapping
- [ ] Brief delay (500-800ms) before navigation so user sees "Executed" state

---

## 21. Host App Missing `dotenv` — `.env` File Not Loaded

**Symptom**: App crashes with `DATABASE_URL must be set` even though `.env` file exists in the project root.

**Root Cause**: The host app doesn't have `dotenv` installed or configured. The `.env` file exists but Node.js doesn't load it automatically.

**Fix**: Install dotenv and import it at the top of the server entry point:
```bash
npm install dotenv
```
```typescript
// First line of server/index.ts (or main.ts)
import "dotenv/config";
```

**Checklist**:
- [ ] `dotenv` is in dependencies
- [ ] `import "dotenv/config"` is the first import in server entry point
- [ ] `.env` file exists with required variables (DATABASE_URL, SESSION_SECRET, etc.)

---

## 22. Database Not Provisioned

**Symptom**: App starts but all API calls return 500 errors. Console shows `FATAL: database "X" does not exist` (code 3D000).

**Root Cause**: The database referenced in `DATABASE_URL` hasn't been created yet. The app expects the database to already exist before running schema migrations.

**Fix**:
1. Create the database:
   ```bash
   psql -U postgres -c "CREATE DATABASE myapp;"
   ```
   Or via PgAdmin4: Right-click Databases → Create → Database

2. Push the schema:
   ```bash
   npx drizzle-kit push
   ```

**Checklist**:
- [ ] Database exists in PostgreSQL (verify with `\l` in psql)
- [ ] `DATABASE_URL` in `.env` points to the correct host, port, and database name
- [ ] Schema has been pushed (`npx drizzle-kit push`)
- [ ] Tables exist (verify with `\dt` in psql)

---

## Deployment Verification Checklist

Before deploying to any new environment:

1. [ ] Backend starts without errors (`npm run dev`)
2. [ ] `curl` test to `/api/copilot` returns SSE events
3. [ ] CORS origins configured for the target frontend URL
4. [ ] Tool result truncation active (`MAX_TOOL_RESULT_CHARS`)
5. [ ] Dark mode uses `[class.copilot-dark]` approach (NOT `:host-context`)
6. [ ] Dark mode colors extracted from host app's actual palette
7. [ ] All text readable in both light and dark modes (no grey below `#d0d0d0`)
8. [ ] User message text is white on blue in dark mode
9. [ ] Navigation prompts execute client-side routing
10. [ ] Action buttons are clickable (suggest + navigate syntax)
11. [ ] Z-index doesn't cover host app menus
12. [ ] Error messages are user-friendly
13. [ ] `ANTHROPIC_API_KEY` is set and valid
14. [ ] Token/auth forwarding works with the host app's auth system
15. [ ] SSE reader uses `response.text()` (not `ReadableStream` reader)
16. [ ] CSRF: tool executor sets `Origin` header on API calls
17. [ ] Write actions work after approval (not just reads)
18. [ ] Same-origin proxy configured if cross-origin fetch is blocked
19. [ ] Node version compatible (v22 LTS recommended; v24 has ESM issues)
20. [ ] Welcome state uses chat-bubble layout with inline pill buttons
21. [ ] Write tool schemas cross-referenced with DB NOT NULL columns
22. [ ] Each write tool tested end-to-end (approve → verify in DB/UI)
23. [ ] Auto-navigation wired for post-action UX
24. [ ] Query cache invalidation wired for post-action data freshness
25. [ ] `dotenv` installed and imported in server entry point
26. [ ] Database created and schema pushed before first run
