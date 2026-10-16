import { NextResponse } from "next/server";
import { authMode } from "@/lib/auth/config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    authMode: authMode(),
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    openai: Boolean(process.env.OPENAI_API_KEY),
    notificationProvider: process.env.NOTIFICATION_PROVIDER || "simulation",
  });
}
