/**
 * Provider-agnostic types for LLM integration.
 *
 * These types decouple the agentic loop from any specific LLM SDK,
 * allowing copilot-engine to work with Anthropic, OpenAI, or any
 * provider that supports tool-use / function-calling.
 */

// ─── Tool Definition (provider-agnostic) ─────────────────────────────────

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  [key: string]: unknown;
}

export interface Tool {
  name: string;
  description: string;
  input_schema: ToolInputSchema;
}

// ─── LLM Response (provider-agnostic) ────────────────────────────────────

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type ContentBlock = TextBlock | ToolUseBlock;

export interface LLMResponse {
  content: ContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | string;
}

// ─── Tool Result (fed back to the LLM) ──────────────────────────────────

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// ─── Message Types ──────────────────────────────────────────────────────

export interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[] | ToolResult[];
}

// ─── Provider Interface ─────────────────────────────────────────────────

export interface LLMProvider {
  createMessage(params: {
    model: string;
    maxTokens: number;
    system: string;
    tools: Tool[];
    messages: Message[];
  }): Promise<LLMResponse>;
}

// ─── Provider Config ────────────────────────────────────────────────────

export type ProviderName = "anthropic" | "openai";

export interface LLMConfig {
  provider: ProviderName;
  model: string;
  apiKey: string;
  maxTokens?: number;
}
