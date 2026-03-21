#!/usr/bin/env ts-node
/**
 * Copilot Engine — Frontend Scaffold CLI
 *
 * Generates Angular copilot components, services, and configuration
 * for integrating copilot-engine into any Angular application.
 *
 * Usage:
 *   npx ts-node scaffold/init.ts --app-path=/path/to/angular-app
 *   npx ts-node scaffold/init.ts --app-path=/path/to/angular-app --skip-i18n
 */

import * as fs from "fs";
import * as path from "path";

// ─── CLI Args ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const appPathArg = args.find((a) => a.startsWith("--app-path="));
const skipI18n = args.includes("--skip-i18n");

if (!appPathArg) {
  console.error("Usage: npx ts-node scaffold/init.ts --app-path=/path/to/angular-app");
  process.exit(1);
}

const appPath = appPathArg.split("=")[1];
const srcApp = path.join(appPath, "src", "app");

if (!fs.existsSync(srcApp)) {
  console.error(`Error: ${srcApp} does not exist. Is this an Angular app?`);
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  ✅ Created ${path.relative(appPath, filePath)}`);
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// ─── Types ────────────────────────────────────────────────────────────────

const TYPES_CONTENT = `export interface CopilotMessage {
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
  icon?: string;
}

export type ResponseMode = 'concise' | 'actions' | 'detailed';
`;

// ─── Copilot Service ──────────────────────────────────────────────────────

const SERVICE_CONTENT = `import { Injectable } from '@angular/core';
import { CopilotAction, ResponseMode } from '../components/copilot/copilot.types';

@Injectable({ providedIn: 'root' })
export class CopilotService {
  private conversationId = this.generateUUID();
  private abortController: AbortController | null = null;

  // TODO: Replace with your app's token retrieval method
  private getToken(): string {
    return document.cookie.split(';').find(c => c.trim().startsWith('loginToken='))?.split('=')[1]?.trim() || '';
  }

  // TODO: Replace with your app's config service
  private getCopilotApiUrl(): string {
    return (window as any).__COPILOT_API_URL__ || 'http://localhost:3100';
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  async sendMessage(
    message: string,
    history: { role: string; content: string }[],
    responseMode: ResponseMode,
    context: Record<string, unknown>,
    onChunk: (text: string) => void,
    onDone: (actions: CopilotAction[]) => void,
    onError: (error: string) => void,
  ): Promise<void> {
    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), 600_000);

    try {
      const response = await fetch(\`\${this.getCopilotApiUrl()}/api/copilot\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${this.getToken()}\` },
        body: JSON.stringify({ message, conversationId: this.conversationId, context, history, responseMode }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        onError(response.status === 401 ? 'Session expired. Please sign in again.' : \`Request failed (\${response.status})\`);
        return;
      }

      const responseText = await response.text();
      const lines = responseText.split('\\n');
      let doneReceived = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.type === 'text') onChunk(data.text);
          else if (data.type === 'done') { doneReceived = true; onDone(data.pendingActions || []); }
          else if (data.type === 'error') {
            doneReceived = true;
            onError(typeof data.error === 'string' ? data.error : (data.error?.message || 'An error occurred'));
          }
        } catch { /* skip malformed */ }
      }

      if (!doneReceived) onDone([]);
    } catch (err: any) {
      onError(err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Connection failed'));
    } finally {
      clearTimeout(timeoutId);
      this.abortController = null;
    }
  }

  async executeAction(action: CopilotAction): Promise<any> {
    const response = await fetch(\`\${this.getCopilotApiUrl()}/api/copilot/execute\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${this.getToken()}\` },
      body: JSON.stringify({ toolCallId: action.id, name: action.name, input: action.input }),
    });
    return response.json();
  }

  cancelRequest(): void { this.abortController?.abort(); }
  resetConversation(): void { this.conversationId = this.generateUUID(); }
}
`;

// ─── Context Service ──────────────────────────────────────────────────────

const CONTEXT_SERVICE_CONTENT = `import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class CopilotContextService {
  constructor(private router: Router) {}

  getSnapshot(): Record<string, unknown> {
    return {
      currentPage: this.router.url,
      timestamp: new Date().toISOString(),
    };
  }
}
`;

// ─── Events Service ───────────────────────────────────────────────────────

const EVENTS_SERVICE_CONTENT = `import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CopilotEventsService {
  private refreshSubject = new Subject<string>();
  refresh$ = this.refreshSubject.asObservable();

  emitRefresh(entityType: string): void {
    this.refreshSubject.next(entityType);
  }
}
`;

// ─── Prompts Template ─────────────────────────────────────────────────────

const PROMPTS_CONTENT = `import { CopilotPrompt } from './copilot.types';

// TODO: Add your app's navigation routes and action prompts
export const COPILOT_PROMPTS: CopilotPrompt[] = [
  {
    id: 'nav-home',
    category: 'Navigation',
    title: 'Go to Home',
    prompt: '[navigate:/]Open Home[/navigate]',
  },
  // Add more prompts for your app...
];
`;

// ─── i18n Keys ────────────────────────────────────────────────────────────

const I18N_KEYS: Record<string, Record<string, string>> = {
  en: {
    COPILOT_TITLE: "AI Copilot",
    COPILOT_PLACEHOLDER: "Ask the copilot anything...",
    COPILOT_CLOSE: "Close copilot",
    COPILOT_PROMPT_LIBRARY: "Prompt Library",
    COPILOT_MODE_CONCISE: "Concise",
    COPILOT_MODE_ACTIONS: "Actions",
    COPILOT_MODE_DETAILED: "Detailed",
    COPILOT_APPROVE: "Approve",
    COPILOT_REJECT: "Reject",
    COPILOT_SIDEBAR_LABEL: "AI Copilot",
  },
  es: {
    COPILOT_TITLE: "Copiloto IA",
    COPILOT_PLACEHOLDER: "Pregunta al copiloto lo que quieras...",
    COPILOT_CLOSE: "Cerrar copiloto",
    COPILOT_PROMPT_LIBRARY: "Biblioteca de prompts",
    COPILOT_MODE_CONCISE: "Conciso",
    COPILOT_MODE_ACTIONS: "Acciones",
    COPILOT_MODE_DETAILED: "Detallado",
    COPILOT_APPROVE: "Aprobar",
    COPILOT_REJECT: "Rechazar",
    COPILOT_SIDEBAR_LABEL: "Copiloto IA",
  },
  ja: {
    COPILOT_TITLE: "AIコパイロット",
    COPILOT_PLACEHOLDER: "コパイロットに何でも聞いてください...",
    COPILOT_CLOSE: "コパイロットを閉じる",
    COPILOT_PROMPT_LIBRARY: "プロンプトライブラリ",
    COPILOT_MODE_CONCISE: "簡潔",
    COPILOT_MODE_ACTIONS: "アクション",
    COPILOT_MODE_DETAILED: "詳細",
    COPILOT_APPROVE: "承認",
    COPILOT_REJECT: "拒否",
    COPILOT_SIDEBAR_LABEL: "AIコパイロット",
  },
  pt: {
    COPILOT_TITLE: "Copiloto IA",
    COPILOT_PLACEHOLDER: "Pergunte qualquer coisa ao copiloto...",
    COPILOT_CLOSE: "Fechar copiloto",
    COPILOT_PROMPT_LIBRARY: "Biblioteca de prompts",
    COPILOT_MODE_CONCISE: "Conciso",
    COPILOT_MODE_ACTIONS: "Ações",
    COPILOT_MODE_DETAILED: "Detalhado",
    COPILOT_APPROVE: "Aprovar",
    COPILOT_REJECT: "Rejeitar",
    COPILOT_SIDEBAR_LABEL: "Copiloto IA",
  },
};

// ─── Main ─────────────────────────────────────────────────────────────────

console.log("\n🚀 Copilot Engine — Frontend Scaffold\n");
console.log(`Target: ${appPath}\n`);

// 1. Types
writeFile(path.join(srcApp, "components/copilot/copilot.types.ts"), TYPES_CONTENT);

// 2. Prompts
writeFile(path.join(srcApp, "components/copilot/copilot-prompts.ts"), PROMPTS_CONTENT);

// 3. Services
writeFile(path.join(srcApp, "services/copilot.service.ts"), SERVICE_CONTENT);
writeFile(path.join(srcApp, "services/copilot-context.service.ts"), CONTEXT_SERVICE_CONTENT);
writeFile(path.join(srcApp, "services/copilot-events.service.ts"), EVENTS_SERVICE_CONTENT);

// 4. i18n
if (!skipI18n) {
  const i18nDir = path.join(appPath, "src", "assets", "i18n");
  if (fs.existsSync(i18nDir)) {
    for (const [lang, keys] of Object.entries(I18N_KEYS)) {
      const filePath = path.join(i18nDir, `${lang}.json`);
      if (fileExists(filePath)) {
        try {
          const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
          let modified = false;
          for (const [key, value] of Object.entries(keys)) {
            if (!content[key]) {
              content[key] = value;
              modified = true;
            }
          }
          if (modified) {
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + "\n", "utf8");
            console.log(`  ✅ Updated ${lang}.json with COPILOT_* keys`);
          } else {
            console.log(`  ⏭️  ${lang}.json already has COPILOT_* keys`);
          }
        } catch {
          console.log(`  ⚠️  Could not parse ${lang}.json — skipping`);
        }
      }
    }
  } else {
    console.log("  ⏭️  No i18n directory found — skipping translations");
  }
}

// 5. Summary
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Scaffold complete! Files created:

  src/app/components/copilot/copilot.types.ts
  src/app/components/copilot/copilot-prompts.ts
  src/app/services/copilot.service.ts
  src/app/services/copilot-context.service.ts
  src/app/services/copilot-events.service.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Manual steps required:

1. COPILOT SERVICE — Update getToken() and getCopilotApiUrl():
   - src/app/services/copilot.service.ts
   - Replace with your app's auth token and config service

2. COMPONENTS — Copy the copilot UI components from the reference
   implementation or build your own using the copilot.types.ts interfaces.
   The reference Angular components are in the zt-app-ui repo:
   - copilot-panel (main chat UI)
   - copilot-message (message bubble with markdown + [suggest:]/[navigate:])
   - copilot-action-card (approve/reject card)
   - copilot-thinking (loading indicator)

3. LAYOUT — Add the copilot panel to your app layout:
   - Add a toggle button (sidebar/header)
   - Add <app-copilot-panel> to your main layout template
   - Import CopilotPanelComponent in your app module

4. DARK MODE — Use [class.copilot-dark]="isDark" approach:
   - Subscribe to your app's theme service in the panel component
   - Pass isDark as @Input() to all child components
   - Do NOT use :host-context(.dark) — it fails with Angular encapsulation

5. CONFIG — Add CopilotApiUrl to your runtime config:
   - config.template.json: "CopilotApiUrl": "\${COPILOT_API_URL}"
   - Default: http://localhost:3100

6. PROMPTS — Update copilot-prompts.ts with your app's:
   - Navigation routes (sidebar pages)
   - Action prompts (common tasks)

7. BACKEND — Create your project in copilot-engine/projects/:
   - system-prompt.ts (domain expertise)
   - tools.ts (READ + WRITE tool definitions)
   - tool-executor.ts (API call mappings)

See KNOWN-ISSUES.md for common pitfalls to avoid.
`);
