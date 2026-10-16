"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HoloRingShader, ScannerBeamShader } from "../shaders/customShaders";

interface ScannerChamberProps {
  active?: boolean;
  scanProgress?: number; // 0 to 1
  beamColor?: string;
  intensity?: number;
}

export function ScannerChamber({
  active = true,
  scanProgress,
  beamColor = "#3cefff",
  intensity = 1.0,
}: ScannerChamberProps) {
  const outerRingRef = useRef<THREE.Group>(null);
  const midRingRef = useRef<THREE.Group>(null);
  const innerRingRef = useRef<THREE.Group>(null);
  const beamMeshRef = useRef<THREE.Mesh>(null);

  // Custom shader materials
  const beamMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(beamColor) },
        uIntensity: { value: intensity },
        uScanProgress: { value: 0.5 },
      },
      vertexShader: ScannerBeamShader.vertexShader,
      fragmentShader: ScannerBeamShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [beamColor, intensity]);

  const ringMatOuter = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(beamColor) },
        uSpeed: { value: 0.8 },
        uSegments: { value: 36.0 },
      },
      vertexShader: HoloRingShader.vertexShader,
      fragmentShader: HoloRingShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [beamColor]);

  const ringMatMid = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color("#8f6bff") },
        uSpeed: { value: -1.2 },
        uSegments: { value: 24.0 },
      },
      vertexShader: HoloRingShader.vertexShader,
      fragmentShader: HoloRingShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, []);

  const ringMatInner = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(beamColor) },
        uSpeed: { value: 1.6 },
        uSegments: { value: 16.0 },
      },
      vertexShader: HoloRingShader.vertexShader,
      fragmentShader: HoloRingShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [beamColor]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Update shader uniforms
    beamMat.uniforms.uTime.value = t;
    ringMatOuter.uniforms.uTime.value = t;
    ringMatMid.uniforms.uTime.value = t;
    ringMatInner.uniforms.uTime.value = t;

    // Multi-axis concentric gimbal rotation
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z += delta * (active ? 0.35 : 0.08);
      outerRingRef.current.rotation.y = Math.sin(t * 0.4) * 0.15;
    }
    if (midRingRef.current) {
      midRingRef.current.rotation.z -= delta * (active ? 0.55 : 0.12);
      midRingRef.current.rotation.x = Math.cos(t * 0.5) * 0.22;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z += delta * (active ? 0.85 : 0.18);
      innerRingRef.current.rotation.y = Math.cos(t * 0.6) * 0.28;
    }

    // Laser beam sweep
    if (beamMeshRef.current) {
      beamMeshRef.current.visible = active;
      if (typeof scanProgress === "number") {
        beamMeshRef.current.position.y = (scanProgress - 0.5) * 2.2;
      } else if (active) {
        beamMeshRef.current.position.y = Math.sin(t * 2.8) * 0.95;
      }
    }
  });

  return (
    <group>
      {/* 1. Concentric Holographic Gimbal Rings */}
      <group ref={outerRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <mesh material={ringMatOuter}>
          <planeGeometry args={[5.2, 5.2]} />
        </mesh>
        {/* Physical outer carbon guide rail */}
        <mesh>
          <torusGeometry args={[2.5, 0.02, 16, 96]} />
          <meshStandardMaterial color="#0f1b2c" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      <group ref={midRingRef} rotation={[Math.PI / 2.2, 0, 0.4]}>
        <mesh material={ringMatMid}>
          <planeGeometry args={[4.2, 4.2]} />
        </mesh>
        <mesh>
          <torusGeometry args={[2.0, 0.018, 16, 96]} />
          <meshStandardMaterial color="#1a1c35" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      <group ref={innerRingRef} rotation={[Math.PI / 1.8, 0, -0.6]}>
        <mesh material={ringMatInner}>
          <planeGeometry args={[3.2, 3.2]} />
        </mesh>
        <mesh>
          <torusGeometry args={[1.5, 0.016, 16, 96]} />
          <meshStandardMaterial color="#0f263e" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      {/* 2. Sweeping Laser Plane with Volumetric Glow */}
      <mesh ref={beamMeshRef} position={[0, 0, 0]} material={beamMat} rotation={[0, 0, 0]}>
        <planeGeometry args={[2.8, 0.45]} />
      </mesh>

      {/* 3. Physical Overhead Emitter Dome */}
      <group position={[0, 2.6, 0]}>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.65, 0.35, 32, 1, true]} />
          <meshStandardMaterial color="#0a1424" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.04, 32]} />
          <meshStandardMaterial
            color={beamColor}
            emissive={beamColor}
            emissiveIntensity={active ? 1.8 : 0.3}
          />
        </mesh>
        <spotLight
          position={[0, 0, 0]}
          target-position={[0, 0, 0]}
          color={beamColor}
          intensity={active ? 4.5 : 0.8}
          angle={0.65}
          penumbra={0.8}
          distance={6.5}
        />
      </group>

      {/* 4. Fine Atmospheric Scanner Particles */}
      <ScannerDust active={active} />
    </group>
  );
}

function ScannerDust({ active }: { active: boolean }) {
  const count = 60;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 3.6,
      y: (Math.random() - 0.5) * 3.2,
      z: (Math.random() - 0.5) * 2.8,
      speed: 0.2 + Math.random() * 0.6,
      scale: 0.015 + Math.random() * 0.025,
      offset: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    particles.forEach((p, i) => {
      const curY = ((p.y + t * p.speed * (active ? 0.8 : 0.2) + 2.0) % 4.0) - 2.0;
      dummy.position.set(
        p.x + Math.sin(t * 0.5 + p.offset) * 0.15,
        curY,
        p.z + Math.cos(t * 0.5 + p.offset) * 0.15,
      );
      dummy.scale.setScalar(p.scale * (active ? 1.3 : 0.8));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#3cefff" transparent opacity={0.65} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  );
}
