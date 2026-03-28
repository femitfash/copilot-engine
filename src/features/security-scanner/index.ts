import type { FeatureModule } from "../feature-module";
import { readTools, writeTools } from "./tools";
import { executeReadTool, executeWriteTool } from "./executor";
import { initializeSupabase } from "./supabase";

const securityScanner: FeatureModule = {
  name: "security-scanner",
  description: "WordPress security scanning — vulnerability checks, file integrity, login monitoring, hardening recommendations. Results logged to Supabase.",

  readTools,
  writeTools,

  executeReadTool,
  executeWriteTool,

  systemPromptAddition: `
## Security Scanner (Enabled)

You have access to security scanning tools. Use them proactively:
- When asked about site security, run a scan first
- When listing plugins/themes, check for known vulnerabilities
- Monitor failed login attempts and suspicious activity
- Recommend security hardening steps based on scan results
- All scan results are logged to the connected Supabase database for historical tracking

Available security actions:
- [suggest:Run a security scan on my site]Security Scan[/suggest]
- [suggest:Check for plugin vulnerabilities]Check Vulnerabilities[/suggest]
- [suggest:Show recent security events]Security Events[/suggest]
- [suggest:What security improvements should I make?]Hardening Tips[/suggest]
`,

  initialize: async () => {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      await initializeSupabase();
    } else {
      console.log("  ℹ️  Security scanner: No Supabase configured — results will not be persisted.");
      console.log("     Set SUPABASE_URL and SUPABASE_ANON_KEY in .env to enable logging.");
    }
  },
};

export default securityScanner;
export { securityScanner as feature };
