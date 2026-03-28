import type { Tool } from "../../engine/llm-types";

export const readTools: Tool[] = [
  {
    name: "scan_wordpress_core",
    description:
      "Scan WordPress core files for modifications, outdated versions, and known vulnerabilities. " +
      "Checks WP version against known CVEs, verifies core file checksums, and detects unauthorized modifications. " +
      "Results are logged to Supabase if configured.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "scan_plugin_vulnerabilities",
    description:
      "Check all installed plugins against known vulnerability databases. " +
      "Reports outdated plugins, plugins with known CVEs, abandoned/unmaintained plugins, and plugins from untrusted sources. " +
      "Results are logged to Supabase if configured.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "scan_theme_security",
    description:
      "Scan installed themes for security issues including outdated versions, known vulnerabilities, " +
      "and common security anti-patterns (eval, base64_decode in theme files).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "check_ssl_status",
    description:
      "Check the site's SSL/TLS configuration including certificate validity, HTTPS enforcement, " +
      "mixed content issues, and security headers (HSTS, CSP, X-Frame-Options).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "check_user_security",
    description:
      "Audit WordPress user accounts for security issues: admin accounts with weak usernames (admin, administrator), " +
      "users with excessive privileges, inactive accounts, and accounts without 2FA.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "check_file_permissions",
    description:
      "Check WordPress file and directory permissions for security compliance. " +
      "Verifies wp-config.php, .htaccess, uploads directory, and plugin/theme directories.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_hardening_recommendations",
    description:
      "Get a prioritized list of security hardening recommendations based on the current WordPress configuration. " +
      "Covers: file editing, debug mode, automatic updates, database prefix, login URL, XML-RPC, REST API exposure.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_security_scan_history",
    description:
      "Get recent security scan results and findings from Supabase. Shows scan history, " +
      "unresolved findings, and trend over time.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent scans to return (default 10)" },
      },
      required: [],
    },
  },
  {
    name: "get_security_events",
    description:
      "Get recent security events (failed logins, file changes, suspicious requests) from Supabase. " +
      "Use this to monitor for ongoing attacks or suspicious activity.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent events to return (default 50)" },
        event_type: { type: "string", description: "Filter by type: failed_login, file_change, suspicious_request, plugin_update" },
      },
      required: [],
    },
  },
  {
    name: "run_full_security_audit",
    description:
      "Run a comprehensive security audit combining all checks: core integrity, plugin vulnerabilities, " +
      "theme security, SSL, user security, file permissions, and hardening. Returns a consolidated report " +
      "with severity-ranked findings. Results are logged to Supabase if configured.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

export const writeTools: Tool[] = [
  {
    name: "resolve_security_finding",
    description:
      "Mark a security finding as resolved in Supabase. Use after a vulnerability has been fixed.",
    input_schema: {
      type: "object",
      properties: {
        finding_id: { type: "string", description: "Finding ID from Supabase" },
        resolution: { type: "string", description: "How the finding was resolved" },
      },
      required: ["finding_id", "resolution"],
    },
  },
];
