/**
 * Optional Google Cloud Vision adapter.
 * Images are only sent if GOOGLE_VISION_API_KEY is set on the server.
 */
export async function runGoogleVision(imageDataUrl: string): Promise<{ text: string; confidence: number } | null> {
  const key = process.env.GOOGLE_VISION_API_KEY;
  if (!key) return null;
  const content = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Vision API ${res.status}`);
  const json = await res.json();
  const text = json.responses?.[0]?.fullTextAnnotation?.text || "";
  return { text, confidence: text ? 80 : 0 };
}
