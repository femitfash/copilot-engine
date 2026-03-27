# Post-Integration QA — copilot-engine + Target App

Run a full integration health check across copilot-engine and the target application. Automatically detect and fix common issues, then re-test until certified or the fix cap is reached.

---

## Instructions for Claude Code

You are running post-integration QA for a copilot-engine deployment. Your goal is to verify the full stack works end-to-end: copilot-engine + the target application it was integrated into.

**Fix loop cap: 3 iterations max.** After 3 fix-retest cycles, report unresolved issues with manual fix suggestions.

---

## Phase 1 — Discover Environment

1. Find the copilot-engine directory. Check these in order:
   - Sibling directory: `../copilot-engine/`
   - If not found: ask the developer for the path

2. Read `copilot-engine/.env` to extract:
   - `PORT` (default 3100)
   - `ALLOWED_ORIGINS` (to know the target app's expected URL)
   - Any `*_API_URL` variables (to know backend endpoints)

3. Identify the active project:
   - List directories under `copilot-engine/projects/` (exclude `example/`)
   - Read `copilot-engine/routes/copilot.ts` to confirm which project is imported

4. Read `copilot-engine/projects/{app}/tools.ts` to discover:
   - All tool names and their input schemas
   - Which are READ tools and which are WRITE tools (`WRITE_TOOL_NAMES` set)

5. Read `copilot-engine/projects/{app}/tool-executor.ts` to discover:
   - API endpoints each tool calls
   - HTTP methods used (GET, POST, PUT, DELETE)
   - How auth is forwarded

6. Identify the target app's dev server port from `ALLOWED_ORIGINS` or the app's config files.

---

## Phase 2 — Engine Health

Run the same checks as the isolated QA agent:

### 2a. Node version
Run: `node --version`
- If < 18: report `❌ Node version is X — copilot-engine requires Node v18+` and stop
- If >= 18: ✅

### 2b. .env file
- If missing: `cp .env.example .env` and warn to set `ANTHROPIC_API_KEY`
- If `ANTHROPIC_API_KEY` is empty or placeholder: report ❌ and stop
- If set: ✅

### 2c. node_modules
- If missing: run `npm install` in the copilot-engine directory
- If exists: ✅

### 2d. Engine server health
Run: `curl -s http://localhost:{PORT}/health`
- If `{"status":"ok"}`: ✅
- If connection refused: start with `cd {copilot-engine-dir} && npm run dev &`, wait 3 seconds, retry
- If still failing: report ❌ and stop

---

## Phase 3 — Target App Health

Test that the target application is running and reachable.

1. Extract the target app URL from `ALLOWED_ORIGINS` (e.g., `http://localhost:4200`)
2. Attempt to reach it: `curl -s -o /dev/null -w "%{http_code}" {target-app-url}`
3. If not reachable (status `000` or connection refused):
   - **Ask the developer:** "The target app at {url} is not responding. What command starts your dev server?"
   - Run their command in the background
   - Wait 5 seconds and retry
   - If still down: report ❌ and stop

4. Test a basic API endpoint that the tool-executor calls:
   - Pick the first READ tool's API endpoint from `tool-executor.ts`
   - Call it with `curl` (use the dev auth header `x-copilot-auth: dev`)
   - If it responds with valid JSON: ✅
   - If 401/403: auth forwarding may be misconfigured — note for Phase 7
   - If 404: the API endpoint path may be wrong — note for Phase 7
   - If 500: the target app has a bug — note as "Target App Issue" for Phase 8

---

## Phase 4 — CORS & Connectivity

### 4a. ALLOWED_ORIGINS validation
- Read `ALLOWED_ORIGINS` from copilot-engine `.env`
- Determine the actual URL the target app is running on (from Phase 3)
- If they don't match (e.g., `.env` says `http://localhost:4200` but app runs on `http://localhost:4000`):
  - **Auto-fix:** Update `ALLOWED_ORIGINS` in `.env` to match the actual URL
  - Restart copilot-engine
  - Report: `⚠️ Fixed ALLOWED_ORIGINS: was {old}, now {new}`

### 4b. CORS preflight test
Run:
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X OPTIONS http://localhost:{PORT}/api/copilot \
  -H "Origin: {target-app-url}" \
  -H "Access-Control-Request-Method: POST"
```
- If 204 or 200: ✅ CORS is configured correctly
- If 403 or no CORS headers: report ❌ — ALLOWED_ORIGINS mismatch

---

## Phase 5 — Tool Endpoint Validation

For each tool defined in `projects/{app}/tools.ts`:

### READ tools — call the underlying API endpoint
1. From `tool-executor.ts`, identify the API URL and HTTP method for this tool
2. Call it directly with curl (forward auth headers as the executor does)
3. Check:
   - **Response status**: 200/201 = ✅, 404 = wrong path, 405 = wrong HTTP method, 500 = target app bug
   - **Response body**: must be valid JSON. If empty body, `tool-executor.ts` will crash with "Unexpected end of JSON input"
   - **Response shape**: does it match what the tool description implies? (e.g., if tool says "list policies", response should be an array)

### WRITE tools — verify endpoint exists (do NOT execute mutations)
1. From `tool-executor.ts`, identify the API URL
2. Send an OPTIONS request to verify the endpoint exists
3. Check that the HTTP method matches what `tool-executor.ts` uses (catches 405 errors)

### Common issues this catches:
- **HTTP 405**: tool-executor uses PUT but API only accepts POST (or vice versa)
- **Empty JSON**: API returns 204 No Content or empty body, but tool-executor calls `res.json()`
- **Type mismatch**: GET returns `[{complianceId: 1}]` but POST expects `[1]` — detected by comparing input schema types with API response shapes

Record all failures for Phase 7.

---

## Phase 6 — End-to-End Copilot Test

### 6a. READ tool exercise
Send a prompt that should trigger a READ tool:
```bash
curl -s -N \
  -X POST http://localhost:{PORT}/api/copilot \
  -H "Content-Type: application/json" \
  -H "x-copilot-auth: dev" \
  -d '{"message":"{prompt derived from first READ tool description}","history":[],"context":""}' \
  --max-time 15
```
- Expect SSE events (`data:` lines)
- Expect at least one `text` event with content
- Expect a `done` event at the end

### 6b. WRITE tool exercise
Send a prompt that should trigger a WRITE tool:
```bash
curl -s -N \
  -X POST http://localhost:{PORT}/api/copilot \
  -H "Content-Type: application/json" \
  -H "x-copilot-auth: dev" \
  -d '{"message":"{prompt derived from first WRITE tool description}","history":[],"context":""}' \
  --max-time 15
```
- Expect SSE events
- The `done` event should contain `pendingActions` with at least one action (WRITE tools are queued, not executed)

### 6c. Execute endpoint
If Phase 6b returned a pending action, test the execute endpoint:
```bash
curl -s \
  -X POST http://localhost:{PORT}/api/copilot/execute \
  -H "Content-Type: application/json" \
  -H "x-copilot-auth: dev" \
  -d '{"toolCallId":"{id from pending action}","name":"{tool name}","input":{input from pending action}}'
```
- Expect `200` with `{"success": true, ...}`
- If `405`: the route method is wrong
- If `500`: the tool executor threw — check error message

Record all failures for Phase 7.

---

## Phase 7 — Diagnose & Fix Loop

**Max 3 iterations.** For each failure from Phases 4-6:

### Diagnostic decision tree

| Error Pattern | Where to Fix | How to Fix |
|---------------|-------------|------------|
| ECONNREFUSED on :{PORT} | copilot-engine | Start with `npm run dev` |
| ECONNREFUSED on target port | target app | Ask developer for start command |
| CORS / Failed to fetch | copilot-engine `.env` | Update `ALLOWED_ORIGINS` to match target app URL |
| HTTP 405 Method Not Allowed | `projects/{app}/tool-executor.ts` | Change the HTTP method (e.g., PUT → POST) to match what the target API accepts |
| MODULE_NOT_FOUND dist/index.js | copilot-engine start script | Use `npm run dev` instead of `npm start`, or run `npm run build` |
| Unexpected end of JSON input | `projects/{app}/tool-executor.ts` | Add empty-body guard: check `content-length` or response status before calling `.json()` |
| 400 type mismatch / cannot convert | `projects/{app}/tools.ts` | Fix `input_schema` types to match what the target API expects (e.g., `integer[]` not `object[]`) |
| 500 from target app API | **Target app** | **Do NOT fix.** Report as "Target App Issue" in Phase 8 |
| 401/403 auth failure | `projects/{app}/tool-executor.ts` | Check auth header forwarding — ensure Cookie/Authorization is passed correctly |
| SSE no data events | `routes/copilot.ts` | Check `res.flushHeaders()` is called, check system prompt is valid |

### Fix procedure
1. Identify the error and match it to the decision tree
2. Read the file that needs fixing
3. Apply the fix
4. If copilot-engine files were changed: restart the engine (`kill` existing process, `npm run dev &`)
5. Re-run ONLY the failed test(s) from the relevant phase
6. If the test passes: ✅ move to next failure
7. If still failing: try an alternative fix (decrement iteration counter)
8. After 3 failed iterations on the same issue: mark as unresolved

---

## Phase 8 — Report

Output a summary table:

```
╔═══════════════════════════════════════════════════════╗
║  Integration QA Report                                ║
╠═══════════════════════════════════════════════════════╣
║  Engine health           ✅/❌                         ║
║  Target app health       ✅/❌                         ║
║  CORS config             ✅/❌/⚠️ (auto-fixed)         ║
║  READ tools ({n} total)  ✅/❌ ({pass}/{fail})         ║
║  WRITE tools ({n} total) ✅/❌ ({pass}/{fail})         ║
║  E2E copilot chat        ✅/❌                         ║
║  Execute endpoint        ✅/❌                         ║
║  Fixes applied           {count}                       ║
║  Unresolved issues       {count}                       ║
╚═══════════════════════════════════════════════════════╝
```

### If there are unresolved issues:

For each, provide:
- Which server/codebase has the problem
- The exact error message
- Suggested manual fix with file path and code change

### If there are Target App Issues:

List separately under a "Target App Issues (out of scope)" section:
- The endpoint and error
- Suggest the developer fix their API and re-run `/qa-integration`

### If all checks pass:

```
✅  Integration is healthy — copilot-engine + {app-name} are working end-to-end.

Verified:
- Engine serves /health, /api/copilot (SSE), /api/copilot/execute
- All {n} READ tools return valid responses
- All {n} WRITE tools have reachable endpoints
- CORS is correctly configured for {target-app-url}
- End-to-end prompt → tool-use → response flow works
```
