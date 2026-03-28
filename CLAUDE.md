# Copilot Engine — Claude Code Context

@claude/architecture.md
@claude/conventions.md

---

## Project Overview

Copilot Engine is a reusable, LLM-agnostic Express backend for building AI copilots. Supports Anthropic Claude and OpenAI GPT (including gpt-4.1-mini). Two deployment modes: **Built-in** (mounts on your existing server) or **Standalone** (runs as a separate process on port 3100). It handles:
- Agentic tool-use loop (LLM calls READ tools immediately; WRITE tools are queued for user approval)
- SSE streaming (word-by-word at ~40 words/sec)
- Auth middleware (bearer token, session cookies, or dev header)
- Pluggable project system (swap `projects/` directory for a different domain)

The engine runs as a **separate process** alongside the frontend app (default port 3100).

---

## Architecture

See @claude/architecture.md for the full data flow.

Key entry points:
- `src/index.ts` — Express app, CORS, auth middleware, route mounting
- `routes/copilot.ts` — POST /api/copilot (SSE chat)
- `routes/execute.ts` — POST /api/copilot/execute (action approval)
- `src/engine/agentic-loop.ts` — LLM-agnostic agentic loop with tool routing
- `src/engine/providers/` — LLM provider adapters (Anthropic, OpenAI)
- `src/engine/sse-stream.ts` — SSE helpers (streamWords, sendDone, sendError)
- `projects/aisoar/` — AISOAR platform implementation (system-prompt, tools, tool-executor)

---

## Tech Stack

- **Runtime**: Node.js ≥ 18.0.0 (native fetch required)
- **Language**: TypeScript (strict mode)
- **Framework**: Express 4
- **AI**: LLM-agnostic — @anthropic-ai/sdk + openai SDK. Default: Anthropic `claude-sonnet-4-20250514`. Set `LLM_PROVIDER=openai` + `OPENAI_API_KEY` for GPT models.
- **Streaming**: Server-Sent Events (SSE)
- **Auth**: Bearer token / session cookies / x-copilot-auth dev header

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (ts-node, no build needed) — **use this for development** |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output (runs build first via prestart) |
| `bash tools/dev.sh` | Full setup + dev start (copies .env, installs deps, starts server) |
| `bash tools/test.sh` | Run test suite |

**QA Agent:** `/qa` — Run self-healing QA agent (checks build, env, server, API)
**Integration QA:** `/qa-integration` — Post-integration QA for copilot-engine + target app (tests both servers, diagnoses and fixes issues)

---

## Coding Conventions

See @claude/conventions.md for full rules.

Key rules:
- Always truncate tool results to `MAX_RESULT_SIZE` (8000 chars)
- READ tools execute immediately; WRITE tools are always queued for approval
- TypeScript strict mode — no `any`, explicit return types on exported functions
- No wildcard CORS with `credentials: true`

---

## Folder Structure

```
copilot-engine/
├── src/
│   ├── index.ts              # Express app entry point
│   ├── config.ts             # Environment config (getConfig())
│   ├── auth/
│   │   └── validate-token.ts # Auth middleware
│   └── engine/
│       ├── agentic-loop.ts   # LLM-agnostic agentic loop
│       ├── llm-types.ts      # Provider-agnostic types (Tool, Message, LLMProvider)
│       ├── providers/        # LLM adapters
│       │   ├── index.ts      # getLLMConfig(), createProvider()
│       │   ├── anthropic.ts  # Anthropic Claude adapter
│       │   └── openai.ts     # OpenAI GPT adapter
│       ├── project-config.ts # ProjectConfig interface
│       ├── route-factories.ts# createCopilotRoute(), createExecuteRoute()
│       └── sse-stream.ts     # SSE streaming helpers
│   ├── mount.ts              # mountCopilot() for built-in mode
│   └── features/             # Optional feature modules
│       ├── feature-module.ts  # FeatureModule interface + loader
│       └── security-scanner/  # Security scanning + Supabase logging
├── routes/
│   ├── copilot.ts            # POST /api/copilot
│   └── execute.ts            # POST /api/copilot/execute
├── projects/
│   ├── aisoar/               # AISOAR implementation
│   │   ├── system-prompt.ts
│   │   ├── tools.ts
│   │   └── tool-executor.ts
│   ├── wordpress/            # WordPress project (content, plugins, themes, security)
│   └── example/              # Starter template for new projects
├── claude/                   # Modular Claude context (architecture, conventions)
├── .claude/                  # Claude Code config (settings, agents, commands)
├── tools/                    # Dev/test shell scripts
├── CLAUDE.md                 # This file
├── COPILOT_SKILL.md          # Integration guide for consuming apps
├── KNOWN-ISSUES.md           # Pitfalls and fixes
├── .env.example              # Environment template
└── README.md                 # Public documentation
```

---

## Rules

1. **Read before modifying** — always read the target file before editing it
2. **Execution loop**: Read → Implement → Test → Fix → Commit
3. **Never use `npm start` for development** — use `npm run dev` (ts-node); `npm start` compiles first
4. **Node v18+ is required** — native `fetch` is used throughout; do not add `node-fetch` polyfills
5. **Test before completion** — run `bash tools/test.sh` (or `curl /health`) before marking work done
6. **Commit meaningful changes** — descriptive commit messages, never skip pre-commit hooks
7. **Never assume completion without verification** — check server response, not just that code compiled
8. **Tool results must be truncated** — any new tool executor must cap output at 8000 chars
9. **WRITE tools must never auto-execute** — they must go through the approval queue in agentic-loop.ts
10. **SCSS rules (for consuming apps)**: use `&.modifier { }` not `.modifier & { }` — the latter is invalid in Sass pre-dart
