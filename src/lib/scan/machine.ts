import type { ScanPhase } from "@/types";

export const SCAN_FLOW: ScanPhase[] = ["idle", "uploading", "processing", "reviewing", "completed"];

export const SCAN_TRANSITIONS: Record<ScanPhase, ScanPhase[]> = {
  idle: ["uploading", "processing"],
  uploading: ["processing", "failed", "cancelled"],
  processing: ["reviewing", "failed", "cancelled"],
  reviewing: ["completed", "failed"],
  completed: ["idle", "uploading", "processing"],
  failed: ["idle", "uploading", "processing"],
  cancelled: ["idle", "uploading", "processing"],
};

export function canTransition(from: ScanPhase, to: ScanPhase): boolean {
  return SCAN_TRANSITIONS[from].includes(to);
}

export function isBusyPhase(phase: ScanPhase): boolean {
  return phase === "uploading" || phase === "processing";
}
