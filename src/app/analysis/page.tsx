"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { evaluateDietaryRules } from "@/lib/dietary/rules";
import { scaleNutrition } from "@/lib/nutrition/serving";
import { Badge, Button, Field, Panel, inputClass } from "@/components/ui/Hud";
import { formatNumber } from "@/lib/utils";
import { motion } from "framer-motion";
import { PortionDial } from "@/components/three/LabCanvas";
import { VolumetricServingChamber } from "@/components/three/models/VolumetricServingChamber";
import { ExplodedIngredientField, type ExplodedIngredientItem } from "@/components/three/models/ExplodedIngredientField";
import { CinematicProduct } from "@/components/three/models/CinematicProduct";
import { ExtractionIntegrityDeck } from "@/components/analysis/ExtractionIntegrityDeck";
import { ImageQualityHud } from "@/components/scanner/ImageQualityHud";
import { EvidenceGroundedAlerts } from "@/components/analysis/EvidenceGroundedAlerts";

const MotionLi = motion.li as any;

const LabCanvas = dynamic(() => import("@/components/three/LabCanvas").then((m) => m.LabCanvas), { ssr: false });

export default function AnalysisPage() {
  const product = useGuardianStore((s) => s.activeProduct());
  const prefs = useGuardianStore((s) => s.prefs);
  const selected = useGuardianStore((s) => s.selectedIngredientId);
  const selectIngredient = useGuardianStore((s) => s.selectIngredient);
  const updateFieldCorrection = useGuardianStore((s) => s.updateFieldCorrection);
  const confirmField = useGuardianStore((s) => s.confirmField);
  const startUpload = useGuardianStore((s) => s.startUpload);
  const activeQualityReport = useGuardianStore((s) => s.activeQualityReport);
  const phase = useGuardianStore((s) => s.phase);
  const activeComparisons = useGuardianStore((s) => s.activeComparisons());
  const resolveConfirmation = useGuardianStore((s) => s.resolveConfirmation);
  const dismissAlert = useGuardianStore((s) => s.dismissAlert);
  const findings = product ? evaluateDietaryRules(product, prefs) : [];
  const [amount, setAmount] = useState<number>(product?.nutrition.servingSizeAmount ?? 55);
  const [unit, setUnit] = useState(product?.nutrition.servingSizeUnit ?? "g");

  const handleNavigateToEvidence = (ref: string) => {
    if (ref.startsWith("ing") || ref.includes("ing") || ref.includes("ingredient")) {
      const match = product?.ingredients.find((i) => i.id === ref || ref.includes(i.id));
      if (match) selectIngredient(match.id);
      setViewMode("list");
      setTimeout(() => {
        const el = document.getElementById(`ingredient-item-${ref}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } else if (ref.includes("nutrition")) {
      const el = document.getElementById("panel-nutrition-facts");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (ref.includes("allergen")) {
      const el = document.getElementById("panel-allergens-section");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  useEffect(() => {
    if (!product) return;
    setAmount(product.nutrition.servingSizeAmount ?? 55);
    setUnit(product.nutrition.servingSizeUnit);
  }, [product]);

  const scaled = useMemo(() => {
    if (!product) return null;
    return scaleNutrition(product.nutrition, amount, unit);
  }, [product, amount, unit]);

  // Keep every hook above the conditional return so hook order stays stable.
  const [viewMode, setViewMode] = useState<"3d" | "list">("3d");

  const ingredientNodes: ExplodedIngredientItem[] = useMemo(() => {
    if (!product) return [];
    return product.ingredients.map((ing) => {
      let category: "safe" | "concern" | "uncertain" = "safe";
      if (ing.allergenTags.length > 0 || ing.concernTags.length > 0 || ing.veganStatus === "NON-VEGAN") {
        category = "concern";
      } else if (ing.veganStatus === "UNKNOWN") {
        category = "uncertain";
      }
      return {
        id: ing.id,
        name: ing.name,
        category,
        statusText: ing.veganStatus,
        evidence: ing.classificationReason,
      };
    });
  }, [product]);

  if (!product) {
    return (
      <Panel title="No scan in chamber">
        <p className="text-slate-300">Load a sample or upload a label from the scanner.</p>
      </Panel>
    );
  }

  const selectedIng = product.ingredients.find((i) => i.id === selected);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="hud-label">Analysis · {phase}</p>
          <h1 className="display text-3xl">{product.name}</h1>
          <p className="text-sm text-slate-400">
            {product.brand} · {product.dataOrigin} · completeness {product.completeness}%
          </p>
        </div>
        <Badge tone={product.dietary.veganStatus === "NON-VEGAN" ? "alert" : product.dietary.veganStatus === "VEGAN" ? "ok" : "amber"}>
          {product.dietary.veganStatus}
        </Badge>
      </header>
      <p className="text-xs text-amber-200">{product.dataSource}</p>
      {product.medicineDisclaimer && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm">{product.medicineDisclaimer}</p>
      )}

      
{/* Fail-Safe Safety Warnings (Mandatory Requirement 5) */}
{findings.filter((f) => f.rule.startsWith("safety.")).length > 0 && (
  <div className="space-y-2">
    {findings
      .filter((f) => f.rule.startsWith("safety."))
      .map((f, index) => (
        <div
          key={`${f.id}-${f.rule}-${index}`}
          className={`rounded-2xl border p-4 backdrop-blur-md ${
            f.severity === "alert"
              ? "border-red-500/40 bg-red-500/10"
              : "border-amber-500/40 bg-amber-500/10"
          }`}
        >
          {/* Keep your existing warning content here */}
        </div>
      ))}
  </div>
)}

      {/* Optical Quality Diagnostics Card if available */}
      {activeQualityReport && (
        <ImageQualityHud report={activeQualityReport} compact />
      )}

      {/* OCR Field Integrity & User Correction Deck (Requirements 2, 3, 4) */}
      <ExtractionIntegrityDeck
        product={product}
        onUpdateField={updateFieldCorrection}
        onConfirmField={confirmField}
        onRescanImage={async (dataUrl, fileName) => {
          await startUpload(dataUrl, fileName || "Close-Up Crop");
          return true;
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          kicker="Ingredients"
          title={
            <div className="flex items-center justify-between">
              <span>Holographic matrix</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewMode("3d")}
                  className={`rounded-lg px-2.5 py-0.5 text-xs font-mono transition-all ${
                    viewMode === "3d"
                      ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_10px_rgba(60,239,255,0.2)]"
                      : "text-slate-400 hover:text-white border border-transparent"
                  }`}
                >
                  3D Matrix
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`rounded-lg px-2.5 py-0.5 text-xs font-mono transition-all ${
                    viewMode === "list"
                      ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_10px_rgba(60,239,255,0.2)]"
                      : "text-slate-400 hover:text-white border border-transparent"
                  }`}
                >
                  List
                </button>
              </div>
            </div>
          }
        >
          {viewMode === "3d" ? (
            <div className="space-y-2">
              <LabCanvas className="h-[280px]" autoRotate={false}>
                <CinematicProduct
                  scale={0.7}
                  openFactor={0.7}
                  scannerGlow={0.3}
                  titleText={product.name}
                  brandText={product.brand}
                  customTextureUrl={product.imageDataUrl ?? undefined}
                />
                <ExplodedIngredientField
                  mode="understand"
                  ingredients={ingredientNodes}
                  activeIngredientId={selected}
                  onSelectIngredient={selectIngredient}
                />
              </LabCanvas>
              <p className="text-[11px] text-slate-400 text-center font-mono">
                Click any 3D node above to inspect verified evidence & classification.
              </p>
            </div>
          ) : (
            <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {product.ingredients.map((ing, idx) => (
                <MotionLi
                  key={ing.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <button
                    id={`ingredient-item-${ing.id}`}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-all ${
                      selected === ing.id
                        ? "border-cyan-300 bg-cyan-400/15 shadow-[0_0_12px_rgba(60,239,255,0.2)]"
                        : "border-white/10 hover:border-white/20"
                    }`}
                    onClick={() => selectIngredient(ing.id)}
                  >
                    <span className={selected === ing.id ? "text-cyan-200 font-bold" : ""}>{ing.originalText}</span>
                    <span className="ml-2 text-xs text-slate-400">{ing.veganStatus}</span>
                    {ing.allergenTags.length > 0 && (
                      <span className="ml-2 text-xs text-rose-300 font-mono">allergen</span>
                    )}
                  </button>
                </MotionLi>
              ))}
            </ul>
          )}
        </Panel>
        <Panel kicker="Evidence" title={selectedIng ? selectedIng.name : "Select an ingredient"}>
          {selectedIng ? (
            <div className="space-y-2 text-sm text-slate-300">
              <p>{selectedIng.classificationReason}</p>
              <p>Origin: {selectedIng.originNote}</p>
              <p>Evidence quality: {selectedIng.evidenceQuality}</p>
              {selectedIng.evidence.map((ev) => (
                <blockquote key={ev.id} className="border-l-2 border-cyan-400/40 pl-3">
                  <span className="hud-label">{ev.kind}</span>
                  <p>{ev.sourceText || ev.claim}</p>
                </blockquote>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Click an ingredient to inspect source text and classification.</p>
          )}
          {product.imageDataUrl && (
            <div className="relative mt-4 max-h-48 overflow-hidden rounded-xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.imageDataUrl} alt="Source label capture" className="max-h-48 w-full object-contain" />
              {selectedIng?.evidence[0]?.boundingBox && (
                <span
                  className="pointer-events-none absolute border border-cyan-300"
                  style={{
                    left: `${selectedIng.evidence[0].boundingBox.x * 100}%`,
                    top: `${selectedIng.evidence[0].boundingBox.y * 100}%`,
                    width: `${selectedIng.evidence[0].boundingBox.width * 100}%`,
                    height: `${selectedIng.evidence[0].boundingBox.height * 100}%`,
                  }}
                />
              )}
            </div>
          )}
          {product.extractedText && (
            <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-400">
              {selectedIng
                ? product.extractedText.split(new RegExp(`(${selectedIng.originalText})`, "i")).map((chunk, i) =>
                    chunk.toLowerCase() === selectedIng.originalText.toLowerCase() ? (
                      <mark key={i} className="bg-cyan-400/30 text-cyan-50">
                        {chunk}
                      </mark>
                    ) : (
                      <span key={i}>{chunk}</span>
                    ),
                  )
                : product.extractedText}
            </pre>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <LabCanvas className="h-[320px]" autoRotate={false}>
          <VolumetricServingChamber
            factor={scaled?.valid ? scaled.factor : 1}
            alertSeverity={findings.some((f) => f.severity === "alert") ? "alert" : findings.some((f) => f.severity === "warning") ? "warning" : "safe"}
          />
        </LabCanvas>
        <Panel kicker="Printed vs calculated" title="Nutrition bars">
          <p className="mb-3 text-xs text-slate-400">Bar widths track calculated amounts when the scale is valid.</p>
          <ul className="space-y-3">
            {product.nutrition.values.slice(0, 6).map((v) => {
              const calc = scaled?.valid ? scaled.scaled.values.find((x) => x.nutrient === v.nutrient) : v;
              const raw = calc?.amount ?? v.amount;
              const width = raw === null ? 0 : Math.min(100, (raw / (v.amount && v.amount > 0 ? v.amount * 3 : 100)) * 100);
              return (
                <li key={v.nutrient}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{v.nutrient}</span>
                    <span className="text-cyan-200">
                      {formatNumber(raw)} {v.unit}
                    </span>
                  </div>
                  <div className="nutrition-bar" aria-hidden>
                    <span style={{ width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div id="panel-nutrition-facts">
        <Panel kicker="Printed label" title="Nutrition facts">
        <p className="mb-3 text-sm text-slate-400">
          Serving {product.nutrition.servingSizeAmount} {product.nutrition.servingSizeUnit}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400">
                <th>Nutrient</th>
                <th>Printed</th>
                <th>Calculated</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {product.nutrition.values.map((v) => {
                const calc = scaled?.scaled.values.find((x) => x.nutrient === v.nutrient);
                return (
                  <tr key={v.nutrient} className="border-t border-white/5">
                    <td className="py-1">{v.nutrient}</td>
                    <td>
                      {formatNumber(v.amount)} {v.unit}
                    </td>
                    <td className="text-cyan-200">
                      {formatNumber(calc?.amount ?? null)} {v.unit}
                    </td>
                    <td className="text-xs text-slate-500">{v.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {product.nutrition.incomplete && <p className="mt-2 text-amber-200">Nutrition panel incomplete.</p>}
      </Panel>
      </div>

      <Panel kicker="Reality check" title="Serving-size calculator">
        <p className="mb-3 text-xs text-slate-400">
          Calculated columns are proportional math, not medical portion advice.
        </p>
        <div className="flex flex-wrap gap-3">
          <Field label="New serving amount">
            <input
              className={inputClass}
              type="number"
              min={0}
              step={0.1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              data-testid="serving-amount"
            />
          </Field>
          <Field label="Unit">
            <select className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} data-testid="serving-unit">
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="oz">oz</option>
              <option value="tablet">tablet</option>
            </select>
          </Field>
          <Button
            variant="ghost"
            onClick={() => {
              setAmount(product.nutrition.servingSizeAmount ?? 1);
              setUnit(product.nutrition.servingSizeUnit);
            }}
          >
            Reset original
          </Button>
        </div>
        {scaled && !scaled.valid && (
          <p className="mt-2 text-sm text-rose-300" role="alert">
            {scaled.error}
          </p>
        )}
        {scaled?.valid && (
          <p className="mt-2 text-sm text-cyan-200" data-testid="serving-factor">
            Scale factor {scaled.factor.toFixed(3)}
          </p>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel kicker="Potential benefits" title="Label-supported only">
          <ul className="space-y-2 text-sm">
            {product.benefits.map((b) => (
              <li key={b.evidence.id} className="rounded-lg border border-white/10 p-3">
                <p>{b.text}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {b.evidence.kind}: {b.evidence.sourceText || b.evidence.claim}
                </p>
              </li>
            ))}
            {!product.benefits.length && <li className="text-slate-400">No benefit claims were extracted.</li>}
          </ul>
        </Panel>
        <Panel kicker="Potential concerns" title="With evidence">
          <ul className="space-y-2 text-sm">
            {product.concerns.map((c) => (
              <li key={c.evidence.id} className="rounded-lg border border-rose-400/20 p-3">
                <p>{c.text}</p>
                <p className="mt-1 text-xs text-rose-200/70">
                  {c.evidence.kind}: {c.evidence.sourceText || c.evidence.claim}
                </p>
              </li>
            ))}
            {!product.concerns.length && <li className="text-slate-400">No evidenced concerns on this record.</li>}
          </ul>
        </Panel>
      </div>

      <div id="panel-allergens-section">
        <Panel kicker="Dietary comparison" title="Evidence-grounded alerts & rules">
          {product.allergenStatement && (
            <div className="mb-3 rounded-lg border border-white/10 bg-black/30 p-2.5 text-xs font-mono text-cyan-200">
              <span className="text-slate-400 block mb-1">Declared &lsquo;Contains:&rsquo; Statement:</span>
              &ldquo;{product.allergenStatement.text}&rdquo;
            </div>
          )}
          <EvidenceGroundedAlerts
            comparisons={activeComparisons}
            onNavigateToEvidence={handleNavigateToEvidence}
            onResolveConfirmation={resolveConfirmation}
            onDismissAlert={dismissAlert}
          />
        </Panel>
      </div>

      <Panel kicker="Gaps" title="Missing & uncertain">
        <ul className="list-disc pl-5 text-sm text-slate-300">
          {product.missingInformation.map((m) => (
            <li key={m}>{m}</li>
          ))}
          {product.uncertainties.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
