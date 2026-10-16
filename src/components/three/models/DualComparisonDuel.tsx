"use client";

import { useMemo } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

// This version intentionally avoids drei's <Html> overlay. Html creates a separate
// DOM root and can trigger a synchronous-unmount warning during concurrent renders.
type ProductLike = {
  name?: string;
  brand?: string;
} | null;

type Props = {
  leftProduct: ProductLike;
  rightProduct: ProductLike;
};

export function DualComparisonDuel({ leftProduct, rightProduct }: Props) {
  const leftName = leftProduct?.name ?? "Select Product A";
  const rightName = rightProduct?.name ?? "Select Product B";
  const leftBrand = leftProduct?.brand ?? "";
  const rightBrand = rightProduct?.brand ?? "";

  return (
    <group>
      <ComparisonPod
        position={[-1.5, 0, 0]}
        accent="#3cefff"
        label="POD ALPHA"
        productName={leftName}
        brand={leftBrand}
      />
      <ComparisonPod
        position={[1.5, 0, 0]}
        accent="#8f6bff"
        label="POD BETA"
        productName={rightName}
        brand={rightBrand}
      />
      <mesh position={[0, -1.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.15, 64]} />
        <meshBasicMaterial color="#31506d" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

function ComparisonPod({
  position,
  accent,
  label,
  productName,
  brand,
}: {
  position: [number, number, number];
  accent: string;
  label: string;
  productName: string;
  brand: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.2 + position[0]) * 0.035;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <cylinderGeometry args={[0.7, 0.85, 1.25, 8, 1, false]} />
        <meshStandardMaterial color="#101a2b" metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.64, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 0.08, 8]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>
      <mesh position={[0, -0.65, 0]}>
        <cylinderGeometry args={[0.84, 0.84, 0.08, 8]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.6} />
      </mesh>

      <Text
        position={[0, -1.15, 0.08]}
        fontSize={0.13}
        color={accent}
        anchorX="center"
        anchorY="middle"
        maxWidth={2.3}
        textAlign="center"
      >
        {label}
      </Text>
      <Text
        position={[0, -1.38, 0.08]}
        fontSize={0.115}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={2.5}
        textAlign="center"
        overflowWrap="break-word"
      >
        {productName}
      </Text>
      {brand ? (
        <Text
          position={[0, -1.58, 0.08]}
          fontSize={0.085}
          color="#9caec5"
          anchorX="center"
          anchorY="middle"
          maxWidth={2.4}
          textAlign="center"
          overflowWrap="break-word"
        >
          {brand}
        </Text>
      ) : null}
    </group>
  );
}
