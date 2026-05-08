import type { Tool } from "../../engine/llm-types";

export const readTools: Tool[] = [
  {
    name: "list_agent_policies",
    description:
      "List all agent policies in the FastGRC organization. " +
      "Optionally filter by status (inferred, confirmed, modified) or risk tolerance (low, medium, high). " +
      "Returns policy names, IDs, agent types, status, and key settings.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: inferred, confirmed, modified" },
        risk_tolerance: { type: "string", description: "Filter by risk tolerance: low, medium, high" },
        limit: { type: "number", description: "Max results to return (default 50)" },
      },
      required: [],
    },
  },
  {
    name: "get_agent_policy",
    description:
      "Get the full details of a specific agent policy by ID, including all allowed/blocked actions, " +
      "sensitive patterns, tool lists, and version history.",
    input_schema: {
      type: "object",
      properties: {
        policy_id: { type: "string", description: "The policy ID to retrieve" },
      },
      required: ["policy_id"],
    },
  },
  {
    name: "evaluate_action",
    description:
      "Evaluate whether an agent action or output is allowed, blocked, or requires approval under a given policy. " +
      "Use for INGRESS (before agent acts): subject_type=task/prompt/plan/tool_argument, direction=ingress. " +
      "Use for EGRESS (before returning to user): subject_type=tool_result, direction=egress — checks outputs for credential leaks, PII, and policy violations. " +
      "The ingress response includes a sessionId; pass it on the egress call to link both records in the audit log. " +
      "Response includes skillGuidance (displayAlert, blockResponse, escalate) — use this to decide how the SDK should respond to the user. " +
      "Returns decision (allow/block/require_approval/verify/uncertain), confidence, reasoning, direction, sessionId, and skillGuidance.",
    input_schema: {
      type: "object",
      properties: {
        subject_content: { type: "string", description: "The action or content to evaluate" },
        subject_type: {
          type: "string",
          description: "Type of subject: task, tool_argument, prompt, plan, tool_result. Use tool_result for ALL egress evaluations (both tool outputs and final agent responses).",
        },
        direction: {
          type: "string",
          description: "Evaluation direction: 'ingress' (default, check before agent acts) or 'egress' (check agent output before returning to user). Egress defaults to fast mode.",
        },
        session_id: {
          type: "string",
          description: "Session ID from the ingress response. Pass this on egress calls to link ingress + egress records in the audit log.",
        },
        policy_id: { type: "string", description: "Policy ID to evaluate against (optional — omit to use agent metadata inference)" },
        agent_id: { type: "string", description: "Agent ID for policy inference (optional)" },
        agent_type: { type: "string", description: "Agent type for policy inference (optional)" },
        mode: { type: "string", description: "Evaluation mode: fast (default for egress), balanced (default for ingress), strict. Egress defaults to fast for lower latency." },
        override_block: {
          type: "boolean",
          description: "When true, converts block/require_approval decisions to allow + logs the override. Use only for policy testing — never in production compliance environments.",
        },
      },
      required: ["subject_content"],
    },
  },
  {
    name: "list_policy_decisions",
    description:
      "List recent agent policy decision audit log entries. Shows what actions agents attempted and what the policy decided. " +
      "Useful for auditing, debugging, and understanding agent behavior.",
    input_schema: {
      type: "object",
      properties: {
        decision: { type: "string", description: "Filter by decision: allow, block, require_approval, verify, uncertain" },
        limit: { type: "number", description: "Max results to return (default 50)" },
      },
      required: [],
    },
  },
];

export const writeTools: Tool[] = [
  {
    name: "create_agent_policy",
    description:
      "Create a new agent policy in FastGRC. " +
      "Requires a name at minimum. Optionally specify agent type, risk tolerance, allowed/blocked actions, " +
      "sensitive patterns, tool restrictions, and evaluation mode. " +
      "Use this after gathering requirements from the user via clarifying questions.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Policy name (required)" },
        description: { type: "string", description: "Optional description of what this policy does" },
        agent_id: { type: "string", description: "Specific agent ID this policy applies to (leave blank for org-wide)" },
        agent_type: { type: "string", description: "Agent type: Claude Agent, LangChain Agent, AutoGen Agent, CrewAI Agent, etc." },
        risk_tolerance: { type: "string", description: "Risk tolerance: low (strict), medium (balanced), high (permissive)" },
        default_mode: { type: "string", description: "Evaluation mode: fast, balanced, strict" },
        allowed_actions: {
          type: "array",
          items: { type: "string" },
          description: "Actions the agent is explicitly permitted to perform",
        },
        blocked_actions: {
          type: "array",
          items: { type: "string" },
          description: "Actions the agent must never perform",
        },
        sensitive_patterns: {
          type: "array",
          items: { type: "string" },
          description: "Regex/keyword patterns that flag sensitive content",
        },
        require_approval_patterns: {
          type: "array",
          items: { type: "string" },
          description: "Patterns requiring human approval before the agent proceeds",
        },
        allowed_tools: {
          type: "array",
          items: { type: "string" },
          description: "Tool IDs this agent is permitted to call",
        },
        blocked_tools: {
          type: "array",
          items: { type: "string" },
          description: "Tool IDs this agent is forbidden from calling",
        },
        tool_mode: {
          type: "string",
          description: "Tool access mode: 'blacklist' (default — allow all except blocked_tools) or 'whitelist' (allow only allowed_tools)",
        },
        blocked_output_patterns: {
          type: "array",
          items: { type: "string" },
          description: "Egress patterns that block agent outputs (e.g. leaked credentials, banned data). Evaluated when direction=egress.",
        },
        egress_skill: {
          type: "string",
          description: "Behavioral profile for egress decisions: auto (default, adapts to risk), monitor (log only), alert (alert on violations), guard (block + escalate), strict (block all + full audit)",
        },
        kill_switch: {
          type: "boolean",
          description: "When true, every evaluate call for this policy immediately returns block",
        },
        paused: {
          type: "boolean",
          description: "When true, the policy router is bypassed and every evaluate call returns allow",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "update_agent_policy",
    description:
      "Update an existing agent policy. Only the specified fields are changed — others are preserved. " +
      "Use for adding/removing blocked actions, changing risk tolerance, adjusting tool restrictions, " +
      "or toggling the kill switch and pause state.",
    input_schema: {
      type: "object",
      properties: {
        policy_id: { type: "string", description: "ID of the policy to update" },
        blocked_actions: { type: "array", items: { type: "string" }, description: "New blocked actions list" },
        allowed_actions: { type: "array", items: { type: "string" }, description: "New allowed actions list" },
        sensitive_patterns: { type: "array", items: { type: "string" }, description: "New sensitive patterns" },
        require_approval_patterns: { type: "array", items: { type: "string" }, description: "New require-approval patterns" },
        allowed_tools: { type: "array", items: { type: "string" }, description: "New allowed tools list" },
        blocked_tools: { type: "array", items: { type: "string" }, description: "New blocked tools list" },
        risk_tolerance: { type: "string", description: "Updated risk tolerance: low, medium, high" },
        default_mode: { type: "string", description: "Updated evaluation mode: fast, balanced, strict" },
        tool_mode: { type: "string", description: "Updated tool mode: blacklist or whitelist" },
        blocked_output_patterns: { type: "array", items: { type: "string" }, description: "Updated list of egress patterns that block agent outputs" },
        egress_skill: { type: "string", description: "Updated egress skill: auto, monitor, alert, guard, strict" },
        kill_switch: { type: "boolean", description: "Set to true to block all actions immediately, false to lift the kill switch" },
        paused: { type: "boolean", description: "Set to true to bypass the router (allow all), false to resume evaluation" },
        change_reason: { type: "string", description: "Reason for the change (for audit trail)" },
      },
      required: ["policy_id"],
    },
  },
  {
    name: "confirm_agent_policy",
    description:
      "Promote an inferred policy to confirmed status. Use this after reviewing an auto-inferred policy " +
      "to indicate it has been human-reviewed and approved.",
    input_schema: {
      type: "object",
      properties: {
        policy_id: { type: "string", description: "ID of the inferred policy to confirm" },
      },
      required: ["policy_id"],
    },
  },
  {
    name: "delete_agent_policy",
    description:
      "Permanently delete an agent policy. This cannot be undone. " +
      "Always confirm with the user before calling this tool.",
    input_schema: {
      type: "object",
      properties: {
        policy_id: { type: "string", description: "ID of the policy to delete" },
      },
      required: ["policy_id"],
    },
  },
];
