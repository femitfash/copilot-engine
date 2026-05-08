const MAX_RESULT_SIZE = 8000;

function truncate(json: string): string {
  if (json.length <= MAX_RESULT_SIZE) return json;
  return json.substring(0, MAX_RESULT_SIZE) + '..."truncated"}';
}

function getConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.FASTGRC_BASE_URL || "https://www.fastgrc.ai";
  const apiKey = process.env.FASTGRC_API_KEY || "";
  return { baseUrl, apiKey };
}

async function fastgrcFetch(
  path: string,
  options: RequestInit,
  apiKey: string,
  baseUrl: string
): Promise<any> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  if (!text) return { status: res.status };
  try {
    return JSON.parse(text);
  } catch {
    return { status: res.status, body: text.substring(0, 500) };
  }
}

export async function executeReadTool(
  name: string,
  input: Record<string, unknown>,
  _ctx: any
): Promise<string | null> {
  const { baseUrl, apiKey } = getConfig();

  if (!apiKey) {
    return JSON.stringify({ error: "FASTGRC_API_KEY not configured. Set it in your .env file." });
  }

  switch (name) {
    case "list_agent_policies": {
      const params = new URLSearchParams();
      if (input.status) params.set("status", String(input.status));
      if (input.limit) params.set("limit", String(input.limit));
      const data = await fastgrcFetch(
        `/api/v1/policy-router/policies?${params}`,
        { method: "GET" },
        apiKey,
        baseUrl
      );
      return truncate(JSON.stringify(data));
    }

    case "get_agent_policy": {
      const data = await fastgrcFetch(
        `/api/v1/policy-router/policies/${input.policy_id}`,
        { method: "GET" },
        apiKey,
        baseUrl
      );
      return truncate(JSON.stringify(data));
    }

    case "evaluate_action": {
      const body: Record<string, unknown> = {
        subject_type: input.subject_type || "task",
        subject_content: input.subject_content,
      };
      if (input.policy_id) body.policy_id = input.policy_id;
      if (input.agent_id) body.agent_id = input.agent_id;
      if (input.agent_type) body.agent_type = input.agent_type;
      if (input.mode) body.mode = input.mode;
      if (input.direction) body.direction = input.direction;
      if (input.session_id) body.session_id = input.session_id;
      if (input.override_block !== undefined) body.override_block = input.override_block;

      const data = await fastgrcFetch(
        `/api/v1/policy-router/evaluate`,
        { method: "POST", body: JSON.stringify(body) },
        apiKey,
        baseUrl
      );
      return truncate(JSON.stringify(data));
    }

    case "list_policy_decisions": {
      const params = new URLSearchParams({ limit: String(input.limit || 50) });
      if (input.decision) params.set("decision", String(input.decision));
      const data = await fastgrcFetch(
        `/api/v1/policy-router/decisions?${params}`,
        { method: "GET" },
        apiKey,
        baseUrl
      );
      return truncate(JSON.stringify(data));
    }

    default:
      return null;
  }
}

export async function executeWriteTool(
  name: string,
  input: Record<string, unknown>,
  _ctx: any
): Promise<unknown | null> {
  const { baseUrl, apiKey } = getConfig();

  if (!apiKey) {
    return JSON.stringify({ error: "FASTGRC_API_KEY not configured. Set it in your .env file." });
  }

  switch (name) {
    case "create_agent_policy": {
      const body: Record<string, unknown> = {
        name: input.name,
      };
      if (input.description) body.description = input.description;
      if (input.agent_id) body.agentId = input.agent_id;
      if (input.agent_type) body.agentType = input.agent_type;
      if (input.risk_tolerance) body.riskTolerance = input.risk_tolerance;
      if (input.default_mode) body.defaultMode = input.default_mode;
      if (input.allowed_actions) body.allowedActions = input.allowed_actions;
      if (input.blocked_actions) body.blockedActions = input.blocked_actions;
      if (input.sensitive_patterns) body.sensitivePatterns = input.sensitive_patterns;
      if (input.require_approval_patterns) body.requireApprovalPatterns = input.require_approval_patterns;
      if (input.allowed_tools) body.allowedTools = input.allowed_tools;
      if (input.blocked_tools) body.blockedTools = input.blocked_tools;
      if (input.tool_mode) body.toolMode = input.tool_mode;
      if (input.blocked_output_patterns) body.blockedOutputPatterns = input.blocked_output_patterns;
      if (input.egress_skill) body.egressSkill = input.egress_skill;
      if (input.kill_switch !== undefined) body.killSwitch = input.kill_switch;
      if (input.paused !== undefined) body.paused = input.paused;

      const data = await fastgrcFetch(
        `/api/v1/policy-router/policies`,
        { method: "POST", body: JSON.stringify(body) },
        apiKey,
        baseUrl
      );
      return data;
    }

    case "update_agent_policy": {
      const { policy_id, ...fields } = input;
      const body: Record<string, unknown> = {};
      if (fields.blocked_actions !== undefined) body.blockedActions = fields.blocked_actions;
      if (fields.allowed_actions !== undefined) body.allowedActions = fields.allowed_actions;
      if (fields.sensitive_patterns !== undefined) body.sensitivePatterns = fields.sensitive_patterns;
      if (fields.require_approval_patterns !== undefined) body.requireApprovalPatterns = fields.require_approval_patterns;
      if (fields.allowed_tools !== undefined) body.allowedTools = fields.allowed_tools;
      if (fields.blocked_tools !== undefined) body.blockedTools = fields.blocked_tools;
      if (fields.risk_tolerance !== undefined) body.riskTolerance = fields.risk_tolerance;
      if (fields.default_mode !== undefined) body.defaultMode = fields.default_mode;
      if (fields.tool_mode !== undefined) body.toolMode = fields.tool_mode;
      if (fields.blocked_output_patterns !== undefined) body.blockedOutputPatterns = fields.blocked_output_patterns;
      if (fields.egress_skill !== undefined) body.egressSkill = fields.egress_skill;
      if (fields.kill_switch !== undefined) body.killSwitch = fields.kill_switch;
      if (fields.paused !== undefined) body.paused = fields.paused;
      if (fields.change_reason !== undefined) body.change_reason = fields.change_reason;

      const data = await fastgrcFetch(
        `/api/v1/policy-router/policies/${policy_id}`,
        { method: "PUT", body: JSON.stringify(body) },
        apiKey,
        baseUrl
      );
      return data;
    }

    case "confirm_agent_policy": {
      const data = await fastgrcFetch(
        `/api/v1/policy-router/policies/${input.policy_id}/confirm`,
        { method: "POST", body: JSON.stringify({}) },
        apiKey,
        baseUrl
      );
      return data;
    }

    case "delete_agent_policy": {
      const data = await fastgrcFetch(
        `/api/v1/policy-router/policies/${input.policy_id}`,
        { method: "DELETE" },
        apiKey,
        baseUrl
      );
      return data;
    }

    default:
      return null;
  }
}
