import { NextResponse } from "next/server";
import { runGoogleVision } from "@/lib/ocr/vision";

export async function POST(req: Request) {
  const body = (await req.json()) as { image?: string };
  if (!body.image) return NextResponse.json({ error: "image required" }, { status: 400 });
  if (!process.env.GOOGLE_VISION_API_KEY) {
    return NextResponse.json({
      provider: "none",
      message: "No cloud vision key configured. The client uses on-device Tesseract instead.",
    });
  }
  try {
    const result = await runGoogleVision(body.image);
    return NextResponse.json({ provider: "google-vision", result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Vision failed" },
      { status: 502 },
    );
  }
}
