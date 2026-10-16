import { DEMO_LABEL_DATA_URL, DEMO_LABEL_FILENAME, DEMO_LABEL_OCR_TEXT } from "@/lib/ocr/fixture";
import { preprocessImageForOcr } from "@/lib/ocr/preprocess";

export interface OcrResult {
  text: string;
  confidence: number;
  provider: "tesseract" | "demo-fixture" | "google-vision";
  simulatedFailure?: boolean;
  dimensions?: {
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
  };
  preprocessed?: boolean;
  ocrDurationMs?: number;
}

export async function runTesseract(
  image: string,
  options: { preprocess?: boolean } = { preprocess: true },
): Promise<OcrResult> {
  const startTime = Date.now();
  let targetImage = image;
  let dims: OcrResult["dimensions"] | undefined = undefined;
  let preprocessed = false;

  // 1. Run optical preprocessing to scale and enhance contrast for OCR
  if (options.preprocess !== false && typeof window !== "undefined") {
    try {
      const prep = await preprocessImageForOcr(image);
      if (prep.dataUrl) {
        targetImage = prep.dataUrl;
        dims = {
          width: prep.width,
          height: prep.height,
          originalWidth: prep.originalWidth,
          originalHeight: prep.originalHeight,
        };
        preprocessed = true;
      }
    } catch (e) {
      console.warn("[OCR] Image preprocessing failed, falling back to raw image:", e);
    }
  }

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    // Configure Tesseract for food label structure
    await worker.setParameters({
      preserve_interword_spaces: "1",
    });

    const res = await worker.recognize(targetImage);
    const confidence = Math.round(res.data.confidence ?? 0);
    const duration = Date.now() - startTime;

    return {
      text: res.data.text || "",
      confidence,
      provider: "tesseract",
      dimensions: dims,
      preprocessed,
      ocrDurationMs: duration,
    };
  } finally {
    await worker.terminate();
  }
}

export const FAIL_TOKEN = "__LLG_FORCE_OCR_FAIL__";

export async function runOcrPipeline(
  image: string,
  options: { forceFail?: boolean; fileName?: string | null; preprocess?: boolean } = {},
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
      preprocessed: false,
      ocrDurationMs: 45,
    };
  }

  try {
    return await runTesseract(image, { preprocess: options.preprocess });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OCR failed";
    console.error("[OCR Pipeline Error]:", message);
    throw new Error(message);
  }
}
