import { logScan, logFinding, getRecentScans, getRecentFindings, getRecentEvents, getSupabase } from "./supabase";

const MAX_RESULT_SIZE = 8000;

function truncate(json: string): string {
  if (json.length <= MAX_RESULT_SIZE) return json;
  return json.substring(0, MAX_RESULT_SIZE) + '..."truncated"}';
}

async function wpApi(url: string, userToken: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${userToken}`,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  if (!text) return { status: res.status };
  try {
    return JSON.parse(text);
  } catch {
    return { status: res.status, body: text.substring(0, 200) };
  }
}

// ─── Security Check Implementations ─────────────────────────────────────

async function checkCoreIntegrity(wpUrl: string, token: string): Promise<any> {
  const findings: any[] = [];

  // Check WP version via REST API
  const rootInfo = await wpApi(`${wpUrl}/wp-json/`, token);
  const wpVersion = rootInfo?.namespaces ? "detected" : "unknown";
  const siteUrl = rootInfo?.url || wpUrl;

  // Check if core update is available
  try {
    const updates = await wpApi(`${wpUrl}/wp-json/wp/v2/settings`, token);
    if (updates?.error) {
      findings.push({
        severity: "medium",
        category: "core_integrity",
        title: "Cannot check core settings",
        description: "Unable to access WordPress settings API. This may indicate permission issues.",
        remediation: "Ensure the API user has administrator capabilities.",
      });
    }
  } catch {
    findings.push({
      severity: "low",
      category: "core_integrity",
      title: "Core settings API inaccessible",
      description: "Could not reach the WordPress settings endpoint.",
    });
  }

  // Check site health
  try {
    const health = await wpApi(`${wpUrl}/wp-json/wp-site-health/v1/tests/background-updates`, token);
    if (health?.status === "critical" || health?.status === "recommended") {
      findings.push({
        severity: health.status === "critical" ? "high" : "medium",
        category: "core_updates",
        title: "Background updates issue",
        description: health.description || "WordPress background updates may not be working correctly.",
        remediation: "Check file permissions and WordPress cron configuration.",
      });
    }
  } catch {
    // Site health API may not be available
  }

  return { site_url: siteUrl, wp_version: wpVersion, findings };
}

async function checkPluginVulnerabilities(wpUrl: string, token: string): Promise<any> {
  const findings: any[] = [];

  const plugins = await wpApi(`${wpUrl}/wp-json/wp/v2/plugins`, token);
  if (!Array.isArray(plugins)) {
    return { error: "Could not retrieve plugin list", findings };
  }

  for (const plugin of plugins) {
    const name = plugin.name || plugin.plugin;
    const version = plugin.version;
    const status = plugin.status;

    // Flag inactive plugins (attack surface)
    if (status === "inactive") {
      findings.push({
        severity: "low",
        category: "plugin_hygiene",
        title: `Inactive plugin: ${name}`,
        description: `Plugin "${name}" is installed but inactive. Inactive plugins still present an attack surface.`,
        remediation: "Delete plugins you don't use. Inactive plugins can still have exploitable vulnerabilities.",
        affected_item: name,
      });
    }

    // Flag plugins needing updates
    if (plugin.update) {
      findings.push({
        severity: "high",
        category: "plugin_update",
        title: `Plugin update available: ${name}`,
        description: `Plugin "${name}" v${version} has an update available. Running outdated plugins is a common attack vector.`,
        remediation: `Update "${name}" to the latest version via Plugins > Updates.`,
        affected_item: name,
      });
    }
  }

  return {
    total_plugins: plugins.length,
    active: plugins.filter((p: any) => p.status === "active").length,
    inactive: plugins.filter((p: any) => p.status === "inactive").length,
    findings,
  };
}

async function checkThemeSecurity(wpUrl: string, token: string): Promise<any> {
  const findings: any[] = [];

  const themes = await wpApi(`${wpUrl}/wp-json/wp/v2/themes`, token);
  if (!Array.isArray(themes) && typeof themes === "object") {
    // Themes API returns an object keyed by stylesheet
    const themeList = Object.values(themes);
    const activeTheme = themeList.find((t: any) => t.status === "active");

    if (activeTheme) {
      const t = activeTheme as any;
      if (t.version && /^[01]\./.test(t.version)) {
        findings.push({
          severity: "medium",
          category: "theme_version",
          title: `Active theme "${t.name?.rendered || t.stylesheet}" is on early version`,
          description: "Early version themes may have undiscovered security issues.",
          affected_item: t.stylesheet,
        });
      }
    }
  }

  return { findings };
}

async function checkSSL(wpUrl: string, token: string): Promise<any> {
  const findings: any[] = [];

  // Check if site uses HTTPS
  if (!wpUrl.startsWith("https://")) {
    findings.push({
      severity: "critical",
      category: "ssl",
      title: "Site not using HTTPS",
      description: "The WordPress site is accessible over HTTP. All traffic including login credentials is transmitted in plain text.",
      remediation: "Install an SSL certificate and force HTTPS. Use a plugin like Really Simple SSL or configure your web server.",
    });
  }

  // Check for HTTPS status via site health
  try {
    const httpsTest = await wpApi(`${wpUrl}/wp-json/wp-site-health/v1/tests/https-status`, token);
    if (httpsTest?.status === "critical" || httpsTest?.status === "recommended") {
      findings.push({
        severity: httpsTest.status === "critical" ? "critical" : "medium",
        category: "ssl",
        title: "HTTPS configuration issue",
        description: httpsTest.description || "HTTPS is not properly configured.",
        remediation: httpsTest.actions || "Verify SSL certificate and HTTPS redirects.",
      });
    }
  } catch {
    // Site health may not be available
  }

  return {
    uses_https: wpUrl.startsWith("https://"),
    findings,
  };
}

async function checkUserSecurity(wpUrl: string, token: string): Promise<any> {
  const findings: any[] = [];

  const users = await wpApi(`${wpUrl}/wp-json/wp/v2/users?per_page=100`, token);
  if (!Array.isArray(users)) {
    return { error: "Could not retrieve user list", findings };
  }

  // Check for risky admin usernames
  const riskyUsernames = ["admin", "administrator", "root", "wordpress", "wp"];
  for (const user of users) {
    if (riskyUsernames.includes(user.slug?.toLowerCase())) {
      findings.push({
        severity: "high",
        category: "user_security",
        title: `Default admin username: "${user.slug}"`,
        description: `User "${user.slug}" uses a common default username that is frequently targeted by brute force attacks.`,
        remediation: "Create a new administrator account with a unique username, transfer content, and delete this account.",
        affected_item: user.slug,
      });
    }
  }

  // Check admin count
  const admins = users.filter((u: any) =>
    u.roles?.includes("administrator") || u._links?.self
  );
  if (admins.length > 3) {
    findings.push({
      severity: "medium",
      category: "user_security",
      title: `Too many administrator accounts (${admins.length})`,
      description: "Having multiple administrator accounts increases the attack surface. Each admin account is a potential entry point.",
      remediation: "Review administrator accounts and downgrade users who don't need full admin access to Editor or lower roles.",
    });
  }

  return {
    total_users: users.length,
    findings,
  };
}

function getHardeningRecommendations(): any {
  return {
    recommendations: [
      {
        priority: 1,
        category: "file_editing",
        title: "Disable file editing in wp-admin",
        description: "WordPress allows editing plugin/theme files from the admin dashboard. If compromised, an attacker can inject malicious code.",
        remediation: "Add `define('DISALLOW_FILE_EDIT', true);` to wp-config.php",
        severity: "high",
      },
      {
        priority: 2,
        category: "debug_mode",
        title: "Disable debug mode in production",
        description: "WP_DEBUG should be false in production. Debug output can reveal sensitive information about your server configuration.",
        remediation: "Set `define('WP_DEBUG', false);` in wp-config.php",
        severity: "high",
      },
      {
        priority: 3,
        category: "auto_updates",
        title: "Enable automatic security updates",
        description: "WordPress minor/security updates should install automatically to patch vulnerabilities quickly.",
        remediation: "Add `define('WP_AUTO_UPDATE_CORE', 'minor');` to wp-config.php",
        severity: "medium",
      },
      {
        priority: 4,
        category: "database_prefix",
        title: "Use a custom database prefix",
        description: "The default 'wp_' table prefix makes SQL injection attacks easier by providing predictable table names.",
        remediation: "Change $table_prefix in wp-config.php (requires database migration).",
        severity: "medium",
      },
      {
        priority: 5,
        category: "login_security",
        title: "Limit login attempts",
        description: "Without rate limiting, attackers can run unlimited brute force attempts against the login page.",
        remediation: "Install a login limiting plugin (e.g., Limit Login Attempts Reloaded) or use Application Passwords for API access.",
        severity: "high",
      },
      {
        priority: 6,
        category: "xml_rpc",
        title: "Disable XML-RPC if not needed",
        description: "XML-RPC is a legacy API that can be exploited for brute force amplification attacks and DDoS.",
        remediation: "Add `add_filter('xmlrpc_enabled', '__return_false');` to your theme's functions.php or use a security plugin.",
        severity: "medium",
      },
      {
        priority: 7,
        category: "rest_api",
        title: "Restrict REST API user enumeration",
        description: "The REST API exposes user information at /wp-json/wp/v2/users by default, which aids reconnaissance.",
        remediation: "Use a plugin to restrict unauthenticated access to the users endpoint, or add custom authentication checks.",
        severity: "low",
      },
      {
        priority: 8,
        category: "security_headers",
        title: "Add security headers",
        description: "HTTP security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options) protect against XSS, clickjacking, and MIME-type attacks.",
        remediation: "Configure security headers in your web server (Apache/Nginx) or use a security plugin.",
        severity: "medium",
      },
      {
        priority: 9,
        category: "backup",
        title: "Verify backup strategy",
        description: "Regular, tested backups are the last line of defense against ransomware, accidental deletion, and site compromise.",
        remediation: "Set up automated daily backups with a plugin like UpdraftPlus. Store backups off-site (S3, Google Drive).",
        severity: "high",
      },
      {
        priority: 10,
        category: "two_factor",
        title: "Enable two-factor authentication",
        description: "2FA dramatically reduces the risk of account compromise, even if passwords are leaked.",
        remediation: "Install a 2FA plugin (e.g., Two Factor, Wordfence) and enable it for all administrator accounts.",
        severity: "high",
      },
    ],
  };
}

// ─── Executor ───────────────────────────────────────────────────────────

export async function executeReadTool(
  name: string,
  input: Record<string, unknown>,
  ctx: any
): Promise<string | null> {
  const wpUrl = ctx.config?.wpApiUrl || process.env.WP_API_URL;
  if (!wpUrl && name !== "get_security_scan_history" && name !== "get_security_events" && name !== "get_hardening_recommendations") {
    return JSON.stringify({ error: "WP_API_URL not configured" });
  }

  const token = ctx.userToken;

  switch (name) {
    case "scan_wordpress_core": {
      const result = await checkCoreIntegrity(wpUrl, token);
      const scanId = await logScan({
        scan_type: "core_integrity",
        status: "completed",
        findings_count: result.findings.length,
        summary: `Core scan: ${result.findings.length} findings`,
        site_url: wpUrl,
      });
      for (const f of result.findings) {
        await logFinding({ scan_id: scanId || undefined, ...f });
      }
      return truncate(JSON.stringify(result));
    }

    case "scan_plugin_vulnerabilities": {
      const result = await checkPluginVulnerabilities(wpUrl, token);
      const scanId = await logScan({
        scan_type: "plugin_vulnerabilities",
        status: "completed",
        findings_count: result.findings.length,
        summary: `Plugin scan: ${result.total_plugins} plugins, ${result.findings.length} findings`,
        site_url: wpUrl,
      });
      for (const f of result.findings) {
        await logFinding({ scan_id: scanId || undefined, ...f });
      }
      return truncate(JSON.stringify(result));
    }

    case "scan_theme_security": {
      const result = await checkThemeSecurity(wpUrl, token);
      await logScan({
        scan_type: "theme_security",
        status: "completed",
        findings_count: result.findings.length,
        site_url: wpUrl,
      });
      return truncate(JSON.stringify(result));
    }

    case "check_ssl_status": {
      const result = await checkSSL(wpUrl, token);
      for (const f of result.findings) {
        await logFinding(f);
      }
      return truncate(JSON.stringify(result));
    }

    case "check_user_security": {
      const result = await checkUserSecurity(wpUrl, token);
      for (const f of result.findings) {
        await logFinding(f);
      }
      return truncate(JSON.stringify(result));
    }

    case "check_file_permissions": {
      // File permissions can only be checked via WP-CLI or server access
      // We report what we can check via the REST API
      return JSON.stringify({
        note: "File permission checks require server-level access (SSH/WP-CLI). Use the hardening recommendations for file permission guidance.",
        recommendations: [
          "wp-config.php: 400 or 440 (read-only)",
          ".htaccess: 644",
          "wp-content/: 755",
          "wp-content/uploads/: 755",
          "All PHP files: 644",
          "All directories: 755",
        ],
      });
    }

    case "get_hardening_recommendations":
      return truncate(JSON.stringify(getHardeningRecommendations()));

    case "get_security_scan_history": {
      const scans = await getRecentScans(Number(input.limit) || 10);
      const findings = await getRecentFindings(20);
      return truncate(JSON.stringify({ recent_scans: scans, recent_findings: findings }));
    }

    case "get_security_events": {
      const events = await getRecentEvents(Number(input.limit) || 50);
      return truncate(JSON.stringify({ events }));
    }

    case "run_full_security_audit": {
      const scanId = await logScan({
        scan_type: "full_audit",
        status: "running",
        site_url: wpUrl,
      });

      const [core, plugins, themes, ssl, users] = await Promise.all([
        checkCoreIntegrity(wpUrl, token),
        checkPluginVulnerabilities(wpUrl, token),
        checkThemeSecurity(wpUrl, token),
        checkSSL(wpUrl, token),
        checkUserSecurity(wpUrl, token),
      ]);

      const allFindings = [
        ...core.findings,
        ...plugins.findings,
        ...themes.findings,
        ...ssl.findings,
        ...users.findings,
      ];

      // Sort by severity
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      allFindings.sort((a, b) => (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4));

      // Log all findings
      for (const f of allFindings) {
        await logFinding({ scan_id: scanId || undefined, ...f });
      }

      // Update scan status
      if (scanId) {
        const client = (await import("./supabase")).getSupabase();
        if (client) {
          await client.from("security_scans").update({
            status: "completed",
            findings_count: allFindings.length,
            summary: `Full audit: ${allFindings.filter(f => f.severity === "critical").length} critical, ${allFindings.filter(f => f.severity === "high").length} high, ${allFindings.filter(f => f.severity === "medium").length} medium, ${allFindings.filter(f => f.severity === "low").length} low`,
          }).eq("id", scanId);
        }
      }

      const hardening = getHardeningRecommendations();

      return truncate(JSON.stringify({
        audit_summary: {
          total_findings: allFindings.length,
          critical: allFindings.filter(f => f.severity === "critical").length,
          high: allFindings.filter(f => f.severity === "high").length,
          medium: allFindings.filter(f => f.severity === "medium").length,
          low: allFindings.filter(f => f.severity === "low").length,
        },
        findings: allFindings,
        hardening_recommendations: hardening.recommendations.slice(0, 5),
        plugins_summary: {
          total: plugins.total_plugins,
          active: plugins.active,
          inactive: plugins.inactive,
        },
        ssl: { uses_https: ssl.uses_https },
      }));
    }

    default:
      return null; // Not handled by this feature
  }
}

export async function executeWriteTool(
  name: string,
  input: Record<string, unknown>,
  ctx: any
): Promise<unknown | null> {
  switch (name) {
    case "resolve_security_finding": {
      const client = (await import("./supabase")).getSupabase();
      if (!client) {
        return JSON.stringify({ error: "Supabase not configured — cannot resolve findings" });
      }
      const { error } = await client
        .from("security_findings")
        .update({
          resolved: true,
          resolution: input.resolution,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", input.finding_id);

      if (error) throw new Error(error.message);
      return { success: true, finding_id: input.finding_id };
    }

    default:
      return null; // Not handled by this feature
  }
}
