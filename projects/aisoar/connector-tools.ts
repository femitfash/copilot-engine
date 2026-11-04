/**
 * Copilot tools for the predefined ServiceNow, Splunk, SAINT, CrowdStrike, Tenable and AWS
 * connector functions (AISOAR: server/services/toolRegistryConnectorOps.ts).
 *
 * Every tool here is a thin, data-driven wrapper over an AISOAR *governed* tool id: the call goes
 * through executeGovernedTool, so AISOAR's own authorization, tenant/profile scoping, approval queue
 * and audit logging apply exactly as they do for LaunchPad — Copilot adds no second code path and no
 * vendor credentials of its own.
 *
 * Contract (kept in sync with AISOAR by server/copilot/connectorToolsParity.test.ts):
 *  - READ tools map to governed tools that are read-only and need no approval;
 *  - WRITE tools map to governed tools that require approval, and ride behind the existing global
 *    COPILOT_WRITE_TOOLS_ENABLED switch (tools.ts) — they are deliberately NOT in
 *    SAFE_WRITE_TOOL_NAMES;
 *  - `params` is the exact allowlist of arguments forwarded to the governed tool; anything else the
 *    model supplies is dropped, so the model cannot smuggle in fields such as tenant ids.
 *
 * Not exposed to chat on purpose: the Tenable export status/chunk reads, Splunk search-by-sid and SAINT
 * asset listing — they only make sense as steps of a multi-call workflow, which LaunchPad runs.
 */
import type { Tool } from "../../src/engine/llm-types";

export interface ConnectorGovernedTool {
  /** AISOAR governed tool id (toolRegistry.ts). */
  toolId: string;
  /** Exact argument names forwarded to the governed tool. */
  params: readonly string[];
}

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[] = []): Tool {
  return { name, description, input_schema: { type: "object" as const, properties, required } };
}

const str = (description: string): Record<string, unknown> => ({ type: "string", description });
const num = (description: string): Record<string, unknown> => ({ type: "number", description });
const bool = (description: string): Record<string, unknown> => ({ type: "boolean", description });
const enumStr = (values: string[], description: string): Record<string, unknown> => ({ type: "string", enum: values, description });

const LIMIT = num("Max records to return (bounded by the tool; the result says if it was truncated)");
const NO_CONFIG = "Returns an honest 'not configured' or vendor-error result — never fabricated data.";

// ── READ ───────────────────────────────────────────────────────────────────────────────

export const CONNECTOR_READ_TOOLS: Tool[] = [
  // ServiceNow
  tool("get_servicenow_incident", `Read one ServiceNow incident by number (INC…) or sys_id from the customer's own instance. found:false if it does not exist. ${NO_CONFIG}`, {
    number: str("Incident number, e.g. INC0010001"), sysId: str("32-character sys_id (use this or number)"),
  }),
  tool("list_servicenow_incidents", `List ServiceNow incidents, newest-updated first, filtered by priority, state, assignment group, category, text in the short description, age, or active-only. ${NO_CONFIG}`, {
    priority: str("1-5 (1 = critical)"), state: str("ServiceNow state code"), assignmentGroup: str("Assignment group sys_id or name"),
    category: str("Incident category"), text: str("Text to find in the short description"), activeOnly: bool("Only active incidents"),
    openedWithinHours: num("Only incidents opened in the last N hours"), limit: LIMIT,
  }),
  tool("get_servicenow_change", `Read one ServiceNow change request by number (CHG…) or sys_id. ${NO_CONFIG}`, {
    number: str("Change number, e.g. CHG0030001"), sysId: str("32-character sys_id (use this or number)"),
  }),
  tool("lookup_servicenow_cmdb_ci", `Look up configuration items in the customer's REAL ServiceNow CMDB by name, IP address or serial number (optionally one cmdb_ci_* class). Distinct from AISOAR's own inventory. ${NO_CONFIG}`, {
    name: str("CI name"), ipAddress: str("IP address"), serialNumber: str("Serial number"), ciClass: str("cmdb_ci table, e.g. cmdb_ci_server"), limit: LIMIT,
  }),
  // Splunk
  tool("list_splunk_saved_searches", `List Splunk saved searches (name, app, owner, SPL, schedule). ${NO_CONFIG}`, {
    nameContains: str("Only saved searches whose name contains this text"), limit: LIMIT,
  }),
  tool("run_splunk_saved_search", `Run an existing Splunk saved search by name and return its rows. Refuses saved searches that write, send or execute (outputlookup, collect, sendemail, delete, run). ${NO_CONFIG}`, {
    name: str("Saved search name"), app: str("Splunk app the saved search lives in (optional)"), limit: LIMIT,
  }, ["name"]),
  tool("list_splunk_notable_events", `List recent Splunk Enterprise Security notable events by urgency, status or rule name. A zero-row result notes that ES may not be installed. ${NO_CONFIG}`, {
    sinceHours: num("Look back N hours (default 24)"), urgency: enumStr(["critical", "high", "medium", "low", "informational"], "Urgency"),
    status: str("Status label, e.g. New"), ruleName: str("Correlation rule name"), limit: LIMIT,
  }),
  // SAINT
  tool("list_saint_scan_policies", `List the scan policies on the customer's SAINT instance (id, category, whether it is a penetration-test policy). Use the numeric id when starting a scan. ${NO_CONFIG}`, {
    category: str("Only this category, e.g. Vulnerability"), excludePentest: bool("Hide penetration-test (exploit) policies"),
  }),
  tool("list_saint_scan_nodes", `List SAINT scan nodes with connection and node status, to check a scan can run. Never returns license keys. ${NO_CONFIG}`, {
    connectedOnly: bool("Only connected nodes"), activeOnly: bool("Only active nodes"),
  }),
  tool("get_saint_license", `Read the SAINT license: total and remaining scannable IPs and expiry. ${NO_CONFIG}`, {}),
  tool("lookup_saint_vulnerability", `Look up a CVE in SAINT: CVSS v2/v3, whether it is on the CISA Known Exploited list, and the SAINT checks that detect it. found:false if unknown. ${NO_CONFIG}`, {
    identifier: str("CVE or other identifier, e.g. CVE-2021-44228"),
  }, ["identifier"]),
  tool("list_saint_scan_errors", `List the errors SAINT recorded for a scan AISOAR started (for example 'Target host cannot be resolved') — use it to explain a scan that found nothing. ${NO_CONFIG}`, {
    runId: str("The SAINT run id returned when the scan was started"),
  }, ["runId"]),
  // CrowdStrike
  tool("list_crowdstrike_alerts", `List CrowdStrike Falcon alerts (detections), newest first, by status, minimum severity, age or hostname. ${NO_CONFIG}`, {
    status: enumStr(["new", "in_progress", "closed", "reopened"], "Alert status"), severity: enumStr(["low", "medium", "high", "critical"], "At least this severe"),
    sinceHours: num("Alerts created in the last N hours"), hostname: str("Hostname (wildcards * allowed)"), limit: LIMIT,
  }),
  tool("get_crowdstrike_alert", `Read one CrowdStrike Falcon alert by composite id. ${NO_CONFIG}`, {
    compositeId: str("Falcon alert composite id"),
  }, ["compositeId"]),
  tool("list_crowdstrike_hosts", `Search CrowdStrike Falcon hosts by hostname (wildcards allowed), local IP, platform or containment status. Shows containment status, last seen and sensor version. ${NO_CONFIG}`, {
    hostname: str("Hostname (wildcards * allowed)"), localIp: str("Local IP"), platform: enumStr(["Windows", "Mac", "Linux"], "Platform"),
    containmentStatus: enumStr(["normal", "contained", "containment_pending", "lift_containment_pending"], "Containment status"), limit: LIMIT,
  }),
  tool("get_crowdstrike_host", `Read one CrowdStrike Falcon host by 32-character device id. ${NO_CONFIG}`, {
    deviceId: str("Falcon device id"),
  }, ["deviceId"]),
  tool("list_crowdstrike_spotlight_vulnerabilities", `List CrowdStrike Spotlight vulnerabilities (open by default) by CVE severity, CVE id, device or hostname, with CVSS, exploitability and the affected host. Needs the Spotlight read scope. ${NO_CONFIG}`, {
    status: enumStr(["open", "closed", "reopen", "expired"], "Vulnerability status"), severity: enumStr(["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE", "UNKNOWN"], "CVE severity"),
    cveId: str("CVE id"), deviceId: str("Falcon device id"), hostname: str("Hostname"), limit: LIMIT,
  }),
  // Tenable
  tool("list_tenable_scans", `List scans configured in Tenable.io (id, name, status, owner), filtered by status or name. ${NO_CONFIG}`, {
    status: str("Scan status, e.g. completed, running"), nameContains: str("Name contains this text"), limit: LIMIT,
  }),
  tool("get_tenable_scan", `Read one Tenable.io scan: status, start/end time, targets and per-host severity counts. ${NO_CONFIG}`, {
    scanId: str("Tenable scan id or UUID"),
  }, ["scanId"]),
  tool("list_tenable_assets", `List Tenable.io assets with per-severity vulnerability counts, filtered by IP, hostname fragment or minimum severity present. ${NO_CONFIG}`, {
    ipAddress: str("Exact IPv4"), hostnameContains: str("Hostname fragment"), minSeverity: enumStr(["info", "low", "medium", "high", "critical"], "Only assets with this severity or worse"),
    dateRangeDays: num("Look-back window in days (default 30)"), limit: LIMIT,
  }),
  tool("list_tenable_asset_vulnerabilities", `List the vulnerabilities Tenable.io holds for one asset (plugin, severity, VPR, state). Get the asset UUID from list_tenable_assets. ${NO_CONFIG}`, {
    assetId: str("Tenable asset UUID"), minSeverity: enumStr(["info", "low", "medium", "high", "critical"], "Minimum severity"),
    dateRangeDays: num("Look-back window in days (default 30)"), limit: LIMIT,
  }, ["assetId"]),
  // AWS
  tool("list_aws_guardduty_findings", `List active Amazon GuardDuty findings in a region (highest severity first). If GuardDuty is not enabled there the result says so — it is not 'no findings'. ${NO_CONFIG}`, {
    region: str("AWS region (default: the connector's region)"), severity: enumStr(["low", "medium", "high", "critical"], "At least this severe"),
    sinceHours: num("Updated in the last N hours"), includeArchived: bool("Include archived findings"), limit: LIMIT,
  }),
  tool("list_aws_inspector_findings", `List Amazon Inspector v2 findings (active by default) at or above a severity, optionally for one CVE, with CVSS and the affected resource. ${NO_CONFIG}`, {
    region: str("AWS region"), severity: enumStr(["informational", "low", "medium", "high", "critical"], "At least this severe"),
    status: enumStr(["active", "suppressed", "closed"], "Finding status (default active)"), vulnerabilityId: str("CVE id"), limit: LIMIT,
  }),
  tool("lookup_aws_cloudtrail_events", `Look up recent CloudTrail management events (default last 24h) by one attribute such as EventName, Username or AccessKeyId. Returns who, what, when, source IP and error code — never the raw event body. ${NO_CONFIG}`, {
    region: str("AWS region"), attributeKey: enumStr(["EventId", "EventName", "ReadOnly", "Username", "ResourceType", "ResourceName", "EventSource", "AccessKeyId"], "Attribute to match"),
    attributeValue: str("Value to match"), sinceHours: num("Look back N hours (max 2160)"), limit: LIMIT,
  }),
  tool("list_aws_securityhub_findings", `List active AWS Security Hub findings (workflow NEW by default) at or above a severity, with the finding id and product ARN needed to update them. ${NO_CONFIG}`, {
    region: str("AWS region"), severity: enumStr(["informational", "low", "medium", "high", "critical"], "At least this severe"),
    workflowStatus: enumStr(["new", "notified", "suppressed", "resolved"], "Workflow status (default new)"), limit: LIMIT,
  }),
];

export const CONNECTOR_READ_TOOL_MAP: Record<string, ConnectorGovernedTool> = {
  get_servicenow_incident: { toolId: "servicenow.incident.get", params: ["number", "sysId"] },
  list_servicenow_incidents: { toolId: "servicenow.incident.list", params: ["priority", "state", "assignmentGroup", "category", "text", "activeOnly", "openedWithinHours", "limit"] },
  get_servicenow_change: { toolId: "servicenow.change.get", params: ["number", "sysId"] },
  lookup_servicenow_cmdb_ci: { toolId: "servicenow.cmdb.ci.lookup", params: ["name", "ipAddress", "serialNumber", "ciClass", "limit"] },
  list_splunk_saved_searches: { toolId: "splunk.savedsearch.list", params: ["nameContains", "limit"] },
  run_splunk_saved_search: { toolId: "splunk.savedsearch.run", params: ["name", "app", "limit"] },
  list_splunk_notable_events: { toolId: "splunk.notable.list", params: ["sinceHours", "urgency", "status", "ruleName", "limit"] },
  list_saint_scan_policies: { toolId: "scanner.saint.policy.list", params: ["category", "excludePentest"] },
  list_saint_scan_nodes: { toolId: "scanner.saint.node.list", params: ["connectedOnly", "activeOnly"] },
  get_saint_license: { toolId: "scanner.saint.license.get", params: [] },
  lookup_saint_vulnerability: { toolId: "scanner.saint.vulnerability.lookup", params: ["identifier"] },
  list_saint_scan_errors: { toolId: "scanner.saint.scan.errors.list", params: ["runId"] },
  list_crowdstrike_alerts: { toolId: "crowdstrike.alert.list", params: ["status", "severity", "sinceHours", "hostname", "limit"] },
  get_crowdstrike_alert: { toolId: "crowdstrike.alert.get", params: ["compositeId"] },
  list_crowdstrike_hosts: { toolId: "crowdstrike.host.list", params: ["hostname", "localIp", "platform", "containmentStatus", "limit"] },
  get_crowdstrike_host: { toolId: "crowdstrike.host.get", params: ["deviceId"] },
  list_crowdstrike_spotlight_vulnerabilities: { toolId: "crowdstrike.spotlight.vulnerability.list", params: ["status", "severity", "cveId", "deviceId", "hostname", "limit"] },
  list_tenable_scans: { toolId: "tenable.scan.list", params: ["status", "nameContains", "limit"] },
  get_tenable_scan: { toolId: "tenable.scan.get", params: ["scanId"] },
  list_tenable_assets: { toolId: "tenable.asset.list", params: ["ipAddress", "hostnameContains", "minSeverity", "dateRangeDays", "limit"] },
  list_tenable_asset_vulnerabilities: { toolId: "tenable.asset.vulnerability.list", params: ["assetId", "minSeverity", "dateRangeDays", "limit"] },
  list_aws_guardduty_findings: { toolId: "aws.guardduty.finding.list", params: ["region", "severity", "sinceHours", "includeArchived", "limit"] },
  list_aws_inspector_findings: { toolId: "aws.inspector.finding.list", params: ["region", "severity", "status", "vulnerabilityId", "limit"] },
  lookup_aws_cloudtrail_events: { toolId: "aws.cloudtrail.event.lookup", params: ["region", "attributeKey", "attributeValue", "sinceHours", "limit"] },
  list_aws_securityhub_findings: { toolId: "aws.securityhub.finding.list", params: ["region", "severity", "workflowStatus", "limit"] },
};

// ── WRITE (approval-gated; behind COPILOT_WRITE_TOOLS_ENABLED) ───────────────────────────

export const CONNECTOR_WRITE_TOOLS: Tool[] = [
  tool("add_servicenow_work_note", "Add an internal work note (default) or a customer-visible comment to an existing ServiceNow incident. Does not create or close tickets. Requires human approval before it executes.", {
    number: str("Incident number"), sysId: str("32-character sys_id (use this or number)"), note: str("The note text"),
    visibility: enumStr(["internal", "customer"], "internal = work note (default), customer = visible comment"),
  }, ["note"]),
  tool("resolve_servicenow_incident", "Resolve a ServiceNow incident. ServiceNow requires BOTH a close code and close notes; the result confirms the incident really moved to Resolved. Requires human approval before it executes.", {
    number: str("Incident number"), sysId: str("32-character sys_id (use this or number)"), closeCode: str("Close code, e.g. 'Solved (Permanently)'"), closeNotes: str("Resolution notes"),
  }, ["closeCode", "closeNotes"]),
  tool("create_servicenow_change", "Create a ServiceNow change request (normal, standard or emergency). Confirms the record was really created. Requires human approval before it executes.", {
    shortDescription: str("Short description"), description: str("Full description"), type: enumStr(["normal", "standard", "emergency"], "Change type (default normal)"),
    assignmentGroup: str("Assignment group"), justification: str("Business justification"),
  }, ["shortDescription"]),
  tool("update_crowdstrike_alert_status", "Set the status of CrowdStrike Falcon alerts (new, in_progress, closed, reopened) with an optional comment. Reads them back and says whether the change took effect. Does not isolate hosts. Requires human approval before it executes.", {
    compositeId: str("Falcon alert composite id (use this or compositeIds)"), compositeIds: { type: "array", items: { type: "string" }, description: "Up to 50 alert composite ids" },
    status: enumStr(["new", "in_progress", "closed", "reopened"], "New status"), comment: str("Comment to append"),
  }, ["status"]),
  tool("update_aws_securityhub_finding", "Set the workflow status (new, notified, suppressed, resolved) of AWS Security Hub findings, with an optional note. Reports AWS's own UnprocessedFindings; success only if AWS processed them. Get findingId and productArn from list_aws_securityhub_findings. Requires human approval before it executes.", {
    findingId: str("Finding id (use this with productArn, or findings)"), productArn: str("Product ARN"),
    findings: { type: "array", items: { type: "object", properties: { findingId: { type: "string" }, productArn: { type: "string" } } }, description: "Up to 100 {findingId, productArn} pairs" },
    workflowStatus: enumStr(["new", "notified", "suppressed", "resolved"], "New workflow status"), note: str("Note text"), region: str("AWS region"),
  }, ["workflowStatus"]),
  tool("launch_tenable_scan", "Launch an EXISTING saved Tenable.io scan exactly as configured. It accepts no targets (the scan's targets are whatever an administrator saved in Tenable) and refuses a scan that is already running. Requires human approval before it executes.", {
    scanId: str("Tenable scan id or UUID (from list_tenable_scans)"),
  }, ["scanId"]),
];

export const CONNECTOR_WRITE_TOOL_MAP: Record<string, ConnectorGovernedTool> = {
  add_servicenow_work_note: { toolId: "servicenow.incident.worknote.add", params: ["number", "sysId", "note", "visibility"] },
  resolve_servicenow_incident: { toolId: "servicenow.incident.resolve", params: ["number", "sysId", "closeCode", "closeNotes"] },
  create_servicenow_change: { toolId: "servicenow.change.create", params: ["shortDescription", "description", "type", "assignmentGroup", "justification"] },
  update_crowdstrike_alert_status: { toolId: "crowdstrike.alert.status.update", params: ["compositeId", "compositeIds", "status", "comment"] },
  update_aws_securityhub_finding: { toolId: "aws.securityhub.finding.update", params: ["findingId", "productArn", "findings", "workflowStatus", "note", "region"] },
  launch_tenable_scan: { toolId: "tenable.scan.launch", params: ["scanId"] },
};

/** Governed tool ids Copilot may call for these tools (merged into COPILOT_GOVERNED_WRITE_TOOL_IDS). */
export const CONNECTOR_GOVERNED_TOOL_IDS: string[] = [
  ...Object.values(CONNECTOR_READ_TOOL_MAP).map((t) => t.toolId),
  ...Object.values(CONNECTOR_WRITE_TOOL_MAP).map((t) => t.toolId),
];

/**
 * Copy ONLY the allowlisted arguments, dropping anything undefined. Tenant, profile and user identity
 * come from the authenticated governed context, never from model-supplied arguments.
 */
export function pickGovernedParams(input: Record<string, unknown>, allowed: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  return out;
}
