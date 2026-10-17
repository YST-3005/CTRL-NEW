"use client";

import { useState } from "react";
import type { EvidenceGroundedComparison } from "@/types/comparison";
import { Badge, Button } from "@/components/ui/Hud";

interface EvidenceGroundedAlertsProps {
  comparisons: EvidenceGroundedComparison[];
  onNavigateToEvidence?: (evidenceRef: string) => void;
  onResolveConfirmation?: (comparisonId: string, actionValue: string) => void;
  onDismissAlert?: (comparisonId: string) => void;
}

export function EvidenceGroundedAlerts({
  comparisons,
  onNavigateToEvidence,
  onResolveConfirmation,
  onDismissAlert,
}: EvidenceGroundedAlertsProps) {
  const [activePromptComp, setActivePromptComp] = useState<EvidenceGroundedComparison | null>(null);

  if (!comparisons || comparisons.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#070c1e]/60 p-4 text-sm text-slate-400">
        No dietary rules or thresholds active. Configure dietary preferences or caregiver limits to review alerts.
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="evidence-grounded-alerts">
      {comparisons.map((comp) => {
        const statusMeta = getStatusBadgeMeta(comp.status);

        return (
          <div
            key={comp.id}
            id={`alert-card-${comp.id}`}
            className={`relative rounded-2xl border p-4 backdrop-blur-md transition-all ${
              comp.severity === "alert"
                ? "border-red-500/40 bg-red-950/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                : comp.status === "UNRESOLVED_CONTRADICTION"
                ? "border-fuchsia-500/40 bg-fuchsia-950/20 shadow-[0_0_15px_rgba(217,70,239,0.1)]"
                : comp.status === "NEEDS_USER_CONFIRMATION"
                ? "border-cyan-400/40 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                : comp.severity === "warning"
                ? "border-amber-500/40 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                : "border-emerald-500/30 bg-emerald-950/15"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base" aria-hidden="true">
                  {statusMeta.icon}
                </span>
                <span className="font-syne text-sm font-semibold tracking-wide text-slate-100">
                  {comp.ruleName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={statusMeta.badgeTone}>
                  {statusMeta.label}
                </Badge>
                {onDismissAlert && comp.severity !== "safe" && (
                  <button
                    type="button"
                    onClick={() => onDismissAlert(comp.id)}
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                    title="Dismiss alert card (does not resolve underlying conflict)"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>

            <p className="mt-2 text-sm text-slate-200">{comp.explanation}</p>

            {/* Exact Extracted Evidence snippet */}
            {comp.originalExtractedText ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-xs">
                <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                  <span>Exact Label Evidence</span>
                  {comp.confidence !== undefined && (
                    <span>
                      Confidence: {comp.confidence !== null ? `${comp.confidence}%` : "Honest null"}
                    </span>
                  )}
                </div>
                <p className="text-cyan-200/90 whitespace-pre-wrap select-all font-mono">
                  &ldquo;{comp.originalExtractedText}&rdquo;
                </p>
              </div>
            ) : comp.severity !== "safe" ? (
              <div className="mt-2 rounded-lg border border-dashed border-white/10 bg-white/5 p-2 text-xs text-slate-400 font-mono">
                No readable supporting evidence found on physical label.
              </div>
            ) : null}

            {/* Threshold information if applicable */}
            {comp.thresholdApplied && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400 font-mono">
                <span>
                  Configured Threshold:{" "}
                  <strong className="text-amber-300">
                    {comp.thresholdApplied.operator} {comp.thresholdApplied.limit} {comp.thresholdApplied.unit}
                  </strong>{" "}
                  ({comp.thresholdApplied.basis})
                </span>
                {comp.normalizedValue && (
                  <span>
                    Label Value: <strong className="text-cyan-200">{comp.normalizedValue}</strong>
                  </span>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
              <div className="flex gap-2">
                {comp.supportingEvidenceRefs.length > 0 && onNavigateToEvidence && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigateToEvidence(comp.supportingEvidenceRefs[0])}
                    className="text-xs text-cyan-300 hover:bg-cyan-400/10"
                    data-testid={`link-evidence-${comp.id}`}
                  >
                    🔍 View Label Evidence
                  </Button>
                )}
                {comp.userConfirmationRequired && comp.confirmationPrompt && onResolveConfirmation && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setActivePromptComp(comp)}
                    className="text-xs bg-cyan-500/20 text-cyan-200 border-cyan-400/40 hover:bg-cyan-500/30"
                    data-testid={`review-ambiguity-${comp.id}`}
                  >
                    ⚠️ Review & Resolve
                  </Button>
                )}
              </div>

              {comp.resolvedByUser && (
                <span className="text-[11px] text-emerald-400 font-mono">
                  ✓ User Confirmed ({comp.resolvedAction})
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Confirmation & Ambiguity Resolution Modal */}
      {activePromptComp && activePromptComp.confirmationPrompt && onResolveConfirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-lg w-full rounded-2xl border border-cyan-400/30 bg-[#060b1c] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-syne font-semibold text-cyan-200">
                Confirm Ingredient Ambiguity / Contradiction
              </h3>
              <button
                type="button"
                onClick={() => setActivePromptComp(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Original Label Phrase:
                </span>
                <p className="mt-1 font-mono text-cyan-100 bg-white/5 p-2.5 rounded-lg border border-white/10">
                  &ldquo;{activePromptComp.confirmationPrompt.originalPhrase}&rdquo;
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Competing Interpretations:
                </span>
                <ul className="mt-1 space-y-1 text-slate-300 list-disc pl-5 text-xs">
                  {activePromptComp.confirmationPrompt.competingInterpretations.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200">
                <span className="font-semibold">Why this matters: </span>
                {activePromptComp.confirmationPrompt.impactReason}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <span className="text-xs text-slate-400 uppercase tracking-wider">
                Select Your Resolution:
              </span>
              <div className="grid gap-2">
                {activePromptComp.confirmationPrompt.suggestedActions.map((action) => (
                  <Button
                    key={action.actionValue}
                    variant={action.actionValue.includes("conflict") || action.actionValue.includes("animal") ? "danger" : "primary"}
                    className="w-full text-xs justify-start"
                    onClick={() => {
                      onResolveConfirmation(activePromptComp.id, action.actionValue);
                      setActivePromptComp(null);
                    }}
                    data-testid={`action-${action.actionValue}`}
                  >
                    {action.label}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="w-full text-xs text-cyan-300 hover:text-white"
                  onClick={() => {
                    window.location.href = "/scanner";
                  }}
                  data-testid="action-upload-clearer"
                >
                  📷 Upload Clearer Image
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-xs text-slate-400 hover:text-white"
                  onClick={() => {
                    onResolveConfirmation(activePromptComp.id, "leave_unresolved");
                    setActivePromptComp(null);
                  }}
                  data-testid="action-leave-unresolved"
                >
                  Leave Unresolved
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusBadgeMeta(status: EvidenceGroundedComparison["status"]): {
  label: string;
  badgeTone: "alert" | "amber" | "ok" | "muted";
  icon: string;
} {
  switch (status) {
    case "CONFIRMED_CONFLICT":
      return { label: "CONFIRMED FINDING", badgeTone: "alert", icon: "⛔" };
    case "UNRESOLVED_CONTRADICTION":
      return { label: "UNRESOLVED CONTRADICTION", badgeTone: "alert", icon: "⚡" };
    case "NEEDS_USER_CONFIRMATION":
      return { label: "NEEDS USER CONFIRMATION", badgeTone: "amber", icon: "❓" };
    case "UNCERTAIN":
      return { label: "UNCERTAIN", badgeTone: "amber", icon: "⚠️" };
    case "MISSING_INFORMATION":
      return { label: "MISSING INFORMATION", badgeTone: "amber", icon: "📋" };
    case "NO_DETECTED_CONFLICT":
      return { label: "NO DETECTED CONFLICT", badgeTone: "ok", icon: "✓" };
    default:
      return { label: status, badgeTone: "muted", icon: "ℹ️" };
  }
}
