import type { ProviderName } from "./llm-types";

/**
 * Stable, provider-agnostic categories for LLM call failures.
 * These drive both the user-facing message and which categories
 * the frontend should render as an actionable banner.
 */
export type ProviderErrorCode =
  | "invalid_api_key"
  | "insufficient_credits"
  | "rate_limited"
  | "context_too_long"
  | "invalid_request"
  | "server_error"
  | "unknown";

export interface ClassifiedError {
  code: ProviderErrorCode;
  providerMessage: string;
}

function extractAnthropicShape(err: any): { status?: number; type?: string; message?: string } {
  const status = typeof err?.status === "number" ? err.status : undefined;
  const body = err?.error;
  const type = body?.error?.type;
  const message = body?.error?.message ?? err?.message;
  return { status, type, message };
}

function extractOpenAIShape(err: any): { status?: number; code?: string; message?: string } {
  const status = typeof err?.status === "number" ? err.status : undefined;
  const code = err?.code ?? err?.error?.code;
  const message = err?.error?.message ?? err?.message;
  return { status, code, message };
}

/**
 * Classify a raw LLM SDK error into a stable category + the provider's
 * actual message, so callers never have to guess from HTTP status alone.
 */
export function classifyProviderError(err: any, provider: ProviderName): ClassifiedError {
  if (provider === "openai") {
    const { status, code, message } = extractOpenAIShape(err);
    const providerMessage = message ?? "An unknown error occurred.";

    if (code === "insufficient_quota") {
      return { code: "insufficient_credits", providerMessage };
    }
    if (code === "context_length_exceeded" || /too long|maximum context length/i.test(providerMessage)) {
      return { code: "context_too_long", providerMessage };
    }
    if (code === "invalid_api_key" || status === 401 || status === 403) {
      return { code: "invalid_api_key", providerMessage };
    }
    if (status === 429 || code === "rate_limit_exceeded") {
      return { code: "rate_limited", providerMessage };
    }
    if (status === 400) {
      return { code: "invalid_request", providerMessage };
    }
    if (typeof status === "number" && status >= 500) {
      return { code: "server_error", providerMessage };
    }
    return { code: "unknown", providerMessage };
  }

  // Anthropic (default)
  const { status, type, message } = extractAnthropicShape(err);
  const providerMessage = message ?? "An unknown error occurred.";

  if (status === 400 && /credit balance/i.test(providerMessage)) {
    return { code: "insufficient_credits", providerMessage };
  }
  if (/too long|maximum context length/i.test(providerMessage)) {
    return { code: "context_too_long", providerMessage };
  }
  if (type === "authentication_error" || status === 401 || status === 403) {
    return { code: "invalid_api_key", providerMessage };
  }
  if (status === 429 || type === "rate_limit_error") {
    return { code: "rate_limited", providerMessage };
  }
  if (status === 400) {
    return { code: "invalid_request", providerMessage };
  }
  if (typeof status === "number" && status >= 500) {
    return { code: "server_error", providerMessage };
  }
  return { code: "unknown", providerMessage };
}

const CATEGORY_HEADLINES: Record<ProviderErrorCode, string> = {
  invalid_api_key: "This provider's API key was rejected.",
  insufficient_credits: "This provider account is out of credits or has exceeded its usage quota.",
  rate_limited: "Rate limited — please wait a moment and try again.",
  context_too_long: "The conversation is too long for this model. Please clear the conversation and try again.",
  invalid_request: "The request was rejected by the provider.",
  server_error: "The provider's servers returned an error. Please try again shortly.",
  unknown: "Something went wrong talking to the language model provider.",
};

/**
 * Build the user-facing message for a classified error, always including
 * the provider's own wording so the real cause is never hidden.
 */
export function friendlyMessageFor(classified: ClassifiedError): string {
  const headline = CATEGORY_HEADLINES[classified.code];
  return `${headline} (Provider said: "${classified.providerMessage}")`;
}
