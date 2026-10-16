import { NextResponse } from "next/server";
import { askLabel } from "@/lib/llm/adapter";
import type { DietaryPreferences, ProductRecord } from "@/types";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    question?: string;
    product?: ProductRecord | null;
    prefs?: DietaryPreferences;
    compareWith?: ProductRecord | null;
  };
  if (!body.question) return NextResponse.json({ error: "question required" }, { status: 400 });
  const message = await askLabel({
    question: body.question,
    product: body.product ?? null,
    prefs: body.prefs,
    compareWith: body.compareWith,
  });
  return NextResponse.json({ message, provider: process.env.OPENAI_API_KEY ? "openai" : "local-grounded" });
}
