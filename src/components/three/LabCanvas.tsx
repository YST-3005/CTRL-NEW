"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { useGuardianStore } from "@/stores/useGuardianStore";

function WebGLFallback() {
  return (
    <div
      role="img"
      aria-label="3D laboratory unavailable. Showing schematic fallback."
      className="flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-6 text-center text-sm text-slate-300"
    >
      WebGL is unavailable. The laboratory HUD continues in 2D schematic mode.
    </div>
  );
}

export function LabCanvas({
  children,
  className = "h-[280px] md:h-[360px]",
  autoRotate = true,
}: {
  children: ReactNode;
  className?: string;
  autoRotate?: boolean;
}) {
  const motion = useGuardianStore((s) => s.prefs.motion);
  const wrap = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    setWebgl(Boolean(gl));
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (webgl === false) return <WebGLFallback />;

  const loop = motion === "reduced" || !visible ? "demand" : "always";

  return (
    <div ref={wrap} className={`lab-viewport relative overflow-hidden rounded-2xl ${className}`}>
      <Canvas
        dpr={[1, 1.4]}
        camera={{ position: [0, 1.35, 4.6], fov: 40 }}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
        frameloop={loop}
      >
        <color attach="background" args={["#050814"]} />
        <fog attach="fog" args={["#050814", 6, 14]} />
        <ambientLight intensity={0.28} />
        <pointLight position={[4, 6, 3]} intensity={1.35} color="#3cefff" />
        <pointLight position={[-5, -1.5, -3]} intensity={0.7} color="#8f6bff" />
        <spotLight position={[0, 5, 2]} angle={0.45} intensity={0.55} color="#9fdfff" />
        
<Suspense
  fallback={
    <group position={[0, 0, 0]}>
      {/* Lightweight 3D loading indicator; no HTML portal */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.36, 48]} />
        <meshBasicMaterial
          color="#3cefff"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh>
        <icosahedronGeometry args={[0.18, 1]} />
        <meshStandardMaterial
          color="#8f6bff"
          emissive="#3cefff"
          emissiveIntensity={0.7}
          metalness={0.4}
          roughness={0.25}
        />
      </mesh>
    </group>
  }
>
  <ChamberFloor />
  {children}
</Suspense>

        <OrbitControls
          enablePan={false}
          autoRotate={autoRotate && motion === "full" && visible}
          autoRotateSpeed={0.55}
          minDistance={3.2}
          maxDistance={7}
        />
      </Canvas>
    </div>
  );
}

function ChamberFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]} receiveShadow>
        <circleGeometry args={[3.4, 64]} />
        <meshStandardMaterial color="#07101c" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.14, 0]}>
        <ringGeometry args={[1.55, 1.62, 64]} />
        <meshBasicMaterial color="#3cefff" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

export function PackageMesh({ color = "#3cefff", scale = 1 }: { color?: string; scale?: number }) {
  return (
    <Float speed={1.15} rotationIntensity={0.18} floatIntensity={0.28}>
      <group scale={scale}>
        {/* Main Body with PBR Physical Material */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.15, 1.65, 0.44]} />
          <meshPhysicalMaterial
            color="#0b172a"
            metalness={0.7}
            roughness={0.2}
            clearcoat={0.6}
            clearcoatRoughness={0.15}
          />
        </mesh>
        {/* Top Metallic Closure Bar */}
        <mesh position={[0, 0.86, 0]}>
          <boxGeometry args={[1.2, 0.08, 0.48]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.15} emissive={color} emissiveIntensity={0.2} />
        </mesh>
        {/* Front High-Tech Label Plane */}
        <mesh position={[0, 0, 0.225]}>
          <planeGeometry args={[1.05, 1.55]} />
          <meshStandardMaterial color="#071424" metalness={0.5} roughness={0.25} />
        </mesh>
        {/* Top Accent Strip */}
        <mesh position={[0, 0.55, 0.23]}>
          <planeGeometry args={[0.85, 0.12]} />
          <meshBasicMaterial color={color} />
        </mesh>
        {/* Holographic Security Chip */}
        <mesh position={[0.3, 0.65, 0.232]}>
          <circleGeometry args={[0.08, 32]} />
          <meshBasicMaterial color={color} />
        </mesh>
        {/* Barcode Lines */}
        <mesh position={[0, -0.55, 0.23]}>
          <planeGeometry args={[0.85, 0.18]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
        {/* Perimeter Glow Laser Frame */}
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(1.16, 1.66, 0.45)]} />
          <lineBasicMaterial color={color} transparent opacity={0.4} />
        </lineSegments>
      </group>
    </Float>
  );
}

export function RingField({ active = false }: { active?: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.z += dt * (active ? 0.35 : 0.08);
    group.current.rotation.y += dt * (active ? 0.12 : 0.03);
  });
  return (
    <group ref={group}>
      {[1.35, 1.85, 2.35].map((r, i) => (
        <mesh key={r} rotation={[Math.PI / 2, 0, i * 0.35]}>
          <torusGeometry args={[r, 0.012, 8, 96]} />
          <meshBasicMaterial color={active ? "#3cefff" : "#2a4464"} transparent opacity={active ? 0.92 : 0.32} />
        </mesh>
      ))}
    </group>
  );
}

export function ScanBeam({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.visible = active;
    if (!active) return;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 2.8) * 0.85;
  });
  return (
    <mesh ref={ref} position={[0, 0, 0.35]}>
      <planeGeometry args={[2.6, 0.25]} />
      <meshBasicMaterial color="#3cefff" transparent opacity={0.9} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function ParticleField({ active = false, count = 40 }: { active?: boolean; count?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    if (!mesh.current) return;
    for (let i = 0; i < count; i++) {
      const t = state.clock.elapsedTime * (active ? 0.35 : 0.12) + i;
      dummy.position.set(Math.cos(t + i) * 1.7, Math.sin(t * 0.8 + i) * 0.95, Math.sin(t + i * 0.4) * 1.55);
      dummy.scale.setScalar(active ? 0.045 : 0.028);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#8f6bff" transparent opacity={0.55} />
    </instancedMesh>
  );
}

export function IdentityCore({ scanning = false }: { scanning?: boolean }) {
  const inner = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (inner.current) inner.current.rotation.y += dt * (scanning ? 1.4 : 0.35);
  });
  return (
    <group>
      <RingField active={scanning} />
      <mesh ref={inner}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color="#8f6bff" emissive="#3cefff" emissiveIntensity={scanning ? 0.6 : 0.2} metalness={0.4} roughness={0.2} />
      </mesh>
      <ParticleField active={scanning} count={28} />
    </group>
  );
}

export function AssistantOrb({ thinking = false }: { thinking?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  useFrame((s, dt) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime;
    const k = thinking ? 1.2 : 0.45;
    const pulse = 0.9 + Math.sin(t * (thinking ? 8 : 2)) * 0.1;
    ref.current.scale.setScalar(pulse);
    (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = k;

    if (coreRef.current) {
      coreRef.current.rotation.x += dt * (thinking ? 3.0 : 0.8);
      coreRef.current.rotation.y += dt * (thinking ? 4.0 : 1.2);
    }
  });
  return (
    <group>
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.7, 2]} />
        <meshStandardMaterial
          color="#3cefff"
          emissive="#3cefff"
          wireframe
          metalness={0.8}
          roughness={0.15}
        />
      </mesh>
      {/* Inner Rotating Quantum Core */}
      <mesh ref={coreRef}>
        <octahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial
          color="#8f6bff"
          emissive="#8f6bff"
          emissiveIntensity={thinking ? 1.6 : 0.7}
          metalness={0.5}
          roughness={0.2}
        />
      </mesh>
      <RingField active={thinking} />
      <ParticleField active={thinking} count={32} />
    </group>
  );
}

export function PortionDial({ factor = 1 }: { factor: number }) {
  const needle = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!needle.current) return;
    const target = Math.min(Math.max(factor, 0.1), 3) * 0.9 - 1.4;
    needle.current.rotation.z += (target - needle.current.rotation.z) * 0.08;
  });
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.1, 0.06, 12, 64]} />
        <meshStandardMaterial color="#16324c" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh ref={needle} position={[0, 0, 0.05]}>
        <boxGeometry args={[0.9, 0.04, 0.04]} />
        <meshBasicMaterial color="#ffb020" />
      </mesh>
      <PackageMesh scale={0.45 + Math.min(factor, 2) * 0.2} />
    </group>
  );
}

export function ComparePods({ accentLeft = "#3cefff", accentRight = "#8f6bff" }: { accentLeft?: string; accentRight?: string }) {
  return (
    <group>
      <group position={[-1.25, 0, 0]}>
        <PackageMesh color={accentLeft} scale={0.78} />
        <mesh position={[0, -0.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.62, 48]} />
          <meshBasicMaterial color={accentLeft} transparent opacity={0.65} />
        </mesh>
      </group>
      <group position={[1.25, 0, 0]}>
        <PackageMesh color={accentRight} scale={0.78} />
        <mesh position={[0, -0.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.62, 48]} />
          <meshBasicMaterial color={accentRight} transparent opacity={0.65} />
        </mesh>
      </group>
      {/* Central Laser Divider Plane */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.04, 1.8]} />
        <meshBasicMaterial color="#ffb020" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function statusColor(status: string) {
  if (status === "VEGAN") return "#5dffb0";
  if (status === "NON-VEGAN") return "#ff4d6d";
  return "#ffb020";
}

export function OriginNodes({
  items,
}: {
  items: { name: string; status: string }[];
}) {
  const nodes = items.slice(0, 12);
  return (
    <group>
      <RingField active />
      {nodes.map((item, i) => {
        const a = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
        const color = statusColor(item.status);
        return (
          <group key={`${item.name}-${i}`} position={[Math.cos(a) * 1.7, Math.sin(a * 0.55) * 0.55, Math.sin(a) * 1.7]}>
            <mesh>
              <sphereGeometry args={[0.11, 16, 16]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[0.008, 0.008, 1.55, 6]} />
              <meshBasicMaterial color={color} transparent opacity={0.28} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function ControlRings({ armed = 0 }: { armed?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * (0.12 + armed * 0.05);
  });
  return (
    <group ref={ref}>
      <RingField active={armed > 0} />
      <mesh>
        <torusGeometry args={[0.85, 0.04, 12, 48]} />
        <meshStandardMaterial color={armed > 2 ? "#ff4d6d" : "#3cefff"} metalness={0.5} roughness={0.25} />
      </mesh>
      <IdentityCore scanning={armed > 0} />
    </group>
  );
}

export function TransmissionPulse({ active = false }: { active?: boolean }) {
  const ringRef1 = useRef<THREE.Mesh>(null);
  const ringRef2 = useRef<THREE.Mesh>(null);
  const dishRef = useRef<THREE.Group>(null);

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    if (ringRef1.current) {
      const k1 = active ? ((t * 1.5) % 2.0) : 0.2;
      ringRef1.current.scale.setScalar(0.8 + k1 * 1.4);
      (ringRef1.current.material as THREE.MeshBasicMaterial).opacity = active ? Math.max(0, 0.7 - k1 * 0.35) : 0.15;
    }
    if (ringRef2.current) {
      const k2 = active ? (((t * 1.5) + 1.0) % 2.0) : 0.2;
      ringRef2.current.scale.setScalar(0.8 + k2 * 1.4);
      (ringRef2.current.material as THREE.MeshBasicMaterial).opacity = active ? Math.max(0, 0.7 - k2 * 0.35) : 0.15;
    }
    if (dishRef.current) {
      dishRef.current.rotation.y += dt * (active ? 2.5 : 0.4);
    }
  });

  return (
    <group>
      {/* Expanding Concentric Telemetry Transmission Waves */}
      <mesh ref={ringRef1} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 0.94, 64]} />
        <meshBasicMaterial color="#ffb020" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ringRef2} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 0.94, 64]} />
        <meshBasicMaterial color="#3cefff" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Rotating Parabolic Dish Transmitter */}
      <group ref={dishRef} position={[0, 0.3, 0]}>
        <mesh rotation={[Math.PI * 0.35, 0, 0]}>
          <coneGeometry args={[0.5, 0.25, 32, 1, true]} />
          <meshStandardMaterial color="#0e1f38" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.1, 0.15]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial
            color={active ? "#ffb020" : "#3cefff"}
            emissive={active ? "#ffb020" : "#3cefff"}
            emissiveIntensity={active ? 1.8 : 0.4}
          />
        </mesh>
      </group>
      <IdentityCore scanning={active} />
    </group>
  );
}

export function HistoryOrbit({ count = 0 }: { count?: number }) {
  const n = Math.min(Math.max(count, 2), 8);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += dt * 0.18;
    }
  });

  return (
    <group ref={groupRef}>
      <RingField active={count > 0} />
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 2.0, Math.sin(a * 2.0) * 0.2, Math.sin(a) * 2.0]}>
            <mesh rotation={[0, -a, 0]}>
              <boxGeometry args={[0.3, 0.45, 0.12]} />
              <meshStandardMaterial
                color="#0b172a"
                metalness={0.7}
                roughness={0.3}
                emissive="#3cefff"
                emissiveIntensity={0.25}
              />
            </mesh>
            <mesh position={[0, 0, 0.065]} rotation={[0, -a, 0]}>
              <planeGeometry args={[0.22, 0.35]} />
              <meshBasicMaterial color="#3cefff" transparent opacity={0.3} />
            </mesh>
            <line>
              <bufferGeometry
                attach="geometry"
                onUpdate={(geo) => {
                  geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
                }}
              />
              <lineBasicMaterial color="#3cefff" transparent opacity={0.2} />
            </line>
          </group>
        );
      })}
    </group>
  );
}
