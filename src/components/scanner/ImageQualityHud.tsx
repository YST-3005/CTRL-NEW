"use client";

import type { ImageQualityReport } from "@/lib/ocr/quality";
import { Badge, Button } from "@/components/ui/Hud";

interface ImageQualityHudProps {
  report: ImageQualityReport | null;
  onRetake?: () => void;
  compact?: boolean;
}

export function ImageQualityHud({ report, onRetake, compact = false }: ImageQualityHudProps) {
  if (!report) return null;

  const { overallScore, suitability, guidance, metrics } = report;

  const toneMap: Record<ImageQualityReport["suitability"], "ok" | "amber" | "alert"> = {
    suitable: "ok",
    needs_review: "amber",
    unsuitable: "alert",
  };

  return (
    <div
      className={`rounded-2xl border p-4 backdrop-blur-md transition-all ${
        suitability === "unsuitable"
          ? "border-rose-400/40 bg-rose-950/30"
          : suitability === "needs_review"
            ? "border-amber-400/40 bg-amber-950/30"
            : "border-cyan-400/30 bg-slate-950/60"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="hud-label text-cyan-300">Optical Quality Diagnostics</span>
          <Badge tone={toneMap[suitability]}>{suitability.toUpperCase().replace("_", " ")}</Badge>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">Score:</span>
          <span
            className={`font-bold ${
              overallScore >= 75 ? "text-emerald-300" : overallScore >= 45 ? "text-amber-300" : "text-rose-400"
            }`}
          >
            {overallScore} / 100
          </span>
          <span className="text-[10px] text-slate-500">(Automated Estimate)</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono sm:grid-cols-4">
        {/* Sharpness */}
        <div className="rounded-lg bg-white/5 p-2 border border-white/5">
          <span className="text-[10px] text-slate-400 block">Sharpness / Blur</span>
          <span className={metrics.isBlurry ? "text-rose-300 font-bold" : "text-emerald-300"}>
            {metrics.isBlurry ? "▲ Blurry" : `✓ Sharp (${metrics.sharpnessScore}%)`}
          </span>
        </div>

        {/* Resolution */}
        <div className="rounded-lg bg-white/5 p-2 border border-white/5">
          <span className="text-[10px] text-slate-400 block">Resolution</span>
          <span className={metrics.isLowResolution ? "text-amber-300 font-bold" : "text-emerald-300"}>
            {metrics.width} × {metrics.height} px
          </span>
        </div>

        {/* Lighting & Contrast */}
        <div className="rounded-lg bg-white/5 p-2 border border-white/5">
          <span className="text-[10px] text-slate-400 block">Lighting / Contrast</span>
          <span className={metrics.isPoorLighting || metrics.isLowContrast ? "text-amber-300" : "text-emerald-300"}>
            {metrics.isPoorLighting ? "▲ Poor lighting" : metrics.isLowContrast ? "▲ Low contrast" : "✓ Balanced"}
          </span>
        </div>

        {/* Glare & Crop */}
        <div className="rounded-lg bg-white/5 p-2 border border-white/5">
          <span className="text-[10px] text-slate-400 block">Glare & Crop</span>
          <span className={metrics.hasGlare ? "text-rose-300" : metrics.isCroppedOrObstructed ? "text-amber-300" : "text-emerald-300"}>
            {metrics.hasGlare
              ? `▲ Glare (${metrics.glarePercentage}%)`
              : metrics.isCroppedOrObstructed
                ? "▲ Cropped edge"
                : "✓ Clean"}
          </span>
        </div>
      </div>

      {/* Actionable Guidance List */}
      {guidance.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-2.5">
          <p className="text-[11px] font-bold text-amber-200 mb-1 font-mono">SPECIFIC GUIDANCE:</p>
          <ul className="space-y-1 text-xs text-amber-100">
            {guidance.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-amber-400">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onRetake && suitability !== "suitable" && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" className="text-xs py-1 px-3" onClick={onRetake}>
            Retake Closer Photo →
          </Button>
        </div>
      )}
    </div>
  );
}
