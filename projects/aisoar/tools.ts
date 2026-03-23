import Anthropic from "@anthropic-ai/sdk";

// ─── READ Tools (auto-execute in agentic loop) ─────────────────────────────

export const READ_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_dashboard_stats",
    description:
      "Get dashboard overview including risk score, compliance status, open findings, and recent activity",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_active_profile",
    description:
      "Get the currently active system security profile including its name, type, and compliance framework",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_profiles",
    description:
      "List all system security profiles with their status and compliance framework assignments",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_inventory",
    description:
      "Get the asset inventory for the active profile including hardware, software, and network components",
    input_schema: {
      type: "object" as const,
      properties: {
        profileId: {
          type: "number",
          description: "Profile ID (uses active profile if not specified)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_poam_items",
    description:
      "Get Plan of Action & Milestones items with their status, risk level, and remediation timeline",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_critical_findings",
    description:
      "Get critical and high-severity findings that need immediate attention",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_evidence",
    description:
      "List compliance evidence artifacts with their type, status, and associated controls",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_policies",
    description:
      "List security policies with their approval status and last review date",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_scan_results",
    description:
      "Get security scan results from SAST, DAST, or unified scan engine",
    input_schema: {
      type: "object" as const,
      properties: {
        scan_type: {
          type: "string",
          enum: ["sast", "dast", "unified"],
          description: "Type of scan results to retrieve",
        },
      },
      required: [],
    },
  },
  {
    name: "get_threat_intel",
    description:
      "Get threat intelligence watchlist statistics and recent findings",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_ai_agents",
    description:
      "List all AI agents with their type, status, and capabilities",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_documents",
    description:
      "List uploaded documents in the document library",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_generated_documents",
    description:
      "List AI-generated compliance documents (SSPs, policies, etc.)",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_audit_logs",
    description:
      "Get recent audit log entries showing user actions and system events",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max records to return (default 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_admin_dashboard",
    description:
      "Get admin dashboard statistics including user counts, integration status, and system health",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// ─── WRITE Tools (queued for user approval) ─────────────────────────────────

export const WRITE_TOOLS: Anthropic.Tool[] = [
  {
    name: "create_profile",
    description:
      "Create a new system security profile with a name, type, and compliance framework",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Profile name" },
        type: { type: "string", description: "Profile type (e.g., 'FedRAMP High', 'CMMC L3')" },
        description: { type: "string", description: "Profile description" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_poam_item",
    description:
      "Create a new POA&M item for tracking a security finding or vulnerability",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Finding title" },
        description: { type: "string", description: "Detailed description of the finding" },
        severity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description: "Severity level",
        },
        controlId: { type: "string", description: "Associated NIST 800-53 control ID" },
        dueDate: { type: "string", description: "Remediation due date (ISO format)" },
      },
      required: ["title", "severity"],
    },
  },
  {
    name: "close_poam_item",
    description:
      "Close a POA&M item with remediation evidence and notes",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "POA&M item ID" },
        remediationNotes: { type: "string", description: "Description of remediation actions taken" },
      },
      required: ["id", "remediationNotes"],
    },
  },
  {
    name: "upload_evidence",
    description:
      "Upload a compliance evidence artifact linked to specific controls",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Evidence name" },
        type: { type: "string", description: "Evidence type (e.g., 'screenshot', 'config', 'policy')" },
        controlIds: {
          type: "array",
          items: { type: "string" },
          description: "Associated control IDs",
        },
        description: { type: "string", description: "Description of what this evidence proves" },
      },
      required: ["name", "type"],
    },
  },
  {
    name: "run_sast_scan",
    description:
      "Trigger a Static Application Security Testing (SAST) scan on a target",
    input_schema: {
      type: "object" as const,
      properties: {
        target: { type: "string", description: "Target repository or code path" },
        language: { type: "string", description: "Programming language to scan" },
      },
      required: ["target"],
    },
  },
  {
    name: "run_dast_scan",
    description:
      "Trigger a Dynamic Application Security Testing (DAST) scan against a URL",
    input_schema: {
      type: "object" as const,
      properties: {
        targetUrl: { type: "string", description: "URL to scan" },
        scanType: {
          type: "string",
          enum: ["quick", "full", "api"],
          description: "Scan depth",
        },
      },
      required: ["targetUrl"],
    },
  },
  {
    name: "generate_document",
    description:
      "Generate a compliance document using AI (SSP, policy, procedure, assessment report)",
    input_schema: {
      type: "object" as const,
      properties: {
        documentType: {
          type: "string",
          description: "Type of document to generate (e.g., 'SSP', 'Policy', 'Assessment Report')",
        },
        framework: {
          type: "string",
          description: "Compliance framework (e.g., 'NIST 800-53', 'FedRAMP', 'CMMC')",
        },
        context: { type: "string", description: "Additional context for document generation" },
      },
      required: ["documentType"],
    },
  },
  {
    name: "execute_agent_task",
    description:
      "Execute an AI agent task with specific parameters and instructions",
    input_schema: {
      type: "object" as const,
      properties: {
        agentId: { type: "string", description: "Agent ID to execute" },
        task: { type: "string", description: "Task description" },
        parameters: {
          type: "object",
          description: "Task-specific parameters",
        },
      },
      required: ["agentId", "task"],
    },
  },
  {
    name: "create_integration",
    description:
      "Create a new system integration/connector (SIEM, ticketing, cloud)",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Integration name" },
        type: { type: "string", description: "Integration type (e.g., 'siem', 'ticketing', 'cloud')" },
        config: { type: "object", description: "Integration configuration" },
      },
      required: ["name", "type"],
    },
  },
  {
    name: "connect_threat_feed",
    description:
      "Connect to a threat intelligence feed source",
    input_schema: {
      type: "object" as const,
      properties: {
        feedName: { type: "string", description: "Feed name" },
        feedUrl: { type: "string", description: "Feed URL or API endpoint" },
        feedType: { type: "string", description: "Feed type (e.g., 'STIX', 'TAXII', 'CSV')" },
      },
      required: ["feedName", "feedType"],
    },
  },
];

// ─── Exports ────────────────────────────────────────────────────────────────

export const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));
export const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];
