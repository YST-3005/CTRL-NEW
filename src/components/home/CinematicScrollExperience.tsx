"use client";

import { useEffect, useRef, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CinematicProduct } from "../three/models/CinematicProduct";
import { ScannerChamber } from "../three/models/ScannerChamber";
import { ExplodedIngredientField } from "../three/models/ExplodedIngredientField";
import { DualComparisonDuel } from "../three/models/DualComparisonDuel";
import { VolumetricServingChamber } from "../three/models/VolumetricServingChamber";
import { HoloGridFloorShader } from "../three/shaders/customShaders";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { SAMPLE_PRODUCTS } from "@/data/samples";
import { Badge, Button, Panel } from "../ui/Hud";
import { evaluateDietaryRules } from "@/lib/dietary/rules";
import { scaleNutrition } from "@/lib/nutrition/serving";
import { fileToDataUrl, validateImageFile, ACCEPTED_IMAGE_TYPES } from "@/lib/validation/files";

const SCENE_NAMES = [
  "01 · DISCOVER",
  "02 · SCAN",
  "03 · REVEAL",
  "04 · UNDERSTAND",
  "05 · COMPARE",
  "06 · PERSONALIZE",
  "07 · ENTER LAB",
];

export function CinematicScrollExperience() {
  const router = useRouter();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeScene, setActiveScene] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Store connections
  const startUpload = useGuardianStore((s) => s.startUpload);
  const loadSample = useGuardianStore((s) => s.loadSample);
  const simulateDemoOcr = useGuardianStore((s) => s.simulateDemoOcr);
  const setPreview = useGuardianStore((s) => s.setPreview);
  const prefs = useGuardianStore((s) => s.prefs);
  const savePrefs = useGuardianStore((s) => s.savePrefs);
  const user = useGuardianStore((s) => s.user);

  // Scene 5 (Compare) state
  const [compLeftId, setCompLeftId] = useState<string>("sample-oat-dawn");
  const [compRightId, setCompRightId] = useState<string>("sample-nova-whey");

  // Scene 6 (Personalize) state
  const [servingFactor, setServingFactor] = useState<number>(1.0);
  const [strictVegan, setStrictVegan] = useState<boolean>(Boolean(prefs.vegan));
  const [peanutAllergy, setPeanutAllergy] = useState<boolean>(
    Boolean(prefs.allergensToFlag?.includes("peanuts")),
  );

  const sampleProduct = useMemo(() => {
    return SAMPLE_PRODUCTS.find((p) => p.id === "sample-oat-dawn") || SAMPLE_PRODUCTS[0];
  }, []);

  const leftProd = useMemo(() => SAMPLE_PRODUCTS.find((p) => p.id === compLeftId) || SAMPLE_PRODUCTS[0], [compLeftId]);
  const rightProd = useMemo(() => SAMPLE_PRODUCTS.find((p) => p.id === compRightId) || SAMPLE_PRODUCTS[1], [compRightId]);

  // Scaled nutrition calculation
  const scaledNutrition = useMemo(() => {
    if (!sampleProduct) return null;
    return scaleNutrition(
      sampleProduct.nutrition,
      (sampleProduct.nutrition.servingSizeAmount || 55) * servingFactor,
      sampleProduct.nutrition.servingSizeUnit || "g",
    );
  }, [sampleProduct, servingFactor]);

  // Calculate alert severity
  const activeAlertSeverity = useMemo(() => {
    if (peanutAllergy) return "alert";
    if (strictVegan) return "warning";
    return "safe";
  }, [peanutAllergy, strictVegan]);

  const [introActive, setIntroActive] = useState(true);

  // Respect reduced motion
  useEffect(() => {
    if (typeof window !== "undefined") {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReduced || prefs.motion === "reduced") {
        setIntroActive(false);
      }
    }
  }, [prefs.motion]);

  // Track global scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const totalHeight = containerRef.current.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;
      const progress = Math.min(Math.max(window.scrollY / totalHeight, 0), 1);
      setScrollProgress(progress);
      if (progress > 0.015 && introActive) {
        setIntroActive(false);
      }
      const sceneIndex = Math.min(Math.floor(progress * 6.999), 6);
      setActiveScene(sceneIndex);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [introActive]);

  // Track mouse coordinates for parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: -(e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Smooth scroll to scene
  const scrollToScene = (index: number) => {
    if (!containerRef.current) return;
    const totalHeight = containerRef.current.scrollHeight - window.innerHeight;
    const targetY = (index / 6) * totalHeight;
    window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  // Upload handler for Scene 7
  const handleFileDrop = async (file: File) => {
    const v = validateImageFile(file);
    if (!v.ok) return;
    const url = await fileToDataUrl(file);
    setPreview(url, file.name);
    const ok = await startUpload(url, file.name);
    if (ok) router.push("/analysis");
  };

  return (
    <div ref={containerRef} className="relative min-h-[700vh] text-slate-100">
      {/* 1. FIXED BACKGROUND 3D WEBGL CHAMBER */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0.4, 4.4], fov: 40 }}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            alpha: false,
          }}
        >
          <color attach="background" args={["#04060c"]} />
          <fog attach="fog" args={["#04060c", 5, 16]} />

          {/* Cinematic Lighting Rig */}
          <ambientLight intensity={0.35} />
          <pointLight position={[5, 8, 4]} intensity={2.2} color="#3cefff" />
          <pointLight position={[-6, -2, -3]} intensity={1.2} color="#8f6bff" />
          <spotLight position={[0, 6, 2]} intensity={1.5} color="#9fdfff" angle={0.5} penumbra={0.7} />

          {/* Master 3D Scene Conductor */}
          <Suspense fallback={null}>
            <ChamberFloor />
            <CameraConductor
              progress={scrollProgress}
              activeScene={activeScene}
              mouseParallax={mousePos}
              introActive={introActive}
              onIntroFinish={() => setIntroActive(false)}
            />
            <SceneObjectsConductor
              progress={scrollProgress}
              activeScene={activeScene}
              leftProduct={leftProd}
              rightProduct={rightProd}
              servingFactor={servingFactor}
              alertSeverity={activeAlertSeverity}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* 2. TOP HUD TELEMETRY & NAVIGATION SCRUBBER */}
      <div className="fixed top-16 left-0 right-0 z-30 pointer-events-none px-4 md:px-8">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          {/* Telemetry pill */}
          <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-slate-950/80 px-3.5 py-1.5 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="text-[11px] font-mono tracking-widest text-cyan-300">
              {introActive
                ? "INITIALIZING QUANTUM SCANNER CHAMBER..."
                : `CHAMBER STATUS: OPTIMAL · ${SCENE_NAMES[activeScene]}`}
            </span>
          </div>

          {/* Controls: Skip intro / Replay intro / Skip to lab */}
          <div className="pointer-events-auto flex items-center gap-2">
            {introActive ? (
              <button
                onClick={() => setIntroActive(false)}
                className="rounded-full border border-cyan-400/30 bg-slate-950/80 hover:bg-cyan-950/60 px-3.5 py-1.5 text-xs font-mono text-cyan-200 backdrop-blur-md transition-all"
              >
                Skip Intro
              </button>
            ) : (
              <button
                onClick={() => {
                  setIntroActive(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="rounded-full border border-white/10 hover:border-cyan-400/30 bg-slate-950/60 hover:bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-400 hover:text-cyan-200 backdrop-blur-md transition-all"
              >
                ↺ Replay Intro
              </button>
            )}
            <button
              onClick={() => scrollToScene(6)}
              className="rounded-full border border-cyan-400/30 bg-cyan-950/60 hover:bg-cyan-900/80 px-4 py-1.5 text-xs font-mono tracking-wider text-cyan-200 backdrop-blur-md transition-all shadow-[0_0_15px_rgba(60,239,255,0.2)]"
            >
              Skip to Lab Scanner →
            </button>
          </div>
        </div>
      </div>

      {/* Floating Scene Scrubber on right edge (Desktop) */}
      <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-30 flex-col gap-3">
        {SCENE_NAMES.map((name, i) => (
          <button
            key={name}
            onClick={() => scrollToScene(i)}
            className="group flex items-center gap-2.5 text-right transition-all"
          >
            <span
              className={`text-[10px] font-mono tracking-wider transition-opacity duration-300 ${
                activeScene === i ? "opacity-100 text-cyan-300 font-bold" : "opacity-0 group-hover:opacity-75 text-slate-400"
              }`}
            >
              {name}
            </span>
            <span
              className={`block h-2 rounded-full transition-all duration-300 ${
                activeScene === i
                  ? "w-6 bg-cyan-400 shadow-[0_0_8px_#3cefff]"
                  : "w-2 bg-slate-700 group-hover:bg-cyan-500/50"
              }`}
            />
          </button>
        ))}
      </div>

      {/* 3. SCROLL-DRIVEN HTML STORY SECTIONS */}
      <div className="relative z-20 pointer-events-none">
        {/* ===================== SCENE 1: DISCOVER ===================== */}
        <section className="min-h-screen flex items-center px-4 md:px-12 pointer-events-auto">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-slate-950/70 px-3.5 py-1 text-xs font-mono tracking-wider text-cyan-300 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              PEACHWEB-GRADE IMMERSIVE 3D · SECTOR 07
            </div>
            <h1 className="display text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white leading-none">
              LabelLens <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-indigo-300">
                Guardian
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
              A cinematic laboratory for deconstructing food, supplement, and tablet labels in physical 3D space with genuine evidence,
              quantified uncertainty, and dietary rules — never simulated or invented health scores.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => scrollToScene(1)}
                className="rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold px-6 py-3 text-sm tracking-wide shadow-[0_0_25px_rgba(60,239,255,0.4)] transition-all hover:scale-105"
              >
                Initiate Scanner Chamber ↓
              </button>
              <button
                onClick={() => scrollToScene(6)}
                className="rounded-full border border-cyan-400/30 hover:border-cyan-300 bg-slate-950/70 text-cyan-200 px-6 py-3 text-sm font-medium backdrop-blur-md transition-all"
              >
                Direct Lab Bay
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-6 border-t border-white/10 text-xs font-mono text-slate-400">
              <div>
                <span className="block text-cyan-400 font-bold text-sm">100%</span>
                On-device OCR engine
              </div>
              <div>
                <span className="block text-violet-400 font-bold text-sm">3-WAY</span>
                Vegan & Allergen logic
              </div>
              <div>
                <span className="block text-amber-400 font-bold text-sm">HONEST</span>
                Missing data stays missing
              </div>
            </div>
          </div>
        </section>

        {/* ===================== SCENE 2: SCAN ===================== */}
        <section className="min-h-screen flex items-center justify-end px-4 md:px-12 pointer-events-auto">
          <div className="max-w-xl space-y-5 rounded-3xl border border-cyan-400/20 bg-slate-950/80 p-6 md:p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.6)]">
            <span className="hud-label text-cyan-400">Scene 02 // Precision Scanning</span>
            <h2 className="display text-3xl sm:text-4xl text-white">Holographic Laser Sweep</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              As the food cartridge enters the scanning chamber, concentric 3-axis gimbal rings spin up to synchronize focal planes.
              An energetic dual-wave laser planar beam sweeps over the packaging, parsing ingredients, nutrition facts, and allergen warnings directly.
            </p>
            <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-900/50 p-4 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>OCR LASER PROGRESS</span>
                <span className="text-cyan-300 font-bold">ACTIVE · 99.8% CONFIDENCE</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 w-[92%] animate-pulse" />
              </div>
              <div className="flex justify-between pt-1 text-[11px] text-slate-500">
                <span>TARGET: OAT DAWN CLUSTERS</span>
                <span>SPECTRAL SENSORS: 4/4</span>
              </div>
            </div>
            <button
              onClick={() => scrollToScene(2)}
              className="inline-flex items-center gap-2 text-xs font-mono text-cyan-300 hover:text-cyan-100 transition-colors"
            >
              Continue to Exploded Reveal ↓
            </button>
          </div>
        </section>

        {/* ===================== SCENE 3: REVEAL ===================== */}
        <section className="min-h-screen flex items-center px-4 md:px-12 pointer-events-auto">
          <div className="max-w-xl space-y-5 rounded-3xl border border-cyan-400/20 bg-slate-950/80 p-6 md:p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.6)]">
            <span className="hud-label text-violet-400">Scene 03 // Deconstruction</span>
            <h2 className="display text-3xl sm:text-4xl text-white">Layered Label Breakdown</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              The physical packaging separates, exposing its internal holographic core. Ingredients, macro-nutrients, and allergen markers
              detach into 3D orbital rings, floating around the container with active laser connection lines.
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-950/30 p-3">
                <span className="text-cyan-300 font-bold block mb-1">PRINTED FACTS</span>
                <p className="text-slate-400">220 kcal · 5g Fiber · 6g Protein verified from printed label box.</p>
              </div>
              <div className="rounded-xl border border-amber-400/20 bg-amber-950/30 p-3">
                <span className="text-amber-300 font-bold block mb-1">CONCERNS FLAGGED</span>
                <p className="text-slate-400">8g Added Sugars declared in printed table. Soy allergen confirmed.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== SCENE 4: UNDERSTAND ===================== */}
        <section className="min-h-screen flex items-center justify-end px-4 md:px-12 pointer-events-auto">
          <div className="max-w-xl space-y-5 rounded-3xl border border-cyan-400/20 bg-slate-950/80 p-6 md:p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.6)]">
            <span className="hud-label text-emerald-400">Scene 04 // Categorization</span>
            <h2 className="display text-3xl sm:text-4xl text-white">Three-Cluster Evidence</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Ingredient nodes separate into three spatially distinct security clusters. Verified vegan ingredients glow emerald, declared
              allergens pulse with alert crimson rings, while undisclosed compounds (such as natural flavors) remain honestly marked as UNKNOWN.
            </p>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-emerald-200">
                <span>● VERIFIED VEGAN (CYAN/GREEN)</span>
                <span>Oats, Sunflower Oil, Salt</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-950/30 px-3 py-2 text-amber-200">
                <span>▲ UNCERTAIN ORIGIN (AMBER)</span>
                <span>Natural Flavors, Cane Sugar</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-rose-400/30 bg-rose-950/30 px-3 py-2 text-rose-200">
                <span>✕ MAJOR ALLERGEN (RED)</span>
                <span>Soy Lecithin (Soy Allergen)</span>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== SCENE 5: COMPARE ===================== */}
        <section className="min-h-screen flex items-center px-4 md:px-12 pointer-events-auto">
          <div className="max-w-xl space-y-5 rounded-3xl border border-cyan-400/20 bg-slate-950/80 p-6 md:p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.6)]">
            <span className="hud-label text-cyan-400">Scene 05 // Comparative Arena</span>
            <h2 className="display text-3xl sm:text-4xl text-white">Dual Chamber Duel</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Two products dock side by side in shared holographic containment. Interactive 3D metric towers rise from the chamber floor,
              illustrating nutritional trade-offs without invented overall health scores.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-cyan-300 block mb-1">POD ALPHA (LEFT)</label>
                <select
                  value={compLeftId}
                  onChange={(e) => setCompLeftId(e.target.value)}
                  className="w-full rounded-xl border border-cyan-400/30 bg-slate-900 px-3 py-2 text-xs text-white"
                >
                  {SAMPLE_PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-mono text-violet-300 block mb-1">POD BETA (RIGHT)</label>
                <select
                  value={compRightId}
                  onChange={(e) => setCompRightId(e.target.value)}
                  className="w-full rounded-xl border border-violet-400/30 bg-slate-900 px-3 py-2 text-xs text-white"
                >
                  {SAMPLE_PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs space-y-2">
              <span className="hud-label">Key Differences Detected</span>
              <p className="text-slate-300">
                <strong className="text-cyan-300">{leftProd.name}</strong> vs{" "}
                <strong className="text-violet-300">{rightProd.name}</strong>:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400">
                <li>Protein: {leftProd.nutrition.values.find((v) => v.nutrient === "Protein")?.amount ?? 0}g vs {rightProd.nutrition.values.find((v) => v.nutrient === "Protein")?.amount ?? 0}g</li>
                <li>Dietary status: {leftProd.dietary.veganStatus} vs {rightProd.dietary.veganStatus}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ===================== SCENE 6: PERSONALIZE ===================== */}
        <section className="min-h-screen flex items-center justify-end px-4 md:px-12 pointer-events-auto">
          <div className="max-w-xl space-y-5 rounded-3xl border border-cyan-400/20 bg-slate-950/80 p-6 md:p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.6)]">
            <span className="hud-label text-amber-400">Scene 06 // Recalibration</span>
            <h2 className="display text-3xl sm:text-4xl text-white">Serving & Preference Calibration</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Moving the serving-size slider scales the 3D containment chamber in real time. Nutritional metrics recalculate proportionally,
              and personal dietary restrictions dynamically trigger the holographic forcefield alert.
            </p>

            {/* Serving Size Slider & Presets */}
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">SERVING SCALE: {servingFactor.toFixed(2)}x</span>
                <span className="font-mono text-cyan-300 font-bold">
                  {Math.round((sampleProduct.nutrition.servingSizeAmount || 55) * servingFactor)} {sampleProduct.nutrition.servingSizeUnit}
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={servingFactor}
                onChange={(e) => setServingFactor(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex gap-2">
                {[0.5, 1.0, 1.5, 2.0].map((f) => (
                  <button
                    key={f}
                    onClick={() => setServingFactor(f)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-mono transition-all ${
                      servingFactor === f
                        ? "bg-cyan-400 text-slate-950 font-bold"
                        : "border border-white/10 hover:border-cyan-400/40 text-slate-400"
                    }`}
                  >
                    {f}x
                  </button>
                ))}
              </div>

              {/* Calculated results */}
              {scaledNutrition?.valid && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block">CALORIES</span>
                    <span className="text-xs font-bold text-white">
                      {Math.round(scaledNutrition.scaled.values.find((v) => v.nutrient === "Calories")?.amount ?? 0)} kcal
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">PROTEIN</span>
                    <span className="text-xs font-bold text-cyan-300">
                      {(scaledNutrition.scaled.values.find((v) => v.nutrient === "Protein")?.amount ?? 0).toFixed(1)} g
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">SUGARS</span>
                    <span className="text-xs font-bold text-amber-300">
                      {(scaledNutrition.scaled.values.find((v) => v.nutrient === "Added Sugars")?.amount ?? 0).toFixed(1)} g
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Rule Toggles */}
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 cursor-pointer hover:border-cyan-400/30">
                <input
                  type="checkbox"
                  checked={strictVegan}
                  onChange={(e) => setStrictVegan(e.target.checked)}
                  className="accent-cyan-400"
                />
                Strict Vegan Audit
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 cursor-pointer hover:border-rose-400/30">
                <input
                  type="checkbox"
                  checked={peanutAllergy}
                  onChange={(e) => setPeanutAllergy(e.target.checked)}
                  className="accent-rose-500"
                />
                Peanut & Soy Alert Shield
              </label>
            </div>
          </div>
        </section>

        {/* ===================== SCENE 7: ENTER THE LAB ===================== */}
        <section className="min-h-screen flex items-center justify-center px-4 md:px-12 pointer-events-auto py-20">
          <div className="w-full max-w-4xl space-y-6 rounded-3xl border border-cyan-400/30 bg-slate-950/90 p-8 md:p-10 backdrop-blur-2xl shadow-[0_0_80px_rgba(60,239,255,0.15)]">
            <div className="text-center space-y-3">
              <span className="hud-label text-cyan-400">Scene 07 // Operational Gateway</span>
              <h2 className="display text-4xl sm:text-5xl text-white">Enter The Laboratory</h2>
              <p className="text-sm text-slate-300 max-w-xl mx-auto">
                Scan your own label with private on-device OCR, load a structured demonstration cartridge, or enter with a demo credentials session.
              </p>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) void handleFileDrop(file);
              }}
              className="rounded-2xl border-2 border-dashed border-cyan-400/40 hover:border-cyan-300 bg-cyan-950/10 hover:bg-cyan-950/20 p-8 text-center transition-all cursor-pointer"
              onClick={() => {
                const el = document.getElementById("hero-file-input");
                el?.click();
              }}
            >
              <input
                id="hero-file-input"
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                hidden
                onChange={(e) => e.target.files?.[0] && void handleFileDrop(e.target.files[0])}
              />
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300 mb-3">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-base font-semibold text-white">Drop a food or supplement label image here</p>
              <p className="text-xs text-slate-400 mt-1">JPEG, PNG, WebP · Private, runs directly in your browser via Tesseract</p>
            </div>

            {/* Quick Demo Payloads */}
            <div>
              <p className="hud-label text-slate-400 mb-3">Or load a demonstration payload directly:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {SAMPLE_PRODUCTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={async () => {
                      await loadSample(p.id);
                      router.push("/analysis");
                    }}
                    className="flex flex-col items-start rounded-xl border border-white/10 hover:border-cyan-400/40 bg-slate-900/60 hover:bg-slate-900 p-3 text-left transition-all group"
                  >
                    <span className="text-xs font-bold text-white group-hover:text-cyan-200">{p.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">{p.brand}</span>
                    <span className="text-[9px] text-cyan-400 font-mono mt-1">{p.dietary.veganStatus}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
              <div className="flex gap-3">
                <Link href="/scanner">
                  <Button>Open Full Scanner</Button>
                </Link>
                <Link href="/login">
                  <Button variant="ghost">Sign In / Demo Access</Button>
                </Link>
              </div>
              <Button
                variant="ghost"
                onClick={async () => {
                  const ok = await simulateDemoOcr();
                  if (ok) router.push("/analysis");
                }}
              >
                Run Structured Demo OCR →
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * 3D Chamber Floor with Procedural Shader Grid & Sweeping Radar
 */
function ChamberFloor() {
  const gridMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color("#3cefff") },
        uSecondaryColor: { value: new THREE.Color("#8f6bff") },
        uGridSize: { value: 0.8 },
        uRadarSpeed: { value: 0.5 },
      },
      vertexShader: HoloGridFloorShader.vertexShader,
      fragmentShader: HoloGridFloorShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame((state) => {
    // Update the ShaderMaterial directly. The ref belongs to a mesh if attached
    // to <mesh>, so it must not be used to access shader uniforms.
    const timeUniform = gridMat.uniforms?.uTime;
    if (timeUniform) {
      timeUniform.value = state.clock.elapsedTime;
    }
  });

  return (
    <group position={[0, -1.35, 0]}>
      {/* 1. Procedural Sci-Fi Grid Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={gridMat}>
        <planeGeometry args={[20, 20]} />
      </mesh>
      {/* 2. Inner Reflective Hexagonal Pedestal */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <cylinderGeometry args={[2.8, 3.2, 0.05, 6]} />
        <meshStandardMaterial
          color="#060c18"
          metalness={0.9}
          roughness={0.15}
        />
      </mesh>
      {/* 3. Glowing Cyan Circuit Rings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[2.5, 2.54, 6]} />
        <meshBasicMaterial color="#3cefff" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/**
 * Camera Choreography Engine across the 7 Scroll Scenes
 */
function CameraConductor({
  progress,
  activeScene,
  mouseParallax,
  introActive,
  onIntroFinish,
}: {
  progress: number;
  activeScene: number;
  mouseParallax: { x: number; y: number };
  introActive: boolean;
  onIntroFinish: () => void;
}) {
  const { camera } = useThree();
  const introTimer = useRef(0);

  // Target positions across scenes: [posX, posY, posZ, targetX, targetY, targetZ, fov]
  const sceneKeyframes = [
    [0.0, 0.4, 4.4, 0.0, 0.0, 0.0, 40], // Scene 0: Discover
    [0.0, 0.1, 3.4, 0.0, 0.1, 0.0, 42], // Scene 1: Scan
    [-0.6, 0.5, 4.8, 0.0, 0.0, 0.0, 44], // Scene 2: Reveal
    [0.0, 0.8, 5.8, 0.0, 0.4, 0.0, 48], // Scene 3: Understand
    [0.0, 0.6, 5.6, 0.0, 0.0, 0.0, 46], // Scene 4: Compare
    [0.0, 0.1, 4.2, 0.0, -0.2, 0.0, 42], // Scene 5: Personalize
    [0.0, 1.2, 5.4, 0.0, 0.3, 0.0, 44], // Scene 6: Lab
  ];

  useEffect(() => {
    if (introActive) {
      introTimer.current = 0;
      camera.position.set(0.0, 3.2, 7.8);
      camera.lookAt(0, 0.2, 0);
    }
  }, [introActive, camera]);

  useFrame((_, delta) => {
    if (introActive) {
      introTimer.current += delta;
      const duration = 2.4;
      const t = Math.min(introTimer.current / duration, 1.0);
      // Smooth cubic ease-out
      const ease = 1 - Math.pow(1 - t, 3);

      const startPos = new THREE.Vector3(0.0, 3.2, 7.8);
      const endPos = new THREE.Vector3(0.0, 0.4, 4.4);
      camera.position.lerpVectors(startPos, endPos, ease);
      camera.lookAt(0, 0.1 * (1 - ease), 0);

      if (t >= 1.0) {
        onIntroFinish();
      }
      return;
    }

    // Current scene segment interpolation
    const totalScenes = 6;
    const rawIndex = progress * totalScenes;
    const baseIndex = Math.min(Math.floor(rawIndex), totalScenes - 1);
    const nextIndex = Math.min(baseIndex + 1, totalScenes);
    const subProgress = rawIndex - baseIndex;

    const k1 = sceneKeyframes[baseIndex];
    const k2 = sceneKeyframes[nextIndex];

    // Lerp camera position
    const targetX = k1[0] + (k2[0] - k1[0]) * subProgress + mouseParallax.x * 0.25;
    const targetY = k1[1] + (k2[1] - k1[1]) * subProgress + mouseParallax.y * 0.2;
    const targetZ = k1[2] + (k2[2] - k1[2]) * subProgress;

    const lookX = k1[3] + (k2[3] - k1[3]) * subProgress;
    const lookY = k1[4] + (k2[4] - k1[4]) * subProgress;
    const lookZ = k1[5] + (k2[5] - k1[5]) * subProgress;

    camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), delta * 4.0);
    camera.lookAt(lookX, lookY, lookZ);
  });

  return null;
}

/**
 * 3D Objects Conductor that manages visibility and transforms across all 7 scenes
 */
function SceneObjectsConductor({
  progress,
  activeScene,
  leftProduct,
  rightProduct,
  servingFactor,
  alertSeverity,
}: {
  progress: number;
  activeScene: number;
  leftProduct: any;
  rightProduct: any;
  servingFactor: number;
  alertSeverity: "safe" | "warning" | "alert";
}) {
  return (
    <group>
      {/* SCENES 1, 2, 3: Single Suspended Product */}
      {activeScene <= 2 && (
        <group position={[0, 0, 0]}>
          <CinematicProduct
            scale={1.0}
            openFactor={activeScene === 2 ? 0.8 : 0.0}
            scannerGlow={activeScene === 1 ? 1.0 : 0.2}
          />
        </group>
      )}

      {/* SCENE 2: Active Scanner Rings and Sweep */}
      {activeScene === 1 && (
        <ScannerChamber active intensity={1.2} />
      )}

      {/* SCENE 3 & 4: Exploded Ingredients Field */}
      {(activeScene === 2 || activeScene === 3) && (
        <group position={[0, 0, 0]}>
          <ExplodedIngredientField
            mode={activeScene === 2 ? "reveal" : "understand"}
          />
        </group>
      )}

      {/* SCENE 5: Dual Product Comparison Duel */}
      {activeScene === 4 && (
        <DualComparisonDuel
          leftProduct={leftProduct}
          rightProduct={rightProduct}
        />
      )}

      {/* SCENE 6: Volumetric Serving Chamber & Forcefield */}
      {activeScene === 5 && (
        <VolumetricServingChamber
          factor={servingFactor}
          hasAlert={alertSeverity === "alert"}
          alertSeverity={alertSeverity}
        />
      )}

      {/* SCENE 7: Lab Gateway Halo */}
      {activeScene === 6 && (
        <group position={[0, 0.4, 0]}>
          <ScannerChamber active={false} intensity={0.4} />
          <CinematicProduct scale={0.75} scannerGlow={0.2} />
        </group>
      )}
    </group>
  );
}
