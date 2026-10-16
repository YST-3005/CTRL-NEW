import { DEMO_LABEL_DATA_URL, DEMO_LABEL_FILENAME, DEMO_LABEL_OCR_TEXT } from "@/lib/ocr/fixture";

export interface OcrResult {
  text: string;
  confidence: number;
  provider: "tesseract" | "demo-fixture" | "google-vision";
  simulatedFailure?: boolean;
}

export async function runTesseract(image: string): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const res = await worker.recognize(image);
    const confidence = res.data.confidence ?? 0;
    return { text: res.data.text || "", confidence, provider: "tesseract" };
  } finally {
    await worker.terminate();
  }
}

export const FAIL_TOKEN = "__LLG_FORCE_OCR_FAIL__";

export async function runOcrPipeline(
  image: string,
  options: { forceFail?: boolean; fileName?: string | null } = {},
): Promise<OcrResult> {
  const forceFail = options.forceFail || image.includes(FAIL_TOKEN);
  if (forceFail) {
    throw new Error("OCR provider request failed (simulated or forced). You can retry without losing the upload.");
  }

  const isDemoFixture =
    options.fileName === DEMO_LABEL_FILENAME || image === DEMO_LABEL_DATA_URL || image.includes("llg-demo-ocr");

  if (isDemoFixture) {
    return {
      text: DEMO_LABEL_OCR_TEXT,
      confidence: 82,
      provider: "demo-fixture",
    };
  }

  try {
    return await runTesseract(image);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OCR failed";
    throw new Error(message);
  }
}
