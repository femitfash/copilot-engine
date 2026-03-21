import Anthropic from "@anthropic-ai/sdk";

// ─── READ Tools (auto-execute in agentic loop) ─────────────────────────────

export const READ_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_llm_settings",
    description:
      "Get the user's current LLM configuration including selected models, privacy level, and compliance settings",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_pii_settings",
    description:
      "Get the user's configured PII entity arrays — which personally identifiable information types are being detected",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_compliance_settings",
    description:
      "Get enabled compliance standards (GDPR, CCPA, HIPAA, PCI-DSS, etc.) and their configuration",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_customer_llms",
    description:
      "List all LLM models configured by the customer including custom endpoints, API key status, and model details",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_health_check_datasets",
    description:
      "List all AI health check datasets with their scan status, last scan date, and results summary",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_scan_results",
    description:
      "Get detailed results of a specific health check scan including data drift, hallucination, and compliance findings",
    input_schema: {
      type: "object" as const,
      properties: {
        scan_id: {
          type: "string",
          description: "The scan ID to retrieve results for",
        },
      },
      required: [],
    },
  },
  {
    name: "get_llm_history",
    description:
      "Get recent LLM usage history/logs showing prompts, models used, token counts, and timestamps",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max number of records to return (default 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_reliability_scores",
    description:
      "Get reliability and safety scores for recent LLM responses including risk levels and violation details",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string",
          description: "The prompt to evaluate",
        },
        llm_responses: {
          type: "array",
          items: { type: "string" },
          description: "LLM responses to evaluate for reliability",
        },
      },
      required: ["prompt", "llm_responses"],
    },
  },
  {
    name: "get_compliance_reports",
    description:
      "Get compliance analysis reports checking against GDPR, CCPA, HIPAA, PCI-DSS standards",
    input_schema: {
      type: "object" as const,
      properties: {
        compliance_array: {
          type: "array",
          items: { type: "string" },
          description:
            "Compliance standards to check (e.g., ['GDPR', 'HIPAA'])",
        },
      },
      required: [],
    },
  },
  {
    name: "list_rag_assistants",
    description:
      "List all RAG AI assistants configured by the user with their data sources, model, and status",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_chat_history",
    description: "Get conversation history for a specific RAG assistant",
    input_schema: {
      type: "object" as const,
      properties: {
        assistant_id: {
          type: "string",
          description: "The assistant/config ID",
        },
      },
      required: ["assistant_id"],
    },
  },
  {
    name: "get_notifications",
    description: "Get recent notifications and alerts",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_user_roles",
    description:
      "Get available user roles and their permissions within the organization",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_audit_logs",
    description:
      "Get AI gateway audit logs showing API calls, compliance checks, and security events",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max records to return (default 20)",
        },
        event_type: {
          type: "string",
          description: "Filter by event type",
        },
      },
      required: [],
    },
  },
];

// ─── WRITE Tools (queued for user approval) ─────────────────────────────────

export const WRITE_TOOLS: Anthropic.Tool[] = [
  {
    name: "detect_pii",
    description:
      "Scan text for personally identifiable information (PII). Returns detected entities with their types, positions, and confidence scores.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "The text to scan for PII" },
        pii_entities: {
          type: "array",
          items: { type: "string" },
          description:
            "Specific PII types to detect (e.g., ['FIRST_NAME', 'SSN', 'EMAIL']). If empty, uses user's configured entities.",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "anonymize_prompt",
    description:
      "Anonymize sensitive data in a prompt before sending to an LLM. Supports fictionalize (replace with realistic fake data) or mask (replace with [REDACTED]).",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string",
          description: "The prompt containing sensitive data",
        },
        strategy: {
          type: "string",
          enum: ["fictionalize", "mask"],
          description: "Anonymization strategy (default: fictionalize)",
        },
        pii_entities: {
          type: "array",
          items: { type: "string" },
          description:
            "PII types to anonymize. If empty, uses user's config.",
        },
        do_not_anonymize: {
          type: "array",
          items: { type: "string" },
          description: "Keywords to preserve (not anonymize)",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "chat_via_llm",
    description:
      "Send a prompt through the ZeroTrusted AI Gateway with full PII protection, compliance checks, and reliability scoring applied.",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: { type: "string", description: "The prompt to send" },
        llm: {
          type: "string",
          description: "LLM model to use (e.g., 'gpt-4', 'claude-3-sonnet')",
        },
        apply_anonymization: {
          type: "boolean",
          description:
            "Whether to auto-anonymize PII before sending (default: true)",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "update_llm_settings",
    description:
      "Update LLM configuration settings including selected models, privacy level, safeguard keywords, and compliance options.",
    input_schema: {
      type: "object" as const,
      properties: {
        settings: {
          type: "object",
          description: "Settings object with fields to update",
          properties: {
            privacy_level: { type: "number", description: "Privacy level 1-5" },
            safeguard_keywords: {
              type: "array",
              items: { type: "string" },
            },
            do_not_anonymize_keywords: {
              type: "array",
              items: { type: "string" },
            },
            compliance_enabled: { type: "boolean" },
            selected_compliance: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
      required: ["settings"],
    },
  },
  {
    name: "update_pii_entities",
    description:
      "Update the list of PII entity types that should be detected and anonymized.",
    input_schema: {
      type: "object" as const,
      properties: {
        entities: {
          type: "array",
          items: { type: "string" },
          description:
            "PII entity types (e.g., ['FIRST_NAME', 'LAST_NAME', 'SSN', 'CREDIT_CARD', 'EMAIL', 'PHONE'])",
        },
      },
      required: ["entities"],
    },
  },
  {
    name: "create_rag_assistant",
    description:
      "Create a new RAG-based AI assistant with uploaded documents as its knowledge base.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Assistant name" },
        description: {
          type: "string",
          description: "What this assistant does",
        },
        llm: { type: "string", description: "LLM model to use" },
        category: {
          type: "string",
          description:
            "Category (e.g., 'knowledge-base', 'support', 'compliance')",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_rag_assistant",
    description: "Delete a RAG assistant and its associated data.",
    input_schema: {
      type: "object" as const,
      properties: {
        assistant_id: {
          type: "string",
          description: "The assistant ID to delete",
        },
        assistant_name: {
          type: "string",
          description: "Name for confirmation",
        },
      },
      required: ["assistant_id"],
    },
  },
  {
    name: "run_health_check",
    description:
      "Trigger an AI health check scan including data drift analysis, hallucination detection, and compliance verification.",
    input_schema: {
      type: "object" as const,
      properties: {
        dataset_id: { type: "string", description: "Dataset to scan" },
        scan_types: {
          type: "array",
          items: {
            type: "string",
            enum: ["data_drift", "hallucination", "compliance", "reliability"],
          },
          description: "Types of scans to run",
        },
      },
      required: [],
    },
  },
  {
    name: "check_compliance",
    description:
      "Run a compliance check on a prompt/response pair against specified regulatory standards.",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: { type: "string", description: "The original prompt" },
        response: {
          type: "string",
          description: "The LLM response to check",
        },
        standards: {
          type: "array",
          items: { type: "string" },
          description:
            "Standards to check against (e.g., ['GDPR', 'HIPAA'])",
        },
      },
      required: ["prompt", "response"],
    },
  },
  {
    name: "execute_agent",
    description:
      "Execute an LLM agent with specific tools and instructions for automated tasks.",
    input_schema: {
      type: "object" as const,
      properties: {
        messages: {
          type: "array",
          description: "Agent conversation messages",
        },
        tools: {
          type: "array",
          description: "Tools available to the agent",
        },
        model: { type: "string", description: "LLM model for the agent" },
      },
      required: ["messages"],
    },
  },
];

// ─── Exports ────────────────────────────────────────────────────────────────

export const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));
export const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];
