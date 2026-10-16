
"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { Button, Field, Panel, inputClass, Badge } from "@/components/ui/Hud";
import { TransmissionPulse } from "@/components/three/LabCanvas";
import { COMMON_ALLERGENS } from "@/types";
import type { NutritionThreshold, CaregiverProfile } from "@/types/comparison";
import { EvidenceGroundedAlerts } from "@/components/analysis/EvidenceGroundedAlerts";
import { useRouter } from "next/navigation";

const LabCanvas = dynamic(
  () => import("@/components/three/LabCanvas").then((m) => m.LabCanvas),
  { ssr: false }
);

export default function CaregiverPage() {
  const router = useRouter();

  const user = useGuardianStore((s) => s.user);
  const caregiver = useGuardianStore((s) => s.caregiver);
  const optIn = useGuardianStore((s) => s.caregiverOptIn);
  const setCaregiver = useGuardianStore((s) => s.setCaregiver);
  const setOptIn = useGuardianStore((s) => s.setCaregiverOptIn);
  const triggerAlert = useGuardianStore((s) => s.triggerAlert);
  const deleteAlert = useGuardianStore((s) => s.deleteAlert);
  const alerts = useGuardianStore((s) => s.alerts);

  // Subscribe to the stable store state, then derive computed values.
  const storeState = useGuardianStore((s) => s);
  const product = useMemo(
    () => storeState.activeProduct(),
    [storeState]
  );
  const activeComparisons = useMemo(
    () => storeState.activeComparisons(),
    [storeState]
  );

  const resolveConfirmation = useGuardianStore((s) => s.resolveConfirmation);
  const dismissAlert = useGuardianStore((s) => s.dismissAlert);
  const caregiverProfile = useGuardianStore((s) => s.caregiverProfile);
  const saveCaregiverProfile = useGuardianStore((s) => s.saveCaregiverProfile);

  const [contactName, setContactName] = useState(caregiver?.name ?? "");
  const [address, setAddress] = useState(caregiver?.address ?? "");

  const [dependentName, setDependentName] = useState(
    caregiverProfile?.dependentName ?? "Primary Dependent"
  );
  const [isVegan, setIsVegan] = useState(
    caregiverProfile?.dietaryPlan.vegan ?? false
  );
  const [isVegetarian, setIsVegetarian] = useState(
    caregiverProfile?.dietaryPlan.vegetarian ?? false
  );
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(
    caregiverProfile?.dietaryPlan.allergies ?? ["milk", "peanuts", "eggs"]
  );
  const [avoidInput, setAvoidInput] = useState(
    caregiverProfile?.dietaryPlan.ingredientsToAvoid.join(", ") ??
      "added sugar, hydrogenated oil"
  );

  const [thresholds, setThresholds] = useState<NutritionThreshold[]>(
    caregiverProfile?.thresholds ?? [
      {
        id: "th-1",
        nutrient: "Total Sugars",
        operator: ">=",
        limit: 12,
        unit: "g",
        basis: "per_serving",
        enabled: true,
      },
      {
        id: "th-2",
        nutrient: "Sodium",
        operator: ">=",
        limit: 400,
        unit: "mg",
        basis: "per_serving",
        enabled: true,
      },
      {
        id: "th-3",
        nutrient: "Saturated Fat",
        operator: ">=",
        limit: 3,
        unit: "g",
        basis: "per_serving",
        enabled: true,
      },
    ]
  );

  const [newNutrient, setNewNutrient] = useState("Calories");
  const [newOperator, setNewOperator] = useState<">=" | "<=" | ">" | "<">(">=");
  const [newLimit, setNewLimit] = useState(250);
  const [newUnit, setNewUnit] = useState("kcal");
  const [newBasis, setNewBasis] =
    useState<"per_serving" | "per_100g">("per_serving");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleToggleAllergen = (allergen: string) => {
    setSelectedAllergies((prev) =>
      prev.includes(allergen)
        ? prev.filter((a) => a !== allergen)
        : [...prev, allergen]
    );
  };

  const handleAddThreshold = () => {
    if (!newNutrient.trim()) {
      setValidationError("Nutrient name is required.");
      return;
    }
    if (!Number.isFinite(newLimit) || newLimit < 0) {
      setValidationError("Threshold limit must be a non-negative number.");
      return;
    }
    if (!newUnit.trim()) {
      setValidationError("Unit is required.");
      return;
    }

    const created: NutritionThreshold = {
      id: `th-${Date.now()}`,
      nutrient: newNutrient.trim(),
      operator: newOperator,
      limit: Number(newLimit),
      unit: newUnit.trim(),
      basis: newBasis,
      enabled: true,
    };

    setThresholds((prev) => [...prev, created]);
    setValidationError(null);
  };

  const handleToggleThreshold = (id: string) => {
    setThresholds((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const handleDeleteThreshold = (id: string) => {
    setThresholds((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveProfile = () => {
    if (!user) return;

    const updated: CaregiverProfile = {
      userId: user.id,
      dependentName: dependentName.trim() || "Dependent",
      dietaryPlan: {
        vegan: isVegan,
        vegetarian: isVegetarian,
        allergies: selectedAllergies,
        ingredientsToAvoid: avoidInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      thresholds,
      userConfirmations: caregiverProfile?.userConfirmations ?? {},
      dismissedAlertIds: caregiverProfile?.dismissedAlertIds ?? [],
      updatedAt: new Date().toISOString(),
    };

    saveCaregiverProfile(updated);
    setSaveSuccessMsg("Dietary profile & nutrition thresholds saved successfully.");
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="hud-label">Authorized Caregiver Portal</p>
          <h1 className="display text-3xl">Caregiver Dashboard</h1>
          <p className="text-sm text-slate-400">
            Configure dietary plans, allergens to avoid, and personalized nutrition thresholds for{" "}
            <strong className="text-cyan-200">{dependentName}</strong>.
          </p>
        </div>
        <Badge tone="cyan">
          {user?.displayName ? `Account: ${user.displayName}` : "Local Demo Session"}
        </Badge>
      </header>

      {saveSuccessMsg && (
        <div
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300"
          role="status"
        >
          ✓ {saveSuccessMsg}
        </div>
      )}

      <LabCanvas className="h-[180px]" autoRotate={false}>
        <TransmissionPulse
          active={
            alerts.length > 0 ||
            activeComparisons.some((c) => c.severity === "alert")
          }
        />
      </LabCanvas>

      <Panel kicker="Profile Management" title="Dependent Dietary Plan & Allergens">
        <div className="space-y-4">
          <Field label="Dependent Name / Identifier">
            <input
              className={inputClass}
              value={dependentName}
              onChange={(e) => setDependentName(e.target.value)}
              placeholder="e.g. Maya"
              data-testid="dependent-name-input"
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isVegan}
                onChange={(e) => setIsVegan(e.target.checked)}
                className="rounded border-cyan-400/30"
                data-testid="caregiver-vegan-toggle"
              />
              <span>Strict Vegan Dietary Plan</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isVegetarian}
                onChange={(e) => setIsVegetarian(e.target.checked)}
                className="rounded border-cyan-400/30"
                data-testid="caregiver-veg-toggle"
              />
              <span>Vegetarian Dietary Plan</span>
            </label>
          </div>

          <div>
            <span className="hud-label block mb-2">Major Allergens to Avoid</span>
            <div className="flex flex-wrap gap-2">
              {COMMON_ALLERGENS.map((allergen) => {
                const active = selectedAllergies.includes(allergen);
                return (
                  <button
                    key={allergen}
                    type="button"
                    onClick={() => handleToggleAllergen(allergen)}
                    className={`rounded-full px-3 py-1 text-xs font-mono transition-all border ${
                      active
                        ? "bg-rose-500/20 text-rose-200 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                        : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"
                    }`}
                    data-testid={`allergen-toggle-${allergen}`}
                  >
                    {allergen} {active ? "✕" : "+"}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Custom Ingredients of Concern (comma-separated)">
            <input
              className={inputClass}
              value={avoidInput}
              onChange={(e) => setAvoidInput(e.target.value)}
              placeholder="e.g. added sugar, palm oil, artificial colors"
              data-testid="custom-avoid-input"
            />
          </Field>

          <Button
            variant="primary"
            onClick={handleSaveProfile}
            data-testid="save-caregiver-profile"
            className="mt-2"
          >
            Save Dietary Profile
          </Button>
        </div>
      </Panel>

      <Panel kicker="Thresholds" title="Numeric Nutrition Limits">
        <p className="mb-4 text-xs text-slate-400">
          Set maximum or minimum limits for nutrients. Incompatible units or missing serving bases are safely flagged as
          uncertain rather than causing false comparisons.
        </p>

        {validationError && (
          <p className="mb-3 text-xs text-rose-300" role="alert">
            ⚠️ {validationError}
          </p>
        )}

        <div className="space-y-2 mb-6">
          {thresholds.map((t) => (
            <div
              key={t.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-all ${
                t.enabled
                  ? "border-cyan-400/30 bg-cyan-950/20"
                  : "border-white/5 bg-white/[0.02] opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={t.enabled}
                  onChange={() => handleToggleThreshold(t.id)}
                  className="rounded border-cyan-400/30"
                  title="Toggle threshold"
                />
                <div>
                  <span className="font-semibold text-slate-100">{t.nutrient}</span>
                  <span className="ml-2 font-mono text-cyan-200">
                    {t.operator} {t.limit} {t.unit}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">({t.basis})</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-rose-400 hover:text-rose-200"
                onClick={() => handleDeleteThreshold(t.id)}
              >
                Delete
              </Button>
            </div>
          ))}
          {!thresholds.length && (
            <p className="text-sm text-slate-500">No nutrition thresholds configured yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
          <span className="hud-label block">Add New Threshold</span>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <Field label="Nutrient">
              <input
                className={inputClass}
                value={newNutrient}
                onChange={(e) => setNewNutrient(e.target.value)}
                placeholder="e.g. Sodium"
                data-testid="new-threshold-nutrient"
              />
            </Field>
            <Field label="Operator">
              <select
                className={inputClass}
                value={newOperator}
                onChange={(e) => setNewOperator(e.target.value as any)}
                data-testid="new-threshold-operator"
              >
                <option value=">=">&gt;= (Max Limit)</option>
                <option value=">">&gt; (Strict Max)</option>
                <option value="<=">&lt;= (Min Target)</option>
                <option value="<">&lt; (Strict Min)</option>
              </select>
            </Field>
            <Field label="Limit">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={newLimit}
                onChange={(e) => setNewLimit(Number(e.target.value))}
                data-testid="new-threshold-limit"
              />
            </Field>
            <Field label="Unit">
              <select
                className={inputClass}
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                data-testid="new-threshold-unit"
              >
                <option value="g">g (grams)</option>
                <option value="mg">mg (milligrams)</option>
                <option value="kcal">kcal (calories)</option>
              </select>
            </Field>
            <Field label="Basis">
              <select
                className={inputClass}
                value={newBasis}
                onChange={(e) => setNewBasis(e.target.value as any)}
                data-testid="new-threshold-basis"
              >
                <option value="per_serving">Per Printed Serving</option>
                <option value="per_100g">Per 100g / 100ml</option>
              </select>
            </Field>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="primary" size="sm" onClick={handleAddThreshold} data-testid="add-threshold-btn">
              + Add Threshold
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSaveProfile} data-testid="save-all-thresholds">
              Save All Changes
            </Button>
          </div>
        </div>
      </Panel>

      <Panel kicker="Live Scan Verification" title={`Personalized Alerts for: ${product?.name ?? "No Scanned Product"}`}>
        {product ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Evaluated against <strong className="text-cyan-200">{dependentName}&apos;s</strong> active dietary profile and enabled thresholds.
            </p>
            <EvidenceGroundedAlerts
              comparisons={activeComparisons}
              onNavigateToEvidence={() => router.push("/analysis")}
              onResolveConfirmation={resolveConfirmation}
              onDismissAlert={dismissAlert}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-[#070c1e]/60 p-4 text-sm text-slate-400">
            No active product in the scanning chamber. Load a sample in the scanner or upload a label to review personalized alerts.
          </div>
        )}
      </Panel>

      <Panel kicker="Simulation Mode" title="Caregiver Delivery Settings (Demo)">
        <label className="text-sm flex items-center gap-2 cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
            data-testid="caregiver-optin"
            className="rounded border-cyan-400/30"
          />
          <span>I understand this is a simulation and opt in to demo alerts</span>
        </label>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <Field label="Caregiver Contact Name">
            <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. Dr. Jordan" />
          </Field>
          <Field label="Emergency Email / SMS (Simulation Only)">
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. caregiver@example.com" />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setCaregiver({ name: contactName, address, channel: "email" })}>
            Save Contact
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!optIn || !caregiver || !product}
            onClick={() => product && triggerAlert(product, "caregiver.threshold_exceeded")}
          >
            Trigger Simulated Test Alert
          </Button>
        </div>
      </Panel>

      <Panel kicker="Audit Trail" title="Simulated Alert Log">
        <ul className="space-y-2" data-testid="alert-list">
          {alerts.map((a) => (
            <li key={a.id} className="rounded-lg border border-white/10 p-3 text-sm">
              <div className="flex items-center justify-between">
                <Badge tone="amber">{a.status}</Badge>
                <span className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="mt-1 text-slate-200">{a.preview}</p>
              <Button variant="danger" size="sm" className="mt-2 text-xs" onClick={() => deleteAlert(a.id)}>
                Delete Log
              </Button>
            </li>
          ))}
          {!alerts.length && <li className="text-slate-400 text-sm">No simulated alerts logged yet.</li>}
        </ul>
      </Panel>
    </div>
  );
}
