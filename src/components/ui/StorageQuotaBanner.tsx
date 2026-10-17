"use client";

import { useGuardianStore } from "@/stores/useGuardianStore";
import { Badge, Button } from "@/components/ui/Hud";

export function StorageQuotaBanner() {
  const storageWarning = useGuardianStore((s) => s.storageWarning);
  const dismissStorageWarning = useGuardianStore((s) => s.dismissStorageWarning);

  if (!storageWarning) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/40 bg-cyan-950/40 p-4 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.15)]"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl" aria-hidden="true">💾</span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-syne text-xs font-semibold uppercase tracking-wider text-cyan-200">
              Storage Safeguard Active
            </span>
            <Badge tone="cyan">IndexedDB Offload</Badge>
          </div>
          <p className="mt-0.5 text-xs text-slate-300">{storageWarning}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={dismissStorageWarning}
        className="text-xs text-cyan-300 hover:text-white"
      >
        Dismiss
      </Button>
    </div>
  );
}
