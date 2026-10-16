"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { useGuardianStore } from "@/stores/useGuardianStore";

export interface ExplodedIngredientItem {
  id: string;
  name: string;
  category: "safe" | "concern" | "uncertain";
  statusText: string;
  evidence: string;
}

interface ExplodedIngredientFieldProps {
  mode?: "reveal" | "understand";
  activeIngredientId?: string | null;
  onSelectIngredient?: (id: string) => void;
  ingredients?: ExplodedIngredientItem[];
}

const DEMO_INGREDIENTS: ExplodedIngredientItem[] = [
  { id: "ing-1", name: "Whole Grain Oats", category: "safe", statusText: "VEGAN (VERIFIED)", evidence: "Plant-derived grain base" },
  { id: "ing-2", name: "Cane Sugar", category: "uncertain", statusText: "UNKNOWN (BONE CHAR)", evidence: "Refining method undisclosed" },
  { id: "ing-3", name: "Sunflower Oil", category: "safe", statusText: "VEGAN (VERIFIED)", evidence: "Pressed seed origin" },
  { id: "ing-4", name: "Natural Flavors", category: "uncertain", statusText: "UNKNOWN ORIGIN", evidence: "Undisclosed multi-source compound" },
  { id: "ing-5", name: "Soy Lecithin", category: "concern", statusText: "ALLERGEN (SOY)", evidence: "Major allergen declared" },
  { id: "ing-6", name: "Salt", category: "safe", statusText: "MINERAL (SAFE)", evidence: "Inorganic mineral source" },
];

export function ExplodedIngredientField({
  mode = "reveal",
  activeIngredientId,
  onSelectIngredient,
  ingredients,
}: ExplodedIngredientFieldProps) {
  const storeSelected = useGuardianStore((s) => s.selectedIngredientId);
  const setStoreSelected = useGuardianStore((s) => s.selectIngredient);
  const activeId = activeIngredientId ?? storeSelected;

  const groupRef = useRef<THREE.Group>(null);
  const items = useMemo(
    () => (ingredients && ingredients.length > 0 ? ingredients : DEMO_INGREDIENTS),
    [ingredients],
  );

  const nodeLayout = useMemo(() => {
    return items.map((item, index) => {
      let targetX = 0;
      let targetY = 0;
      let targetZ = 0;
      let color = "#3cefff";

      if (item.category === "safe") color = "#5dffb0";
      else if (item.category === "concern") color = "#ff4d6d";
      else color = "#ffb020";

      if (mode === "reveal") {
        const angle = (index / items.length) * Math.PI * 2;
        const radius = 2.2 + (index % 2) * 0.35;
        targetX = Math.cos(angle) * radius;
        targetY = Math.sin(angle) * 1.05;
        targetZ = Math.sin(angle * 2.0) * 0.7 + 0.3;
      } else if (item.category === "safe") {
        const safeIndex = items.filter((x, i) => i <= index && x.category === "safe").length - 1;
        const row = Math.floor(safeIndex / 2);
        const col = safeIndex % 2;
        targetX = -2.3 - col * 0.55;
        targetY = 0.8 - row * 0.5;
        targetZ = col === 0 ? 0.2 : -0.2;
      } else if (item.category === "uncertain") {
        const uncertIndex = items.filter((x, i) => i <= index && x.category === "uncertain").length - 1;
        targetX = (uncertIndex - 0.5) * 0.8;
        targetY = 1.75;
        targetZ = 0.3;
      } else {
        const alertIndex = items.filter((x, i) => i <= index && x.category === "concern").length - 1;
        const row = Math.floor(alertIndex / 2);
        const col = alertIndex % 2;
        targetX = 2.3 + col * 0.55;
        targetY = 0.8 - row * 0.5;
        targetZ = col === 0 ? 0.2 : -0.2;
      }

      return {
        ...item,
        targetPos: new THREE.Vector3(targetX, targetY, targetZ),
        color,
      };
    });
  }, [items, mode]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.05;
  });

  return (
    <group ref={groupRef}>
      {nodeLayout.map((node) => (
        <IngredientNode
          key={node.id}
          node={node}
          isSelected={activeId === node.id}
          onClick={() => {
            setStoreSelected(node.id);
            onSelectIngredient?.(node.id);
          }}
        />
      ))}
    </group>
  );
}

function IngredientNode({
  node,
  isSelected,
  onClick,
}: {
  node: {
    id: string;
    name: string;
    category: "safe" | "concern" | "uncertain";
    statusText: string;
    evidence: string;
    targetPos: THREE.Vector3;
    color: string;
  };
  isSelected: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const currentPos = useRef(node.targetPos.clone());

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    currentPos.current.lerp(node.targetPos, Math.min(delta * 3.5, 1));
    meshRef.current.position.copy(currentPos.current);
  });

  return (
    <group ref={meshRef}>
      <mesh onClick={onClick}>
        <sphereGeometry args={[isSelected ? 0.12 : 0.08, 16, 16]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={isSelected ? 1.5 : 0.6}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {(isSelected || node.category === "concern") && (
        <mesh rotation={[Math.PI / 2, 0, 0]} onClick={onClick}>
          <ringGeometry args={[0.16, 0.19, 32]} />
          <meshBasicMaterial color={node.color} transparent opacity={0.7} />
        </mesh>
      )}

      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(0, -node.targetPos.y, -node.targetPos.z),
            ]);
          }}
        />
        <lineBasicMaterial
          color={node.color}
          transparent
          opacity={isSelected ? 0.85 : 0.22}
          linewidth={isSelected ? 2 : 1}
        />
      </line>

      {/* Use native 3D text instead of drei <Html>, avoiding its separate DOM root. */}
      <group position={[0, 0.22, 0]} onClick={onClick}>
        <mesh position={[0, -0.12, -0.025]} onClick={onClick}>
          <planeGeometry args={[1.9, isSelected ? 0.72 : 0.52]} />
          <meshBasicMaterial
            color={isSelected ? "#062a35" : node.category === "concern" ? "#300b18" : "#07111d"}
            transparent
            opacity={0.92}
            depthWrite={false}
          />
        </mesh>
        <Text
          position={[0, 0.07, 0]}
          fontSize={0.105}
          maxWidth={1.75}
          anchorX="center"
          anchorY="middle"
          textAlign="center"
          color="#ffffff"
          outlineWidth={0.003}
          outlineColor="#06101a"
          onClick={onClick}
        >
          {node.name}
        </Text>
        <Text
          position={[0, -0.075, 0.005]}
          fontSize={0.062}
          maxWidth={1.75}
          anchorX="center"
          anchorY="middle"
          textAlign="center"
          color={node.color}
          onClick={onClick}
        >
          {node.statusText}
        </Text>
        {isSelected && (
          <Text
            position={[0, -0.22, 0.005]}
            fontSize={0.052}
            maxWidth={1.75}
            anchorX="center"
            anchorY="middle"
            textAlign="center"
            color="#cbd5e1"
            onClick={onClick}
          >
            {`Evidence: ${node.evidence}`}
          </Text>
        )}
      </group>
    </group>
  );
}
