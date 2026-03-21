# Add AI Copilot to Your Application

This is a Claude Code skill file. Copy it to your project's `.claude/skills/add-copilot.md` or paste it directly as a prompt to Claude Code.

It will automatically: clone copilot-engine, create your backend project, scaffold frontend components, wire everything into your app layout, configure dark mode, and handle all known pitfalls.

---

## Instructions for Claude Code

You are integrating an AI Copilot into this application using the copilot-engine framework. Follow these steps exactly.

### Prerequisites

- This application uses Angular (any version 14+)
- The developer has an `ANTHROPIC_API_KEY`
- The copilot-engine repo is at: https://github.com/femitfash/copilot-engine

### Step 1: Clone and Set Up copilot-engine

Clone the copilot-engine repo as a sibling directory (NOT inside the app repo):

```bash
cd .. && git clone https://github.com/femitfash/copilot-engine.git
cd copilot-engine && npm install
cp .env.example .env
```

Read the app's codebase to understand:
1. What APIs does this app call? (search for HTTP services, API endpoints, base URLs)
2. What auth system does it use? (cookies, localStorage, tokens — search for `Authorization`, `Bearer`, `loginToken`)
3. What is the app's domain? (what does it do — e.g., project management, e-commerce, analytics)
4. What pages/routes exist? (read the routing module)
5. How does dark mode work? (search for theme service, `dark` class, CSS variables)

### Step 2: Create Backend Project

Create `copilot-engine/projects/{app-name}/` with three files:

**system-prompt.ts** — Write a domain-specific system prompt that:
- Describes what the copilot can do in this app's context
- Lists interaction principles (proactive, conversational, action-oriented, approval gate)
- Documents the `[suggest:]` and `[navigate:]` syntax
- Lists all available pages from the app's routing module
- Use `projects/example/system-prompt.ts` as a template

**tools.ts** — Define READ and WRITE tools based on the app's APIs:
- READ tools: safe data-fetching operations (GET endpoints)
- WRITE tools: mutations that need user approval (POST/PUT/DELETE)
- Use `projects/example/tools.ts` as a template

**tool-executor.ts** — Map tool names to API calls:
- Forward the user's auth token to the app's APIs
- Use `projects/example/tool-executor.ts` as a template

Then update `copilot-engine/routes/copilot.ts` and `routes/execute.ts` imports to point to your new project instead of `zerotrusted`.

Update `copilot-engine/src/config.ts` to include your app's API URL environment variables.

Update `copilot-engine/.env` with:
- `ANTHROPIC_API_KEY`
- Your app's API URLs
- `ALLOWED_ORIGINS` with your app's dev server URL
- `PORT=3100`

### Step 3: Scaffold Frontend Files

Create these files in the Angular app:

**Types** — `src/app/components/copilot/copilot.types.ts`:
```typescript
export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: CopilotAction[];
  isStreaming?: boolean;
}

export interface CopilotAction {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'executing' | 'executed' | 'rejected';
  result?: Record<string, unknown>;
}

export interface CopilotPrompt {
  id: string;
  category: string;
  title: string;
  prompt: string;
}

export type ResponseMode = 'concise' | 'actions' | 'detailed';
```

**Prompts** — `src/app/components/copilot/copilot-prompts.ts`:
- Add a `Navigation` category with `[navigate:/route]Label[/navigate]` prompts for every sidebar/nav page
- Add action categories relevant to the app's domain
- Use `[suggest:prompt text]Label[/suggest]` for action prompts

**Services** — Create 3 services:
- `copilot.service.ts` — SSE communication with copilot-engine. CRITICAL: use `response.text()` NOT `response.body.getReader()` for SSE parsing (ReadableStream fails on Windows). Get auth token using the app's existing auth pattern. Get copilot URL from the app's config service with fallback `http://localhost:3100`.
- `copilot-context.service.ts` — Snapshot of current page, user role, etc.
- `copilot-events.service.ts` — Subject-based refresh bus for cross-component updates.

**Components** — Create 4 standalone Angular components:
- `copilot-panel` — Main chat container with header, message list, input area, prompt library with category tabs
- `copilot-message` — Message bubble with markdown rendering and `[suggest:]`/`[navigate:]` button parsing. CRITICAL: extract tokens BEFORE HTML escaping, then restore after. Use `ngDoCheck` not `ngOnChanges`.
- `copilot-action-card` — Approve/reject card for write tool actions
- `copilot-thinking` — Animated thinking indicator with rotating phrases

### Step 4: Dark Mode (CRITICAL — Read Carefully)

**DO NOT use `:host-context(.dark)`** — it fails with Angular's ViewEncapsulation.Emulated.

Instead:
1. In `copilot-panel.component.ts`, subscribe to the app's theme service:
   ```typescript
   isDark = false;
   this.themeService.theme$.subscribe(theme => {
     this.isDark = theme === 'dark';
     this.cdr.markForCheck();
   });
   ```
2. Bind on root div: `[class.copilot-dark]="isDark"`
3. Pass to ALL child components: `[isDark]="isDark"` as `@Input()`
4. Each child binds: `[class.copilot-dark]="isDark"` on its root element
5. All dark SCSS uses `.copilot-dark { ... }` — never `:host-context()`

**Dark mode colors** — Extract from the host app's actual palette:
```bash
grep -r "bg-\[#" src/app/app.component.html
grep -r "--header-bg\|--dropdown-bg" src/app/components/header/
```

**Text colors in dark mode**:
- Body text: `#e8e8e8` (light grey-white)
- Bold/headers: `#ffffff`
- User message bubble text: `#ffffff` (explicit override needed)
- Use blanket `::ng-deep { div, p, span, li, ... { color: #e8e8e8; } }` for assistant messages

### Step 5: Layout Integration

1. Add a toggle mechanism (BehaviorSubject in a shared service, or simple boolean)
2. Add a toggle button to the sidebar or header
3. Add `<app-copilot-panel>` to the main layout template alongside `<router-outlet>`
4. Import `CopilotPanelComponent` in the app module
5. Set z-index LOWER than the app's header dropdowns/modals (typically `z-index: 10`)
6. Add `CopilotApiUrl` to the app's runtime config

### Step 6: Config and i18n

- Add `CopilotApiUrl` to config template and env generator
- Add COPILOT_* translation keys to all i18n files

### Step 7: Verify

1. Start copilot-engine: `cd ../copilot-engine && npm run dev`
2. Start the app: `npm start`
3. Test: navigation buttons work, action prompts return responses, dark mode renders correctly, header menus appear above copilot panel

---

## Known Issues Reference

Read `KNOWN-ISSUES.md` in the copilot-engine repo. Key pitfalls:

| Issue | Prevention |
|-------|------------|
| Token overflow (223K+) | Truncate tool results to 8KB max |
| SSE stream cuts off | Use `response.text()` not ReadableStream |
| Dark mode invisible | Use `[class.copilot-dark]` not `:host-context()` |
| Grey text in dark mode | Blanket `::ng-deep` color overrides, user bubble explicit white |
| Buttons not clickable | Extract `[suggest:]` tokens BEFORE `escapeHtml()` |
| Covers host menus | Panel z-index: 10, below host dropdowns |
| Private prop in template | Use public methods, not `private` service access |
| Error shows raw JSON | Parse error as string OR object |
| Duplicate thinking avatar | Hide empty streaming message with `*ngIf` |
