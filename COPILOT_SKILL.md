# Add AI Copilot to Your Application

This is a Claude Code skill file. To use it, paste this single prompt into Claude Code from your project directory:

> Add an AI copilot to this application using the skill at https://github.com/femitfash/copilot-engine/blob/master/COPILOT_SKILL.md

Claude Code will fetch this file, save it locally, and follow the steps below.

Alternatively, copy this file manually to your project's `.claude/skills/add-copilot.md` and run:
> Add an AI copilot to this application using the skill in .claude/skills/add-copilot.md

---

## Instructions for Claude Code

You are integrating an AI Copilot into this application using the copilot-engine framework. Follow these steps exactly.

### Step 0: Pre-Flight Checks

Before doing any work, verify these prerequisites. If any fail, stop and report the issue.

```bash
# 1. Node.js >= 18 (required for native fetch)
node --version

# 2. GitHub CLI installed and authenticated
gh auth status

# 3. npm available
npm --version
```

- If Node < 18: stop and tell the developer to install Node 18+ from https://nodejs.org
- If `gh` not found: stop and tell the developer to install GitHub CLI from https://cli.github.com/
- If `gh auth status` fails: stop and tell the developer to run `gh auth login`

After checks pass, display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Pre-flight checks passed ✅
  Node.js: v{version}
  GitHub CLI: authenticated as {username}
  npm: v{version}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 0.5: Detect Project Type

Scan the project directory to determine what kind of application this is. **Display your findings to the developer.**

Check in this order:
1. Look for `wp-config.php` or `wp-content/` directory → **WordPress detected**
2. Look for `package.json` → read it to determine framework (Angular, React, Vue, Next.js, Express, NestJS)
3. If neither found → ask the developer what kind of project this is

**Display the detection result:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Project detected: {WordPress / Angular / React / etc.}
  {additional details: WP version, framework version, etc.}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### WordPress-Specific Setup

If WordPress is detected, display and follow this flow:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔧 WordPress Copilot Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WordPress uses Application Passwords for API access.
  You'll need to create one in your WordPress admin:

  wp-admin → Users → Your Profile → Application Passwords

  Enter a name (e.g., "Copilot") and click "Add New".
  Copy the generated password (shown only once).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Then ask the developer for:
1. **WordPress site URL** (e.g., `http://localhost:8080`)
2. **WordPress username** (the admin account)
3. **Application Password** (the one they just created)

Set `WP_API_URL` in `.env`. The auth token is base64-encoded `username:app_password`.

Use `projects/wordpress/` as the project template — it has 15 READ + 11 WRITE tools for content, plugins, themes, users, and site management.

The welcome prompt template uses **two tabs**: "WordPress" (navigation + content actions) and "Security" (scanning + hardening actions).

### LLM Provider Selection

**Display this choice to the developer and wait for their answer:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🤖 Choose your LLM provider:

  1. Anthropic Claude (default)
     Model: claude-sonnet-4-20250514
     Requires: ANTHROPIC_API_KEY

  2. OpenAI GPT
     Model: gpt-4.1-mini (affordable)
     Requires: OPENAI_API_KEY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If they already have an `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in their environment, detect it and display:
```
  Detected: ANTHROPIC_API_KEY in environment ✅
  Using Anthropic Claude as your LLM provider.
```

The copilot-engine repo is at: https://github.com/femitfash/copilot-engine

### Optional Features

**Display available features and ask the developer which to enable:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📦 Optional Features:

  [ ] security-scanner
      WordPress security scanning — vulnerability checks,
      plugin audits, SSL verification, user security,
      hardening recommendations.

      Optional: Connect Supabase for scan history & dashboard.
      Provide SUPABASE_URL + SUPABASE_ANON_KEY to enable logging.
      (Scanner works without Supabase, results just aren't saved.)

  Enable security-scanner? (y/n)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If the developer enables `security-scanner`:
- Ask: "Do you have a Supabase project for logging? (optional)"
- If yes: ask for `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Set `COPILOT_FEATURES=security-scanner` in `.env`
- Tables (`security_scans`, `security_findings`, `security_events`) are auto-created on first run
- Developer views results at their Supabase dashboard (Table Editor) or through the copilot

### Deployment Mode: Built-in vs Standalone

**Compatibility check — determine if built-in mode is possible:**

For WordPress: WordPress is typically PHP-based without a Node.js/Express server. **Default to Standalone mode** unless the developer also has an Express server alongside WordPress.

For other frameworks — read the app's `package.json`:
1. If `express` is in dependencies AND a server entry file exists (server.ts, index.ts, app.ts, main.ts) → **Built-in compatible**
2. If `@nestjs/core` is in dependencies → **Built-in compatible** (NestJS uses Express underneath)
3. If `next` is in dependencies AND a custom server file exists (server.ts/server.js with Express) → **Built-in compatible**
4. If `next` is in dependencies but NO custom server → **Standalone only** — inform: "Your Next.js app uses the built-in server. The copilot will run as a standalone server on port 3100."
5. If no server-side framework found (frontend-only SPA) → **Standalone only** — inform: "Your app doesn't have a backend server. The copilot will run as a standalone server on port 3100."

**If built-in is compatible, display this choice:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🏗️ Deployment Mode:

  1. Built-in
     Runs on your existing server — same port, one process.
     Simpler to manage. One `npm start` runs everything.

  2. Standalone
     Runs as its own server on port 3100.
     Better for shared/multi-app setups or full isolation.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If standalone is the only option** (WordPress, SPA-only, pure Next.js), display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🏗️ Deployment Mode: Standalone
  Your project will use a separate copilot server on port 3100.
  {reason: e.g., "WordPress is PHP-based and doesn't have a Node.js server."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If they choose Built-in, follow **Path A** below. If Standalone, follow **Path B**.

**Before proceeding, display the full setup summary:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋 Setup Summary

  Project:        {WordPress / Angular / React / etc.}
  LLM Provider:   {Anthropic Claude / OpenAI GPT}
  Deployment:     {Built-in / Standalone (port 3100)}
  Features:       {security-scanner / none}
  Supabase:       {Connected / Not configured}
  WP API URL:     {url}  (WordPress only)

  Proceeding with installation...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Path A — Built-in Mode

#### Step 1A: Fork, Clone, and Copy Engine Files

Fork and clone the copilot-engine repo (this benefits the open-source project and gives you a reference for future updates):

```bash
gh repo fork femitfash/copilot-engine --clone=false
GITHUB_USER=$(gh api user --jq .login)
cd .. && git clone "https://github.com/$GITHUB_USER/copilot-engine.git"
cd copilot-engine && git remote add upstream https://github.com/femitfash/copilot-engine.git
cd ../{app-directory}
```

Copy engine source files into the app's project:

```bash
mkdir -p src/copilot/engine/providers src/copilot/auth src/copilot/routes
```

Copy these files from copilot-engine into `src/copilot/`:

| Source (copilot-engine/) | Destination (src/copilot/) |
|--------------------------|---------------------------|
| `src/engine/agentic-loop.ts` | `engine/agentic-loop.ts` |
| `src/engine/llm-types.ts` | `engine/llm-types.ts` |
| `src/engine/sse-stream.ts` | `engine/sse-stream.ts` |
| `src/engine/project-config.ts` | `engine/project-config.ts` |
| `src/engine/route-factories.ts` | `engine/route-factories.ts` |
| `src/engine/providers/index.ts` | `engine/providers/index.ts` |
| `src/engine/providers/anthropic.ts` | `engine/providers/anthropic.ts` |
| `src/engine/providers/openai.ts` | `engine/providers/openai.ts` |
| `src/auth/validate-token.ts` | `auth/validate-token.ts` |
| `src/mount.ts` | `mount.ts` |

**Important:** After copying, fix the import paths in `mount.ts` — change `"./auth/validate-token"` to `"./auth/validate-token"` and `"./engine/route-factories"` to `"./engine/route-factories"` (these should already be correct since the directory structure mirrors the source).

Install only the LLM SDK the developer chose:
```bash
npm install @anthropic-ai/sdk   # if Anthropic
# OR
npm install openai              # if OpenAI
```

#### Step 2A: Create Project Files

Create these files directly in `src/copilot/` (NOT in a separate `projects/` directory):

**`src/copilot/system-prompt.ts`** — domain-specific system prompt (same guidance as Step 2 in standalone).

**`src/copilot/tools.ts`** — tool definitions using the generic `Tool` type:
```typescript
import type { Tool } from "./engine/llm-types";
export const READ_TOOLS: Tool[] = [ ... ];
export const WRITE_TOOLS: Tool[] = [ ... ];
export const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map(t => t.name));
export const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];
```

**`src/copilot/tool-executor.ts`** — tool execution logic (same guidance as Step 2 in standalone).

**`src/copilot/config.ts`** — project-specific config:
```typescript
export function getConfig() {
  return {
    apiUrl: process.env.APP_API_URL || "http://localhost:5000",
    // ... other project-specific URLs
  };
}
```

**`src/copilot/index.ts`** — barrel file that wires everything together:
```typescript
import type { Express } from "express";
import { mountCopilot } from "./mount";
import type { ProjectConfig } from "./engine/project-config";
import { SYSTEM_PROMPT, getResponseModeInstruction } from "./system-prompt";
import { ALL_TOOLS, WRITE_TOOL_NAMES } from "./tools";
import { executeReadTool, executeWriteTool } from "./tool-executor";
import { getConfig } from "./config";

const project: ProjectConfig = {
  systemPrompt: SYSTEM_PROMPT,
  getResponseModeInstruction,
  allTools: ALL_TOOLS,
  writeToolNames: WRITE_TOOL_NAMES,
  executeReadTool,
  executeWriteTool,
  getConfig,
};

export function setupCopilot(app: Express): void {
  mountCopilot(app, project);
}
```

#### Step 7A: Mount on Existing Server

Find the app's server entry point and add one line:

**Express:**
```typescript
import { setupCopilot } from "./copilot";
// ... after app.use(express.json()) and CORS setup ...
setupCopilot(app);
```

**NestJS:** Create a CopilotModule or add to `main.ts`:
```typescript
import { setupCopilot } from "./copilot";
const app = await NestFactory.create(AppModule);
setupCopilot(app.getHttpAdapter().getInstance());
```

Add copilot env vars to the app's `.env`:
```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
# LLM_MODEL=gpt-4.1-mini  (optional override)
```

**No separate `ALLOWED_ORIGINS` needed** — the copilot runs on the same origin as the app.

#### Remaining Steps (Built-in)

Steps 3-6 (frontend scaffold, dark mode, layout, config) are the same as standalone mode. Skip to those steps below.

Step 8 verification: start only ONE server (`npm start` or `npm run dev`). Test endpoints at the app's own port:
```bash
curl http://localhost:{APP_PORT}/api/copilot/health
```

---

### Path B — Standalone Mode

#### Step 1B: Fork, Clone, and Set Up copilot-engine

Each application gets its own fork — this ensures one-to-one isolation and lets you customize tools, prompts, and executors independently.

1. Fork the upstream repo:

```bash
gh repo fork femitfash/copilot-engine --clone=false
```

2. Clone YOUR fork as a sibling directory (NOT inside the app repo):

```bash
GITHUB_USER=$(gh api user --jq .login)
cd .. && git clone "https://github.com/$GITHUB_USER/copilot-engine.git"
cd copilot-engine && npm install
cp .env.example .env
```

3. Set upstream remote for future engine updates:

```bash
git remote add upstream https://github.com/femitfash/copilot-engine.git
```

Confirm `src/index.ts` (or the server entry point) has `import 'dotenv/config'` as its **first line** — before any other imports that read `process.env`. If it doesn't, add it.

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
- Set `Origin` header on all requests to pass CSRF checks
- For WRITE tools: cross-reference the app's database schema for NOT NULL columns and fill in sensible defaults for any required fields not in the tool's `input_schema`
- **Required:** Truncate every tool result to **8KB max** before returning it — serialize to JSON, then if `result.length > 8192` slice it and append `" ... (truncated)"`. This prevents token overflow on large API responses.
- Use `projects/example/tool-executor.ts` as a template

Then update `copilot-engine/routes/copilot.ts` and `routes/execute.ts` imports to point to your new project instead of `zerotrusted`.

**Required for SSE:** In `routes/copilot.ts`, immediately after setting SSE response headers, call `res.flushHeaders()` and send one empty keep-alive event (`res.write('data: \n\n')`) before the first real chunk. Without this, the connection silently times out before any tokens stream.

Update `copilot-engine/src/config.ts` to include your app's API URL environment variables.

Update `copilot-engine/.env` with:
- `LLM_PROVIDER` — set to `anthropic` (default) or `openai`
- `LLM_MODEL` — optional override (e.g., `gpt-4.1-mini`, `claude-sonnet-4-20250514`)
- The matching API key: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
- If the developer has an API key in their shell environment, auto-populate it in `.env`
- Your app's API URLs
- `ALLOWED_ORIGINS` must exactly match your app's dev server URL (e.g., `http://localhost:4200`) — wildcards will fail for credentialed requests
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
- `copilot-message` — Message bubble with markdown rendering and `[suggest:]`/`[navigate:]` button parsing. CRITICAL: extract tokens BEFORE HTML escaping, then restore after. Watch for content changes during streaming (use `ngDoCheck` in Angular, `useEffect`/`useMemo` in React, `watch` in Vue). **Required:** When displaying errors, handle both formats — `typeof err === 'string' ? err : err.message` — otherwise `[object Object]` is shown to the user.
- `copilot-action-card` — Approve/reject card for write tool actions. Three states: pending (amber/warning), executed (green/success), rejected (red/error). After successful execution, the card MUST:
  1. **Auto-navigate** to the relevant page so the user can see what was created (map tool names to routes)
  2. **Invalidate the data cache** (React Query, Angular HttpClient cache, etc.) for the affected endpoints so the page shows fresh data without a hard refresh
- `copilot-thinking` — Animated thinking indicator with bouncing dots and rotating domain-specific phrases. **Required:** While the thinking indicator is visible, hide any message with `isStreaming: true` and empty content — rendering both simultaneously causes a duplicate bot avatar.

### SCSS Rules (Angular — applies to all components)

> ⚠️ **Common cause of build failures and unstyled buttons.** Follow these exactly.

**Valid BEM nesting:**
```scss
.action-card {
  &__actions { ... }         // ✅ element at block root
  &.pending { ... }          // ✅ modifier at block root
  &.pending &__icon { ... }  // ✅ element scoped to modifier — valid
}
```

**Invalid patterns (will cause SassError or wrong selector):**
```scss
.action-card {
  &__actions {
    .btn-approve { ... }   // ❌ place .btn-approve at block root, not inside &__actions
  }
  &.pending {
    &__icon { ... }        // ❌ nested &__icon inside modifier block — invalid in Sass pre-dart
  }
}
.pending & { ... }         // ❌ & after another selector — always invalid
```

**Rule:** Place button rules (`.btn-approve`, `.btn-reject`) and modifier-scoped rules at the block root level, not nested inside element blocks.

---

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

### Step 7: Install QA Skill

Copy the integration QA skill from copilot-engine to the target app so the developer can run `/qa-integration` from their project directory:

```bash
mkdir -p .claude/skills
cp ../copilot-engine/.claude/skills/qa-integration.md .claude/skills/qa-integration.md
```

### Step 8: Verify

1. Start copilot-engine: `cd ../copilot-engine && npm run dev`
2. Start the app: `npm start` (or `npm run dev`)
3. Test: navigation pill buttons work, action prompts return responses, dark mode renders correctly, header menus appear above copilot panel

### Step 9: Summary — What Was Done

After completing all steps, output this summary so the developer knows what was created.

**For Built-in mode:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅  AI Copilot Integration Complete (Built-in)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Mode:          Built-in (same server, same port)
  LLM Provider:  {provider} ({model})
  Copilot files: src/copilot/
  Frontend:      {n} components + {n} services created

  Engine files in src/copilot/:
    engine/          (agentic loop, providers, SSE streaming)
    auth/            (token extraction middleware)
    mount.ts         (mountCopilot function)
    system-prompt.ts
    tools.ts         ({n} READ + {n} WRITE tools)
    tool-executor.ts
    config.ts
    index.ts         (setupCopilot barrel export)

  Server integration:
    {server-file}: import { setupCopilot } from "./copilot"

  To start:
    npm start  (or your app's dev command — one process)

  To verify:
    Run /qa-integration from Claude Code in this directory

  Reference repo: ../copilot-engine/ (for updates: git pull upstream master)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**For Standalone mode:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅  AI Copilot Integration Complete (Standalone)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Mode:          Standalone (port {PORT})
  LLM Provider:  {provider} ({model})
  Engine:        ../copilot-engine/
  Project:       copilot-engine/projects/{app-name}/
  Frontend:      {n} components + {n} services created

  Files created in copilot-engine:
    projects/{app-name}/system-prompt.ts
    projects/{app-name}/tools.ts         ({n} READ + {n} WRITE tools)
    projects/{app-name}/tool-executor.ts

  Files created in {app-name}:
    {list each component, service, and types file created}
    .claude/skills/qa-integration.md

  To start:
    Terminal 1:  cd ../copilot-engine && npm run dev
    Terminal 2:  npm start  (or your app's dev command)

  To verify:
    Run /qa-integration from Claude Code in this directory

  Docs:
    Integration guide:  ../copilot-engine/COPILOT_SKILL.md
    Known pitfalls:     ../copilot-engine/KNOWN-ISSUES.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Replace `{placeholders}` with actual values from the integration.

---

## Known Issues Reference

The common pitfalls are covered inline in the steps above. For environment-specific edge cases:

| Issue | When to check |
|-------|---------------|
| Cross-origin fetch blocked | App and copilot-engine on different origins — implement a same-origin proxy in the host app |
| Node v24 ESM resolution errors | Pin `openai` v4.x and `@anthropic-ai/sdk` v0.39.x |
| Windows `ENOTSUP` on startup | Bind to `127.0.0.1` instead of `0.0.0.0` in `src/index.ts` |
| Database not found on first run | Run `prisma migrate dev` or `prisma db push` before starting |

See `known-issues.md` for the full deployment verification checklist (26 items) before going live.
