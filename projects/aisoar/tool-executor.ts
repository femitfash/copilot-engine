export interface ToolExecutionContext {
  /** Raw `Cookie` header, forwarded for READ-tool HTTP calls only. */
  userToken: string;
  identity?: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    profileId?: string;
  };
  toolCallId?: string;
  config: {
    aisoarApiUrl: string;
    /**
     * Injected by AISOAR's mount wiring so WRITE tools that map to a governed
     * tool (sast.run, dast.run, report.generate) call it in-process instead of
     * round-tripping over HTTP. Absent for other copilot-engine consumers
     * (wordpress/zerotrusted), which have no governed executor to inject.
     */
    executeGovernedTool?: (
      toolId: string,
      params: Record<string, unknown>,
      ctx: Record<string, unknown>
    ) => Promise<unknown>;
    [key: string]: unknown;
  };
}

const COPILOT_AGENT_ID = "agent.copilot_chat_assistant";
const COPILOT_AGENT_NAME = "Copilot Chat Assistant";

/**
 * Governed tool ids Copilot's WRITE tools call via executeGovernedTool().
 * Mirrored in AISOAR's shared/agentManifest.ts as this agent's capabilityEnvelope
 * so requireAutonomy() denies anything Copilot doesn't actually expose.
 */
export const COPILOT_GOVERNED_WRITE_TOOL_IDS = ["sast.run", "dast.run", "report.generate"];

function buildGovernedCtx(ctx: ToolExecutionContext, toolName: string): Record<string, unknown> {
  return {
    agentId: COPILOT_AGENT_ID,
    agentName: COPILOT_AGENT_NAME,
    userId: ctx.identity?.userId,
    profileId: ctx.identity?.profileId,
    taskType: "copilot_tool_execute",
    description: `Copilot: ${toolName}`,
  };
}

function requireGovernedExecutor(
  ctx: ToolExecutionContext
): NonNullable<ToolExecutionContext["config"]["executeGovernedTool"]> {
  if (!ctx.config.executeGovernedTool) {
    throw new Error(
      "Governed tool executor not configured — this write tool requires AISOAR's mount wiring to inject config.executeGovernedTool"
    );
  }
  return ctx.config.executeGovernedTool;
}

// Cross-repo duplicate of client/src/pages/reports.tsx's SECTOR_REPORT_TEMPLATES
// (copilot-engine can't import AISOAR's client code). Keep ids in sync.
const SECTOR_REPORT_TEMPLATES: Record<
  string,
  { label: string; frameworks: string[]; modules: string[]; reportType: string }
> = {
  "executive-risk": { label: "Executive Risk Report", frameworks: ["NIST CSF", "ISO 31000"], modules: ["risks", "vulnerabilities", "incidents", "threatIntel"], reportType: "executive" },
  "banking-financial": { label: "Banking & Financial Services", frameworks: ["PCI DSS", "SOX", "GLBA"], modules: ["risks", "vulnerabilities", "suppliers", "incidents"], reportType: "compliance" },
  "health-hipaa": { label: "Healthcare / HIPAA", frameworks: ["HIPAA", "HITECH", "NIST SP 800-66"], modules: ["risks", "vulnerabilities", "poam", "incidents"], reportType: "compliance" },
  "government-fisma": { label: "Government / FISMA", frameworks: ["FISMA", "NIST SP 800-53", "FedRAMP"], modules: ["poam", "risks", "vulnerabilities", "incidents"], reportType: "compliance" },
  "cmmc-2": { label: "CMMC 2.0", frameworks: ["CMMC 2.0", "NIST SP 800-171", "NIST SP 800-172"], modules: ["poam", "risks", "vulnerabilities", "cspm"], reportType: "compliance" },
  "energy-nerc-cip": { label: "Energy / NERC CIP", frameworks: ["NERC CIP", "ICS-CERT"], modules: ["vulnerabilities", "risks", "incidents", "threatIntel"], reportType: "compliance" },
  "eu-ai-compliance": { label: "EU AI Compliance", frameworks: ["EU AI Act", "GDPR", "ISO 42001"], modules: ["risks", "vulnerabilities", "poam"], reportType: "compliance" },
  "japan-ai-compliance": { label: "Japan AI Compliance", frameworks: ["APPI", "Japan AI Guidelines"], modules: ["risks", "vulnerabilities", "poam"], reportType: "compliance" },
  "brazil-ai-compliance": { label: "Brazil AI Compliance", frameworks: ["LGPD", "Brazil AI Framework"], modules: ["risks", "vulnerabilities", "poam"], reportType: "compliance" },
  "fraud-detection": { label: "Fraud Detection", frameworks: ["ISO 27001", "PCI DSS"], modules: ["incidents", "threatIntel", "vulnerabilities", "risks"], reportType: "security_posture" },
  "aml-kyc": { label: "AML / KYC", frameworks: ["BSA/AML", "FATF", "FinCEN"], modules: ["risks", "incidents", "suppliers", "threatIntel"], reportType: "compliance" },
  "insurance": { label: "Insurance Compliance", frameworks: ["NAIC #668", "NY DFS 23 NYCRR 500", "GLBA"], modules: ["risks", "vulnerabilities", "suppliers", "incidents"], reportType: "compliance" },
  "soc2": { label: "SOC 2 Type II", frameworks: ["AICPA TSC", "CC1-CC9", "SOC 2 Type II"], modules: ["risks", "vulnerabilities", "poam", "incidents"], reportType: "compliance" },
  "iso42001": { label: "ISO/IEC 42001 AI Management", frameworks: ["ISO/IEC 42001", "NIST AI RMF", "ISO 27001"], modules: ["risks", "vulnerabilities", "poam", "threatIntel"], reportType: "compliance" },
};

const MAX_RESULT_SIZE = 8000; // Truncate to prevent token overflow

function truncate(json: string): string {
  if (json.length <= MAX_RESULT_SIZE) return json;
  return json.substring(0, MAX_RESULT_SIZE) + '..."truncated"}';
}

async function apiCall(
  url: string,
  options: RequestInit,
  cookies?: string
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  // Forward session cookie for AISOAR's session-based auth
  if (cookies) {
    headers["Cookie"] = cookies;
  }
  // Set Origin header to pass CSRF checks (server-to-server calls lack Origin by default)
  const baseUrl = new URL(url);
  headers["Origin"] = baseUrl.origin;

  const res = await fetch(url, { ...options, headers, credentials: "include" });
  const text = await res.text();

  if (!res.ok) {
    return JSON.stringify({
      error: true,
      status: res.status,
      message: `API call to ${url} failed (${res.status}): ${text.substring(0, 200)}`,
    });
  }

  return truncate(text);
}

// Same auth/CSRF handling as apiCall, but returns parsed JSON (or null on any
// failure) instead of a truncated string — for tools that need to chain two
// calls (e.g. resolve the latest runId, then read that run's state) without
// truncating the intermediate response before it's even parsed.
async function apiCallJson<T = any>(
  url: string,
  options: RequestInit,
  cookies?: string
): Promise<T | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (cookies) {
    headers["Cookie"] = cookies;
  }
  const baseUrl = new URL(url);
  headers["Origin"] = baseUrl.origin;

  const res = await fetch(url, { ...options, headers, credentials: "include" });
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Mirrors missionIdFor() in AISOAR's server/services/launchpadWorkflowRuleRunner.ts —
// keep in sync if that format ever changes.
function launchpadMissionId(projectId: string, runId: string, unitId: string): string {
  return `launchpad:${projectId}:${runId}:${unitId}`;
}

// ─── READ Tool Executor ─────────────────────────────────────────────────────

export async function executeReadTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<string> {
  const base = ctx.config.aisoarApiUrl;
  const cookies = ctx.userToken; // AISOAR uses session cookies, passed as the "token"

  switch (toolName) {
    case "get_dashboard_stats": {
      return apiCall(`${base}/api/admin/dashboard`, { method: "GET" }, cookies);
    }

    case "get_active_profile": {
      return apiCall(`${base}/api/profiles/active`, { method: "GET" }, cookies);
    }

    case "list_profiles": {
      return apiCall(`${base}/api/profiles`, { method: "GET" }, cookies);
    }

    case "get_inventory": {
      const profileId = input.profileId || "active";
      return apiCall(
        `${base}/api/profiles/${profileId}/inventory`,
        { method: "GET" },
        cookies
      );
    }

    case "get_poam_items": {
      return apiCall(`${base}/api/poam-items`, { method: "GET" }, cookies);
    }

    case "get_critical_findings": {
      return apiCall(
        `${base}/api/poam-items/critical`,
        { method: "GET" },
        cookies
      );
    }

    case "get_evidence": {
      return apiCall(`${base}/api/artifacts`, { method: "GET" }, cookies);
    }

    case "get_policies": {
      return apiCall(`${base}/api/policies`, { method: "GET" }, cookies);
    }

    case "get_scan_results": {
      const scanType = (input.scan_type as string) || "unified";
      return apiCall(
        `${base}/api/scan-engine/results?type=${scanType}`,
        { method: "GET" },
        cookies
      );
    }

    case "get_threat_intel": {
      return apiCall(
        `${base}/api/threat-intel/watchlist-stats`,
        { method: "GET" },
        cookies
      );
    }

    case "list_ai_agents": {
      return apiCall(`${base}/api/ai-agents`, { method: "GET" }, cookies);
    }

    case "get_documents": {
      return apiCall(`${base}/api/documents`, { method: "GET" }, cookies);
    }

    case "get_generated_documents": {
      return apiCall(`${base}/api/generated`, { method: "GET" }, cookies);
    }

    case "get_audit_logs": {
      const limit = input.limit || 20;
      return apiCall(
        `${base}/api/admin/audit-log?limit=${limit}`,
        { method: "GET" },
        cookies
      );
    }

    case "get_admin_dashboard": {
      return apiCall(`${base}/api/admin/dashboard`, { method: "GET" }, cookies);
    }

    case "get_fraud_alerts": {
      return apiCall(`${base}/api/fraud/alerts`, { method: "GET" }, cookies);
    }

    case "get_fraud_scanner_configs": {
      return apiCall(`${base}/api/fraud/scanner-configs`, { method: "GET" }, cookies);
    }

    case "get_fraud_feedback_runs": {
      const configId = input.configId as string;
      const limit = input.limit || 10;
      return apiCall(
        `${base}/api/fraud/feedback/runs/${configId}?limit=${limit}`,
        { method: "GET" },
        cookies
      );
    }

    case "get_fraud_scan_logs": {
      const configId = input.configId as string;
      const limit = input.limit || 20;
      return apiCall(
        `${base}/api/fraud/scanner/logs/${configId}?limit=${limit}`,
        { method: "GET" },
        cookies
      );
    }

    case "get_transaction_feedback": {
      const txnId = input.transactionId as string;
      return apiCall(
        `${base}/api/fraud/alert-feedback?transactionId=${encodeURIComponent(txnId)}`,
        { method: "GET" },
        cookies
      );
    }

    case "get_fraud_rule_effectiveness": {
      return apiCall(`${base}/api/fraud/alert-feedback/stats`, { method: "GET" }, cookies);
    }

    case "get_unified_findings": {
      const params = new URLSearchParams();
      for (const key of ["severity", "findingType", "status", "executorType", "since", "until", "limit"] as const) {
        const value = input[key];
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, String(value));
        }
      }
      const qs = params.toString();
      return apiCall(
        `${base}/api/unified-findings${qs ? `?${qs}` : ""}`,
        { method: "GET" },
        cookies
      );
    }

    case "list_launchpad_projects": {
      const overview = await apiCallJson<{ projects?: Array<Record<string, any>> }>(
        `${base}/api/launchpad/overview`,
        { method: "GET" },
        cookies
      );
      const projects = (overview?.projects || []).map((p) => ({
        id: p.id,
        name: p.name,
        department: p.config?.scan?.department,
        status: p.status,
        lifecycleStage: p.lifecycleStage,
        stage: p.config?.stage,
      }));
      return truncate(JSON.stringify({ projects }));
    }

    case "get_workflow_rule_run_status": {
      const projectId = input.projectId as string;
      const params = new URLSearchParams();
      if (input.runId) params.set("runId", String(input.runId));
      const qs = params.toString();
      return apiCall(
        `${base}/api/launchpad/projects/${projectId}/workflow-rule/state${qs ? `?${qs}` : ""}`,
        { method: "GET" },
        cookies
      );
    }

    case "get_workflow_rule_runs": {
      const projectId = input.projectId as string;
      return apiCall(
        `${base}/api/launchpad/projects/${projectId}/workflow-rule/runs`,
        { method: "GET" },
        cookies
      );
    }

    case "get_launchpad_dynamic_tools": {
      const projectId = input.projectId as string;
      return apiCall(
        `${base}/api/launchpad/projects/${projectId}/dynamic-tools`,
        { method: "GET" },
        cookies
      );
    }

    case "diagnose_launchpad_unit": {
      const projectId = input.projectId as string;
      const unitId = input.unitId as string;
      let runId = input.runId as string | undefined;

      if (!runId) {
        const runsData = await apiCallJson<{ runs?: Array<{ runId: string }> }>(
          `${base}/api/launchpad/projects/${projectId}/workflow-rule/runs`,
          { method: "GET" },
          cookies
        );
        runId = runsData?.runs?.[0]?.runId;
        if (!runId) {
          return truncate(JSON.stringify({ error: true, message: "This project has no Workflow Rule runs yet." }));
        }
      }

      // Force-generate the cached plain-language explanation (zeroItemsExplanation) before
      // reading state, so it's present on the first ask rather than requiring the user to
      // click "Explain in plain language" themselves first. Best-effort: state is still read
      // and returned even if this fails or the gateway declines.
      await apiCallJson(
        `${base}/api/launchpad/projects/${projectId}/workflow-rule/units/${encodeURIComponent(unitId)}/explain`,
        { method: "POST", body: JSON.stringify({ runId }) },
        cookies
      );

      const [state, project] = await Promise.all([
        apiCallJson<{ units?: any[] }>(
          `${base}/api/launchpad/projects/${projectId}/workflow-rule/state?runId=${encodeURIComponent(runId)}`,
          { method: "GET" },
          cookies
        ),
        apiCallJson<{ config?: { workflowRule?: { plan?: { units?: any[] } } } }>(
          `${base}/api/launchpad/projects/${projectId}`,
          { method: "GET" },
          cookies
        ),
      ]);

      const runtimeUnit = state?.units?.find((u) => u.unitId === unitId);
      if (!runtimeUnit) {
        return truncate(JSON.stringify({ error: true, message: `Unit ${unitId} has no task in run ${runId}.` }));
      }
      const planUnit = project?.config?.workflowRule?.plan?.units?.find((u: any) => u.unitId === unitId);

      return truncate(
        JSON.stringify({
          runId,
          ...runtimeUnit,
          plan: planUnit
            ? {
                steps: planUnit.steps,
                forEach: planUnit.forEach,
                filter: planUnit.filter,
                matchedAgentId: planUnit.matchedAgentId,
                candidateAgentIds: planUnit.candidateAgentIds,
                unsatisfiedCapabilities: planUnit.unsatisfiedCapabilities,
                dependsOn: planUnit.dependsOn,
              }
            : null,
        })
      );
    }

    case "get_launchpad_unit_run_history": {
      const projectId = input.projectId as string;
      const unitId = input.unitId as string;
      const params = new URLSearchParams();
      if (input.limit) params.set("limit", String(input.limit));
      const qs = params.toString();
      return apiCall(
        `${base}/api/launchpad/projects/${projectId}/workflow-rule/units/${encodeURIComponent(unitId)}/run-history${qs ? `?${qs}` : ""}`,
        { method: "GET" },
        cookies
      );
    }

    case "get_tool_registry_info": {
      const toolId = input.toolId as string;
      return apiCall(
        `${base}/api/tools/inventory/${encodeURIComponent(toolId)}`,
        { method: "GET" },
        cookies
      );
    }

    case "get_launchpad_pending_approvals": {
      const projectId = input.projectId as string;
      const unitId = input.unitId as string;
      const runId = input.runId as string;
      const agentId = input.agentId as string | undefined;

      const missionId = launchpadMissionId(projectId, runId, unitId);
      const missionApprovals = await apiCallJson<any[]>(
        `${base}/api/missions/${encodeURIComponent(missionId)}/approval-requests`,
        { method: "GET" },
        cookies
      );
      if (Array.isArray(missionApprovals) && missionApprovals.length > 0) {
        return truncate(JSON.stringify({ source: "mission", missionId, approvals: missionApprovals }));
      }

      if (agentId) {
        const agentApprovals = await apiCallJson<any[]>(
          `${base}/api/ai-agents/${encodeURIComponent(agentId)}/approval-requests?status=pending`,
          { method: "GET" },
          cookies
        );
        if (Array.isArray(agentApprovals) && agentApprovals.length > 0) {
          return truncate(
            JSON.stringify({
              source: "agent_fallback",
              missionId,
              note: "No pending approvals under this run's mission id, but this agent has pending approvals from another run/context — review the agentId/toolId on each to confirm relevance.",
              approvals: agentApprovals,
            })
          );
        }
      }

      return truncate(JSON.stringify({ source: agentId ? "mission_and_agent" : "mission_only", missionId, approvals: [] }));
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ─── WRITE Tool Executor (called after user approval) ───────────────────────

export async function executeWriteTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<any> {
  const base = ctx.config.aisoarApiUrl;
  const cookies = ctx.userToken;

  switch (toolName) {
    case "create_profile": {
      // Fill in all NOT NULL fields with defaults if not provided by the LLM
      const profileData = {
        name: input.name || "New Profile",
        description: input.description || "",
        systemName: (input.name as string) || "System",
        systemVersion: "1.0",
        organizationName: "Organization",
        ownerName: "System Owner",
        ownerTitle: "ISSO",
        ownerEmail: "owner@org.local",
        securityContactName: "Security Contact",
        securityContactEmail: "security@org.local",
        privacyContactName: "Privacy Contact",
        privacyContactEmail: "privacy@org.local",
        fipsImpactLevel: "High",
        isActive: false,
        ...input, // LLM-provided values override defaults
      };
      return apiCall(
        `${base}/api/profiles`,
        { method: "POST", body: JSON.stringify(profileData) },
        cookies
      );
    }

    case "create_poam_item": {
      return apiCall(
        `${base}/api/poam-items`,
        { method: "POST", body: JSON.stringify(input) },
        cookies
      );
    }

    case "close_poam_item": {
      const { id, ...rest } = input;
      return apiCall(
        `${base}/api/poam-items/${id}/close`,
        { method: "POST", body: JSON.stringify(rest) },
        cookies
      );
    }

    case "upload_evidence": {
      return apiCall(
        `${base}/api/artifacts`,
        { method: "POST", body: JSON.stringify(input) },
        cookies
      );
    }

    case "run_sast_scan": {
      const executeGovernedTool = requireGovernedExecutor(ctx);
      return executeGovernedTool(
        "sast.run",
        { target: input.target },
        buildGovernedCtx(ctx, toolName)
      );
    }

    case "run_dast_scan": {
      const executeGovernedTool = requireGovernedExecutor(ctx);
      return executeGovernedTool(
        "dast.run",
        { targetUrl: input.targetUrl, scanType: input.scanType || "quick" },
        buildGovernedCtx(ctx, toolName)
      );
    }

    case "generate_report": {
      const executeGovernedTool = requireGovernedExecutor(ctx);
      const templateId = input.templateId as string | undefined;
      const template = templateId ? SECTOR_REPORT_TEMPLATES[templateId] : undefined;
      const reportType = (input.reportType as string) || template?.reportType || "security_posture";
      const modules = (input.modules as string[] | undefined) ?? template?.modules;
      const dateRangeStart = input.dateRangeStart as string | undefined;
      const dateRangeEnd = input.dateRangeEnd as string | undefined;

      const queryParts: string[] = [];
      if (template) {
        queryParts.push(`${template.label} report covering frameworks: ${template.frameworks.join(", ")}`);
      }
      if (modules?.length) {
        queryParts.push(`focused on data modules: ${modules.join(", ")}`);
      }
      if (dateRangeStart || dateRangeEnd) {
        queryParts.push(`for the period ${dateRangeStart ?? "earliest available"} to ${dateRangeEnd ?? "now"}`);
      }
      if (input.query) {
        queryParts.push(input.query as string);
      }
      if (input.title) {
        queryParts.push(`titled "${input.title as string}"`);
      }
      const query = queryParts.length
        ? queryParts.join("; ")
        : "security findings risks evidence recommendations";

      return executeGovernedTool(
        "report.generate",
        { query, reportType },
        buildGovernedCtx(ctx, toolName)
      );
    }

    case "generate_document": {
      return apiCall(
        `${base}/api/generate`,
        { method: "POST", body: JSON.stringify(input) },
        cookies
      );
    }

    case "execute_agent_task": {
      return apiCall(
        `${base}/api/agent-tasks/run`,
        { method: "POST", body: JSON.stringify(input) },
        cookies
      );
    }

    case "create_integration": {
      return apiCall(
        `${base}/api/admin/integrations`,
        { method: "POST", body: JSON.stringify(input) },
        cookies
      );
    }

    case "connect_threat_feed": {
      return apiCall(
        `${base}/api/threat-intel/connect`,
        { method: "POST", body: JSON.stringify(input) },
        cookies
      );
    }

    case "create_fraud_scanner_config": {
      const configData = {
        scannerId: "blue-team-scanner-v1",
        scanSchedule: "hourly",
        riskThreshold: 40,
        batchSize: 50,
        isEnabled: true,
        bankApiBaseUrl: "http://localhost:3030",
        bankApiKey: "fraud-sim-key-2026",
        ...input,
      };
      return apiCall(
        `${base}/api/fraud/scanner-configs`,
        { method: "POST", body: JSON.stringify(configData) },
        cookies
      );
    }

    case "run_fraud_feedback": {
      const configId = input.configId as string;
      return apiCall(
        `${base}/api/fraud/feedback/run/${configId}`,
        { method: "POST", body: JSON.stringify({}) },
        cookies
      );
    }

    case "run_fraud_scan": {
      const configId = input.configId as string;
      return apiCall(
        `${base}/api/fraud/scanner/run/${configId}`,
        { method: "POST", body: JSON.stringify({}) },
        cookies
      );
    }

    case "submit_alert_feedback": {
      return apiCall(
        `${base}/api/fraud/alert-feedback`,
        { method: "POST", body: JSON.stringify(input) },
        cookies
      );
    }

    case "create_rule_from_feedback": {
      const { transactionId, ruleDescription, category, riskScoreImpact } = input;
      // Create a rule directly via the rules endpoint
      return apiCall(
        `${base}/api/fraud/rules`,
        {
          method: "POST",
          body: JSON.stringify({
            ruleId: `ANALYST-${Date.now()}`,
            name: `[Analyst] ${(ruleDescription as string).slice(0, 80)}`,
            description: ruleDescription,
            category: category || "behavioral",
            action: "alert",
            riskScoreImpact: riskScoreImpact || 50,
            priority: 70,
            isEnabled: true,
            conditions: {
              source: "analyst_feedback",
              sourceTransactionId: transactionId,
              createdAt: new Date().toISOString(),
            },
          }),
        },
        cookies
      );
    }

    case "propose_workflow_rule": {
      const { projectId, ...rest } = input;
      return apiCall(
        `${base}/api/launchpad/projects/${projectId}/workflow-rule/propose`,
        { method: "POST", body: JSON.stringify(rest) },
        cookies
      );
    }

    case "accept_workflow_rule": {
      const { projectId, ...rest } = input;
      return apiCall(
        `${base}/api/launchpad/projects/${projectId}/workflow-rule/accept`,
        { method: "POST", body: JSON.stringify(rest) },
        cookies
      );
    }

    case "run_workflow_rule": {
      const { projectId, ...rest } = input;
      return apiCall(
        `${base}/api/launchpad/projects/${projectId}/workflow-rule/run`,
        { method: "POST", body: JSON.stringify(rest) },
        cookies
      );
    }

    case "dismiss_launchpad_capability_gap": {
      const { projectId, unitId, ...rest } = input;
      return apiCall(
        `${base}/api/launchpad/projects/${projectId}/workflow-rule/units/${encodeURIComponent(unitId as string)}/dismiss-capability`,
        { method: "PATCH", body: JSON.stringify(rest) },
        cookies
      );
    }

    case "reassign_launchpad_unit_agent": {
      const { projectId, unitId, agentId } = input;
      return apiCall(
        `${base}/api/launchpad/projects/${projectId}/workflow-rule/units/${encodeURIComponent(unitId as string)}/agent`,
        { method: "PATCH", body: JSON.stringify({ agentId: agentId ?? null }) },
        cookies
      );
    }

    case "patch_launchpad_unit_plan": {
      const { projectId, unitId, ...rest } = input;
      return apiCall(
        `${base}/api/launchpad/projects/${projectId}/workflow-rule/units/${encodeURIComponent(unitId as string)}/steps`,
        { method: "PATCH", body: JSON.stringify(rest) },
        cookies
      );
    }

    case "schedule_test": {
      return apiCall(
        `${base}/api/test-scheduler`,
        { method: "POST", body: JSON.stringify(input) },
        cookies
      );
    }

    default:
      throw new Error(`Unknown write tool: ${toolName}`);
  }
}
