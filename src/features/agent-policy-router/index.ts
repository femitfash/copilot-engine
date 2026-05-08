import type { FeatureModule } from "../feature-module";
import { readTools, writeTools } from "./tools";
import { executeReadTool, executeWriteTool } from "./executor";

const agentPolicyRouter: FeatureModule = {
  name: "agent-policy-router",
  description:
    "FastGRC Agent Policy Router — create, manage, and test agent policies that control what AI agents are allowed to do. " +
    "Supports natural language policy creation with clarifying questions.",

  readTools,
  writeTools,

  executeReadTool,
  executeWriteTool,

  systemPromptAddition: `
## Agent Policy Router (Enabled)

You can create, manage, and test FastGRC agent policies via conversation. Use these tools proactively.

### Ingress vs Egress evaluation

The policy router evaluates agent interactions in two directions:

**Ingress** (default) — evaluate BEFORE the agent acts:
- Subject types: task, prompt, plan, tool_argument
- Called before the agent executes an action or processes a prompt
- Returns a sessionId — store it and pass it on the egress call

**Egress** — evaluate BEFORE returning to the user:
- Subject type: tool_result (use this for ALL egress: tool outputs AND final agent responses)
- Called after the agent acts, before the response reaches the user
- Pass the sessionId from the ingress call to link both records in the audit log
- Default mode is fast (rule-based, lower latency)
- Checks for: credential leaks (API keys, tokens), PII (SSN, credit cards), blockedOutputPatterns, sensitivePatterns

### skillGuidance — how to respond after an egress decision

Every egress response includes skillGuidance. Use it:
- \`blockResponse: true\` → suppress/replace the agent response
- \`displayAlert: true\` → show an alert banner alongside the response
- \`alertMessage\` → suggested text for the alert
- \`escalate: true\` + \`escalateTo\` → route to FastGRC Compliance or Risk agent
- \`logEvent: true\` → always true, the decision is logged

### When to use
- User asks to "create a policy for [agent]" → gather requirements, then call create_agent_policy
- User asks to "list policies" or "show my policies" → call list_agent_policies
- User asks to "test if [action] is allowed" → call evaluate_action with direction=ingress
- User asks to "check this output" or "verify agent response" → call evaluate_action with direction=egress, subject_type=tool_result
- User asks to "block [action]" on an existing policy → call update_agent_policy
- User asks to "confirm" or "approve" an inferred policy → call confirm_agent_policy

### Natural language policy creation flow
When a user says something like "create agent policy for a Salesforce agent that manages inventory", ask these clarifying questions BEFORE calling create_agent_policy:

1. **Agent purpose**: What specific tasks will this agent perform? (e.g., read records, update inventory, send notifications)
2. **Sensitive operations**: Are there any actions it should NEVER do, even if asked? (e.g., delete records, export data, change permissions)
3. **Output restrictions**: Are there data types the agent should never include in its responses? (e.g., SSNs, API keys, financial records)
4. **Approval gates**: Which actions need a human to review before proceeding? (e.g., bulk updates, external API calls)
5. **Risk tolerance**: How strictly should the policy restrict the agent?
   - **Low** — very strict, blocks anything ambiguous, frequent approval prompts
   - **Medium** — balanced default, blocks only clearly risky actions
   - **High** — permissive, blocks only obvious threats
6. **Evaluation mode**: How thorough should evaluation be?
   - **Fast** — <5ms rule-based only
   - **Balanced** — fast rules + LLM for borderline cases (recommended)
   - **Strict** — always uses LLM for maximum scrutiny

After gathering answers, call create_agent_policy. Map the agent description to an agent type:
- Salesforce, CRM → "CRM Agent" or "Custom Agent"
- Claude, Anthropic → "Claude Agent"
- LangChain → "LangChain Agent"
- AutoGen → "AutoGen Agent"
- CrewAI → "CrewAI Agent"
- Data/analytics → "Risk Agent" or "Custom Agent"
- Security/compliance → "Security Agent" or "AI Compliance Agent"

### After creating a policy
Always tell the user:
1. The policy ID (for use with the CLI/API/MCP integrations)
2. How to integrate: "You can integrate this policy using the CLI (\`fastgrc-router evaluate --policy-id <id>\`), REST API, or MCP server"
3. Mention egress: "This policy also evaluates agent outputs — use \`direction=egress\` and \`subject_type=tool_result\` to check responses before they reach the user"
4. Suggest testing: "Would you like me to run some test scenarios to verify the policy behaves as expected?"

### Available actions
- [suggest:List all my agent policies]Show Policies[/suggest]
- [suggest:Create an agent policy]New Policy[/suggest]
- [suggest:Test if an action is allowed by a policy]Evaluate Action[/suggest]
- [suggest:Check an agent response for policy violations]Evaluate Egress[/suggest]
- [suggest:Show recent policy decisions (audit log)]Audit Log[/suggest]
`,

  initialize: async () => {
    const apiKey = process.env.FASTGRC_API_KEY;
    const baseUrl = process.env.FASTGRC_BASE_URL || "https://www.fastgrc.ai";
    if (!apiKey) {
      console.log("  ℹ️  Agent Policy Router: FASTGRC_API_KEY not set — policy operations will fail.");
      console.log("     Set FASTGRC_API_KEY in .env and optionally FASTGRC_BASE_URL (default: https://www.fastgrc.ai).");
    } else {
      console.log(`  ✅ Agent Policy Router: connected to ${baseUrl}`);
    }
  },
};

export default agentPolicyRouter;
export { agentPolicyRouter as feature };
