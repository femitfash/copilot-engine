export interface ToolExecutionContext {
  userToken: string;
  config: {
    settingsApiUrl: string;
    healthCheckApiUrl: string;
    mlApiBaseUrl: string;
    ragApiBaseUrl: string;
    historyApiUrl: string;
    gatewayUrl: string;
    identityDomain: string;
    notificationUrl: string;
  };
}

// ─── READ Tool Executor ─────────────────────────────────────────────────────

export async function executeReadTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${ctx.userToken}`,
    "Content-Type": "application/json",
  };

  switch (toolName) {
    case "get_llm_settings": {
      const res = await fetch(
        `${ctx.config.settingsApiUrl}/api/LlmSettings`,
        { headers }
      );
      return JSON.stringify(await res.json());
    }

    case "get_pii_settings": {
      const res = await fetch(
        `${ctx.config.settingsApiUrl}/api/LlmSettings/get-piiarrays`,
        { headers }
      );
      return JSON.stringify(await res.json());
    }

    case "get_compliance_settings": {
      const res = await fetch(
        `${ctx.config.settingsApiUrl}/api/LlmSettings/get-compliances`,
        { headers }
      );
      return JSON.stringify(await res.json());
    }

    case "get_customer_llms": {
      const res = await fetch(
        `${ctx.config.gatewayUrl}/api/v3/customer-llms`,
        { headers }
      );
      return JSON.stringify(await res.json());
    }

    case "get_health_check_datasets": {
      const res = await fetch(
        `${ctx.config.healthCheckApiUrl}/zt-ml/api/v1/datasets`,
        { headers }
      );
      return JSON.stringify(await res.json());
    }

    case "get_scan_results": {
      const scanId = input.scan_id || "";
      const res = await fetch(
        `${ctx.config.healthCheckApiUrl}/zt-ml/api/v1/scans/${scanId}`,
        { headers }
      );
      return JSON.stringify(await res.json());
    }

    case "get_llm_history": {
      const limit = input.limit || 20;
      const res = await fetch(
        `${ctx.config.historyApiUrl}/api/llm/logs/history`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ limit }),
        }
      );
      return JSON.stringify(await res.json());
    }

    case "get_reliability_scores": {
      const res = await fetch(
        `${ctx.config.mlApiBaseUrl}/zt-ml/api/v1/get-reliability-scores`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            prompt: input.prompt,
            llm_responses: input.llm_responses,
          }),
        }
      );
      return JSON.stringify(await res.json());
    }

    case "get_compliance_reports": {
      const res = await fetch(
        `${ctx.config.mlApiBaseUrl}/zt-ml/api/v1/get-compliance-reports-v2`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            compliance_array: input.compliance_array || [],
          }),
        }
      );
      return JSON.stringify(await res.json());
    }

    case "list_rag_assistants": {
      const res = await fetch(`${ctx.config.ragApiBaseUrl}/assistants`, {
        headers,
      });
      return JSON.stringify(await res.json());
    }

    case "get_chat_history": {
      const res = await fetch(
        `${ctx.config.ragApiBaseUrl}/chat-history?configId=${input.assistant_id}`,
        { headers }
      );
      return JSON.stringify(await res.json());
    }

    case "get_notifications": {
      const res = await fetch(
        `${ctx.config.notificationUrl}/api/notifications/notification-list`,
        { headers }
      );
      return JSON.stringify(await res.json());
    }

    case "get_user_roles": {
      const res = await fetch(
        `${ctx.config.identityDomain}/api/v3/applicationroles/get-many`,
        { headers }
      );
      return JSON.stringify(await res.json());
    }

    case "get_audit_logs": {
      const res = await fetch(
        `${ctx.config.gatewayUrl}/api/v3/audits/log-event`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            limit: input.limit || 20,
            event_type: input.event_type,
          }),
        }
      );
      return JSON.stringify(await res.json());
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
  const headers: Record<string, string> = {
    Authorization: `Bearer ${ctx.userToken}`,
    "Content-Type": "application/json",
  };

  switch (toolName) {
    case "detect_pii": {
      const res = await fetch(
        `${ctx.config.gatewayUrl}/api/v3/detect-sensitive-keywords`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            prompt: input.text,
            pii_entities: input.pii_entities || [],
          }),
        }
      );
      return res.json();
    }

    case "anonymize_prompt": {
      const res = await fetch(
        `${ctx.config.mlApiBaseUrl}/zt-ml/api/v1/process`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            prompt: input.prompt,
            task: "anonymize",
            anonymize_keywords: input.do_not_anonymize || [],
            pii_entities: input.pii_entities || [],
          }),
        }
      );
      return res.json();
    }

    case "chat_via_llm": {
      const res = await fetch(`${ctx.config.gatewayUrl}/api/v3/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: input.prompt,
          llm: input.llm || "gpt-4",
        }),
      });
      return res.json();
    }

    case "update_llm_settings": {
      const res = await fetch(
        `${ctx.config.settingsApiUrl}/api/LlmSettings`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(input.settings),
        }
      );
      return res.json();
    }

    case "update_pii_entities": {
      const res = await fetch(
        `${ctx.config.settingsApiUrl}/api/LlmSettings/update-piiarrays`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ pii_entities: input.entities }),
        }
      );
      return res.json();
    }

    case "create_rag_assistant": {
      const res = await fetch(
        `${ctx.config.ragApiBaseUrl}/create-assistant`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(input),
        }
      );
      return res.json();
    }

    case "delete_rag_assistant": {
      const res = await fetch(
        `${ctx.config.ragApiBaseUrl}/delete-assistant`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ config_id: input.assistant_id }),
        }
      );
      return res.json();
    }

    case "run_health_check": {
      const res = await fetch(
        `${ctx.config.healthCheckApiUrl}/zt-ml/api/v1/run-scan`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(input),
        }
      );
      return res.json();
    }

    case "check_compliance": {
      const res = await fetch(
        `${ctx.config.gatewayUrl}/api/v3/responses/check-compliance`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(input),
        }
      );
      return res.json();
    }

    case "execute_agent": {
      const res = await fetch(
        `${ctx.config.mlApiBaseUrl}/zt-ml/api/v1/agent`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(input),
        }
      );
      return res.json();
    }

    default:
      throw new Error(`Unknown write tool: ${toolName}`);
  }
}
