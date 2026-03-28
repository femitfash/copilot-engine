/**
 * Supabase client for security scanner logging.
 *
 * Tables auto-created on first run:
 *   security_scans     — scan run metadata (timestamp, type, status, findings count)
 *   security_findings  — individual findings (severity, category, description, remediation)
 *   security_events    — login attempts, file changes, suspicious activity
 */

let supabaseClient: any = null;

export async function initializeSupabase(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return;

  try {
    // Dynamic import to avoid requiring supabase when feature is disabled
    const { createClient } = await import("@supabase/supabase-js");
    supabaseClient = createClient(url, key);
    console.log("  ✅ Supabase connected for security logging");
  } catch (err: any) {
    console.warn(`  ⚠️  Supabase init failed: ${err.message}. Install @supabase/supabase-js to enable logging.`);
  }
}

export function getSupabase(): any {
  return supabaseClient;
}

// ─── Logging Functions ──────────────────────────────────────────────────

export async function logScan(scan: {
  scan_type: string;
  status: "running" | "completed" | "failed";
  findings_count?: number;
  summary?: string;
  site_url?: string;
}): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("security_scans")
      .insert({
        ...scan,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (err: any) {
    console.warn(`Supabase log scan error: ${err.message}`);
    return null;
  }
}

export async function logFinding(finding: {
  scan_id?: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  title: string;
  description: string;
  remediation?: string;
  affected_item?: string;
}): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  try {
    await client.from("security_findings").insert({
      ...finding,
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.warn(`Supabase log finding error: ${err.message}`);
  }
}

export async function logEvent(event: {
  event_type: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string;
  source_ip?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  try {
    await client.from("security_events").insert({
      ...event,
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.warn(`Supabase log event error: ${err.message}`);
  }
}

export async function getRecentScans(limit: number = 10): Promise<unknown[]> {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("security_scans")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function getRecentFindings(limit: number = 20): Promise<unknown[]> {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("security_findings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function getRecentEvents(limit: number = 50): Promise<unknown[]> {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("security_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}
