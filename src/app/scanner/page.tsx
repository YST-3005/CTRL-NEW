"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { SAMPLE_PRODUCTS } from "@/data/samples";
import { fileToDataUrl, validateImageFile, ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/validation/files";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { Badge, Button, Field, Panel, inputClass } from "@/components/ui/Hud";
import { PackageMesh, ParticleField, RingField, ScanBeam } from "@/components/three/LabCanvas";
import { ScannerChamber } from "@/components/three/models/ScannerChamber";
import { CinematicProduct } from "@/components/three/models/CinematicProduct";
import { ImageQualityHud } from "@/components/scanner/ImageQualityHud";
import { StorageQuotaBanner } from "@/components/ui/StorageQuotaBanner";

const LabCanvas = dynamic(() => import("@/components/three/LabCanvas").then((m) => m.LabCanvas), { ssr: false });

export default function ScannerPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const phase = useGuardianStore((s) => s.phase);
  const previewUrl = useGuardianStore((s) => s.previewUrl);
  const activeQualityReport = useGuardianStore((s) => s.activeQualityReport);
  const pendingFileName = useGuardianStore((s) => s.pendingFileName);
  const uploadProgress = useGuardianStore((s) => s.uploadProgress);
  const scanError = useGuardianStore((s) => s.scanError);
  const startUpload = useGuardianStore((s) => s.startUpload);
  const loadSample = useGuardianStore((s) => s.loadSample);
  const scanManual = useGuardianStore((s) => s.scanManual);
  const retryScan = useGuardianStore((s) => s.retryScan);
  const cancelScan = useGuardianStore((s) => s.cancelScan);
  const setPreview = useGuardianStore((s) => s.setPreview);
  const setForceFailNext = useGuardianStore((s) => s.setForceFailNext);
  const forceFailNext = useGuardianStore((s) => s.forceFailNext);
  const simulateDemoOcr = useGuardianStore((s) => s.simulateDemoOcr);
  const prefs = useGuardianStore((s) => s.prefs);
  const savePrefs = useGuardianStore((s) => s.savePrefs);
  const [drag, setDrag] = useState(false);
  const [manual, setManual] = useState("");
  const busy = phase === "uploading" || phase === "processing";

  async function handleFile(file: File) {
    const v = validateImageFile(file);
    if (!v.ok) {
      useGuardianStore.setState({ scanError: v.error, phase: "failed" });
      return;
    }
    const url = await fileToDataUrl(file);
    setPreview(url, file.name);
    const ok = await startUpload(url, file.name);
    if (ok) router.push("/analysis");
  }

  return (
    <div className="space-y-6">
      <StorageQuotaBanner />

      {/* Dietary Preference Filter Toolbar */}
      <div className="rounded-2xl border border-cyan-400/20 bg-[#060b1c]/70 p-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div>
            <span className="font-syne text-xs font-semibold uppercase tracking-wider text-cyan-200">
              Active Dietary Filters (Evaluated Against Scans)
            </span>
            <p className="text-xs text-slate-400">Toggle preferences before scanning to immediately evaluate label evidence.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/preferences")}
            className="text-xs text-slate-300 hover:text-white"
          >
            ⚙ All Preferences
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => savePrefs({ ...prefs, vegan: !prefs.vegan })}
            className={`rounded-full px-3 py-1 text-xs font-mono transition-all ${
              prefs.vegan ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "text-slate-400 border border-white/10 hover:text-slate-200"
            }`}
          >
            🌱 Vegan: {prefs.vegan ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={() => savePrefs({ ...prefs, vegetarian: !prefs.vegetarian })}
            className={`rounded-full px-3 py-1 text-xs font-mono transition-all ${
              prefs.vegetarian ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "text-slate-400 border border-white/10 hover:text-slate-200"
            }`}
          >
            🥗 Vegetarian: {prefs.vegetarian ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={() => {
              const hasMilk = prefs.allergensToFlag.includes("milk");
              const next = hasMilk ? prefs.allergensToFlag.filter((a) => a !== "milk") : [...prefs.allergensToFlag, "milk"];
              savePrefs({ ...prefs, allergensToFlag: next });
            }}
            className={`rounded-full px-3 py-1 text-xs font-mono transition-all ${
              prefs.allergensToFlag.includes("milk") ? "bg-red-500/20 text-red-200 border border-red-400/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]" : "text-slate-400 border border-white/10 hover:text-slate-200"
            }`}
          >
            🥛 Avoid Milk: {prefs.allergensToFlag.includes("milk") ? "ACTIVE" : "OFF"}
          </button>
          <button
            type="button"
            onClick={() => {
              const hasPeanuts = prefs.allergensToFlag.includes("peanuts");
              const next = hasPeanuts ? prefs.allergensToFlag.filter((a) => a !== "peanuts") : [...prefs.allergensToFlag, "peanuts"];
              savePrefs({ ...prefs, allergensToFlag: next });
            }}
            className={`rounded-full px-3 py-1 text-xs font-mono transition-all ${
              prefs.allergensToFlag.includes("peanuts") ? "bg-red-500/20 text-red-200 border border-red-400/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]" : "text-slate-400 border border-white/10 hover:text-slate-200"
            }`}
          >
            🥜 Avoid Peanuts: {prefs.allergensToFlag.includes("peanuts") ? "ACTIVE" : "OFF"}
          </button>
          <button
            type="button"
            onClick={() => {
              const hasSugar = prefs.ingredientsOfConcern.includes("added sugar");
              const next = hasSugar ? prefs.ingredientsOfConcern.filter((a) => a !== "added sugar") : [...prefs.ingredientsOfConcern, "added sugar"];
              savePrefs({ ...prefs, ingredientsOfConcern: next });
            }}
            className={`rounded-full px-3 py-1 text-xs font-mono transition-all ${
              prefs.ingredientsOfConcern.includes("added sugar") ? "bg-amber-500/20 text-amber-200 border border-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]" : "text-slate-400 border border-white/10 hover:text-slate-200"
            }`}
          >
            🍬 Avoid Added Sugar: {prefs.ingredientsOfConcern.includes("added sugar") ? "ACTIVE" : "OFF"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div>
            <p className="hud-label">Acquisition</p>
            <h1 className="display text-3xl text-cyan-50">Scanner chamber</h1>
          </div>
        <LabCanvas className="h-[360px]" autoRotate={!busy}>
          <ScannerChamber
            active={busy || phase === "failed"}
            beamColor={phase === "failed" ? "#ff4d6d" : previewUrl ? "#5dffb0" : "#3cefff"}
            intensity={phase === "failed" ? 1.8 : busy ? 1.5 : 0.6}
          />
          <CinematicProduct
            accentColor={phase === "failed" ? "#ff4d6d" : previewUrl ? "#5dffb0" : "#3cefff"}
            scannerGlow={busy ? 1.0 : 0.2}
            customTextureUrl={previewUrl ?? undefined}
            titleText={pendingFileName ? pendingFileName.split(".")[0].toUpperCase() : "FOOD-GRADE CARTRIDGE"}
            brandText={previewUrl ? "USER UPLOAD BAY" : "HELION PANTRY"}
            scale={0.92}
          />
        </LabCanvas>
        <p className="text-sm text-slate-400">
          Chamber state: <Badge tone={phase === "failed" ? "alert" : previewUrl ? "ok" : "cyan"}>{phase}</Badge>
          {busy && <span className="ml-2 font-mono text-cyan-300">Upload {uploadProgress}% · OCR laser active</span>}
        </p>
      </div>
      <div className="space-y-4">
        <Panel kicker="Drop zone" title="Label image">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const file = e.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
            className={`rounded-2xl border border-dashed p-8 text-center ${drag ? "border-cyan-300 bg-cyan-400/10" : "border-cyan-400/30"}`}
          >
            <p>Drag a label photo here</p>
            <p className="mt-2 text-xs text-slate-400">
              JPEG, PNG, WebP, GIF · max {MAX_IMAGE_BYTES / 1024 / 1024} MB · processed on-device
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button onClick={() => inputRef.current?.click()} disabled={busy}>
                Choose file
              </Button>
              <Button variant="ghost" onClick={() => camRef.current?.click()} disabled={busy}>
                Camera
              </Button>
              {previewUrl && (
                <Button variant="ghost" onClick={() => setPreview(null)}>
                  Remove image
                </Button>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              hidden
              onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])}
            />
            <input
              ref={camRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])}
            />
          </div>
          {previewUrl && (
            <div className="mt-4 space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Uploaded label preview" className="max-h-48 rounded-xl border border-white/10" />
              <ImageQualityHud report={activeQualityReport} onRetake={() => inputRef.current?.click()} />
            </div>
          )}
          {scanError && (
            <p className="mt-3 text-sm text-rose-300" role="alert">
              {scanError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="ghost"
              data-testid="simulate-ocr"
              disabled={busy}
              onClick={async () => {
                const ok = await simulateDemoOcr();
                if (ok) router.push("/analysis");
              }}
            >
              Run demo OCR pipeline
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                const ok = await retryScan();
                if (ok) router.push("/analysis");
              }}
              disabled={busy || !previewUrl}
            >
              Retry
            </Button>
            <Button variant="ghost" onClick={() => cancelScan()} disabled={!busy}>
              Cancel
            </Button>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={forceFailNext}
                onChange={(e) => setForceFailNext(e.target.checked)}
                aria-label="Force next OCR failure"
              />
              Force next OCR failure (journey B)
            </label>
          </div>
        </Panel>
        <Panel kicker="Mission 4 Scenarios" title="Instant Test Launchers">
          <p className="mb-3 text-xs text-slate-300">
            One-click automated execution of the three required Mission 4 test scenarios:
          </p>
          <div className="space-y-2">
            <Button
              variant="primary"
              className="w-full text-xs text-left justify-start bg-cyan-500/20 border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30"
              onClick={async () => {
                savePrefs({ ...prefs, vegan: true, allergensToFlag: ["milk", "peanuts"] });
                const ocr = `HERSHEY'S MILK CHOCOLATE WITH PEANUTS
Nutrition Facts
Serving size 1 bar (41g)
Calories 220
Total Fat 14g
Saturated Fat 6g
Sodium 35mg
Total Carbohydrate 22g
Total Sugars 19g
Protein 5g

INGREDIENTS: Milk Chocolate (Sugar, Milk, Chocolate, Cocoa Butter, Milk Fat, Lecithin (Soy), PGPR, Natural Flavor), Peanuts.
Contains: Milk, Soy, Peanuts.
Manufactured by The Hershey Company, Hershey, PA 17033`;
                await scanManual(ocr);
                router.push("/analysis");
              }}
              data-testid="launch-m4-test-1"
            >
              🍫 Test 1: Clear Chocolate Label (Peanuts & Milk Avoidance)
            </Button>
            <Button
              variant="ghost"
              className="w-full text-xs text-left justify-start border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
              onClick={async () => {
                savePrefs({ ...prefs, ingredientsOfConcern: ["gluten"] });
                const ocr = `Nova Fuel Rolled Oats
Ingredients: Oats, natural flavoring...
(Nutrition panel partially obscured by glare and motion blur)`;
                await scanManual(ocr);
                router.push("/analysis");
              }}
              data-testid="launch-m4-test-2"
            >
              🌫️ Test 2: Blurry / Partially Obscured Label (Uncertainty & Retake)
            </Button>
            <Button
              variant="ghost"
              className="w-full text-xs text-left justify-start border-fuchsia-500/30 text-fuchsia-200 hover:bg-fuchsia-500/10"
              onClick={async () => {
                savePrefs({ ...prefs, vegan: true });
                const ocr = `Apex Endurance Bar
Ingredients: Rolled oats, brown rice syrup, glycerin, natural flavors, salt.
Contains: May contain traces of milk.
Nutrition Facts
Serving size: 60g
Calories: 240
Total Sugars: 12g
Sodium: 180mg`;
                await scanManual(ocr);
                router.push("/analysis");
              }}
              data-testid="launch-m4-test-3"
            >
              ⚡ Test 3: Contradictory Label (Ambiguous Glycerin & Model Mismatch)
            </Button>
          </div>
        </Panel>

        <Panel kicker="Samples" title="Load demonstration product">
          <div className="grid gap-2">
            {SAMPLE_PRODUCTS.map((p) => (
              <Button
                key={p.id}
                variant="ghost"
                className="w-full text-left"
                data-testid={`sample-${p.id}`}
                onClick={async () => {
                  await loadSample(p.id);
                  router.push("/analysis");
                }}
              >
                {p.name} · {p.dietary.veganStatus}
              </Button>
            ))}
          </div>
        </Panel>
        <Panel kicker="Fallback" title="Manual label text">
          <Field label="Paste ingredients / nutrition text">
            <textarea className={inputClass} rows={5} value={manual} onChange={(e) => setManual(e.target.value)} />
          </Field>
          <Button
            className="mt-3"
            onClick={async () => {
              await scanManual(manual);
              router.push("/analysis");
            }}
          >
            Parse text
          </Button>
        </Panel>
      </div>
    </div>
    </div>
  );
}
