
"use client";

import dynamic from "next/dynamic";
import { LABEL_VERSION_DEMO, SAMPLE_PRODUCTS } from "@/data/samples";
import { diffLabelVersions } from "@/lib/radar/labelDiff";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { Badge, Panel } from "@/components/ui/Hud";
import { DualComparisonDuel } from "@/components/three/models/DualComparisonDuel";

const LabCanvas = dynamic(
  () => import("@/components/three/LabCanvas").then((m) => m.LabCanvas),
  { ssr: false }
);

export default function RadarPage() {
  // Select the catalog function separately to avoid creating a new
  // array inside the Zustand selector.
  const catalogFn = useGuardianStore((s) => s.catalog);
  const catalog = catalogFn();

  const leftId = useGuardianStore((s) => s.radarLeft);
  const rightId = useGuardianStore((s) => s.radarRight);
  const setRadar = useGuardianStore((s) => s.setRadar);

  const all = [
    ...catalog.filter((p) => p.id !== LABEL_VERSION_DEMO.newer.id),
    LABEL_VERSION_DEMO.newer,
  ];

  const older =
    all.find((p) => p.id === leftId) ?? SAMPLE_PRODUCTS[0];

  const newer =
    all.find((p) => p.id === rightId) ?? LABEL_VERSION_DEMO.newer;

  const changes = diffLabelVersions(older, newer);

  return (
    <div className="space-y-6">
      <header>
        <p className="hud-label">Change radar</p>
        <h1 className="display text-3xl">
          Label version comparison
        </h1>
        <p className="text-sm text-amber-200">
          Differences are computed only between two stored records.
          OCR errors can look like formulation changes.
        </p>
      </header>

      <LabCanvas className="h-[300px]" autoRotate={false}>
        <DualComparisonDuel
          leftProduct={older}
          rightProduct={newer}
          accentLeft="#3cefff"
          accentRight="#ffb020"
        />
      </LabCanvas>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="Older capture">
          <select
            className="w-full rounded-xl border border-cyan-400/20 bg-slate-950 p-2"
            value={older.id}
            onChange={(e) => setRadar("left", e.target.value)}
          >
            {all.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} v{p.labelVersion}
              </option>
            ))}
          </select>

          <p className="mt-3 text-sm">
            {older.ingredients.map((i) => i.name).join(", ")}
          </p>
        </Panel>

        <Panel title="Newer capture">
          <select
            className="w-full rounded-xl border border-cyan-400/20 bg-slate-950 p-2"
            value={newer.id}
            onChange={(e) => setRadar("right", e.target.value)}
            data-testid="radar-newer"
          >
            {all.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} v{p.labelVersion}
              </option>
            ))}
          </select>

          <p className="mt-3 text-sm">
            {newer.ingredients.map((i) => i.name).join(", ")}
          </p>
        </Panel>
      </div>

      <ol className="space-y-2">
        <li className="hud-label">Change timeline</li>
      </ol>

      <Panel title="Supported changes">
        <ul className="space-y-2" data-testid="radar-changes">
          {changes.length === 0 ? (
            <li className="rounded-lg border border-white/10 p-3 text-sm text-slate-400">
              No differences detected between these records. This
              does not prove the formulations are identical if
              either label is incomplete.
            </li>
          ) : (
            changes.map((c) => (
              <li
                key={c.title}
                className="timeline-node rounded-lg border border-white/10 p-3"
              >
                <Badge
                  tone={
                    c.type === "ingredient_added"
                      ? "amber"
                      : c.type === "ingredient_removed"
                        ? "alert"
                        : "cyan"
                  }
                >
                  {c.type}
                </Badge>

                <p className="mt-1">{c.title}</p>
                <p className="text-sm text-slate-400">{c.detail}</p>
              </li>
            ))
          )}
        </ul>
      </Panel>
    </div>
  );
}
