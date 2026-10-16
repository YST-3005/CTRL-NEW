import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { DietaryPreferences, ScanRecord } from "@/types";

/** Cloud persistence is only attempted when Supabase is configured. Demo mode never claims this ran. */
export async function pullCloudScans(userId: string): Promise<ScanRecord[] | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  const { data, error } = await sb.from("scans").select("*").eq("user_id", userId);
  if (error) return null;
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    product: row.product,
    phase: row.phase,
    saved: row.saved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function pushCloudScans(userId: string, scans: ScanRecord[]): Promise<boolean> {
  const sb = getSupabaseBrowser();
  if (!sb) return false;
  const { error } = await sb.from("scans").upsert(
    scans.map((s) => ({
      id: s.id,
      user_id: userId,
      product: s.product,
      phase: s.phase,
      saved: s.saved,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    })),
  );
  return !error;
}

export async function pushCloudPrefs(userId: string, prefs: DietaryPreferences): Promise<boolean> {
  const sb = getSupabaseBrowser();
  if (!sb) return false;
  const { error } = await sb.from("preferences").upsert({ user_id: userId, prefs, updated_at: new Date().toISOString() });
  return !error;
}
