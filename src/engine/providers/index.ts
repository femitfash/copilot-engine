import type { LLMProvider, LLMConfig, ProviderName } from "../llm-types";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";

const DEFAULT_MODELS: Record<ProviderName, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4.1-mini",
};

/**
 * Build an LLMConfig from environment variables.
 *
 * Supports:
 *   LLM_PROVIDER=anthropic|openai  (default: anthropic)
 *   LLM_MODEL=<model-id>           (default: per-provider)
 *   ANTHROPIC_API_KEY=...           (used when provider=anthropic)
 *   OPENAI_API_KEY=...              (used when provider=openai)
 *
 * Legacy: if only ANTHROPIC_API_KEY is set and LLM_PROVIDER is unset,
 * defaults to Anthropic for backward compatibility.
 */
export function getLLMConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER || "anthropic") as ProviderName;

  let apiKey: string;
  if (provider === "openai") {
    apiKey = process.env.OPENAI_API_KEY || "";
  } else {
    apiKey = process.env.ANTHROPIC_API_KEY || "";
  }

  const model = process.env.LLM_MODEL || DEFAULT_MODELS[provider] || DEFAULT_MODELS.anthropic;

  return { provider, model, apiKey };
}

/**
 * Create the appropriate LLM provider instance from config.
 */
export function createProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(config.apiKey);
    case "anthropic":
    default:
      return new AnthropicProvider(config.apiKey);
  }
}
