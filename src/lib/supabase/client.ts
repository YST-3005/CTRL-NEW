import { createClient } from "@supabase/supabase-js";
import { supabaseConfigured } from "@/lib/auth/config";

export function getSupabaseBrowser() {
  if (!supabaseConfigured()) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
