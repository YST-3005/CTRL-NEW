"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { classifyIngredientName } from "@/lib/vegan/classify";
import { INGREDIENT_KNOWLEDGE } from "@/lib/vegan/catalog";
import { Badge, Button, Field, Panel, inputClass } from "@/components/ui/Hud";
import { OriginNodes } from "@/components/three/LabCanvas";
import type { VeganStatus } from "@/types";

const LabCanvas = dynamic(() => import("@/components/three/LabCanvas").then((m) => m.LabCanvas), { ssr: false });

export default function VeganPage() {
  const product = useGuardianStore((s) => s.activeProduct());
  const overrides = useGuardianStore((s) => s.veganOverrides);
  const setVeganOverride = useGuardianStore((s) => s.setVeganOverride);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState(() => classifyIngredientName("glycerin", 0));

  const nodes = (product?.ingredients ?? INGREDIENT_KNOWLEDGE.slice(0, 12).map((k, i) => classifyIngredientName(k.name, i))).map(
    (ing) => {
      const over = overrides[ing.name.toLowerCase()];
      return over ? { ...ing, veganStatus: over as VeganStatus } : ing;
    },
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="hud-label">Origin explorer</p>
        <h1 className="display text-3xl">Vegan classification</h1>
        <p className="text-sm text-slate-400">
          Three outcomes only: VEGAN, NON-VEGAN, UNKNOWN. Variable-origin ingredients stay UNKNOWN unless you record a
          manual review.
        </p>
      </header>
      <LabCanvas className="h-[260px]" autoRotate>
        <OriginNodes items={nodes.map((n) => ({ name: n.name, status: n.veganStatus }))} />
      </LabCanvas>
      {product && (
        <Panel title={`${product.name} summary`}>
          <Badge
            tone={
              product.dietary.veganStatus === "VEGAN" ? "ok" : product.dietary.veganStatus === "NON-VEGAN" ? "alert" : "amber"
            }
          >
            {product.dietary.veganStatus}
          </Badge>
          <p className="mt-2 text-sm">{product.dietary.veganSummary}</p>
          <p className="mt-2 text-xs text-slate-500">
            Product status is not a certification. Incomplete labels remain UNKNOWN even if listed items look plant-derived.
          </p>
        </Panel>
      )}
      <Panel title="Interactive nodes">
        <div className="flex flex-wrap gap-2">
          {nodes.map((ing) => (
            <button
              key={ing.id + ing.name}
              onClick={() => setManual(ing)}
              className="rounded-full border border-cyan-400/30 px-3 py-1 text-xs"
              data-testid={`vegan-node-${ing.name}`}
            >
              {ing.name} · {ing.veganStatus}
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="Classification dossier">
        <p className="text-lg">{manual.name}</p>
        <Badge tone={manual.veganStatus === "UNKNOWN" ? "amber" : manual.veganStatus === "VEGAN" ? "ok" : "alert"}>
          {overrides[manual.name.toLowerCase()] ?? manual.veganStatus}
        </Badge>
        <p className="mt-2 text-sm text-slate-300">{manual.classificationReason}</p>
        <p className="text-sm text-slate-400">Origin: {manual.originNote}</p>
        <p className="text-xs text-slate-500">Evidence quality: {manual.evidenceQuality}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-slate-400">Manual review (analyst override, not a lab assay):</span>
          {(["VEGAN", "NON-VEGAN", "UNKNOWN"] as const).map((status) => (
            <Button key={status} variant="ghost" onClick={() => setVeganOverride(manual.name, status)}>
              Mark {status}
            </Button>
          ))}
        </div>
      </Panel>
      <Panel title="Look up any name">
        <Field label="Ingredient">
          <div className="flex gap-2">
            <input className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button onClick={() => setManual(classifyIngredientName(query || "unknown compound", 0))}>Classify</Button>
          </div>
        </Field>
      </Panel>
      {product?.category === "medicine" && <p className="text-sm text-amber-200">{product.medicineDisclaimer}</p>}
    </div>
  );
}
