"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CinematicProductProps {
  color?: string;
  accentColor?: string;
  brandText?: string;
  titleText?: string;
  customTextureUrl?: string;
  scale?: number;
  openFactor?: number; // 0 = closed, 1 = fully exploded / reveal
  scannerGlow?: number; // 0 = none, 1 = maximum laser glow
  floatSpeed?: number;
  interactive?: boolean;
  onClick?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
}

/**
 * Procedurally generates a high-resolution PBR label texture with typography,
 * barcode, nutritional metrics, holographic seal, and sci-fi telemetry.
 */
function createProceduralLabelCanvas(
  title = "OAT DAWN CLUSTERS",
  brand = "HELION PANTRY",
  accent = "#3cefff",
  vegan = "VEGAN CANDIDATE",
) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1536;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 1. Deep obsidian / cyber-matte background
  const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1536);
  bgGrad.addColorStop(0, "#081220");
  bgGrad.addColorStop(0.5, "#0b192e");
  bgGrad.addColorStop(1, "#050912");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 1536);

  // 2. Subtle tech grid
  ctx.strokeStyle = "rgba(60, 239, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let x = 40; x < 1024; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1536);
    ctx.stroke();
  }
  for (let y = 40; y < 1536; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // 3. Top holographic foil header
  const foilGrad = ctx.createLinearGradient(60, 60, 960, 160);
  foilGrad.addColorStop(0, "rgba(60, 239, 255, 0.2)");
  foilGrad.addColorStop(0.5, "rgba(143, 107, 255, 0.35)");
  foilGrad.addColorStop(1, "rgba(255, 176, 32, 0.2)");
  ctx.fillStyle = foilGrad;
  ctx.fillRect(60, 60, 904, 10);

  // 4. Brand & Sector telemetry
  ctx.fillStyle = "rgba(138, 160, 189, 0.9)";
  ctx.font = "bold 24px 'Courier New', monospace";
  ctx.fillText(`SECTOR 07 // ${brand.toUpperCase()}`, 80, 120);

  ctx.fillStyle = accent;
  ctx.font = "bold 20px 'Courier New', monospace";
  ctx.fillText("SPEC: FOOD-GRADE CARTRIDGE · REV 2.4", 80, 155);

  // 5. Main Product Display Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 68px sans-serif";
  ctx.fillText(title.toUpperCase(), 80, 260);

  // Accent underline
  ctx.fillStyle = accent;
  ctx.fillRect(80, 285, 360, 6);

  // Subtitle / mission
  ctx.fillStyle = "rgba(232, 244, 255, 0.75)";
  ctx.font = "28px sans-serif";
  ctx.fillText("Bio-Active Whole Grain Oats with Cane Sugar", 80, 335);
  ctx.fillText("Honest evidence & allergen-verified formula", 80, 375);

  // 6. Holographic Security Stamp (Center Circle)
  const cx = 512;
  const cy = 600;
  const rad = 130;
  const holoGrad = ctx.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, rad);
  holoGrad.addColorStop(0, "#ffffff");
  holoGrad.addColorStop(0.2, "#3cefff");
  holoGrad.addColorStop(0.5, "#8f6bff");
  holoGrad.addColorStop(0.8, "#ffb020");
  holoGrad.addColorStop(1, "#07101e");

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fillStyle = holoGrad;
  ctx.globalAlpha = 0.85;
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.stroke();

  // Seal inner text
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = "#050912";
  ctx.font = "900 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LABEL LENS", cx, cy - 15);
  ctx.fillText("VERIFIED", cx, cy + 20);
  ctx.font = "bold 14px monospace";
  ctx.fillText("EVIDENCE-LOCKED", cx, cy + 45);
  ctx.restore();

  // 7. Nutrition Facts Panel HUD
  ctx.strokeStyle = "rgba(60, 239, 255, 0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(80, 780, 864, 460);

  ctx.fillStyle = "rgba(60, 239, 255, 0.1)";
  ctx.fillRect(80, 780, 864, 50);

  ctx.fillStyle = "#3cefff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("TELEMETRY NUTRITION BREAKDOWN (PER 55g)", 105, 815);

  const stats = [
    ["CALORIES", "220 kcal", "FAT", "6.0 g"],
    ["PROTEIN", "6.0 g", "SAT FAT", "0.8 g"],
    ["FIBER", "5.0 g", "SODIUM", "140 mg"],
    ["TOTAL SUGARS", "9.0 g", "ADDED SUGARS", "8.0 g (ALERT)"],
  ];

  ctx.font = "bold 26px monospace";
  stats.forEach((row, idx) => {
    const y = 875 + idx * 75;
    ctx.fillStyle = "rgba(138, 160, 189, 0.85)";
    ctx.fillText(row[0], 105, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(row[1], 330, y);

    ctx.fillStyle = "rgba(138, 160, 189, 0.85)";
    ctx.fillText(row[2], 560, y);
    ctx.fillStyle = row[3].includes("ALERT") ? "#ffb020" : "#ffffff";
    ctx.fillText(row[3], 720, y);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.moveTo(105, y + 25);
    ctx.lineTo(920, y + 25);
    ctx.stroke();
  });

  // 8. Vegan & Allergen Badge
  ctx.fillStyle = "rgba(93, 255, 176, 0.15)";
  ctx.fillRect(80, 1280, 420, 60);
  ctx.strokeStyle = "#5dffb0";
  ctx.strokeRect(80, 1280, 420, 60);
  ctx.fillStyle = "#5dffb0";
  ctx.font = "bold 24px monospace";
  ctx.fillText(`● STATUS: ${vegan}`, 105, 1318);

  ctx.fillStyle = "rgba(255, 77, 109, 0.15)";
  ctx.fillRect(524, 1280, 420, 60);
  ctx.strokeStyle = "#ff4d6d";
  ctx.strokeRect(524, 1280, 420, 60);
  ctx.fillStyle = "#ff4d6d";
  ctx.fillText("▲ ALLERGEN: SOY, WHEAT", 545, 1318);

  // 9. Serial Barcode at the bottom
  ctx.fillStyle = "#ffffff";
  const bx = 80;
  const by = 1380;
  const barHeights = 70;
  const pattern = [2, 1, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3, 1, 2, 4, 3, 1, 2, 3, 4, 1, 2];
  let curX = bx;
  for (let i = 0; i < 4; i++) {
    pattern.forEach((w) => {
      ctx.fillRect(curX, by, w * 3, barHeights);
      curX += w * 3 + 4;
    });
  }
  ctx.fillStyle = "rgba(138, 160, 189, 0.8)";
  ctx.font = "18px monospace";
  ctx.fillText("8842-X09-EVID-2026 // HONEST OCR TARGET", bx, by + barHeights + 35);

  return canvas;
}

export function CinematicProduct({
  color = "#3cefff",
  accentColor = "#3cefff",
  brandText = "Helion Pantry",
  titleText = "Oat Dawn Clusters",
  customTextureUrl,
  scale = 1,
  openFactor = 0,
  scannerGlow = 0,
  floatSpeed = 1,
  interactive = true,
  onClick,
  onPointerOver,
  onPointerOut,
}: CinematicProductProps) {
  const groupRef = useRef<THREE.Group>(null);
  const frontMeshRef = useRef<THREE.Mesh>(null);
  const coreMeshRef = useRef<THREE.Mesh>(null);
  const targetRotation = useRef({ x: 0, y: 0 });

  // Custom uploaded or provided texture
  const [customTexture, setCustomTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!customTextureUrl) {
      setCustomTexture(null);
      return;
    }
    let isMounted = true;
    const loader = new THREE.TextureLoader();
    loader.load(
      customTextureUrl,
      (tex) => {
        if (!isMounted) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        setCustomTexture(tex);
      },
      undefined,
      (err) => {
        console.warn("Failed to load custom product texture:", err);
      }
    );
    return () => {
      isMounted = false;
      if (customTexture) customTexture.dispose();
    };
  }, [customTextureUrl]);

  // Generate procedural canvas texture fallback
  const texture = useMemo(() => {
    const canvas = createProceduralLabelCanvas(titleText, brandText, accentColor);
    if (!canvas) return null;
    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [titleText, brandText, accentColor]);

  // Clean up texture on unmount
  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  // Floating & subtle interaction lerp
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime * floatSpeed;

    // Levitation bobbing & breathing
    groupRef.current.position.y = Math.sin(t * 1.2) * 0.08;
    groupRef.current.rotation.y += delta * 0.12;
    groupRef.current.rotation.x = Math.sin(t * 0.8) * 0.04;

    // Exploded view transition
    if (frontMeshRef.current) {
      const targetZ = 0.22 + openFactor * 0.45;
      frontMeshRef.current.position.z += (targetZ - frontMeshRef.current.position.z) * 0.1;
    }

    // Glowing core rotation
    if (coreMeshRef.current) {
      coreMeshRef.current.rotation.x += delta * 0.6;
      coreMeshRef.current.rotation.y += delta * 0.8;
      const mat = coreMeshRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = 0.4 + Math.sin(t * 3.0) * 0.3 + scannerGlow * 0.8;
      }
    }
  });

  return (
    <group
      ref={groupRef}
      scale={scale}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* 1. Main Body: Chamfered high-tech food container */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[1.2, 1.8, 0.44]} />
        <meshPhysicalMaterial
          color="#0b172a"
          metalness={0.7}
          roughness={0.2}
          clearcoat={0.6}
          clearcoatRoughness={0.15}
          reflectivity={0.8}
        />
      </mesh>

      {/* 2. Top Metallic Crimped Closure Bar */}
      <mesh position={[0, 0.94, 0]}>
        <boxGeometry args={[1.24, 0.08, 0.48]} />
        <meshStandardMaterial
          color="#1e293b"
          metalness={0.92}
          roughness={0.18}
          emissive={accentColor}
          emissiveIntensity={0.15 + scannerGlow * 0.4}
        />
      </mesh>

      {/* 3. Bottom Pedestal Reinforcement */}
      <mesh position={[0, -0.93, 0]}>
        <boxGeometry args={[1.22, 0.06, 0.46]} />
        <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* 4. Top Corner Smart Sensor Node / NFC Disk */}
      <mesh position={[0.42, 0.76, 0.23]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.02, 32]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.6 + scannerGlow * 0.5}
          metalness={0.5}
        />
      </mesh>

      {/* 5. Front Label Panel (with custom uploaded texture or procedural high-res label texture) */}
      <group position={[0, 0, 0.225]}>
        <mesh ref={frontMeshRef}>
          <planeGeometry args={[1.14, 1.72]} />
          {customTexture ? (
            <meshBasicMaterial map={customTexture} toneMapped={false} />
          ) : texture ? (
            <meshBasicMaterial map={texture} toneMapped={false} />
          ) : (
            <meshStandardMaterial color="#0e1f38" metalness={0.5} roughness={0.3} />
          )}
        </mesh>
        {/* Holographic protective glass sheen */}
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[1.14, 1.72]} />
          <meshPhysicalMaterial
            transparent
            opacity={0.12}
            roughness={0.05}
            clearcoat={1.0}
            clearcoatRoughness={0.1}
            reflectivity={0.9}
            color={accentColor}
          />
        </mesh>
      </group>

      {/* 6. Back Diagnostic Grid Panel */}
      <mesh position={[0, 0, -0.225]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.14, 1.72]} />
        <meshStandardMaterial color="#08101e" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* 7. Internal Glowing Holographic Core (revealed in exploded view) */}
      <group position={[0, 0, 0]}>
        <mesh ref={coreMeshRef}>
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial
            color={accentColor}
            emissive={accentColor}
            emissiveIntensity={0.5}
            wireframe
          />
        </mesh>
        {openFactor > 0.05 && (
          <pointLight
            color={accentColor}
            intensity={1.5 * openFactor}
            distance={2.5}
            decay={2}
          />
        )}
      </group>

      {/* 8. Laser Edges / Perimeter Glow Frame */}
      <lineSegments position={[0, 0, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(1.21, 1.81, 0.45)]} />
        <lineBasicMaterial
          color={accentColor}
          transparent
          opacity={0.3 + scannerGlow * 0.5}
        />
      </lineSegments>
    </group>
  );
}
