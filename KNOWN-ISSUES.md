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
