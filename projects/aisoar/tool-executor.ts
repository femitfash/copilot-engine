export interface ToolExecutionContext {
  userToken: string;
  config: {
    aisoarApiUrl: string;
    [key: string]: string;
  };
}

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
      return apiCall(
        `${base}/api/sast/scan`,
        { method: "POST", body: JSON.stringify(input) },
        cookies
      );
    }

    case "run_dast_scan": {
      return apiCall(
        `${base}/api/dast/scan`,
        { method: "POST", body: JSON.stringify(input) },
        cookies
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

    default:
      throw new Error(`Unknown write tool: ${toolName}`);
  }
}
