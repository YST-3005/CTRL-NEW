"use client";

import { COMMON_ALLERGENS, DEFAULT_PREFERENCES } from "@/types";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { Button, Field, Panel, inputClass } from "@/components/ui/Hud";
import { useState } from "react";
import dynamic from "next/dynamic";
import { ControlRings } from "@/components/three/LabCanvas";

const LabCanvas = dynamic(() => import("@/components/three/LabCanvas").then((m) => m.LabCanvas), { ssr: false });

export default function PreferencesPage() {
  const prefs = useGuardianStore((s) => s.prefs);
  const savePrefs = useGuardianStore((s) => s.savePrefs);
  const resetPrefs = useGuardianStore((s) => s.resetPrefs);
  const [concern, setConcern] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <header>
        <p className="hud-label">Control room</p>
        <h1 className="display text-3xl">Dietary profile</h1>
        <p className="text-sm text-slate-400">
          These are user-selected preferences, not medical contraindications inferred by the system.
        </p>
      </header>
      <LabCanvas className="h-[220px]" autoRotate={false}>
        <ControlRings armed={(prefs.vegan ? 2 : 0) + prefs.allergensToFlag.length} />
      </LabCanvas>
      <Panel title="Diet">
        <label className="mr-4 text-sm">
          <input
            type="checkbox"
            checked={prefs.vegan}
            onChange={(e) => savePrefs({ ...prefs, vegan: e.target.checked })}
            data-testid="pref-vegan"
          />{" "}
          Flag non-vegan / unknown for vegan preference
        </label>
        <label className="text-sm">
          <input
            type="checkbox"
            checked={prefs.vegetarian}
            onChange={(e) => savePrefs({ ...prefs, vegetarian: e.target.checked })}
          />{" "}
          Vegetarian preference
        </label>
      </Panel>
      <Panel title="Allergens to flag">
        <div className="flex flex-wrap gap-2">
          {COMMON_ALLERGENS.map((a) => (
            <label key={a} className="rounded-full border border-white/10 px-3 py-1 text-sm">
              <input
                type="checkbox"
                checked={prefs.allergensToFlag.includes(a)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...prefs.allergensToFlag, a]
                    : prefs.allergensToFlag.filter((x) => x !== a);
                  savePrefs({ ...prefs, allergensToFlag: next });
                }}
              />{" "}
              {a}
            </label>
          ))}
        </div>
      </Panel>
      <Panel title="Ingredients of concern">
        <ul className="mb-3 text-sm">
          {prefs.ingredientsOfConcern.map((c) => (
            <li key={c}>
              {c}{" "}
              <button className="text-rose-300" onClick={() => savePrefs({ ...prefs, ingredientsOfConcern: prefs.ingredientsOfConcern.filter((x) => x !== c) })}>
                remove
              </button>
            </li>
          ))}
        </ul>
        <Field label="Add concern">
          <div className="flex gap-2">
            <input className={inputClass} value={concern} onChange={(e) => setConcern(e.target.value)} />
            <Button
              onClick={() => {
                if (!concern.trim()) return;
                savePrefs({ ...prefs, ingredientsOfConcern: [...prefs.ingredientsOfConcern, concern.trim()] });
                setConcern("");
              }}
            >
              Add
            </Button>
          </div>
        </Field>
      </Panel>
      <Panel title="Units, motion, privacy">
        <Field label="Preferred serving unit">
          <select
            className={inputClass}
            value={prefs.preferredServingUnit}
            onChange={(e) => savePrefs({ ...prefs, preferredServingUnit: e.target.value as typeof prefs.preferredServingUnit })}
          >
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="oz">oz</option>
          </select>
        </Field>
        <label className="mt-3 block text-sm">
          <input
            type="checkbox"
            checked={prefs.motion === "reduced"}
            onChange={(e) => savePrefs({ ...prefs, motion: e.target.checked ? "reduced" : "full" })}
          />{" "}
          Reduced motion
        </label>
        <label className="block text-sm">
          <input
            type="checkbox"
            checked={prefs.saveScans}
            onChange={(e) => savePrefs({ ...prefs, saveScans: e.target.checked })}
          />{" "}
          Save scans locally
        </label>
        <label className="block text-sm">
          <input
            type="checkbox"
            checked={prefs.notificationsOptIn}
            onChange={(e) => savePrefs({ ...prefs, notificationsOptIn: e.target.checked })}
          />{" "}
          Notification preference (does not send caregiver alerts by itself)
        </label>
        <label className="block text-sm">
          <input type="checkbox" checked={prefs.privacyLocalOnly} readOnly /> Local-only demo storage (cloud off)
        </label>
      </Panel>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            savePrefs(prefs);
            setStatus("Preferences saved to local demo storage.");
          }}
        >
          Save
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            resetPrefs();
            setStatus("Reset to defaults.");
          }}
        >
          Reset {DEFAULT_PREFERENCES.vegan ? "" : "defaults"}
        </Button>
      </div>
      {status && <p role="status">{status}</p>}
    </div>
  );
}
