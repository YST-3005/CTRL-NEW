"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { compareAllergens, compareIngredients, compareNutrition, meaningfulDifferences } from "@/lib/compare/products";
import { Badge, Button, Panel, inputClass } from "@/components/ui/Hud";
import { formatNumber } from "@/lib/utils";
import { LABEL_VERSION_DEMO } from "@/data/samples";
import { ComparePods } from "@/components/three/LabCanvas";
import { DualComparisonDuel } from "@/components/three/models/DualComparisonDuel";

const LabCanvas = dynamic(() => import("@/components/three/LabCanvas").then((m) => m.LabCanvas), { ssr: false });

export default function ComparePage() {
  // Select stable store values. Calling s.catalog() inside a Zustand selector creates
  // a fresh array on every snapshot read and can trigger an infinite render loop.
  const catalogFn = useGuardianStore((s) => s.catalog);
  const catalog = useMemo(() => catalogFn(), [catalogFn]);

  const leftId = useGuardianStore((s) => s.compareLeft);
  const rightId = useGuardianStore((s) => s.compareRight);
  const setCompare = useGuardianStore((s) => s.setCompare);

  const extras = [LABEL_VERSION_DEMO.newer];
  const all = useMemo(
    () => [...catalog.filter((p) => p.id !== extras[0].id), extras[0]],
    [catalog]
  );

  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => all.filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(query.toLowerCase())),
    [all, query]
  );
  const left = all.find((p) => p.id === leftId) ?? null;
  const right = all.find((p) => p.id === rightId) ?? null;

  const rows = useMemo(() => (left && right ? compareNutrition(left, right) : []), [left, right]);
  const chartData = useMemo(
    () =>
      rows
        .filter((r) => r.left !== null || r.right !== null)
        .map((r) => ({
          nutrient: r.nutrient,
          left: r.left,
          right: r.right,
        })),
    [rows]
  );
  const radarData = useMemo(
    () =>
      rows
        .filter((r) => r.left !== null && r.right !== null)
        .slice(0, 6)
        .map((r) => ({
          nutrient: r.nutrient,
          left: r.left as number,
          right: r.right as number,
        })),
    [rows]
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="hud-label">Comparison chamber</p>
        <h1 className="display text-3xl">Product comparison</h1>
        <p className="text-sm text-slate-400">
          No universal health score. Charts use actual product records. Missing values stay blank, not zero.
        </p>
      </header>
      <LabCanvas className="h-[320px]" autoRotate={false}>
        <DualComparisonDuel leftProduct={left} rightProduct={right} />
      </LabCanvas>
      <Panel title="Search library">
        <input
          className={inputClass}
          placeholder="Filter by name or brand"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter comparison library"
        />
      </Panel>
      <div className="grid gap-3 md:grid-cols-2">
        {(["left", "right"] as const).map((slot) => (
          <Panel key={slot} title={slot === "left" ? "Product A" : "Product B"}>
            <select
              className="w-full rounded-xl border border-cyan-400/20 bg-slate-950/70 p-2"
              value={(slot === "left" ? leftId : rightId) ?? ""}
              onChange={(e) => setCompare(slot, e.target.value || null)}
              data-testid={`compare-${slot}`}
            >
              <option value="">Select…</option>
              {filtered.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {(slot === "left" ? left : right) && (
              <p className="mt-2 text-sm text-slate-400">
                {(slot === "left" ? left : right)?.dietary.veganStatus} · completeness{" "}
                {(slot === "left" ? left : right)?.completeness}%
              </p>
            )}
            <Button className="mt-2" variant="ghost" onClick={() => setCompare(slot, null)}>
              Remove
            </Button>
          </Panel>
        ))}
      </div>
      {left && right && (
        <>
          <Panel kicker="Nutrition" title="Normalized comparison">
            <div className="h-80" data-testid="compare-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c3a55" />
                  <XAxis dataKey="nutrient" stroke="#8aa0bd" interval={0} angle={-25} textAnchor="end" height={80} />
                  <YAxis stroke="#8aa0bd" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="left" name={left.name} fill="#3cefff" />
                  <Bar dataKey="right" name={right.name} fill="#8f6bff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {radarData.length >= 3 && (
              <div className="mt-6 h-72">
                <p className="mb-2 text-xs text-slate-400">Radar uses only nutrients present on both labels.</p>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#1c3a55" />
                    <PolarAngleAxis dataKey="nutrient" stroke="#8aa0bd" />
                    <PolarRadiusAxis stroke="#8aa0bd" />
                    <Radar name={left.name} dataKey="left" stroke="#3cefff" fill="#3cefff" fillOpacity={0.25} />
                    <Radar name={right.name} dataKey="right" stroke="#8f6bff" fill="#8f6bff" fillOpacity={0.25} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="mb-2 text-left text-slate-400">Accessible table alternative</caption>
                <thead>
                  <tr>
                    <th>Nutrient</th>
                    <th>{left.name}</th>
                    <th>{right.name}</th>
                    <th>Unit / basis</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.nutrient} className="border-t border-white/5">
                      <td>{r.nutrient}</td>
                      <td>{formatNumber(r.left)}</td>
                      <td>{formatNumber(r.right)}</td>
                      <td className="text-xs text-slate-500">{r.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Ingredients">
            <ul className="grid gap-1 text-sm md:grid-cols-2">
              {compareIngredients(left, right).map((d) => (
                <li key={d.name}>
                  {d.name}{" "}
                  {!d.inLeft ? (
                    <Badge tone="amber">only B</Badge>
                  ) : !d.inRight ? (
                    <Badge tone="violet">only A</Badge>
                  ) : (
                    <Badge>both</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Allergens">
            <ul className="text-sm">
              {compareAllergens(left, right).map((a) => (
                <li key={a.allergen}>
                  {a.allergen}: A {a.left ? "yes" : "no"} · B {a.right ? "yes" : "no"}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="What actually differs">
            <ul className="list-disc pl-5 text-sm text-slate-300">
              {meaningfulDifferences(left, right).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
