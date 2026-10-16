"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ForcefieldShader } from "../shaders/customShaders";
import { CinematicProduct } from "./CinematicProduct";

interface VolumetricServingChamberProps {
  factor?: number; // scale factor (e.g. 0.5 to 3.0)
  hasAlert?: boolean; // triggers forcefield red alert
  alertSeverity?: "safe" | "warning" | "alert";
}

export function VolumetricServingChamber({
  factor = 1.0,
  hasAlert = false,
  alertSeverity = "safe",
}: VolumetricServingChamberProps) {
  const needleRef = useRef<THREE.Mesh>(null);
  const forcefieldRef = useRef<THREE.Mesh>(null);
  const liquidRef = useRef<THREE.Mesh>(null);
  const currentFactor = useRef(factor);

  const clampedFactor = Math.min(Math.max(factor, 0.2), 3.0);

  // Forcefield shader material
  const shieldMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new THREE.Color("#3cefff") },
        uAlertColor: { value: new THREE.Color("#ff4d6d") },
        uAlertFactor: { value: hasAlert || alertSeverity === "alert" ? 1.0 : 0.0 },
        uIntensity: { value: 0.9 },
      },
      vertexShader: ForcefieldShader.vertexShader,
      fragmentShader: ForcefieldShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
  }, [hasAlert, alertSeverity]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Smooth lerp factor
    currentFactor.current += (clampedFactor - currentFactor.current) * delta * 5.0;

    // Update needle rotation on graduation dial
    if (needleRef.current) {
      // Maps factor 0.2..3.0 to rotation angles -Math.PI * 0.45 to Math.PI * 0.45
      const angle = ((currentFactor.current - 0.2) / 2.8) * Math.PI * 0.9 - Math.PI * 0.45;
      needleRef.current.rotation.z = -angle;
    }

    // Forcefield uniform updates
    shieldMat.uniforms.uTime.value = t;
    const targetAlert = alertSeverity === "alert" ? 1.0 : alertSeverity === "warning" ? 0.5 : 0.0;
    shieldMat.uniforms.uAlertFactor.value +=
      (targetAlert - shieldMat.uniforms.uAlertFactor.value) * delta * 4.0;

    // Animated liquid/granule volume height
    if (liquidRef.current) {
      liquidRef.current.scale.y = 0.2 + currentFactor.current * 0.4;
      liquidRef.current.position.y = -0.8 + (liquidRef.current.scale.y * 0.8) / 2;
    }
  });

  return (
    <group>
      {/* 1. Volumetric Cylindrical Containment Field */}
      <mesh ref={forcefieldRef} position={[0, 0, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 2.6, 48, 1, true]} />
        <primitive object={shieldMat} attach="material" />
      </mesh>

      {/* 2. Top and Bottom Chamber Flanges */}
      <mesh position={[0, 1.3, 0]}>
        <torusGeometry args={[1.5, 0.04, 16, 64]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, -1.3, 0]}>
        <torusGeometry args={[1.5, 0.05, 16, 64]} />
        <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* 3. Base Graduation Scale Ring with Needle Dial */}
      <group position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <ringGeometry args={[1.1, 1.45, 64]} />
          <meshBasicMaterial color="#0b172a" />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <ringGeometry args={[1.38, 1.42, 64]} />
          <meshBasicMaterial color="#3cefff" transparent opacity={0.5} />
        </mesh>
        {/* Needle indicator */}
        <group ref={needleRef} position={[0, 0, 0.02]}>
          <mesh position={[0, 0.65, 0]}>
            <coneGeometry args={[0.04, 0.25, 16]} />
            <meshBasicMaterial color="#ffb020" />
          </mesh>
        </group>
      </group>

      {/* 4. Scaling Product Model */}
      <group position={[0, 0.1, 0]}>
        <CinematicProduct
          scale={0.55 + clampedFactor * 0.22}
          accentColor={alertSeverity === "alert" ? "#ff4d6d" : alertSeverity === "warning" ? "#ffb020" : "#3cefff"}
          scannerGlow={0.3}
        />
      </group>

      {/* 5. Holographic Volume Level Grid Ring */}
      <mesh position={[0, -0.6 + clampedFactor * 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 0.95, 48]} />
        <meshBasicMaterial
          color={alertSeverity === "alert" ? "#ff4d6d" : "#5dffb0"}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}
