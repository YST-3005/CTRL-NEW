import * as THREE from "three";

/**
 * Custom GLSL Shader for the Volumetric Holographic Scanner Beam
 */
export const ScannerBeamShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#3cefff") },
    uIntensity: { value: 1.0 },
    uScanProgress: { value: 0.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uScanProgress;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
      // Coordinate along beam height
      float y = vUv.y;
      
      // Intense central laser slice
      float center = 1.0 - abs(y - 0.5) * 2.0;
      float core = pow(clamp(center, 0.0, 1.0), 6.0) * 2.2;
      
      // Secondary soft diffusion fringe
      float glow = pow(clamp(center, 0.0, 1.0), 2.0) * 0.7;
      
      // Moving high-frequency energy ripples
      float ripple = sin(vUv.x * 40.0 - uTime * 8.0) * 0.15 + 0.85;
      float microScan = sin(vWorldPosition.y * 120.0 + uTime * 12.0) * 0.08 + 0.92;
      
      // Soft edge falloff horizontally
      float xFade = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
      
      float alpha = (core + glow) * ripple * microScan * xFade * uIntensity;
      
      // Chromatic fringe: shift edge color slightly towards violet
      vec3 col = mix(uColor, vec3(0.56, 0.42, 1.0), pow(1.0 - clamp(center, 0.0, 1.0), 3.0) * 0.6);
      col += vec3(0.4, 0.8, 1.0) * core; // extra brightness at peak
      
      gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.95));
    }
  `,
};

/**
 * Custom GLSL Shader for Holographic Rings with Data Segments
 */
export const HoloRingShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#3cefff") },
    uSpeed: { value: 1.0 },
    uSegments: { value: 24.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uSpeed;
    uniform float uSegments;
    varying vec2 vUv;

    #define PI 3.14159265359

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered) * 2.0;
      
      // Ring boundary
      float ring = smoothstep(0.78, 0.82, dist) * smoothstep(1.0, 0.96, dist);
      
      // Angular calculation
      float angle = atan(centered.y, centered.x);
      if (angle < 0.0) angle += PI * 2.0;
      
      // Segmented ticks
      float segment = sin(angle * uSegments + uTime * uSpeed * 2.5);
      segment = smoothstep(-0.2, 0.2, segment);
      
      // Orbiting pulse beam
      float pulse = sin(angle - uTime * uSpeed * 3.0);
      pulse = pow(clamp(pulse * 0.5 + 0.5, 0.0, 1.0), 8.0);
      
      float alpha = ring * (0.35 + 0.55 * segment + 1.2 * pulse);
      vec3 finalColor = mix(uColor, vec3(1.0, 1.0, 1.0), pulse * 0.7);
      
      gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 0.95));
    }
  `,
};

/**
 * Custom GLSL Shader for Sci-Fi Chamber Floor Grid with Radar Sweep
 */
export const HoloGridFloorShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#3cefff") },
    uSecondaryColor: { value: new THREE.Color("#8f6bff") },
    uGridSize: { value: 1.0 },
    uRadarSpeed: { value: 0.6 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uSecondaryColor;
    uniform float uGridSize;
    uniform float uRadarSpeed;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
      vec2 pos = vWorldPosition.xz;
      float dist = length(pos);
      
      // Minor and major grid lines
      vec2 grid = abs(fract(pos / uGridSize - 0.5) - 0.5) / fwidth(pos / uGridSize);
      float line = min(grid.x, grid.y);
      float c = 1.0 - min(line, 1.0);
      
      vec2 majorGrid = abs(fract(pos / (uGridSize * 4.0) - 0.5) - 0.5) / fwidth(pos / (uGridSize * 4.0));
      float majorLine = min(majorGrid.x, majorGrid.y);
      float majorC = 1.0 - min(majorLine, 1.0);
      
      // Expanding radar pulse wave
      float wave = mod(dist - uTime * uRadarSpeed * 2.0, 6.0);
      float waveIntensity = smoothstep(1.2, 0.0, wave) * smoothstep(0.0, 0.1, wave);
      
      // Radial concentric rings
      float concentric = sin(dist * 3.14159 * 1.5);
      concentric = smoothstep(0.92, 0.98, concentric) * 0.4;
      
      // Edge fade out to dark void
      float fade = smoothstep(7.5, 2.0, dist);
      
      float alpha = (c * 0.18 + majorC * 0.45 + waveIntensity * 0.5 + concentric) * fade;
      vec3 color = mix(uColor, uSecondaryColor, clamp(dist / 6.0, 0.0, 1.0));
      color += vec3(0.5, 0.9, 1.0) * waveIntensity * 0.7;
      
      gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.9));
    }
  `,
};

/**
 * Custom GLSL Shader for Dietary Forcefield / Safety Shield
 */
export const ForcefieldShader = {
  uniforms: {
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color("#3cefff") },
    uAlertColor: { value: new THREE.Color("#ff4d6d") },
    uAlertFactor: { value: 0.0 }, // 0 = safe, 1 = danger
    uIntensity: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uBaseColor;
    uniform vec3 uAlertColor;
    uniform float uAlertFactor;
    uniform float uIntensity;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      
      // Dramatic Fresnel edge rim
      float fresnel = 1.0 - abs(dot(viewDir, normal));
      fresnel = pow(fresnel, 2.8);
      
      // Hexagonal / grid interference pulse
      float hex = sin(vUv.x * 60.0 + uTime * 2.0) * sin(vUv.y * 60.0 - uTime * 1.5);
      hex = smoothstep(0.2, 0.8, hex) * 0.25;
      
      // Moving energy waves across shield
      float wave = sin(vUv.y * 25.0 - uTime * 4.0) * 0.15;
      
      vec3 col = mix(uBaseColor, uAlertColor, uAlertFactor);
      float alpha = (fresnel * 0.85 + hex + wave) * uIntensity;
      
      gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9));
    }
  `,
};
