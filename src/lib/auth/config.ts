export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function forceDemoAuth(): boolean {
  return process.env.NEXT_PUBLIC_FORCE_DEMO_AUTH !== "false";
}

export function authMode(): "demo" | "supabase" {
  if (!supabaseConfigured() || forceDemoAuth()) return "demo";
  return "supabase";
}
