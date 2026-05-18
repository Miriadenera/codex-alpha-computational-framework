import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/*
  StarTwinViewer3D

  Scientific caution:
  - This is a synthetic visual reconstruction constrained by Gaia-derived observables
    and internal dashboard proxies.
  - It is not a direct observational image of the stellar surface.
  - It does not confirm flares, stellar activity class, companions, binarity
    or any exotic physical mechanism.
*/

const DEFAULT_STAR_MODEL = {
  sourceId: "N/A",
  colorHex: "#ffb347",
  emissiveHex: "#ff7a2c",
  effectiveTemperatureK: 5200,
  radiusRelative: 1,
  luminosityRelative: 1,
  visualScale: 0.95,
  surfaceContrast: 0.6,
  activityProxy: 0.32,
  coronaIntensity: 0.42,
  rotationSpeed: 0.0025,
  spectralProxyShortLabel: "stellar proxy",
  spectralProxyLabel: "Synthetic stellar proxy",
  confidenceLevel: "limited",
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function seededUnit(seed, salt = 0) {
  const text = String(seed ?? "star");
  let h = 2166136261 ^ salt;

  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  h += h << 13;
  h ^= h >>> 7;
  h += h << 3;
  h ^= h >>> 17;
  h += h << 5;

  return ((h >>> 0) % 1000000) / 1000000;
}

function buildModel(inputModel) {
  return {
    ...DEFAULT_STAR_MODEL,
    ...(inputModel ?? {}),
  };
}

function colorToCss(input) {
  const c = new THREE.Color(input);
  return `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(
    c.b * 255,
  )})`;
}

function mixColor(a, b, t) {
  const c1 = new THREE.Color(a);
  const c2 = new THREE.Color(b);
  return c1.lerp(c2, clamp(t, 0, 1));
}

function getStarPalette(model) {
  const temperature = asNumber(model.effectiveTemperatureK, 5200);
  const base = new THREE.Color(model.colorHex ?? "#ffb347");
  const emissive = new THREE.Color(model.emissiveHex ?? "#ff7a2c");

  if (temperature >= 11000) {
    return {
      base: mixColor(base, "#63b8ff", 0.42),
      dark: new THREE.Color("#0b2548"),
      hot: new THREE.Color("#d6efff"),
      core: new THREE.Color("#79c7ff"),
      plasma: mixColor(emissive, "#73cfff", 0.36),
      corona: new THREE.Color("#7fd6ff"),
      flare: new THREE.Color("#f2fbff"),
    };
  }

  if (temperature >= 8000) {
    return {
      base: mixColor(base, "#cde4ff", 0.32),
      dark: new THREE.Color("#1a2c44"),
      hot: new THREE.Color("#eef7ff"),
      core: new THREE.Color("#d8ebff"),
      plasma: mixColor(emissive, "#d7e8ff", 0.3),
      corona: new THREE.Color("#d4e8ff"),
      flare: new THREE.Color("#ffffff"),
    };
  }

  if (temperature >= 6000) {
    return {
      base: mixColor(base, "#ffe7a6", 0.26),
      dark: new THREE.Color("#5c4118"),
      hot: new THREE.Color("#fff3d2"),
      core: new THREE.Color("#ffd97d"),
      plasma: mixColor(emissive, "#ffe0a0", 0.23),
      corona: new THREE.Color("#ffd87f"),
      flare: new THREE.Color("#fff4cf"),
    };
  }

  if (temperature >= 4200) {
    return {
      base: mixColor(base, "#ffaf51", 0.24),
      dark: new THREE.Color("#4b2105"),
      hot: new THREE.Color("#ffd391"),
      core: new THREE.Color("#ff9434"),
      plasma: mixColor(emissive, "#ffb35b", 0.2),
      corona: new THREE.Color("#ff9a48"),
      flare: new THREE.Color("#ffd6a6"),
    };
  }

  return {
    base: mixColor(base, "#ff4c25", 0.2),
    dark: new THREE.Color("#330604"),
    hot: new THREE.Color("#ff9862"),
    core: new THREE.Color("#ff391b"),
    plasma: mixColor(emissive, "#ff632a", 0.18),
    corona: new THREE.Color("#ff5c33"),
    flare: new THREE.Color("#ffb693"),
  };
}

function createGlowTexture(color) {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const c = new THREE.Color(color);
  const center = size / 2;

  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(255,255,255,0.82)");
  gradient.addColorStop(
    0.12,
    `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(
      c.b * 255,
    )},0.58)`,
  );
  gradient.addColorStop(
    0.32,
    `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(
      c.b * 255,
    )},0.22)`,
  );
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createPlasmaSpriteTexture(color) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const c = new THREE.Color(color);
  const center = size / 2;

  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(
    0.16,
    `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(
      c.b * 255,
    )},0.72)`,
  );
  gradient.addColorStop(
    0.46,
    `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(
      c.b * 255,
    )},0.26)`,
  );
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function clearObject(object) {
  if (!object) return;

  object.traverse?.((node) => {
    if (node.geometry) {
      node.geometry.dispose?.();
    }

    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];

      materials.forEach((material) => {
        if (material.map) {
          material.map.dispose?.();
        }
        material.dispose?.();
      });
    }
  });
}

function clearGroup(group) {
  if (!group) return;

  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    clearObject(child);
  }
}

function randomPointOnSphere(seed, salt, radius) {
  const u = seededUnit(seed, salt);
  const v = seededUnit(seed, salt + 1);
  const theta = u * Math.PI * 2;
  const phi = Math.acos(2 * v - 1);

  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function chooseBackgroundStarColor(seed, salt) {
  const pick = seededUnit(seed, salt);

  if (pick < 0.08) return new THREE.Color("#8fb8ff");
  if (pick < 0.16) return new THREE.Color("#b8d4ff");
  if (pick < 0.23) return new THREE.Color("#ffd7a5");
  if (pick < 0.28) return new THREE.Color("#ffb489");

  return new THREE.Color("#ffffff");
}

const starPointVertexShader = `
  attribute float aSize;
  attribute vec3 aColor;

  varying vec3 vColor;

  void main() {
    vColor = aColor;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float perspectiveScale = 240.0 / max(1.0, -mvPosition.z);

    gl_PointSize = aSize * perspectiveScale;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starPointFragmentShader = `
  varying vec3 vColor;

  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float d = length(p);

    float core = smoothstep(0.5, 0.05, d);
    float halo = smoothstep(0.5, 0.20, d) * 0.10;
    float alpha = core + halo;

    if (alpha <= 0.01) {
      discard;
    }

    vec3 color = vColor * (0.78 + core * 0.65);
    gl_FragColor = vec4(color, alpha);
  }
`;

function createStarPointMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: starPointVertexShader,
    fragmentShader: starPointFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function createPointCloud(points, colors, sizes) {
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(points.length * 3);
  const colorArray = new Float32Array(points.length * 3);
  const sizeArray = new Float32Array(points.length);

  points.forEach((point, index) => {
    positions[index * 3] = point.x;
    positions[index * 3 + 1] = point.y;
    positions[index * 3 + 2] = point.z;

    colorArray[index * 3] = colors[index].r;
    colorArray[index * 3 + 1] = colors[index].g;
    colorArray[index * 3 + 2] = colors[index].b;

    sizeArray[index] = sizes[index];
  });

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colorArray, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizeArray, 1));

  return new THREE.Points(geometry, createStarPointMaterial());
}

function createDeepSpaceField(sourceId) {
  const group = new THREE.Group();

  // Lontanissimo: così muovendoti non si percepisce il trucco
  const farPoints = [];
  const farColors = [];
  const farSizes = [];

  const farCount = 1400;

  for (let i = 0; i < farCount; i += 1) {
    const radius = 85 + seededUnit(sourceId, 1000 + i) * 45;
    const point = randomPointOnSphere(sourceId, 2000 + i * 3, radius);
    const color = chooseBackgroundStarColor(sourceId, 3000 + i);

    // molto più deboli e meno "sparati"
    color.multiplyScalar(0.14 + seededUnit(sourceId, 4000 + i) * 0.32);

    farPoints.push(point);
    farColors.push(color);
    farSizes.push(0.12 + seededUnit(sourceId, 5000 + i) * 0.38);
  }

  group.add(createPointCloud(farPoints, farColors, farSizes));

  const brightPoints = [];
  const brightColors = [];
  const brightSizes = [];

  const brightCount = 95;

  for (let i = 0; i < brightCount; i += 1) {
    const radius = 78 + seededUnit(sourceId, 6000 + i) * 40;
    const point = randomPointOnSphere(sourceId, 7000 + i * 3, radius);
    const color = chooseBackgroundStarColor(sourceId, 8000 + i);

    color.multiplyScalar(0.28 + seededUnit(sourceId, 9000 + i) * 0.40);

    brightPoints.push(point);
    brightColors.push(color);
    brightSizes.push(0.42 + seededUnit(sourceId, 10000 + i) * 0.90);
  }

  group.add(createPointCloud(brightPoints, brightColors, brightSizes));

  // piccoli ammassi lontani ma delicati
  for (let c = 0; c < 10; c += 1) {
    const centerRadius = 95 + seededUnit(sourceId, 11000 + c) * 22;
    const center = randomPointOnSphere(sourceId, 12000 + c * 5, centerRadius);

    const clusterPoints = [];
    const clusterColors = [];
    const clusterSizes = [];

    const localCount = 18 + Math.round(seededUnit(sourceId, 13000 + c) * 24);
    const spread = 0.55 + seededUnit(sourceId, 14000 + c) * 1.1;

    for (let j = 0; j < localCount; j += 1) {
      const offset = new THREE.Vector3(
        (seededUnit(sourceId, 15000 + c * 100 + j) - 0.5) * spread,
        (seededUnit(sourceId, 16000 + c * 100 + j) - 0.5) * spread,
        (seededUnit(sourceId, 17000 + c * 100 + j) - 0.5) * spread,
      );

      const color = chooseBackgroundStarColor(sourceId, 18000 + c * 100 + j);
      color.multiplyScalar(0.16 + seededUnit(sourceId, 19000 + c * 100 + j) * 0.30);

      clusterPoints.push(center.clone().add(offset));
      clusterColors.push(color);
      clusterSizes.push(0.16 + seededUnit(sourceId, 20000 + c * 100 + j) * 0.42);
    }

    group.add(createPointCloud(clusterPoints, clusterColors, clusterSizes));
  }

  return group;
}

function buildSurfaceUniforms(model, palette) {
  return {
    uTime: { value: 0 },
    uBaseColor: { value: palette.base },
    uDarkColor: { value: palette.dark },
    uHotColor: { value: palette.hot },
    uCoreColor: { value: palette.core },
    uPlasmaColor: { value: palette.plasma },
    uActivity: { value: clamp(asNumber(model.activityProxy, 0.32), 0, 1) },
    uContrast: {
      value: clamp(asNumber(model.surfaceContrast, 0.6), 0.15, 1.8),
    },
    uBrightness: { value: 1.0 },
    uSeed: {
      value: new THREE.Vector3(
        seededUnit(model.sourceId, 11),
        seededUnit(model.sourceId, 22),
        seededUnit(model.sourceId, 33),
      ),
    },
  };
}

const surfaceVertexShader = `
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  varying vec3 vLocalPos;

  uniform float uTime;
  uniform float uActivity;
  uniform float uContrast;
  uniform vec3 uSeed;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;

    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p *= 2.05;
      a *= 0.52;
    }

    return v;
  }

  void main() {
    vec3 p = position;
    vec3 n = normalize(normal);

    float large = fbm(n * (5.0 + uContrast * 4.5) + vec3(uTime * 0.06, uSeed.x * 8.0, uSeed.y * 7.0));
    float fine = fbm(n * 24.0 + vec3(uTime * 0.12, uSeed.y * 10.0, uSeed.z * 10.0));

    float displacement =
      (large - 0.5) * 0.030 * uContrast +
      (fine - 0.5) * 0.010 * (0.55 + uActivity);

    p += normal * displacement;

    vec4 world = modelMatrix * vec4(p, 1.0);

    vPositionW = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vLocalPos = p;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const surfaceFragmentShader = `
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  varying vec3 vLocalPos;

  uniform float uTime;
  uniform vec3 uBaseColor;
  uniform vec3 uDarkColor;
  uniform vec3 uHotColor;
  uniform vec3 uCoreColor;
  uniform vec3 uPlasmaColor;
  uniform float uActivity;
  uniform float uContrast;
  uniform float uBrightness;
  uniform vec3 uSeed;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;

    for (int i = 0; i < 7; i++) {
      v += a * noise(p);
      p *= 2.08;
      a *= 0.52;
    }

    return v;
  }

  float ridge(float x) {
    return 1.0 - abs(2.0 * x - 1.0);
  }

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vPositionW);

    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 2.1);
    float limb = pow(1.0 - max(dot(n, viewDir), 0.0), 4.4);

    vec3 p = normalize(vLocalPos);

    float low = fbm(p * (4.0 + uContrast * 2.0) + vec3(uTime * 0.04, uSeed.x * 7.0, uSeed.y * 6.0));
    float med = fbm(p * (15.0 + uContrast * 8.0) + vec3(-uTime * 0.06, uSeed.y * 9.0, uSeed.z * 8.0));
    float high = fbm(p * 55.0 + vec3(uTime * 0.08, uSeed.z * 11.0, -uTime * 0.09));

    float granulation = mix(low, ridge(med), 0.58) + (high - 0.5) * 0.18;

    float hotMask = smoothstep(0.55, 0.90, granulation * (0.88 + uContrast * 0.40));
    float darkMask = smoothstep(0.70, 0.98, (1.0 - granulation) * (0.82 + uContrast * 0.20));

    float activeField = fbm(p * 8.0 + vec3(uSeed.x * 5.0, uTime * 0.10, uSeed.z * 6.0));
    float activeMask = smoothstep(0.70, 0.96, activeField + uActivity * 0.16);

    vec3 color = uBaseColor;

    color = mix(color, uDarkColor, darkMask * 0.18);
    color = mix(color, uCoreColor, hotMask * 0.40);
    color = mix(color, uHotColor, activeMask * 0.17);

    float bright =
      0.96 +
      hotMask * 0.24 +
      activeMask * 0.10 -
      darkMask * 0.08 +
      (high - 0.5) * 0.035;

    color *= bright * uBrightness;
    color += uPlasmaColor * limb * (0.45 + uActivity * 0.50) * uBrightness;
    color += uHotColor * pow(fresnel, 8.0) * 0.23 * uBrightness;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const coronaVertexShader = `
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  varying vec3 vLocalPos;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);

    vPositionW = world.xyz;
    vNormalW = normalize(normalMatrix * normal);
    vLocalPos = position;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const coronaFragmentShader = `
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  varying vec3 vLocalPos;

  uniform float uTime;
  uniform vec3 uCoronaColor;
  uniform vec3 uHotColor;
  uniform float uActivity;
  uniform float uCoronaLevel;
  uniform float uBrightness;
  uniform vec3 uSeed;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;

    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p *= 2.15;
      a *= 0.52;
    }

    return v;
  }

  void main() {
    if (uCoronaLevel <= 0.001) {
      discard;
    }

    vec3 n = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vPositionW);

    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.0);
    float turbulence = fbm(normalize(vLocalPos) * 6.0 + vec3(uSeed.x * 4.0, uTime * 0.24, uSeed.z * 7.0));

    float corona = rim * (0.40 + turbulence * 0.70) * uCoronaLevel;

    vec3 color = mix(uCoronaColor, uHotColor, turbulence * 0.25);
    color *= corona * (0.85 + uActivity * 0.55) * uBrightness;

    float alpha = clamp(corona * 0.28, 0.0, 0.52);

    gl_FragColor = vec4(color, alpha);
  }
`;

function createLimbBursts(model, palette) {
  const group = new THREE.Group();
  const activity = clamp(asNumber(model.activityProxy, 0.32), 0, 1);
  const texture = createPlasmaSpriteTexture(palette.plasma);
  const count = Math.round(26 + activity * 30);

  for (let i = 0; i < count; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: palette.plasma,
      transparent: true,
      opacity: 0.18 + activity * 0.20,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);

    const theta = seededUnit(model.sourceId, 20000 + i) * Math.PI * 2;
    const phi = Math.acos(2 * seededUnit(model.sourceId, 21000 + i) - 1);
    const radius = 1.08 + seededUnit(model.sourceId, 22000 + i) * 0.10;
    const size = 0.16 + seededUnit(model.sourceId, 23000 + i) * (0.16 + activity * 0.16);

    sprite.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );

    sprite.scale.set(size * 1.45, size * 1.45, 1);

    sprite.userData = {
      baseOpacity: material.opacity,
      phase: seededUnit(model.sourceId, 24000 + i) * Math.PI * 2,
    };

    group.add(sprite);
  }

  return group;
}

function createOuterFlares(model, palette) {
  const group = new THREE.Group();
  const activity = clamp(asNumber(model.activityProxy, 0.32), 0, 1);
  const texture = createPlasmaSpriteTexture(palette.flare);
  const count = Math.round(9 + activity * 10);

  for (let i = 0; i < count; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: palette.flare,
      transparent: true,
      opacity: 0.16 + activity * 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);

    const theta = seededUnit(model.sourceId, 25000 + i) * Math.PI * 2;
    const phi = Math.acos(2 * seededUnit(model.sourceId, 26000 + i) - 1);
    const radius = 1.22 + seededUnit(model.sourceId, 27000 + i) * 0.26;
    const size = 0.28 + seededUnit(model.sourceId, 28000 + i) * (0.24 + activity * 0.22);

    sprite.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );

    sprite.scale.set(size * 1.9, size * 1.1, 1);

    sprite.userData = {
      baseOpacity: material.opacity,
      phase: seededUnit(model.sourceId, 29000 + i) * Math.PI * 2,
      pulse: 0.8 + seededUnit(model.sourceId, 30000 + i) * 0.7,
    };

    group.add(sprite);
  }

  return group;
}

export default function StarTwinViewer3D({ starModel }) {
  const model = useMemo(() => buildModel(starModel), [starModel]);

  const mountRef = useRef(null);

  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const ambientLightRef = useRef(null);
  const pointLightRef = useRef(null);
  const fillLightRef = useRef(null);

  const starRootRef = useRef(null);
  const starMeshRef = useRef(null);
  const coronaMeshRef = useRef(null);
  const glowSpriteRef = useRef(null);
  const limbBurstsRef = useRef(null);
  const outerFlaresRef = useRef(null);
  const backgroundGroupRef = useRef(null);

  const surfaceUniformsRef = useRef(null);
  const coronaUniformsRef = useRef(null);

  const resizeObserverRef = useRef(null);
  const rafRef = useRef(null);
  const frameRef = useRef(0);

  const autoRotateRef = useRef(true);
  const showFlaresRef = useRef(true);
  const coronaLevelRef = useRef(0);
  const starScaleRef = useRef(clamp(asNumber(model.visualScale, 0.95), 0.55, 2.8));
  const contrastRef = useRef(1.15);
  const lightBoostRef = useRef(1.0);
  const currentModelRef = useRef(model);

  const [autoRotate, setAutoRotate] = useState(true);
  const [showFlares, setShowFlares] = useState(true);
  const [coronaLevel, setCoronaLevel] = useState(0);
  const [starScale, setStarScale] = useState(
    clamp(asNumber(model.visualScale, 0.95), 0.55, 2.8),
  );
  const [surfaceContrast, setSurfaceContrast] = useState(1.15);
  const [lightBoost, setLightBoost] = useState(1.0);

  const dragRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  const orbitRef = useRef({
    theta: 0.72,
    phi: 1.08,
    radius: 3.65,
  });

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    showFlaresRef.current = showFlares;
  }, [showFlares]);

  useEffect(() => {
    coronaLevelRef.current = coronaLevel;
  }, [coronaLevel]);

  useEffect(() => {
    starScaleRef.current = starScale;
  }, [starScale]);

  useEffect(() => {
    contrastRef.current = surfaceContrast;
  }, [surfaceContrast]);

  useEffect(() => {
    lightBoostRef.current = lightBoost;
  }, [lightBoost]);

  useEffect(() => {
    currentModelRef.current = model;
  }, [model]);

  useEffect(() => {
    setStarScale(clamp(asNumber(model.visualScale, 0.95), 0.55, 2.8));
    setCoronaLevel(0);
  }, [model.sourceId, model.visualScale]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 1);

    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, 1.6, 0.01, 300);
    camera.position.set(0, 0, 3.65);
    cameraRef.current = camera;

    const ambient = new THREE.AmbientLight(0xffffff, 0.16);
    ambientLightRef.current = ambient;
    scene.add(ambient);

    const pointLight = new THREE.PointLight(0xffffff, 3.0, 45);
    pointLight.position.set(3.2, 2.2, 4.2);
    pointLightRef.current = pointLight;
    scene.add(pointLight);

    const fillLight = new THREE.PointLight(0x5da7ff, 0.22, 45);
    fillLight.position.set(-4.2, -1.8, -3.5);
    fillLightRef.current = fillLight;
    scene.add(fillLight);

    const backgroundGroup = new THREE.Group();
    backgroundGroupRef.current = backgroundGroup;
    scene.add(backgroundGroup);

    const starRoot = new THREE.Group();
    starRootRef.current = starRoot;
    scene.add(starRoot);

    const handleResize = () => {
      const width = Math.max(320, mount.clientWidth || 920);
      const height = Math.max(320, mount.clientHeight || 520);

      renderer.setSize(width, height, false);
      renderer.domElement.style.width = `${width}px`;
      renderer.domElement.style.height = `${height}px`;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const handleWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();

      orbitRef.current.radius = clamp(
        orbitRef.current.radius + event.deltaY * 0.0024,
        1.15,
        14,
      );
    };

    mount.addEventListener("wheel", handleWheel, { passive: false });

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);
    resizeObserverRef.current = resizeObserver;

    handleResize();

    const animate = () => {
      rafRef.current = window.requestAnimationFrame(animate);

      const rendererCurrent = rendererRef.current;
      const sceneCurrent = sceneRef.current;
      const cameraCurrent = cameraRef.current;
      const currentModel = currentModelRef.current;

      if (!rendererCurrent || !sceneCurrent || !cameraCurrent || !currentModel) {
        return;
      }

      const elapsed = frameRef.current / 60;
      const orbit = orbitRef.current;

      cameraCurrent.position.set(
        orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta),
        orbit.radius * Math.cos(orbit.phi),
        orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta),
      );

      cameraCurrent.lookAt(0, 0, 0);

      if (starRootRef.current && autoRotateRef.current) {
        starRootRef.current.rotation.y += asNumber(currentModel.rotationSpeed, 0.0025);
        starRootRef.current.rotation.x = Math.sin(frameRef.current * 0.0028) * 0.01;
      }

      if (starMeshRef.current) {
        starMeshRef.current.scale.setScalar(starScaleRef.current);
      }

      if (coronaMeshRef.current) {
        coronaMeshRef.current.scale.setScalar(starScaleRef.current * 1.32);
        coronaMeshRef.current.visible = coronaLevelRef.current > 0.001;
      }

      if (glowSpriteRef.current) {
        glowSpriteRef.current.scale.setScalar(
          (3.55 + coronaLevelRef.current * 1.25) * starScaleRef.current,
        );

        glowSpriteRef.current.visible = showFlaresRef.current || coronaLevelRef.current > 0.001;

        if (glowSpriteRef.current.material) {
          glowSpriteRef.current.material.opacity = showFlaresRef.current
            ? clamp(0.10 + coronaLevelRef.current * 0.24, 0.06, 0.34)
            : clamp(coronaLevelRef.current * 0.22, 0, 0.24);
        }
      }

      if (limbBurstsRef.current) {
        limbBurstsRef.current.visible = showFlaresRef.current;

        limbBurstsRef.current.children.forEach((child) => {
          if (child.material) {
            const pulse =
              0.86 + Math.sin(elapsed * 2.6 + (child.userData.phase ?? 0)) * 0.28;

            child.material.opacity = showFlaresRef.current
              ? (child.userData.baseOpacity ?? 0.12) * pulse
              : 0;
          }
        });
      }

      if (outerFlaresRef.current) {
        outerFlaresRef.current.visible = showFlaresRef.current;

        outerFlaresRef.current.children.forEach((child) => {
          if (child.material) {
            const pulse =
              0.72 +
              Math.sin(
                elapsed * (child.userData.pulse ?? 1.0) * 1.8 +
                  (child.userData.phase ?? 0),
              ) *
                0.38;

            child.material.opacity = showFlaresRef.current
              ? (child.userData.baseOpacity ?? 0.1) * pulse
              : 0;
          }
        });
      }

      if (surfaceUniformsRef.current) {
        surfaceUniformsRef.current.uTime.value = elapsed;
        surfaceUniformsRef.current.uContrast.value = clamp(
          asNumber(currentModel.surfaceContrast, 0.6) * contrastRef.current,
          0.15,
          1.8,
        );
        surfaceUniformsRef.current.uBrightness.value = clamp(
          lightBoostRef.current,
          0.55,
          2.0,
        );
      }

      if (coronaUniformsRef.current) {
        coronaUniformsRef.current.uTime.value = elapsed;
        coronaUniformsRef.current.uCoronaLevel.value = clamp(
          coronaLevelRef.current,
          0,
          1,
        );
        coronaUniformsRef.current.uBrightness.value = clamp(
          lightBoostRef.current,
          0.55,
          2.0,
        );
      }

      if (pointLightRef.current) {
        const currentPalette = getStarPalette(currentModel);

        pointLightRef.current.intensity =
          clamp(2.0 + coronaLevelRef.current * 1.5, 1.9, 4.3) *
          clamp(lightBoostRef.current, 0.55, 2.0);

        pointLightRef.current.color.set(currentPalette.plasma);
      }

      if (ambientLightRef.current) {
        ambientLightRef.current.intensity =
          0.08 + clamp(lightBoostRef.current, 0.55, 2.0) * 0.08;
      }

      if (fillLightRef.current) {
        fillLightRef.current.intensity =
          0.12 + clamp(lightBoostRef.current, 0.55, 2.0) * 0.08;
      }

      rendererCurrent.render(sceneCurrent, cameraCurrent);
      frameRef.current += 1;
    };

    animate();

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }

      try {
        mount.removeEventListener("wheel", handleWheel);
      } catch {
        //
      }

      try {
        resizeObserverRef.current?.disconnect();
      } catch {
        //
      }

      try {
        clearGroup(starRootRef.current);
        clearGroup(backgroundGroupRef.current);
      } catch {
        //
      }

      try {
        renderer.dispose?.();
        renderer.forceContextLoss?.();
      } catch {
        //
      }

      try {
        if (renderer.domElement?.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      } catch {
        //
      }

      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      ambientLightRef.current = null;
      pointLightRef.current = null;
      fillLightRef.current = null;
      starRootRef.current = null;
      starMeshRef.current = null;
      coronaMeshRef.current = null;
      glowSpriteRef.current = null;
      limbBurstsRef.current = null;
      outerFlaresRef.current = null;
      backgroundGroupRef.current = null;
      surfaceUniformsRef.current = null;
      coronaUniformsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const starRoot = starRootRef.current;
    const backgroundGroup = backgroundGroupRef.current;
    if (!starRoot || !backgroundGroup) return;

    clearGroup(starRoot);
    clearGroup(backgroundGroup);

    const palette = getStarPalette(model);

    backgroundGroup.add(createDeepSpaceField(model.sourceId));

    const surfaceUniforms = buildSurfaceUniforms(model, palette);
    surfaceUniforms.uBrightness.value = clamp(lightBoostRef.current, 0.55, 2.0);
    surfaceUniforms.uContrast.value = clamp(
      asNumber(model.surfaceContrast, 0.6) * contrastRef.current,
      0.15,
      1.8,
    );
    surfaceUniformsRef.current = surfaceUniforms;

    const sphereGeometry = new THREE.SphereGeometry(1, 196, 196);
    const sphereMaterial = new THREE.ShaderMaterial({
      uniforms: surfaceUniforms,
      vertexShader: surfaceVertexShader,
      fragmentShader: surfaceFragmentShader,
      transparent: false,
      depthWrite: true,
      depthTest: true,
    });

    const starMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    starMesh.scale.setScalar(starScaleRef.current);
    starMeshRef.current = starMesh;
    starRoot.add(starMesh);

    const coronaUniforms = {
      uTime: { value: 0 },
      uCoronaColor: { value: palette.corona },
      uHotColor: { value: palette.hot },
      uActivity: { value: clamp(asNumber(model.activityProxy, 0.32), 0, 1) },
      uCoronaLevel: { value: clamp(coronaLevelRef.current, 0, 1) },
      uBrightness: { value: clamp(lightBoostRef.current, 0.55, 2.0) },
      uSeed: {
        value: new THREE.Vector3(
          seededUnit(model.sourceId, 41),
          seededUnit(model.sourceId, 42),
          seededUnit(model.sourceId, 43),
        ),
      },
    };

    coronaUniformsRef.current = coronaUniforms;

    const coronaGeometry = new THREE.SphereGeometry(1, 132, 132);
    const coronaMaterial = new THREE.ShaderMaterial({
      uniforms: coronaUniforms,
      vertexShader: coronaVertexShader,
      fragmentShader: coronaFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });

    const coronaMesh = new THREE.Mesh(coronaGeometry, coronaMaterial);
    coronaMesh.scale.setScalar(starScaleRef.current * 1.32);
    coronaMesh.visible = coronaLevelRef.current > 0.001;
    coronaMeshRef.current = coronaMesh;
    starRoot.add(coronaMesh);

    const glowTexture = createGlowTexture(palette.corona);
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: palette.corona,
      transparent: true,
      opacity: showFlaresRef.current
        ? clamp(0.1 + coronaLevelRef.current * 0.24, 0.06, 0.34)
        : 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.setScalar(
      (3.55 + coronaLevelRef.current * 1.25) * starScaleRef.current,
    );
    glowSprite.visible = showFlaresRef.current || coronaLevelRef.current > 0.001;
    glowSpriteRef.current = glowSprite;
    starRoot.add(glowSprite);

    const limbBursts = createLimbBursts(model, palette);
    limbBursts.visible = showFlaresRef.current;
    limbBurstsRef.current = limbBursts;
    starRoot.add(limbBursts);

    const outerFlares = createOuterFlares(model, palette);
    outerFlares.visible = showFlaresRef.current;
    outerFlaresRef.current = outerFlares;
    starRoot.add(outerFlares);

    if (pointLightRef.current) {
      pointLightRef.current.color.set(palette.plasma);
    }
  }, [model]);

  function handleMouseDown(event) {
    dragRef.current.active = true;
    dragRef.current.lastX = event.clientX;
    dragRef.current.lastY = event.clientY;
  }

  function handleMouseMove(event) {
    if (!dragRef.current.active) return;

    const dx = event.clientX - dragRef.current.lastX;
    const dy = event.clientY - dragRef.current.lastY;

    orbitRef.current.theta -= dx * 0.008;
    orbitRef.current.phi = clamp(
      orbitRef.current.phi - dy * 0.008,
      0.1,
      Math.PI - 0.1,
    );

    dragRef.current.lastX = event.clientX;
    dragRef.current.lastY = event.clientY;
  }

  function handleMouseUp() {
    dragRef.current.active = false;
  }

  function resetCamera() {
    orbitRef.current.theta = 0.72;
    orbitRef.current.phi = 1.08;
    orbitRef.current.radius = 3.65;
  }

  return (
    <div className="star-twin-shell">
      <div className="star-twin-header">
        <div>
          <div className="eyebrow">Synthetic Stellar Twin</div>
          <h2>{model.sourceId || "Selected Gaia Source"}</h2>
          <p>{model.spectralProxyLabel}</p>
        </div>

        <div className="star-twin-status">
          <span
            className="star-twin-color-dot"
            style={{
              background: colorToCss(model.colorHex ?? "#ffb347"),
              boxShadow: `0 0 18px ${colorToCss(model.emissiveHex ?? "#ff7a2c")}`,
            }}
          />
          <div>
            <strong>{model.spectralProxyShortLabel}</strong>
            <small>confidence: {model.confidenceLevel}</small>
          </div>
        </div>
      </div>

      <div className="star-twin-main">
        <div
          ref={mountRef}
          className="star-twin-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: dragRef.current.active ? "grabbing" : "grab",
          }}
        />
      </div>

      <div className="star-twin-controls">
        <button
          type="button"
          className={`star-twin-button${autoRotate ? " active" : ""}`}
          onClick={() => setAutoRotate((value) => !value)}
        >
          Rotation {autoRotate ? "on" : "off"}
        </button>

        <button
          type="button"
          className={`star-twin-button${showFlares ? " active" : ""}`}
          onClick={() => setShowFlares((value) => !value)}
        >
          Flares {showFlares ? "on" : "off"}
        </button>

        <button type="button" className="star-twin-button" onClick={resetCamera}>
          Reset camera
        </button>

        <label className="star-twin-range">
          Star scale
          <input
            type="range"
            min="0.55"
            max="2.8"
            step="0.05"
            value={starScale}
            onChange={(event) => setStarScale(Number(event.target.value))}
          />
          <span>{starScale.toFixed(2)}×</span>
        </label>

        <label className="star-twin-range">
          Surface contrast
          <input
            type="range"
            min="0.70"
            max="2.20"
            step="0.05"
            value={surfaceContrast}
            onChange={(event) => setSurfaceContrast(Number(event.target.value))}
          />
          <span>{surfaceContrast.toFixed(2)}×</span>
        </label>

        <label className="star-twin-range">
          Light
          <input
            type="range"
            min="0.55"
            max="2.00"
            step="0.05"
            value={lightBoost}
            onChange={(event) => setLightBoost(Number(event.target.value))}
          />
          <span>{lightBoost.toFixed(2)}×</span>
        </label>

        <label className="star-twin-range">
          Corona
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={coronaLevel}
            onChange={(event) => setCoronaLevel(Number(event.target.value))}
          />
          <span>{coronaLevel.toFixed(2)}</span>
        </label>
      </div>

      <div className="star-twin-note">
        Real Aladin tiles cannot be used directly here as a free rotatable 3D sky
        background without introducing a flat-image effect and possible CORS
        constraints. This version instead uses a darker, more distant and less
        luminous procedural sky field designed to feel closer to a real deep-sky
        background while preserving 3D navigation.
      </div>
    </div>
  );
}