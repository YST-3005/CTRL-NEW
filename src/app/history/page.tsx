"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { filterScans, type CatalogFilters } from "@/lib/search/filter";
import { Badge, Button, Panel, inputClass } from "@/components/ui/Hud";
import { HistoryOrbit } from "@/components/three/LabCanvas";

const LabCanvas = dynamic(() => import("@/components/three/LabCanvas").then((m) => m.LabCanvas), { ssr: false });

export default function HistoryPage() {
  const scans = useGuardianStore((s) => s.scans);
  const toggleSaved = useGuardianStore((s) => s.toggleSaved);
  const deleteScan = useGuardianStore((s) => s.deleteScan);
  const clearHistory = useGuardianStore((s) => s.clearHistory);
  const loadSample = useGuardianStore((s) => s.loadSample);
  const router = useRouter();
  const [filters, setFilters] = useState<CatalogFilters>({ query: "", sort: "date" });
  const list = useMemo(() => filterScans(scans, filters), [scans, filters]);

  function chip(label: string, patch: Partial<CatalogFilters>, active: boolean) {
    return (
      <button
        type="button"
        className={`rounded-full border px-3 py-1 text-xs ${active ? "border-cyan-300 bg-cyan-400/10 text-cyan-100" : "border-white/15 text-slate-300"}`}
        onClick={() => setFilters({ ...filters, ...patch })}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="hud-label">Local persistence</p>
        <h1 className="display text-3xl">Scan history</h1>
        <p className="text-sm text-amber-200">
          Demo mode stores scans in this browser (localStorage), scoped to the demo user id. Cloud persistence requires
          Supabase credentials.
        </p>
      </header>
      <LabCanvas className="h-[200px]" autoRotate>
        <HistoryOrbit count={scans.length} />
      </LabCanvas>
      <Panel title="Search HUD">
        <div className="flex flex-wrap gap-2">
          <input
            className={inputClass}
            placeholder="Name or brand"
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            data-testid="history-search"
          />
          <select
            className={inputClass}
            value={filters.vegan ?? ""}
            onChange={(e) => setFilters({ ...filters, vegan: (e.target.value || "") as CatalogFilters["vegan"] })}
          >
            <option value="">Any vegan status</option>
            <option value="VEGAN">VEGAN</option>
            <option value="NON-VEGAN">NON-VEGAN</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </select>
          <select
            className={inputClass}
            value={filters.status ?? ""}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Any status</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(filters.savedOnly)}
              onChange={(e) => setFilters({ ...filters, savedOnly: e.target.checked })}
            />
            Saved only
          </label>
          <Button variant="ghost" onClick={() => setFilters({ query: "", sort: "date" })}>
            Clear filters
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {chip("All", { vegan: "", savedOnly: false, status: "" }, !filters.vegan && !filters.savedOnly && !filters.status)}
          {chip("VEGAN", { vegan: "VEGAN" }, filters.vegan === "VEGAN")}
          {chip("NON-VEGAN", { vegan: "NON-VEGAN" }, filters.vegan === "NON-VEGAN")}
          {chip("UNKNOWN", { vegan: "UNKNOWN" }, filters.vegan === "UNKNOWN")}
          {chip("Saved", { savedOnly: true }, Boolean(filters.savedOnly))}
        </div>
      </Panel>
      {!list.length && <p className="text-slate-400">No scans match. Load a sample from the scanner first.</p>}
      <ol className="space-y-3">
        {list.map((s) => (
          <li key={s.id} className="hud-panel timeline-node flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
            <div>
              <p className="font-medium">{s.product.name}</p>
              <p className="text-xs text-slate-400">
                {new Date(s.createdAt).toLocaleString()} · {s.phase} · v{s.product.labelVersion}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{s.saved ? "saved" : "unsaved"}</Badge>
              <Button
                variant="ghost"
                onClick={() => {
                  useGuardianStore.setState({ activeScanId: s.id });
                  router.push("/analysis");
                }}
              >
                Open
              </Button>
              <Button variant="ghost" onClick={() => toggleSaved(s.id)}>
                {s.saved ? "Unsave" : "Save"}
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  await loadSample(s.product.id);
                  router.push("/analysis");
                }}
              >
                Rescan sample
              </Button>
              <Button variant="danger" onClick={() => deleteScan(s.id)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ol>
      {scans.length > 0 && (
        <Button
          variant="danger"
          onClick={() => {
            if (confirm("Clear all history for this demo user?")) clearHistory();
          }}
        >
          Clear history
        </Button>
      )}
    </div>
  );
}
