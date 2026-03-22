# Add AI Copilot to Your Application

This is a Claude Code skill file. Copy it to your project's `.claude/skills/add-copilot.md` or paste it directly as a prompt to Claude Code.

It will automatically: clone copilot-engine, create your backend project, scaffold frontend components, wire everything into your app layout, configure dark mode, and handle all known pitfalls.

---

## Instructions for Claude Code

You are integrating an AI Copilot into this application using the copilot-engine framework. Follow these steps exactly.

### Prerequisites

- This application uses a modern frontend framework (Angular 14+, React 16+, Vue 3+, or similar)
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

Create copilot components using the app's frontend framework (React, Angular, Vue, etc.). Adapt the patterns below to your framework's conventions.

#### Welcome / Empty State Layout (CRITICAL — follow exactly)

When no messages exist, the copilot panel MUST show a **chat bubble welcome message** from the bot — NOT a centered icon/text layout.

**Required layout:**

```
┌─────────────────────────────────────────┐
│ 🤖 AI Copilot    [Concise ▾] [🗑] [✕]  │  ← Header
├─────────────────────────────────────────┤
│                                         │
│  (•) ┌─────────────────────────────┐    │
│  bot │ Hi! I'm your [App Name]     │    │
│  ava │ Copilot. Here's what I      │    │
│  tar │ can do:                     │    │
│      │                             │    │
│      │ Navigate                    │    │
│      │ ┌──────┐ ┌──────┐ ┌──────┐ │    │
│      │ │ Dash │ │ Page │ │ Page │ │    │
│      │ └──────┘ └──────┘ └──────┘ │    │
│      │ ┌──────┐ ┌──────┐         │    │
│      │ │ Page │ │ Page │         │    │
│      │ └──────┘ └──────┘         │    │
│      │                             │    │
│      │ Actions                     │    │
│      │ ┌────────────┐ ┌──────────┐│    │
│      │ │ Action One │ │ Action 2 ││    │
│      │ └────────────┘ └──────────┘│    │
│      │ ┌────────────┐ ┌──────────┐│    │
│      │ │ Action 3   │ │ Action 4 ││    │
│      │ └────────────┘ └──────────┘│    │
│      │                             │    │
│      │ Or just type your question  │    │
│      │ below.                      │    │
│      └─────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│ [Ask the copilot anything...     ] [▶]  │  ← Input
└─────────────────────────────────────────┘
```

**Design rules:**

1. **Bot avatar** (left-aligned, small circle with bot/chat icon) + **chat bubble** containing the welcome content
2. **Navigate** section: bold header, followed by **inline pill/chip buttons** (flex-wrap layout)
   - Pill style: outlined border (1px solid with theme accent color), rounded-full/pill shape
   - Small text (~10-11px), horizontal padding ~8-12px, vertical ~3-5px
   - Each pill uses `[navigate:/route]Label[/navigate]` token — clicking navigates in-app
3. **Actions** section: bold header, followed by **inline pill/chip buttons** (same style as Navigate)
   - Each pill uses `[suggest:prompt text]Label[/suggest]` token — clicking sends a follow-up
4. Closing line: "Or just type your question below."

**DO NOT:**
- Use a centered sparkle/icon as the welcome state
- Use tabbed categories with vertical text list items
- Use full-width card-style buttons for prompts
- Create multiple fine-grained categories (e.g., "Compliance", "Security", "Quick Actions")

#### Types

Create a types file (`copilot.types.ts` or `copilot-types.ts`):
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

#### Prompts

Create a prompts file (`copilot-prompts.ts`):
- Group ALL prompts into exactly **2 categories**: `"Navigate"` and `"Actions"`
- **Navigate** category: `[navigate:/route]Label[/navigate]` prompts for the app's key pages (6-8 most important)
- **Actions** category: `[suggest:prompt text]Label[/suggest]` for domain-specific actions (6-8 most useful)
- Do NOT create multiple fine-grained categories — keep it to Navigate + Actions only

#### Services

Create these services (adapt naming to your framework):
- **copilot-service** — SSE communication with copilot-engine. CRITICAL: use `response.text()` NOT `response.body.getReader()` for SSE parsing (ReadableStream fails on Windows). Get auth token using the app's existing auth pattern. Get copilot URL from the app's config with fallback `http://localhost:3100`.
- **copilot-context** — Snapshot of current page, user role, etc.
- **copilot-events** — Event bus for cross-component refresh updates (use framework-appropriate pattern: Subject in Angular, EventEmitter/context in React, mitt/provide-inject in Vue).

#### Components

Create 4 components:

- `copilot-panel` — Main chat container with:
  - **Header**: bot avatar + copilot name (left), response mode selector + clear/trash button + close button (right)
  - **Message list**: scrollable area showing conversation messages
  - **Welcome state**: chat-bubble welcome with inline Navigate/Actions pill buttons (see layout above)
  - **Input area**: text input + send button at bottom
- `copilot-message` — Message bubble with markdown rendering and `[suggest:]`/`[navigate:]` button parsing. CRITICAL: extract tokens BEFORE HTML escaping, then restore after. Watch for content changes during streaming (use `ngDoCheck` in Angular, `useEffect`/`useMemo` in React, `watch` in Vue).
- `copilot-action-card` — Approve/reject card for write tool actions. Three states: pending (amber/warning), executed (green/success), rejected (red/error).
- `copilot-thinking` — Animated thinking indicator with bouncing dots and rotating domain-specific phrases.

### Step 4: Dark Mode

Ensure the copilot respects the host app's dark mode. Approach depends on your framework:

**Angular** — DO NOT use `:host-context(.dark)` — it fails with ViewEncapsulation.Emulated. Instead:
1. Subscribe to the app's theme service, expose an `isDark` boolean
2. Bind `[class.copilot-dark]="isDark"` on each component's root element
3. Pass `[isDark]="isDark"` as `@Input()` to all child components
4. All dark SCSS uses `.copilot-dark { ... }` — never `:host-context()`

**React** — Use the app's theme context/provider (e.g., `useTheme()` hook). If the app uses Tailwind with `dark:` prefix via a `.dark` class on `<html>`, your copilot components automatically inherit dark mode.

**Vue** — Use the app's reactive theme state or CSS variables. Bind dark class on component root elements.

**Dark mode colors** — Extract from the host app's actual palette:
```bash
grep -r "bg-\[#" src/
grep -r "--header-bg\|--dropdown-bg" src/
```

**Text colors in dark mode**:
- Body text: `#e8e8e8` (light grey-white)
- Bold/headers: `#ffffff`
- User message bubble text: `#ffffff` (explicit override needed)
- For Angular: use blanket `::ng-deep { div, p, span, li, ... { color: #e8e8e8; } }` for assistant messages

### Step 5: Layout Integration

1. Add a toggle mechanism (reactive state — `BehaviorSubject` in Angular, `useState`/context in React, `ref` in Vue)
2. Add a toggle button to the sidebar or header (labeled "Copilot" with a bot/chat icon)
3. Add the copilot panel component to the main layout template alongside the router outlet
4. Import the component in the appropriate module/entry point
5. Set z-index LOWER than the app's header dropdowns/modals (typically `z-index: 10` for panel, `z-index: 20+` for header)
6. Add `CopilotApiUrl` to the app's runtime config

### Step 6: Config and i18n

- Add `CopilotApiUrl` to config template and env generator (or Vite env vars like `VITE_COPILOT_API_URL`)
- Add COPILOT_* translation keys to all i18n files (if the app has i18n)

### Step 7: Verify

1. Start copilot-engine: `cd ../copilot-engine && npm run dev`
2. Start the app: `npm start` (or `npm run dev`)
3. Test: navigation pill buttons work, action prompts return responses, dark mode renders correctly, header menus appear above copilot panel

---

## Known Issues Reference

Read `KNOWN-ISSUES.md` in the copilot-engine repo. Key pitfalls:

| Issue | Prevention |
|-------|------------|
| Token overflow (223K+) | Truncate tool results to 8KB max |
| SSE stream cuts off | Use `response.text()` not ReadableStream |
| Dark mode invisible | Angular: use `[class.copilot-dark]` not `:host-context()`. React/Vue: use theme context. |
| Grey text in dark mode | Explicit color overrides for all text elements in dark mode |
| Buttons not clickable | Extract `[suggest:]` tokens BEFORE `escapeHtml()` |
| Covers host menus | Panel z-index: 10, below host dropdowns (z-index: 20+) |
| Error shows raw JSON | Parse error as string OR object |
| Duplicate thinking avatar | Hide empty streaming message while thinking indicator is visible |
| Welcome layout wrong | Use chat-bubble welcome with inline pills — NOT centered icon + tabbed categories |
