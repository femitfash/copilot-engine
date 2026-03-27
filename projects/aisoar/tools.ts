import type { Tool } from "../../src/engine/llm-types";

// ─── READ Tools (auto-execute in agentic loop) ─────────────────────────────

export const READ_TOOLS: Tool[] = [
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
  {
    name: "get_fraud_alerts",
    description:
      "Get recent fraud alerts detected by the LLM-powered fraud scanner or manual reports. Returns alerts with risk scores, types, status, and triggered rules. Use this when asked about recent fraud detections, flagged transactions, or fraud alert history.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max number of alerts to return (default: all)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_fraud_scanner_configs",
    description:
      "Get all configured fraud scanner bank connections and their status. Returns scanner configurations including bank API URL, schedule, enabled state, last scan time, and status. Use this to check if any bank endpoints are configured for automated fraud scanning.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_fraud_feedback_runs",
    description:
      "Get reinforcement learning feedback run results for a scanner config. Shows how many transactions were correctly detected vs missed, " +
      "what new rules were auto-generated, and analysis of patterns the scanner is missing. " +
      "Use this when the user asks about scanner accuracy, feedback results, learning progress, or missed detections.",
    input_schema: {
      type: "object" as const,
      properties: {
        configId: {
          type: "string",
          description: "Scanner configuration ID. Get this from get_fraud_scanner_configs first.",
        },
        limit: {
          type: "number",
          description: "Max feedback runs to return (default 10)",
        },
      },
      required: ["configId"],
    },
  },
  {
    name: "get_fraud_scan_logs",
    description:
      "Get recent scan execution logs for a fraud scanner configuration. Shows transactions scanned, flagged, alerts created, webhook status, and duration. " +
      "Use this when the user asks about scan reports, scan history, last N scans, or scan results. " +
      "First call get_fraud_scanner_configs to get the configId, then call this with that configId.",
    input_schema: {
      type: "object" as const,
      properties: {
        configId: {
          type: "string",
          description: "Scanner configuration ID to get logs for. Get this from get_fraud_scanner_configs first.",
        },
        limit: {
          type: "number",
          description: "Max number of log entries to return (default 20). Use this for 'last N scans' queries.",
        },
      },
      required: ["configId"],
    },
  },
  {
    name: "get_transaction_feedback",
    description:
      "Get analyst feedback history for a specific flagged transaction. Shows previous verdicts (confirmed_fraud, false_positive), reasoning, and any rules generated from the feedback. " +
      "Use this when the user asks about a specific transaction's feedback history or wants to know if it was previously reviewed.",
    input_schema: {
      type: "object" as const,
      properties: {
        transactionId: {
          type: "string",
          description: "Transaction ID to look up feedback for (e.g., TXN-MN67TD90)",
        },
      },
      required: ["transactionId"],
    },
  },
  {
    name: "get_fraud_rule_effectiveness",
    description:
      "Get effectiveness statistics for fraud detection rules including true positive rate, false positive rate, and total triggers. " +
      "Use this when asked about rule performance, accuracy, or which rules need tuning.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// ─── WRITE Tools (queued for user approval) ─────────────────────────────────

export const WRITE_TOOLS: Tool[] = [
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
  {
    name: "create_fraud_scanner_config",
    description:
      "Create a new fraud scanner configuration to connect to a bank's API for automated fraud detection. " +
      "This sets up a scheduled scan that fetches transaction batches from the bank, analyzes them with AI for fraud patterns, " +
      "stores flagged transactions as alerts, and optionally pushes results back to the bank via webhook. " +
      "Use this when the user wants to set up fraud scanning and no scanner configs exist, or when they want to add a new bank connection.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Display name for this connection (e.g., 'Acme Bank Production')" },
        bankApiBaseUrl: { type: "string", description: "Bank API base URL (e.g., 'https://api.bank.com')" },
        bankApiKey: { type: "string", description: "Bank API authentication key" },
        scannerId: { type: "string", description: "Scanner identity string (default: 'fraud-scanner-agent')" },
        webhookUrl: { type: "string", description: "Optional webhook URL override to push results back to bank" },
        userIds: {
          type: "array",
          items: { type: "string" },
          description: "Anonymized user IDs to monitor for fraud",
        },
        riskThreshold: { type: "number", description: "Risk score threshold 0-100 (default 40). Only flag transactions above this." },
        batchSize: { type: "number", description: "Number of transactions per batch (default 50, max 200)" },
        scanSchedule: {
          type: "string",
          enum: ["5min", "10min", "15min", "30min", "hourly", "daily"],
          description: "How often to scan (default: 'hourly')",
        },
        isEnabled: { type: "boolean", description: "Enable scheduled scanning immediately (default: true)" },
      },
      required: ["name", "bankApiBaseUrl", "bankApiKey", "userIds"],
    },
  },
  {
    name: "run_fraud_feedback",
    description:
      "Trigger a reinforcement learning feedback loop for a fraud scanner configuration. This fetches ground truth feedback from the bank API, " +
      "identifies missed fraudulent transactions, uses AI to analyze the missed patterns, and auto-generates new detection rules to improve future scans. " +
      "Use this when the user wants to improve the scanner's accuracy or learn from past mistakes.",
    input_schema: {
      type: "object" as const,
      properties: {
        configId: { type: "string", description: "Scanner configuration ID" },
      },
      required: ["configId"],
    },
  },
  {
    name: "run_fraud_scan",
    description:
      "Manually trigger a fraud scan for an existing scanner configuration. The scan runs asynchronously - " +
      "it fetches transactions from the bank API, analyzes them with AI, creates fraud alerts for suspicious transactions, " +
      "and pushes results back via webhook. Use this when the user wants to run a scan immediately rather than waiting for the schedule.",
    input_schema: {
      type: "object" as const,
      properties: {
        configId: { type: "string", description: "Scanner configuration ID to run" },
      },
      required: ["configId"],
    },
  },
  {
    name: "submit_alert_feedback",
    description:
      "Submit analyst feedback for a flagged transaction. Records whether it was confirmed fraud or a false positive, " +
      "updates rule effectiveness metrics, and can auto-tune or disable underperforming rules. " +
      "Use this when the analyst says a transaction is a false positive, confirmed fraud, needs investigation, or is inconclusive.",
    input_schema: {
      type: "object" as const,
      properties: {
        transactionId: { type: "string", description: "Transaction ID being reviewed" },
        alertId: { type: "string", description: "Alert ID if known" },
        scanLogId: { type: "string", description: "Scan log ID if known" },
        verdict: {
          type: "string",
          enum: ["confirmed_fraud", "false_positive", "needs_investigation", "inconclusive"],
          description: "Analyst's verdict on the transaction",
        },
        reasoning: { type: "string", description: "Analyst's explanation for the verdict" },
        confidence: { type: "number", description: "Confidence level 0-100" },
        triggeredRuleIds: {
          type: "array",
          items: { type: "string" },
          description: "IDs of rules that triggered this alert, if known",
        },
      },
      required: ["transactionId", "verdict"],
    },
  },
  {
    name: "create_rule_from_feedback",
    description:
      "Create a new fraud detection rule based on analyst feedback and transaction context. " +
      "Uses the analyst's reasoning to generate a targeted detection rule. " +
      "Use this when the analyst identifies a pattern that should be caught in future scans.",
    input_schema: {
      type: "object" as const,
      properties: {
        transactionId: { type: "string", description: "Transaction ID that prompted the rule" },
        ruleDescription: { type: "string", description: "What the rule should detect" },
        category: {
          type: "string",
          enum: ["velocity", "amount", "geographic", "behavioral", "device", "pattern"],
          description: "Rule category",
        },
        riskScoreImpact: { type: "number", description: "Risk score impact 1-100" },
      },
      required: ["transactionId", "ruleDescription"],
    },
  },
];

// ─── Exports ────────────────────────────────────────────────────────────────

export const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));
export const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];
