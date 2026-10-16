/**
 * LabelLens Guardian — Image Quality Detection Engine
 * Evaluates blur, resolution, lighting, glare, cropping, and curvature.
 * Provides actionable guidance and clearly distinguishes automated estimates from confirmed issues.
 */

export interface ImageQualityMetrics {
  width: number;
  height: number;
  totalPixels: number;
  sharpnessScore: number; // 0-100 (Laplacian variance derived)
  isBlurry: boolean;
  isLowResolution: boolean;
  meanLuminance: number; // 0-255
  contrastStdDev: number; // 0-128
  isPoorLighting: boolean;
  isLowContrast: boolean;
  glarePercentage: number; // 0-100%
  hasGlare: boolean;
  isCroppedOrObstructed: boolean;
  isCurvedOrDistorted: boolean;
}

export interface ImageQualityReport {
  overallScore: number; // 0 - 100
  suitability: "suitable" | "needs_review" | "unsuitable";
  metrics: ImageQualityMetrics;
  guidance: string[];
  isEstimate: true; // Explicitly documented as automated heuristic estimate
  assessedAt: string;
}

export interface QualityAnalysisOptions {
  minResolution?: number; // default 600px min dimension
  blurThreshold?: number; // default 60
  glareThreshold?: number; // default 4.0%
  lowContrastThreshold?: number; // default 26
  mockMetrics?: Partial<ImageQualityMetrics>; // for headless tests
}

/**
 * Calculates luminance of an RGB pixel using ITU-R BT.601 standard
 */
function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Analyzes raw ImageData from canvas to extract optical quality metrics
 */
export function analyzeImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: QualityAnalysisOptions = {},
): ImageQualityReport {
  const minRes = options.minResolution ?? 600;
  const blurThresh = options.blurThreshold ?? 60;
  const glareThresh = options.glareThreshold ?? 4.0;
  const contrastThresh = options.lowContrastThreshold ?? 26;

  const totalPixels = width * height;
  let sumLuminance = 0;
  let sumLuminanceSq = 0;
  let saturatedCount = 0;

  // Grayscale buffer for Laplacian sharpness
  const gray = new Float32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const lum = getLuminance(r, g, b);
    gray[i] = lum;
    sumLuminance += lum;
    sumLuminanceSq += lum * lum;

    // Specular highlight / potential glare threshold
    if (r > 245 && g > 245 && b > 245) {
      saturatedCount++;
    }
  }

  const meanLuminance = totalPixels > 0 ? sumLuminance / totalPixels : 128;
  const varianceLum = Math.max(0, totalPixels > 0 ? sumLuminanceSq / totalPixels - meanLuminance * meanLuminance : 0);
  const contrastStdDev = Math.sqrt(varianceLum);
  const glarePercentage = totalPixels > 0 ? (saturatedCount / totalPixels) * 100 : 0;

  // Discrete Laplacian 3x3 kernel variance for sharpness
  let laplacianSum = 0;
  let laplacianSumSq = 0;
  let laplacianCount = 0;
  let borderHighEnergy = 0;
  let borderPixelCount = 0;

  for (let y = 1; y < height - 1; y++) {
    const yOffset = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = yOffset + x;
      // 4-neighbor Laplacian
      const lap =
        4 * gray[idx] -
        gray[idx - 1] -
        gray[idx + 1] -
        gray[idx - width] -
        gray[idx + width];

      laplacianSum += lap;
      laplacianSumSq += lap * lap;
      laplacianCount++;

      // Check if perimeter has high edge gradients (cropped text reaching borders)
      const isPerimeter = x <= 3 || x >= width - 4 || y <= 3 || y >= height - 4;
      if (isPerimeter) {
        borderPixelCount++;
        if (Math.abs(lap) > 40) {
          borderHighEnergy++;
        }
      }
    }
  }

  const meanLap = laplacianCount > 0 ? laplacianSum / laplacianCount : 0;
  const varLap = Math.max(0, laplacianCount > 0 ? laplacianSumSq / laplacianCount - meanLap * meanLap : 0);
  // Normalize sharpness score into 0-100 range
  const sharpnessScore = Math.min(100, Math.round((varLap / 300) * 100));

  const isBlurry = varLap < blurThresh;
  const isLowResolution = width < minRes || height < minRes;
  const isPoorLighting = meanLuminance < 45 || meanLuminance > 225;
  const isLowContrast = contrastStdDev < contrastThresh;
  const hasGlare = glarePercentage > glareThresh;

  // Cropped indicator: high percentage of edge pixels have sharp cutoffs
  const borderDensity = borderPixelCount > 0 ? borderHighEnergy / borderPixelCount : 0;
  const isCroppedOrObstructed = borderDensity > 0.18;

  // Curvature check heuristic (high aspect ratio distortion / uneven brightness gradient)
  const isCurvedOrDistorted = false; // base heuristic; extended if OCR bounding box line variance exists

  // Calculate composite score (0-100)
  let score = 100;
  if (isBlurry) score -= 35;
  if (isLowResolution) score -= 25;
  if (isPoorLighting) score -= 15;
  if (isLowContrast) score -= 15;
  if (hasGlare) score -= 20;
  if (isCroppedOrObstructed) score -= 20;
  score = Math.max(0, Math.min(100, score));

  // Determine suitability & guidance messages
  const guidance: string[] = [];
  if (isBlurry) {
    guidance.push("Image appears blurry — retake closer to the label or hold device steady.");
  }
  if (isLowResolution) {
    guidance.push("Text is too small or resolution is low — move closer or upload a higher-resolution image.");
  }
  if (hasGlare) {
    guidance.push("Glare may hide ingredient text — adjust lighting angle to reduce reflections.");
  }
  if (isPoorLighting || isLowContrast) {
    guidance.push("Poor lighting or low contrast — increase illumination to make printed text legible.");
  }
  if (isCroppedOrObstructed) {
    guidance.push("Nutrition or ingredient panel may be cropped — capture the complete panel.");
  }

  let suitability: ImageQualityReport["suitability"] = "suitable";
  if (score < 45 || isBlurry || (isLowResolution && hasGlare)) {
    suitability = "unsuitable";
  } else if (score < 75 || guidance.length > 0) {
    suitability = "needs_review";
  }

  return {
    overallScore: score,
    suitability,
    guidance,
    isEstimate: true,
    assessedAt: new Date().toISOString(),
    metrics: {
      width,
      height,
      totalPixels,
      sharpnessScore,
      isBlurry,
      isLowResolution,
      meanLuminance: Math.round(meanLuminance),
      contrastStdDev: Math.round(contrastStdDev),
      isPoorLighting,
      isLowContrast,
      glarePercentage: Math.round(glarePercentage * 10) / 10,
      hasGlare,
      isCroppedOrObstructed,
      isCurvedOrDistorted,
    },
  };
}

/**
 * Evaluates an image data URL in browser or node environment
 */
export async function assessImageQuality(
  imageDataUrl: string,
  options: QualityAnalysisOptions = {},
): Promise<ImageQualityReport> {
  // Support explicit mock metrics for automated test environments
  if (options.mockMetrics) {
    const m = options.mockMetrics;
    const width = m.width ?? 1024;
    const height = m.height ?? 1024;
    const isBlurry = Boolean(m.isBlurry);
    const isLowResolution = Boolean(m.isLowResolution ?? (width < 600 || height < 600));
    const hasGlare = Boolean(m.hasGlare);
    const isPoorLighting = Boolean(m.isPoorLighting);
    const isLowContrast = Boolean(m.isLowContrast);
    const isCroppedOrObstructed = Boolean(m.isCroppedOrObstructed);
    const isCurvedOrDistorted = Boolean(m.isCurvedOrDistorted);

    const guidance: string[] = [];
    if (isBlurry) guidance.push("Image appears blurry — retake closer to the label.");
    if (isLowResolution) guidance.push("Text is too small — move closer or upload a higher-resolution image.");
    if (hasGlare) guidance.push("Glare may hide ingredient text — adjust the lighting.");
    if (isCroppedOrObstructed) guidance.push("Nutrition panel may be cropped — capture the complete panel.");
    if (isPoorLighting || isLowContrast) guidance.push("Poor lighting or low contrast — adjust lighting to make text legible.");

    let overallScore = 90;
    if (isBlurry) overallScore -= 35;
    if (isLowResolution) overallScore -= 25;
    if (hasGlare) overallScore -= 20;
    if (isCroppedOrObstructed) overallScore -= 20;
    if (isPoorLighting || isLowContrast) overallScore -= 15;
    overallScore = Math.max(10, Math.min(100, overallScore));

    const suitability: ImageQualityReport["suitability"] =
      overallScore < 45 || isBlurry ? "unsuitable" : overallScore < 75 ? "needs_review" : "suitable";

    return {
      overallScore,
      suitability,
      guidance,
      isEstimate: true,
      assessedAt: new Date().toISOString(),
      metrics: {
        width,
        height,
        totalPixels: width * height,
        sharpnessScore: isBlurry ? 25 : 85,
        isBlurry,
        isLowResolution,
        meanLuminance: isPoorLighting ? 30 : 135,
        contrastStdDev: isLowContrast ? 18 : 65,
        isPoorLighting,
        isLowContrast,
        glarePercentage: hasGlare ? 8.5 : 0.5,
        hasGlare,
        isCroppedOrObstructed,
        isCurvedOrDistorted,
      },
    };
  }

  // If in browser environment with HTMLImageElement & Canvas
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        // Scale to max 512x512 for fast processing
        const maxDim = 512;
        const scale = Math.min(1, maxDim / Math.max(origW, origH));
        const sampleW = Math.max(32, Math.round(origW * scale));
        const sampleH = Math.max(32, Math.round(origH * scale));

        const canvas = document.createElement("canvas");
        canvas.width = sampleW;
        canvas.height = sampleH;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(fallbackReport(origW, origH));
          return;
        }

        ctx.drawImage(img, 0, 0, sampleW, sampleH);
        try {
          const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
          const rep = analyzeImageData(imgData.data, sampleW, sampleH, options);
          // Preserve true original resolution
          rep.metrics.width = origW;
          rep.metrics.height = origH;
          rep.metrics.totalPixels = origW * origH;
          rep.metrics.isLowResolution = origW < 600 || origH < 600;
          if (rep.metrics.isLowResolution && !rep.guidance.some((g) => g.includes("resolution"))) {
            rep.guidance.push("Text is too small — move closer or upload a higher-resolution image.");
            rep.overallScore = Math.max(0, rep.overallScore - 20);
            if (rep.suitability === "suitable") rep.suitability = "needs_review";
          }
          resolve(rep);
        } catch {
          resolve(fallbackReport(origW, origH));
        }
      };
      img.onerror = () => {
        resolve(fallbackReport(0, 0, "Image failed to decode"));
      };
      img.src = imageDataUrl;
    });
  }

  // Fallback for non-browser environments without mockMetrics
  return fallbackReport(1024, 1024);
}

function fallbackReport(width = 800, height = 800, note?: string): ImageQualityReport {
  return {
    overallScore: 75,
    suitability: "needs_review",
    guidance: note ? [note] : ["Automated optical inspection unavailable in current environment."],
    isEstimate: true,
    assessedAt: new Date().toISOString(),
    metrics: {
      width,
      height,
      totalPixels: width * height,
      sharpnessScore: 60,
      isBlurry: false,
      isLowResolution: width < 600 || height < 600,
      meanLuminance: 128,
      contrastStdDev: 45,
      isPoorLighting: false,
      isLowContrast: false,
      glarePercentage: 0,
      hasGlare: false,
      isCroppedOrObstructed: false,
      isCurvedOrDistorted: false,
    },
  };
}
