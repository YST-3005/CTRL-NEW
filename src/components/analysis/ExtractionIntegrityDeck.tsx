"use client";

import { useState, useRef } from "react";
import type { ExtractedField, FieldStatus, ProductRecord } from "@/types";
import { Badge, Button, Field, Panel, inputClass } from "@/components/ui/Hud";
import { fileToDataUrl, validateImageFile, ACCEPTED_IMAGE_TYPES } from "@/lib/validation/files";

interface ExtractionIntegrityDeckProps {
  product: ProductRecord;
  onUpdateField: (
    fieldName: "product_name" | "ingredients" | "allergens" | "nutrition" | "serving_size",
    value: any,
  ) => void;
  onConfirmField: (
    fieldName: "product_name" | "ingredients" | "allergens" | "nutrition" | "serving_size",
  ) => void;
  onRescanImage: (dataUrl: string, fileName?: string) => Promise<boolean>;
}

export function ExtractionIntegrityDeck({
  product,
  onUpdateField,
  onConfirmField,
  onRescanImage,
}: ExtractionIntegrityDeckProps) {
  const extraction = product.extractionRecord;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editing state
  const [editingField, setEditingField] = useState<
    "product_name" | "ingredients" | "allergens" | "nutrition" | "serving_size" | null
  >(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editServingAmount, setEditServingAmount] = useState<number>(
    product.nutrition.servingSizeAmount ?? 55,
  );
  const [editServingUnit, setEditServingUnit] = useState<string>(
    product.nutrition.servingSizeUnit || "g",
  );

  // Clearer image modal state
  const [retakeModalOpen, setRetakeModalOpen] = useState(false);
  const [targetRetakeField, setTargetRetakeField] = useState<string>("ingredients");
  const [rescanBusy, setRescanBusy] = useState(false);

  // Manual text override state
  const [manualTextModalOpen, setManualTextModalOpen] = useState(false);
  const [manualText, setManualText] = useState("");

  if (!extraction) {
    return null;
  }

  const fields: Array<{
    id: "product_name" | "ingredients" | "allergens" | "nutrition" | "serving_size";
    data: ExtractedField;
    displayValue: string;
  }> = [
    {
      id: "product_name",
      data: extraction.productName,
      displayValue: extraction.productName.userCorrected
        ? String(extraction.productName.correctedValue)
        : extraction.productName.extractedValue,
    },
    {
      id: "ingredients",
      data: extraction.ingredients,
      displayValue: extraction.ingredients.userCorrected
        ? Array.isArray(extraction.ingredients.correctedValue)
          ? extraction.ingredients.correctedValue.map((i: any) => i.name || i.originalText).join(", ")
          : String(extraction.ingredients.correctedValue)
        : extraction.ingredients.originalSourceText ||
          product.ingredients.map((i) => i.originalText).join(", "),
    },
    {
      id: "allergens",
      data: extraction.allergens,
      displayValue: extraction.allergens.userCorrected
        ? extraction.allergens.correctedValue?.text || "No allergens declared"
        : extraction.allergens.extractedValue?.text || "No 'Contains:' statement detected",
    },
    {
      id: "serving_size",
      data: extraction.servingSize,
      displayValue: extraction.servingSize.userCorrected
        ? `${extraction.servingSize.correctedValue?.amount ?? "Unknown"} ${extraction.servingSize.correctedValue?.unit || "g"}`
        : `${extraction.servingSize.extractedValue?.amount ?? "Unknown"} ${extraction.servingSize.extractedValue?.unit || "g"}`,
    },
    {
      id: "nutrition",
      data: extraction.nutrition,
      displayValue: `${product.nutrition.values.length} nutrients identified${
        product.nutrition.incomplete ? " (Incomplete Table)" : " (Complete Table)"
      }`,
    },
  ];

  function getStatusTone(status: FieldStatus): "ok" | "amber" | "alert" | "muted" | "violet" {
    switch (status) {
      case "CONFIRMED":
        return "ok";
      case "USER_CORRECTED":
        return "violet";
      case "UNCERTAIN":
        return "amber";
      case "NEEDS_REVIEW":
        return "alert";
      case "MISSING":
        return "muted";
      default:
        return "muted";
    }
  }

  function startEditing(fieldId: "product_name" | "ingredients" | "allergens" | "nutrition" | "serving_size") {
    setEditingField(fieldId);
    if (fieldId === "product_name") {
      setEditValue(product.name);
    } else if (fieldId === "ingredients") {
      setEditValue(
        product.extractionRecord?.ingredients.originalSourceText ||
          product.ingredients.map((i) => i.originalText).join(", "),
      );
    } else if (fieldId === "allergens") {
      setEditValue(product.allergenStatement?.text || "");
    } else if (fieldId === "serving_size") {
      setEditServingAmount(product.nutrition.servingSizeAmount ?? 55);
      setEditServingUnit(product.nutrition.servingSizeUnit || "g");
    }
  }

  function handleSaveEdit() {
    if (!editingField) return;
    if (editingField === "serving_size") {
      onUpdateField("serving_size", {
        amount: editServingAmount,
        unit: editServingUnit,
      });
    } else {
      onUpdateField(editingField, editValue);
    }
    setEditingField(null);
  }

  async function handleReplacementFile(file: File) {
    const v = validateImageFile(file);
    if (!v.ok) return;
    setRescanBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await onRescanImage(dataUrl, file.name);
      setRetakeModalOpen(false);
    } finally {
      setRescanBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <Panel
        kicker="Extraction Integrity & Uncertainty Engine"
        title="Field verification & editable correction"
      >
        <p className="mb-4 text-xs text-slate-300 leading-relaxed">
          Each key label field is tracked independently with explicit confidence, completeness status, and evidence.
          Original OCR extractions are never silently overwritten when you apply corrections.
        </p>

        {/* Conflict Alert Banner if discrepancies exist */}
        {extraction.hasConflicts && (
          <div
            className="mb-4 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3.5 space-y-1.5"
            role="alert"
          >
            <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
              <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
              CONTRADICTION DETECTED IN LABEL EXTRACTION
            </div>
            {extraction.conflictNotes.map((note, idx) => (
              <p key={idx} className="text-xs text-rose-200 pl-4">
                • {note}
              </p>
            ))}
          </div>
        )}

        {/* Global Action Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-cyan-300">
              Extraction Completeness: {extraction.completenessScore}%
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              className="text-xs py-1 px-3"
              onClick={() => {
                setTargetRetakeField("all");
                setRetakeModalOpen(true);
              }}
            >
              Request Clearer Close-Up Image
            </Button>
            <Button
              variant="ghost"
              className="text-xs py-1 px-3"
              onClick={() => {
                setManualText(
                  product.extractedText ||
                    product.ingredients.map((i) => i.originalText).join(", "),
                );
                setManualTextModalOpen(true);
              }}
            >
              Manual Text Override
            </Button>
          </div>
        </div>

        {/* Field Cards Matrix */}
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
          {fields.map((f) => (
            <div
              key={f.id}
              className={`rounded-xl border p-4 transition-all ${
                f.data.status === "NEEDS_REVIEW"
                  ? "border-rose-400/40 bg-rose-950/20"
                  : f.data.status === "USER_CORRECTED"
                    ? "border-violet-400/40 bg-violet-950/20"
                    : f.data.status === "UNCERTAIN"
                      ? "border-amber-400/40 bg-amber-950/20"
                      : "border-white/10 bg-slate-900/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    {f.data.label}
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone={getStatusTone(f.data.status)}>{f.data.status}</Badge>
                    <span className="text-[11px] font-mono text-slate-400">
                      {f.data.confidence !== null
                        ? `Confidence: ${Math.round(f.data.confidence)}%`
                        : `Confidence: Not reported (Est: ~${f.data.confidenceEstimate ?? 70}%)`}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {!f.data.userConfirmed && f.data.status !== "USER_CORRECTED" && (
                    <button
                      type="button"
                      onClick={() => onConfirmField(f.id)}
                      className="rounded border border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 text-[11px] font-mono text-emerald-300 transition-all"
                      title="Confirm this field as verified"
                    >
                      Confirm
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startEditing(f.id)}
                    className="rounded border border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-2 py-0.5 text-[11px] font-mono text-cyan-300 transition-all"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Status Reason if flagged */}
              {f.data.statusReason && (
                <p className="mt-2 text-[11px] text-amber-300 font-mono bg-amber-400/10 px-2 py-1 rounded">
                  ▲ {f.data.statusReason}
                </p>
              )}

              {/* Field Value Display */}
              <div className="mt-2 text-xs text-slate-300">
                <span className="text-[10px] uppercase font-mono text-slate-400 block">
                  Active Value:
                </span>
                <p className="font-mono break-words">{f.displayValue}</p>
              </div>

              {/* Original Extraction Alongside User Correction */}
              {f.data.userCorrected && (
                <div className="mt-2 border-t border-white/5 pt-2 text-[11px] text-slate-400">
                  <span className="text-[10px] uppercase font-mono text-violet-400 block">
                    Original OCR Extraction:
                  </span>
                  <p className="font-mono text-slate-500 italic">
                    {f.data.originalSourceText || "(None detected)"}
                  </p>
                  <span className="text-[9px] text-slate-500 font-mono">
                    Corrected: {new Date(f.data.correctedAt || Date.now()).toLocaleTimeString()}
                  </span>
                </div>
              )}

              {/* Quick Image Retake request for uncertain fields */}
              {(f.data.status === "UNCERTAIN" || f.data.status === "NEEDS_REVIEW") && (
                <div className="mt-3 pt-2 border-t border-white/10 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetRetakeField(f.id);
                      setRetakeModalOpen(true);
                    }}
                    className="text-[11px] font-mono text-cyan-300 hover:underline flex items-center gap-1"
                  >
                    Capture close-up crop of {f.data.label} →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {/* Inline Editor Modal */}
      {editingField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-cyan-400/40 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="display text-lg text-white">
                Edit {editingField.replace("_", " ").toUpperCase()}
              </h3>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {editingField === "serving_size" ? (
              <div className="space-y-3">
                <Field label="Serving Amount">
                  <input
                    type="number"
                    className={inputClass}
                    value={editServingAmount}
                    onChange={(e) => setEditServingAmount(Number(e.target.value))}
                    min={0.1}
                    step={0.1}
                  />
                </Field>
                <Field label="Serving Unit">
                  <select
                    className={inputClass}
                    value={editServingUnit}
                    onChange={(e) => setEditServingUnit(e.target.value)}
                  >
                    <option value="g">grams (g)</option>
                    <option value="ml">milliliters (ml)</option>
                    <option value="oz">ounces (oz)</option>
                    <option value="tablet">tablet / capsule</option>
                  </select>
                </Field>
              </div>
            ) : (
              <Field
                label={`Corrected ${editingField.replace("_", " ")}`}
                hint={
                  editingField === "ingredients"
                    ? "Separate ingredients with commas. Sub-ingredients in parentheses are preserved."
                    : editingField === "allergens"
                      ? "e.g. Contains: Milk, Soy, Wheat"
                      : undefined
                }
              >
                {editingField === "ingredients" ? (
                  <textarea
                    rows={5}
                    className={`${inputClass} font-mono text-xs`}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    className={inputClass}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                )}
              </Field>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditingField(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save & Recalculate</Button>
            </div>
          </div>
        </div>
      )}

      {/* Clearer Image / Close-Up Panel Modal */}
      {retakeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-cyan-400/40 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="hud-label text-cyan-400">Target Close-Up</span>
                <h3 className="display text-lg text-white">Capture Clearer Label Image</h3>
              </div>
              <button
                type="button"
                onClick={() => setRetakeModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Upload or snap a high-resolution close-up focused directly on the{" "}
              <strong className="text-cyan-300">{targetRetakeField}</strong> region. The optical
              analyzer will process this targeted crop.
            </p>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) void handleReplacementFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-2xl border-2 border-dashed border-cyan-400/30 hover:border-cyan-400 p-8 text-center cursor-pointer bg-slate-900/50 hover:bg-cyan-950/20 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                hidden
                onChange={(e) => e.target.files?.[0] && void handleReplacementFile(e.target.files[0])}
              />
              <p className="text-sm font-semibold text-white">
                {rescanBusy ? "Processing close-up OCR…" : "Click or drop close-up crop here"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                JPEG, PNG, WebP · High-contrast lighting recommended
              </p>
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setRetakeModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Text Override Modal */}
      {manualTextModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl space-y-4 rounded-2xl border border-cyan-400/40 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="hud-label text-cyan-400">Manual Entry Fallback</span>
                <h3 className="display text-lg text-white">Paste Raw Label Text</h3>
              </div>
              <button
                type="button"
                onClick={() => setManualTextModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              When an image is too degraded or reflections are severe, paste the ingredient and
              nutrition text manually. The parser will extract verified fields.
            </p>

            <textarea
              rows={6}
              className={`${inputClass} font-mono text-xs`}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="e.g. Ingredients: Whole grain oats, cane sugar... Contains: Soy, Wheat."
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setManualTextModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onUpdateField("ingredients", manualText);
                  setManualTextModalOpen(false);
                }}
              >
                Apply Manual Text
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
