import type { Tool } from "../engine/llm-types";

/**
 * Feature module interface — optional capabilities that can be enabled via COPILOT_FEATURES env var.
 *
 * Each feature module exports tools and executors that get merged into the project's
 * tool set at startup. Features are opt-in: set COPILOT_FEATURES=security-scanner,audit-log
 * in .env to enable them.
 */
export interface FeatureModule {
  /** Unique feature identifier (used in COPILOT_FEATURES env var) */
  name: string;

  /** Human-readable description shown during install */
  description: string;

  /** READ tools this feature provides (auto-execute) */
  readTools: Tool[];

  /** WRITE tools this feature provides (require approval) */
  writeTools: Tool[];

  /** Execute a READ tool from this feature */
  executeReadTool: (
    name: string,
    input: Record<string, unknown>,
    ctx: any
  ) => Promise<string | null>;

  /** Execute a WRITE tool from this feature */
  executeWriteTool: (
    name: string,
    input: Record<string, unknown>,
    ctx: any
  ) => Promise<unknown | null>;

  /** Additional system prompt instructions for this feature */
  systemPromptAddition: string;

  /** Initialize the feature (e.g., create Supabase tables). Called once at startup. */
  initialize?: () => Promise<void>;
}

/**
 * Load enabled feature modules based on COPILOT_FEATURES env var.
 * Returns empty array if no features are enabled.
 */
export async function loadEnabledFeatures(): Promise<FeatureModule[]> {
  const featureNames = (process.env.COPILOT_FEATURES || "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  if (featureNames.length === 0) return [];

  const features: FeatureModule[] = [];

  for (const name of featureNames) {
    try {
      const mod = await import(`./${name}`);
      const feature: FeatureModule = mod.default || mod.feature;
      if (feature && feature.name === name) {
        if (feature.initialize) {
          await feature.initialize();
        }
        features.push(feature);
        console.log(`  ✅ Feature enabled: ${feature.name} — ${feature.description}`);
      }
    } catch (err: any) {
      console.warn(`  ⚠️  Feature "${name}" not found or failed to load: ${err.message}`);
    }
  }

  return features;
}

/**
 * Merge feature tools into a project's tool set.
 */
export function mergeFeatureTools(
  projectReadTools: Tool[],
  projectWriteTools: Tool[],
  features: FeatureModule[]
): { allTools: Tool[]; writeToolNames: Set<string> } {
  const allRead = [...projectReadTools];
  const allWrite = [...projectWriteTools];

  for (const feature of features) {
    allRead.push(...feature.readTools);
    allWrite.push(...feature.writeTools);
  }

  const allTools = [...allRead, ...allWrite];
  const writeToolNames = new Set(allWrite.map((t) => t.name));

  return { allTools, writeToolNames };
}

/**
 * Create a combined executor that tries project executors first, then features.
 */
export function createFeatureAwareExecutor(
  projectExecutor: (name: string, input: Record<string, unknown>, ctx: any) => Promise<string>,
  features: FeatureModule[],
  type: "read" | "write"
): (name: string, input: Record<string, unknown>, ctx: any) => Promise<any> {
  return async (name, input, ctx) => {
    // Try project executor first
    try {
      const result = await projectExecutor(name, input, ctx);
      if (result !== null && !result.includes('"error":"Unknown tool:')) {
        return result;
      }
    } catch {
      // Fall through to features
    }

    // Try each feature
    for (const feature of features) {
      const executor =
        type === "read" ? feature.executeReadTool : feature.executeWriteTool;
      const result = await executor(name, input, ctx);
      if (result !== null) return result;
    }

    const msg = type === "read"
      ? `Unknown tool: ${name}`
      : `Unknown write tool: ${name}`;
    if (type === "read") return JSON.stringify({ error: msg });
    throw new Error(msg);
  };
}
