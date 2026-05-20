import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

/*
  CandidateSignalMap3D — v3
  ─────────────────────────────────────────────────────────────────────────────
  New in v3:
  - Pause/Resume auto-rotation button
  - Free Fly zoom mode (zoom toward camera look-at, not origin)
  - Realistic procedural stellar textures: hot blue → white → yellow → orange → red
    with limb darkening, surface convection cells, chromospheric glow, corona
  - Category connection lines: thin lines connecting stars sharing the same
    stellar type, tier, or anomaly band — selectable from a filter menu
  - Category filter menu in controls bar: Stellar type, Tier, Anomaly band,
    Temperature band, Dynamics band — choosing one highlights matching stars
    and draws thin connection lines between them
  - Enhanced CSS for deeper 3D look (shadows, bloom emissive, glass overlay)
*/

// ─── Constants ────────────────────────────────────────────────────────────────

const SELECTED_COLOR   = 0x39ff14;
const TIER_COLORS      = [0x00ff8c, 0x00d2ff, 0x8b7fff, 0x4a8090];
const TIER_GLOW        = [2.4, 1.2, 0.7, 0.32];
const TIER_NAMES       = ["Priority investigation target","Strong follow-up candidate","Moderate follow-up candidate","Routine validation"];

const COLOR_MODES = {
  stellar:  "Stellar type",
  anomaly:  "Anomaly score",
  dynamics: "Dynamics index",
  tier:     "Investigation tier",
};

const VIEW_MODES = {
  graphCloud:         { label: "Candidate cloud",         description: "Hybrid Gaia coordinate + proxy layout (top-50 anomaly pool)" },
  kinematic:          { label: "Kinematic field",         description: "Proper motion and radial velocity axes (top-50 anomaly pool)" },
  signal:             { label: "Signal space",            description: "Anomaly · Dynamics · Structure axes (top-50 anomaly pool)" },
  kinematicEvolution: { label: "Motion evolution · 1000", description: "Candidate-level kinematic projection of the Gaia DR3 demo set — NOT a confirmed dynamical simulation" },
};

// ─── Kinematic evolution constants ────────────────────────────────────────
// 1 km/s → pc/yr (1 km/s ≈ 1.0227 × 10⁻⁶ pc/yr)
const KMS_TO_PC_PER_YR = 1.0227e-6;
// Mas-yr proper motion → tangential velocity (km/s) coefficient
const PM_VTAN_COEF     = 4.74047;
// Max number of Gaia sources rendered in the evolution view (demo cap)
const KIN_MAX_SOURCES  = 1000;
// Trail length (history samples per star)
const TRAIL_LEN        = 80;
// Spatial scene span (auto-normalized at build time)
const KIN_SCENE_SPAN   = 2.4;
// Fallback distance (pc) used when parallax is missing — explicitly flagged
const KIN_FALLBACK_PC  = 400;
// VISUAL amplification applied to the simulated proper motion so the
// sub-mas/yr displacements become visible inside the demo scene.
// The simulated time (years) displayed in the UI is unaffected.
const KIN_MOTION_GAIN  = 6.0;

// Category connection line modes
const LINK_CATEGORIES = {
  none:       "Off",
  stellar:    "Same stellar type",
  tier:       "Same tier",
  anomaly:    "Same anomaly band",
  temp:       "Same temperature band",
  dynamics:   "Same dynamics band",
};

const STELLAR_LEGEND = [
  { label: "O-type",          col: "#9bb8ff", temp: 40000 },
  { label: "B-type",          col: "#aac8ff", temp: 20000 },
  { label: "A-type",          col: "#ccdeff", temp:  9000 },
  { label: "F-type",          col: "#fff4d6", temp:  7000 },
  { label: "G-type (Sun-like)",col: "#ffe484", temp:  5800 },
  { label: "K-type",          col: "#ffb347", temp:  4500 },
  { label: "M-type",          col: "#ff6b35", temp:  3500 },
  { label: "M+ dwarf",        col: "#ff3a1a", temp:  2800 },
  { label: "Unknown",         col: "#8899aa", temp:  4000 },
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function normalizeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp01(value) { return Math.max(0, Math.min(1, normalizeNumber(value, 0))); }

function getSourceId(record) {
  return String(record?.SOURCE_ID ?? record?.source_id ?? record?.sourceId ?? record?.id ?? "");
}

function firstAvailable(record, keys, fallback = null) {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function computeDistancePc(record) {
  const direct = nullableNumber(firstAvailable(record, ["distance_pc","distancePc","distance_estimate"]));
  if (direct !== null && direct > 0) return direct;
  const parallax = nullableNumber(firstAvailable(record, ["parallax","PARALLAX"]));
  if (parallax !== null && parallax > 0) return 1000 / parallax;
  return null;
}

function seededNoise(id, salt = 0) {
  const text = String(id ?? "candidate");
  let hash = 2166136261 + salt * 374761393;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
}

function normalizeList(values) {
  const valid = values.filter((v) => Number.isFinite(v));
  if (!valid.length) return { scale: () => 0.5 };
  const min = Math.min(...valid), max = Math.max(...valid), span = max - min || 1;
  return { scale: (value) => { const n = nullableNumber(value); if (n === null) return 0.5; return Math.max(0, Math.min(1, (n - min) / span)); } };
}

// ─── Stellar type ─────────────────────────────────────────────────────────────

function classifyStellarType(bpRp) {
  const v = nullableNumber(bpRp);
  if (v === null) return { type:"Unknown", color:0x8899aa, name:"Unknown / no color data", temperature:4000, band:"unknown" };
  if (v < 0.3) return  { type:"O",  color:0x9bb8ff, name:"O-type · very hot blue proxy",    temperature:40000, band:"OB"  };
  if (v < 0.6) return  { type:"B",  color:0xaac8ff, name:"B-type · hot blue-white proxy",   temperature:20000, band:"OB"  };
  if (v < 0.9) return  { type:"A",  color:0xccdeff, name:"A-type · white proxy",             temperature:9000,  band:"AF"  };
  if (v < 1.2) return  { type:"F",  color:0xfff4d6, name:"F-type · yellow-white proxy",     temperature:7000,  band:"AF"  };
  if (v < 1.6) return  { type:"G",  color:0xffe484, name:"G-type · yellow proxy",            temperature:5800,  band:"GK"  };
  if (v < 2.2) return  { type:"K",  color:0xffb347, name:"K-type · orange proxy",            temperature:4500,  band:"GK"  };
  if (v < 3.0) return  { type:"M",  color:0xff6b35, name:"M-type · cool red proxy",          temperature:3500,  band:"M"   };
  return               { type:"M+", color:0xff3a1a, name:"M+ · ultra-cool red proxy",        temperature:2800,  band:"M"   };
}

function getTier(score) {
  if (score >= 0.52) return 0; if (score >= 0.38) return 1; if (score >= 0.24) return 2; return 3;
}

function getAnomalyBand(anom) {
  if (anom >= 0.65) return "high"; if (anom >= 0.45) return "mid"; return "low";
}

function getDynamicsBand(dyn) {
  if (dyn >= 0.35) return "high"; if (dyn >= 0.20) return "mid"; return "low";
}

function getTempBand(temp) {
  if (temp >= 10000) return "hot"; if (temp >= 5000) return "warm"; return "cool";
}

function getCandidateColor(candidate, colorMode) {
  if (colorMode === "stellar")  return candidate.stellarType.color;
  if (colorMode === "tier")     return TIER_COLORS[candidate.tier];
  if (colorMode === "anomaly")  {
    const v = clamp01(candidate.anom);
    return (Math.round(30+v*225) << 16) | (Math.round(220-v*120) << 8) | 0x20;
  }
  if (colorMode === "dynamics") {
    const v = clamp01(candidate.dyn);
    return (0x10 << 16) | (Math.round(60+v*190) << 8) | Math.round(90+v*165);
  }
  return candidate.stellarType.color;
}

// ─── Realistic procedural stellar texture ─────────────────────────────────────
// Simulates: core brightness, limb darkening, convection cells (cool stars),
// chromospheric bright ring, corona, specular hot spot

function createStellarTexture(hexColor, temperature) {
  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  const cx = SIZE / 2, cy = SIZE / 2, R = SIZE / 2 - 2;

  const col = new THREE.Color(hexColor);
  const toRGB = (c) => [Math.round(c.r*255), Math.round(c.g*255), Math.round(c.b*255)];
  const [cr, cg, cb] = toRGB(col);

  // Limb darkening coefficient — hotter = less darkening
  const limb = temperature > 20000 ? 0.18 : temperature > 8000 ? 0.35 : temperature > 5000 ? 0.55 : 0.72;

  // ── 1. Core disk with limb darkening ─────────────────────────────────────────
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  coreGrad.addColorStop(0,        `rgba(255,255,255,${temperature > 15000 ? 0.85 : 0.55})`);
  coreGrad.addColorStop(0.3,      `rgb(${cr},${cg},${cb})`);
  coreGrad.addColorStop(1-limb,   `rgb(${Math.max(0,cr-50)},${Math.max(0,cg-50)},${Math.max(0,cb-50)})`);
  coreGrad.addColorStop(1,        `rgb(${Math.max(0,cr-90)},${Math.max(0,cg-90)},${Math.max(0,cb-90)})`);
  ctx.fillStyle = coreGrad;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();

  // ── 2. Convection cells for cool stars (K, M) ────────────────────────────────
  if (temperature < 5500) {
    const cellCount = temperature < 3500 ? 18 : temperature < 4500 ? 14 : 10;
    ctx.globalAlpha = temperature < 3500 ? 0.18 : 0.12;
    for (let i = 0; i < cellCount; i++) {
      const angle = seededNoise(`cell_${hexColor}_${i}`, 10) * Math.PI * 2;
      const dist  = seededNoise(`cell_${hexColor}_${i}`, 11) * R * 0.72;
      const rx = cx + Math.cos(angle) * dist;
      const ry = cy + Math.sin(angle) * dist;
      const sr = 3 + seededNoise(`cell_${hexColor}_${i}`, 12) * (temperature < 3500 ? 14 : 10);
      // dark cell center
      ctx.fillStyle = `rgb(${Math.max(0,cr-70)},${Math.max(0,cg-70)},${Math.max(0,cb-70)})`;
      ctx.beginPath(); ctx.arc(rx, ry, sr, 0, Math.PI*2); ctx.fill();
      // bright cell border
      ctx.strokeStyle = `rgba(${Math.min(255,cr+30)},${Math.min(255,cg+30)},${Math.min(255,cb+30)},0.5)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(rx, ry, sr, 0, Math.PI*2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ── 3. Solar flares / prominences for hot stars ───────────────────────────────
  if (temperature > 8000) {
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 4; i++) {
      const angle = seededNoise(`flare_${hexColor}_${i}`, 20) * Math.PI * 2;
      const x1 = cx + Math.cos(angle) * R * 0.92;
      const y1 = cy + Math.sin(angle) * R * 0.92;
      const x2 = cx + Math.cos(angle+0.3) * R * 1.05;
      const y2 = cy + Math.sin(angle+0.3) * R * 1.05;
      ctx.strokeStyle = `rgba(${Math.min(255,cr+60)},${Math.min(255,cg+60)},255,0.9)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ── 4. Chromospheric bright ring ──────────────────────────────────────────────
  const chromoGrad = ctx.createRadialGradient(cx, cy, R*0.82, cx, cy, R*0.98);
  const chromoBright = temperature > 10000 ? 1.0 : 0.7;
  chromoGrad.addColorStop(0,   `rgba(${Math.min(255,cr+60)},${Math.min(255,cg+60)},${Math.min(255,cb+80)},${chromoBright*0.35})`);
  chromoGrad.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = chromoGrad;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();

  // ── 5. Corona / glow halo ─────────────────────────────────────────────────────
  const coronaSize = temperature > 15000 ? SIZE*0.52 : SIZE*0.42;
  const corona = ctx.createRadialGradient(cx, cy, R*0.88, cx, cy, R + coronaSize);
  corona.addColorStop(0,   `rgba(${cr},${cg},${cb},0.55)`);
  corona.addColorStop(0.3, `rgba(${cr},${cg},${cb},0.22)`);
  corona.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = corona;
  ctx.beginPath(); ctx.arc(cx, cy, R + coronaSize, 0, Math.PI*2); ctx.fill();

  // ── 6. Specular hot spot ──────────────────────────────────────────────────────
  const specX = cx - R * 0.28, specY = cy - R * 0.28;
  const spec = ctx.createRadialGradient(specX, specY, 0, specX, specY, R*0.38);
  spec.addColorStop(0,  `rgba(255,255,255,${temperature > 10000 ? 0.55 : 0.28})`);
  spec.addColorStop(1,  "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.beginPath(); ctx.arc(specX, specY, R*0.38, 0, Math.PI*2); ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ─── Fallback / build candidates ─────────────────────────────────────────────

function buildFallbackCandidates() {
  return Array.from({ length: 50 }, (_, i) => {
    const id = `fallback-${String(i+1).padStart(2,"0")}`;
    return {
      id, record: null,
      ra:   seededNoise(id,1)*360, dec: -60+seededNoise(id,2)*120,
      distance_pc: 40+seededNoise(id,3)*500,
      pmra: -60+seededNoise(id,4)*120, pmdec: -60+seededNoise(id,5)*120,
      radial_velocity: -100+seededNoise(id,6)*200,
      anom: 0.28+seededNoise(id,7)*0.45, dyn: 0.10+seededNoise(id,8)*0.45,
      str:  0.08+seededNoise(id,9)*0.58,  coh: 0.12+seededNoise(id,10)*0.56,
      vel:  10+seededNoise(id,11)*190,     col: 0.20+seededNoise(id,12)*3.20,
    };
  });
}

function buildCandidates(records = []) {
  const src = Array.isArray(records) ? records : [];
  const base = src.length > 0
    ? src.slice(0,50).map((r,i) => {
        const id   = getSourceId(r) || `candidate-${i+1}`;
        const bpRp = firstAvailable(r,["gaia_color_index","bp_rp","BP_RP"],null) ?? 1.2;
        return {
          id, record: r,
          ra:   nullableNumber(firstAvailable(r,["ra","RA"])),
          dec:  nullableNumber(firstAvailable(r,["dec","DEC"])),
          distance_pc:     computeDistancePc(r),
          pmra:            nullableNumber(firstAvailable(r,["pmra","PMRA"])),
          pmdec:           nullableNumber(firstAvailable(r,["pmdec","PMDEC"])),
          radial_velocity: nullableNumber(firstAvailable(r,["radial_velocity","RADIAL_VELOCITY","rv"])),
          anom: clamp01(firstAvailable(r,["anomaly_score","anomalyScore"],0)),
          dyn:  clamp01(firstAvailable(r,["dynamics_index","dynamicsIndex"],0)),
          str:  clamp01(firstAvailable(r,["structural_importance_score","structural_importance","structuralImportance","pagerank"],0)),
          coh:  clamp01(firstAvailable(r,["coherence_proxy","k_proxy","coherence_score","coherence","gradient_proxy"],0)),
          vel:  normalizeNumber(firstAvailable(r,["approximate_space_velocity","space_velocity","velocity"],0),0),
          col:  normalizeNumber(bpRp,1.2),
        };
      })
    : buildFallbackCandidates();

  return base.map((c) => {
    const score = 0.26*c.dyn + 0.18*c.anom + 0.14*c.str + 0.12*Math.min(1,Math.abs(c.vel)/220) + 0.08*c.coh;
    const st    = classifyStellarType(c.col);
    return {
      ...c, score,
      tier:        getTier(score),
      stellarType: st,
      anomalyBand: getAnomalyBand(c.anom),
      dynamicsBand: getDynamicsBand(c.dyn),
      tempBand:    getTempBand(st.temperature),
    };
  });
}

// ─── Kinematic evolution candidates ──────────────────────────────────────
// LOCAL tangent-plane projection centred on the dataset median:
//   X = (RA  - RA0)  · cos(Dec0)           (deg, then normalised)
//   Y = (Dec - Dec0)                       (deg, then normalised)
//   Z = (distance - distance_median)       (pc,  then normalised)
// Each axis is independently scaled with a robust percentile clamp so the
// 1000 sources form a readable 3D field instead of a line-of-sight stripe.
// Velocity vector in the same local frame:
//   vx ∝ pmra (mas/yr),  vy ∝ pmdec (mas/yr),  vz ∝ radial_velocity (km/s)
// motionVisualGain is applied at render time, not here.
//
// Scientific caution: this is a candidate-level projection of Gaia DR3
// proxies. The drawn lines are "projected motion traces" / "proper-motion
// trajectories", NOT confirmed orbits. The view does NOT confirm orbits,
// binarity, encounters, or any physical interaction.

function percentileClamp(values, lo = 0.05, hi = 0.95) {
  const arr = values.filter((v) => Number.isFinite(v)).slice().sort((a,b)=>a-b);
  if (!arr.length) return { lo: -1, hi: 1, span: 2 };
  const li = Math.max(0, Math.floor(arr.length * lo));
  const hii= Math.min(arr.length-1, Math.floor(arr.length * hi));
  const loV = arr[li], hiV = arr[hii];
  const span = (hiV - loV) || 1;
  return { lo: loV, hi: hiV, span };
}

function buildKinematicCandidates(records = []) {
  const src    = Array.isArray(records) ? records : [];
  const capped = src.slice(0, KIN_MAX_SOURCES);
  if (!capped.length) return [];

  // ── Pass 1 — extract raw fields, compute dataset centre ────────────────
  const raw = capped.map((r, i) => {
    const id   = getSourceId(r) || `gaia-${i+1}`;
    const ra   = nullableNumber(firstAvailable(r, ["ra","RA"]));
    const dec  = nullableNumber(firstAvailable(r, ["dec","DEC"]));
    const parallax = nullableNumber(firstAvailable(r, ["parallax","PARALLAX"]));
    const distance = computeDistancePc(r);
    const pmra  = nullableNumber(firstAvailable(r, ["pmra","PMRA"]));
    const pmdec = nullableNumber(firstAvailable(r, ["pmdec","PMDEC"]));
    const rv    = nullableNumber(firstAvailable(r, ["radial_velocity","RADIAL_VELOCITY","rv"]));
    const bpRp  = firstAvailable(r, ["gaia_color_index","bp_rp","BP_RP"], null) ?? 1.2;
    const anom  = clamp01(firstAvailable(r, ["anomaly_score","anomalyScore"], 0));
    const dyn   = clamp01(firstAvailable(r, ["dynamics_index","dynamicsIndex"], 0));
    const str   = clamp01(firstAvailable(r, ["structural_importance_score","structural_importance","structuralImportance","pagerank"], 0));

    const hasDistance = Number.isFinite(distance) && distance > 0;
    const hasPm       = Number.isFinite(pmra) && Number.isFinite(pmdec);
    const hasRv       = Number.isFinite(rv);
    return { id, record: r, ra, dec, parallax, distance, pmra, pmdec, rv,
             bpRp, anom, dyn, str, hasDistance, hasPm, hasRv };
  });

  // Median helpers
  const median = (arr) => {
    const a = arr.filter((v) => Number.isFinite(v)).slice().sort((x,y)=>x-y);
    if (!a.length) return 0;
    return a.length % 2 ? a[(a.length-1)>>1] : 0.5*(a[a.length/2-1]+a[a.length/2]);
  };
  const ra0  = median(raw.map((c) => c.ra));
  const dec0 = median(raw.map((c) => c.dec));
  const d0   = median(raw.map((c) => c.hasDistance ? c.distance : null));
  const cosDec0 = Math.cos((dec0 ?? 0) * Math.PI / 180);

  // ── Pass 2 — compute raw local coords (deg, deg, pc) and velocity scalars ──
  const rawPos = raw.map((c) => {
    // Local angular X handles RA wrap by mapping to (-180, +180]
    let dRA = (c.ra ?? ra0) - ra0;
    if (dRA >  180) dRA -= 360;
    if (dRA < -180) dRA += 360;
    const xDeg = dRA * cosDec0;
    const yDeg = (c.dec ?? dec0) - dec0;
    const dRel = c.hasDistance ? (c.distance - (d0 || c.distance)) : 0;
    return { xDeg, yDeg, zPc: dRel };
  });

  // ── Robust per-axis normalisation (percentile clamp) ───────────────────
  const sx = percentileClamp(rawPos.map((p) => p.xDeg));
  const sy = percentileClamp(rawPos.map((p) => p.yDeg));
  const sz = percentileClamp(rawPos.map((p) => p.zPc));

  const half = KIN_SCENE_SPAN * 0.5;
  const norm = (v, s) => {
    if (!Number.isFinite(v)) return 0;
    const c = Math.max(s.lo, Math.min(s.hi, v));
    return ((c - s.lo) / s.span - 0.5) * 2 * half; // → [-half, +half]
  };

  // ── Pass 3 — build final records (positions + velocity in normalized units) ──
  // We keep the velocity in the SAME normalised local frame as the position.
  // pmra/pmdec are mas/yr  →  deg/yr = mas/yr * 1e-3 / 3600
  //   xDeg/yr  =  pmra  * 1e-3/3600 * cos(dec0)
  //   yDeg/yr  =  pmdec * 1e-3/3600
  // radial_velocity (km/s) → pc/yr  via KMS_TO_PC_PER_YR
  const MAS_TO_DEG = 1 / (1000 * 3600);
  const dxPerDeg = (2 * half) / sx.span;   // scene units per deg of xDeg
  const dyPerDeg = (2 * half) / sy.span;
  const dzPerPc  = (2 * half) / sz.span;

  return raw.map((c, i) => {
    const p = rawPos[i];
    const x0 = norm(p.xDeg, sx);
    const y0 = norm(p.yDeg, sy);
    const z0 = norm(p.zPc , sz);

    // Velocity in scene units per year (linear, no gain — gain is applied at render)
    const vx_scene = c.hasPm ? (c.pmra  * MAS_TO_DEG * cosDec0) * dxPerDeg : 0;
    const vy_scene = c.hasPm ? (c.pmdec * MAS_TO_DEG)            * dyPerDeg : 0;
    const vz_scene = c.hasRv ? (c.rv * KMS_TO_PC_PER_YR)         * dzPerPc  : 0;

    const score       = 0.26*c.dyn + 0.18*c.anom + 0.14*c.str + 0.12*Math.min(1, Math.abs(c.rv ?? 0)/220);
    const stellarType = classifyStellarType(c.bpRp);
    const vTotalKms   = Math.sqrt(
      (c.hasPm ? (PM_VTAN_COEF*c.pmra /(c.parallax||1))**2 + (PM_VTAN_COEF*c.pmdec/(c.parallax||1))**2 : 0)
      + (c.hasRv ? c.rv*c.rv : 0)
    );

    return {
      id: c.id, record: c.record,
      ra: c.ra, dec: c.dec, distance_pc: c.hasDistance ? c.distance : null,
      parallax: c.parallax, pmra: c.pmra, pmdec: c.pmdec, radial_velocity: c.rv,
      col: normalizeNumber(c.bpRp, 1.2),
      anom: c.anom, dyn: c.dyn, str: c.str, vel: vTotalKms,
      score, tier: getTier(score),
      stellarType,
      anomalyBand:  getAnomalyBand(c.anom),
      dynamicsBand: getDynamicsBand(c.dyn),
      tempBand:     getTempBand(stellarType.temperature),
      // Scene-space initial position and velocity (per year)
      pos0: { x: x0, y: y0, z: z0 },
      vel3: { x: vx_scene, y: vy_scene, z: vz_scene },
      flags: { hasDistance: c.hasDistance, hasPm: c.hasPm, hasRv: c.hasRv },
    };
  });
}

// ─── Pair link helpers (from ChatGPT) ────────────────────────────────────────

function normalizePairEndpoint(v) { if (v === null || v === undefined || v === "") return ""; return String(v); }
function normalizePair(pair) {
  return {
    sourceA: normalizePairEndpoint(pair?.source_a ?? pair?.source_id_a ?? pair?.SOURCE_ID_A ?? pair?.primary_source_id ?? pair?.sourceA ?? pair?.a),
    sourceB: normalizePairEndpoint(pair?.source_b ?? pair?.source_id_b ?? pair?.SOURCE_ID_B ?? pair?.secondary_source_id ?? pair?.sourceB ?? pair?.b),
    score:   normalizeNumber(pair?.binary_pair_score ?? pair?.pair_score ?? pair?.score, 0),
  };
}

function buildPairLinks(candidates, possiblePairs = []) {
  const indexMap = new Map();
  candidates.forEach((c,i) => { if (c?.id) indexMap.set(String(c.id),i); });
  const pairArray = Array.isArray(possiblePairs) ? possiblePairs : [];
  const links = pairArray.map(normalizePair)
    .map((p) => ({ a:indexMap.get(p.sourceA), b:indexMap.get(p.sourceB), score:p.score }))
    .filter((l) => Number.isInteger(l.a) && Number.isInteger(l.b) && l.a !== l.b);
  const unique = new Map();
  links.forEach((l) => {
    const key = `${Math.min(l.a,l.b)}-${Math.max(l.a,l.b)}`;
    if (!unique.has(key)) unique.set(key, { ...l, a:Math.min(l.a,l.b), b:Math.max(l.a,l.b) });
  });
  return Array.from(unique.values()).slice(0,120);
}

// ─── Category connection lines ────────────────────────────────────────────────
// Builds index pairs of candidates sharing the same category value

function buildCategoryLinks(candidates, linkCategory) {
  if (!linkCategory || linkCategory === "none") return [];
  const groups = new Map();

  candidates.forEach((c, i) => {
    let key = null;
    if (linkCategory === "stellar")  key = c.stellarType.type;
    if (linkCategory === "tier")     key = String(c.tier);
    if (linkCategory === "anomaly")  key = c.anomalyBand;
    if (linkCategory === "temp")     key = c.tempBand;
    if (linkCategory === "dynamics") key = c.dynamicsBand;
    if (key === null) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });

  const links = [];
  groups.forEach((indices) => {
    if (indices.length < 2) return;
    // Connect each node to next in group (chain — avoids O(n²) for large groups)
    for (let k = 0; k < indices.length - 1; k++) {
      links.push({ a: indices[k], b: indices[k+1] });
    }
  });
  return links;
}

function disposeObject3D(object) {
  if (!object) return;
  object.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => { m.map?.dispose?.(); m.dispose?.(); });
      else { child.material.map?.dispose?.(); child.material.dispose?.(); }
    }
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CandidateSignalMap3D({
  records = [],
  allRecords = [],
  possiblePairs = [],
  onCandidateSelect,
  selectedSourceId = null,
}) {
  const mountRef        = useRef(null);
  const rendererRef     = useRef(null);
  const sceneRef        = useRef(null);
  const cameraRef       = useRef(null);
  const sphereGroupRef  = useRef(null);
  const haloGroupRef    = useRef(null);
  const linkGroupRef    = useRef(null);
  const catLinkGroupRef = useRef(null);
  const particleRef     = useRef(null);
  const meshesRef       = useRef([]);
  const haloMeshesRef   = useRef([]);
  const linkLinesRef    = useRef([]);
  const catLinkLinesRef = useRef([]);
  const rafRef          = useRef(null);
  const frameRef        = useRef(0);
  const raycasterRef    = useRef(new THREE.Raycaster());
  const mouseRef        = useRef(new THREE.Vector2(-9,-9));
  const candidatesRef   = useRef([]);
  const pairLinksRef    = useRef([]);
  const catLinksRef     = useRef([]);
  const hoveredIdRef    = useRef(null);
  const textureCache    = useRef(new Map());

  const dragRef         = useRef({ active:false, lastX:0, lastY:0 });
  const orbitRef        = useRef({ theta:0.75, phi:0.95, radius:2.2 });
  const transitionRef   = useRef({ t:1, from:[], to:[] });
  const focusRef        = useRef({ target:new THREE.Vector3(0,0,0), current:new THREE.Vector3(0,0,0) });

  // ── Kinematic evolution refs ────────────────────────────────────────────
  const kinGroupRef       = useRef(null);
  const kinTrailGroupRef  = useRef(null);
  const kinMeshesRef      = useRef([]);          // Mesh per star (max 1000)
  const kinHaloMeshesRef  = useRef([]);          // Halo glow per star
  const kinCandidatesRef  = useRef([]);          // Built kinematic candidates
  const kinTrailHistoryRef= useRef([]);          // Vector3 history per star
  const kinTrailLinesRef  = useRef([]);          // Line objects per star
  const kinTimeRef        = useRef(0);           // current sim time (years)
  const kinLastSampleRef  = useRef(0);           // last sample frame
  const kinSubsetMaskRef  = useRef([]);          // visibility mask

  const [viewMode,       setViewMode]       = useState("graphCloud");
  const [colorMode,      setColorMode]      = useState("stellar");
  const [starSize,       setStarSize]       = useState(0.85);
  const [spatialSpread,  setSpatialSpread]  = useState(1.8);
  const [followSelected, setFollowSelected] = useState(false);
  const [showLinks,      setShowLinks]      = useState(false);
  const [linkCategory,   setLinkCategory]   = useState("none");
  const [paused,         setPaused]         = useState(false);
  const [freeFly,        setFreeFly]        = useState(false);
  const [hovered,        setHovered]        = useState(null);
  const [selected,       setSelected]       = useState(null);

  // ── Kinematic evolution UI state ───────────────────────────────────────
  const [kinPlay,         setKinPlay]         = useState(false);
  const [kinTimeSpeed,    setKinTimeSpeed]    = useState(10);      // years per second (sober default)
  const [kinMotionScale,  setKinMotionScale]  = useState(50);      // pure visual amplifier
  const [kinTime,         setKinTime]         = useState(0);
  const [kinTrailsMode,   setKinTrailsMode]   = useState("selected"); // off | selected | topAnomaly | all
  const [kinTrailOpacity, setKinTrailOpacity] = useState(0.28);
  const [kinTrailWidth,   setKinTrailWidth]   = useState(1.5);
  const [kinSubset,       setKinSubset]       = useState("all");      // all | topAnomaly | neighborhood

  // Time horizon is bound to the current time speed (auto, hidden control)
  const kinTimeHorizon = Math.max(50, kinTimeSpeed * 60);            // ~ ±60 s of playback

  const pausedRef          = useRef(false);
  const freeFlyRef         = useRef(false);
  const kinPlayRef         = useRef(false);
  const kinTimeSpeedRef    = useRef(10);
  const kinTimeHorizonRef  = useRef(600);
  const kinMotionScaleRef  = useRef(50);
  const kinTrailsModeRef   = useRef("selected");
  const kinTrailOpacityRef = useRef(0.28);
  const kinTrailWidthRef   = useRef(1.5);
  const viewModeRef        = useRef("graphCloud");
  const selectedIdRef      = useRef(null);

  useEffect(() => { pausedRef.current  = paused;   }, [paused]);
  useEffect(() => { freeFlyRef.current = freeFly;  }, [freeFly]);
  useEffect(() => { kinPlayRef.current         = kinPlay;         }, [kinPlay]);
  useEffect(() => { kinTimeSpeedRef.current    = kinTimeSpeed;    }, [kinTimeSpeed]);
  useEffect(() => { kinTimeHorizonRef.current  = kinTimeHorizon;  }, [kinTimeHorizon]);
  useEffect(() => { kinMotionScaleRef.current  = kinMotionScale;  }, [kinMotionScale]);
  useEffect(() => { kinTrailsModeRef.current   = kinTrailsMode;   }, [kinTrailsMode]);
  useEffect(() => { kinTrailOpacityRef.current = kinTrailOpacity; }, [kinTrailOpacity]);
  useEffect(() => { kinTrailWidthRef.current   = kinTrailWidth;   }, [kinTrailWidth]);
  useEffect(() => { viewModeRef.current        = viewMode;        }, [viewMode]);
  useEffect(() => { selectedIdRef.current      = selectedSourceId; }, [selectedSourceId]);

  const candidates = useMemo(() => buildCandidates(records), [records]);
  const pairLinks  = useMemo(() => buildPairLinks(candidates, possiblePairs), [candidates, possiblePairs]);
  const catLinks   = useMemo(() => buildCategoryLinks(candidates, linkCategory), [candidates, linkCategory]);

  // Kinematic candidates use the full Gaia DR3 demo set (allRecords),
  // falling back to `records` when allRecords is not provided.
  const kinCandidates = useMemo(() => {
    if (!Array.isArray(allRecords) || !allRecords.length) {
      return buildKinematicCandidates(records);
    }
    return buildKinematicCandidates(allRecords);
  }, [allRecords, records]);

  const kinSubsetMask = useMemo(() => {
    const N = kinCandidates.length;
    if (kinSubset === "all") return new Array(N).fill(true);
    if (kinSubset === "topAnomaly") {
      const top = kinCandidates
        .map((c, i) => ({ i, s: c.anom }))
        .sort((a, b) => b.s - a.s)
        .slice(0, Math.min(50, N))
        .map((x) => x.i);
      const set = new Set(top);
      return kinCandidates.map((_, i) => set.has(i));
    }
    if (kinSubset === "stellar") {
      return kinCandidates.map((c) => c.stellarType.type !== "Unknown");
    }
    if (kinSubset === "neighborhood" && selectedSourceId) {
      const selIdx = kinCandidates.findIndex((c) => String(c.id) === String(selectedSourceId));
      if (selIdx < 0) return new Array(N).fill(true);
      const sel = kinCandidates[selIdx].pos0;
      const dists = kinCandidates.map((c, i) => ({
        i,
        d: (c.pos0.x - sel.x) ** 2 + (c.pos0.y - sel.y) ** 2 + (c.pos0.z - sel.z) ** 2,
      }));
      dists.sort((a, b) => a.d - b.d);
      const set = new Set(dists.slice(0, 31).map((x) => x.i));
      return kinCandidates.map((_, i) => set.has(i));
    }
    return new Array(N).fill(true);
  }, [kinCandidates, kinSubset, selectedSourceId]);

  const scales = useMemo(() => ({
    ra:       normalizeList(candidates.map((c) => c.ra           ?? 0)),
    dec:      normalizeList(candidates.map((c) => c.dec          ?? 0)),
    distance: normalizeList(candidates.map((c) => c.distance_pc  ?? 0)),
    pmra:     normalizeList(candidates.map((c) => c.pmra         ?? 0)),
    pmdec:    normalizeList(candidates.map((c) => c.pmdec        ?? 0)),
    rv:       normalizeList(candidates.map((c) => c.radial_velocity ?? c.vel ?? 0)),
  }), [candidates]);

  useEffect(() => {
    candidatesRef.current = candidates;
    pairLinksRef.current  = pairLinks;
    catLinksRef.current   = catLinks;
  }, [candidates, pairLinks, catLinks]);

  // ── Stellar texture (cached per type) ────────────────────────────────────────
  const getStellarTexture = useCallback((hexColor, temperature) => {
    const key = `${hexColor}_${Math.round(temperature/500)*500}`;
    if (!textureCache.current.has(key)) {
      textureCache.current.set(key, createStellarTexture(hexColor, temperature));
    }
    return textureCache.current.get(key);
  }, []);

  // ── Position ──────────────────────────────────────────────────────────────────
  const spreadPoint = useCallback((x, y, z, candidate) => {
    const spread = normalizeNumber(spatialSpread, 1);
    return new THREE.Vector3(
      (x-0.5)*spread + (seededNoise(candidate.id,101)-0.5)*0.08,
      (y-0.5)*spread + (seededNoise(candidate.id,102)-0.5)*0.08,
      (z-0.5)*spread + (seededNoise(candidate.id,103)-0.5)*0.08,
    );
  }, [spatialSpread]);

  const positionForCandidate = useCallback((candidate, modeKey) => {
    if (modeKey === "graphCloud") return spreadPoint(
      0.58*scales.ra.scale(candidate.ra??0)         + 0.42*clamp01(candidate.anom),
      0.58*scales.dec.scale(candidate.dec??0)        + 0.42*clamp01(candidate.dyn),
      0.55*scales.distance.scale(candidate.distance_pc??0) + 0.45*clamp01(candidate.str),
      candidate,
    );
    if (modeKey === "kinematic") return spreadPoint(
      scales.pmra.scale(candidate.pmra??0),
      scales.pmdec.scale(candidate.pmdec??0),
      scales.rv.scale(candidate.radial_velocity ?? candidate.vel ?? 0),
      candidate,
    );
    return spreadPoint(candidate.anom, candidate.dyn, candidate.str, candidate);
  }, [scales, spreadPoint]);

  const buildPositions = useCallback(
    (modeKey) => candidatesRef.current.map((c) => positionForCandidate(c, modeKey)),
    [positionForCandidate]
  );

  const clearGroup = useCallback((group) => {
    if (!group) return;
    while (group.children.length > 0) { const child=group.children[0]; group.remove(child); disposeObject3D(child); }
  }, []);

  // ── Pair links ────────────────────────────────────────────────────────────────
  const rebuildLinks = useCallback(() => {
    const lg = linkGroupRef.current; if (!lg) return;
    clearGroup(lg); linkLinesRef.current = [];
    if (!showLinks || !pairLinksRef.current.length) return;
    pairLinksRef.current.forEach((link) => {
      const mA=meshesRef.current[link.a], mB=meshesRef.current[link.b];
      if (!mA||!mB) return;
      const g = new THREE.BufferGeometry().setFromPoints([mA.position.clone(), mB.position.clone()]);
      const m = new THREE.LineBasicMaterial({ color:0x00d2ff, transparent:true, opacity:Math.max(0.22,Math.min(0.75,0.28+link.score*0.45)) });
      const line = new THREE.Line(g,m); lg.add(line); linkLinesRef.current.push(line);
    });
  }, [clearGroup, showLinks]);

  const updateLinks = useCallback(() => {
    if (!showLinks) return;
    pairLinksRef.current.forEach((link,i) => {
      const line=linkLinesRef.current[i], mA=meshesRef.current[link.a], mB=meshesRef.current[link.b];
      if (!line||!mA||!mB) return;
      line.geometry.setFromPoints([mA.position.clone(), mB.position.clone()]);
    });
  }, [showLinks]);

  // ── Category connection lines ─────────────────────────────────────────────────
  const rebuildCatLinks = useCallback(() => {
    const clg = catLinkGroupRef.current; if (!clg) return;
    clearGroup(clg); catLinkLinesRef.current = [];
    if (!catLinksRef.current.length) return;

    // Color per category mode
    const catColor = linkCategory==="stellar"?"#ffffff":linkCategory==="tier"?"#00ff8c":
                     linkCategory==="anomaly"?"#ff6b35":linkCategory==="temp"?"#ffe484":"#a78bfa";

    catLinksRef.current.forEach((link) => {
      const mA=meshesRef.current[link.a], mB=meshesRef.current[link.b];
      if (!mA||!mB) return;
      const g = new THREE.BufferGeometry().setFromPoints([mA.position.clone(), mB.position.clone()]);
      const m = new THREE.LineBasicMaterial({
        color: new THREE.Color(catColor),
        transparent: true,
        opacity: 0.28,
      });
      const line = new THREE.Line(g,m); clg.add(line); catLinkLinesRef.current.push(line);
    });
  }, [clearGroup, linkCategory]);

  const updateCatLinks = useCallback(() => {
    catLinksRef.current.forEach((link,i) => {
      const line=catLinkLinesRef.current[i], mA=meshesRef.current[link.a], mB=meshesRef.current[link.b];
      if (!line||!mA||!mB) return;
      line.geometry.setFromPoints([mA.position.clone(), mB.position.clone()]);
    });
  }, []);

  // ── Selection state ───────────────────────────────────────────────────────────
  const applySelectionState = useCallback((currentColorMode = colorMode) => {
    meshesRef.current.forEach((mesh,i) => {
      const c=candidatesRef.current[i]; if (!c||!mesh.material) return;
      const isSelected = selectedSourceId && c.id && String(c.id)===String(selectedSourceId);
      if (isSelected) {
        const selCol=new THREE.Color(SELECTED_COLOR);
        mesh.material.color.set(selCol); mesh.material.emissive.set(selCol);
        mesh.material.emissiveIntensity=3.0; mesh.scale.setScalar(1.65);
        if (followSelected) focusRef.current.target.copy(mesh.position);
        if (haloMeshesRef.current[i]) { haloMeshesRef.current[i].material.color.set(selCol); haloMeshesRef.current[i].material.opacity=0.55; }
        return;
      }
      const baseCol=new THREE.Color(getCandidateColor(c,currentColorMode));
      mesh.material.color.set(baseCol); mesh.material.emissive.set(baseCol);
      mesh.material.emissiveIntensity=TIER_GLOW[c.tier]*0.38; mesh.scale.setScalar(1);
      if (haloMeshesRef.current[i]) { haloMeshesRef.current[i].material.color.set(baseCol); haloMeshesRef.current[i].material.opacity=c.tier===0?0.20:0.09; }
    });
  }, [colorMode, followSelected, selectedSourceId]);

  // ── Rebuild meshes ────────────────────────────────────────────────────────────
  const rebuildMeshes = useCallback((modeKey=viewMode, currentColorMode=colorMode, currentStarSize=starSize) => {
    const sg=sphereGroupRef.current, hg=haloGroupRef.current;
    if (!sg||!hg) return;
    clearGroup(sg); clearGroup(hg); meshesRef.current=[]; haloMeshesRef.current=[];

    candidatesRef.current.forEach((c,i) => {
      const hex     = getCandidateColor(c, currentColorMode);
      const col     = new THREE.Color(hex);
      const radius  = (0.015 + c.score * 0.040) * currentStarSize;
      const texture = getStellarTexture(hex, c.stellarType.temperature);

      // Main sphere
      const geo = new THREE.SphereGeometry(radius, 32, 32);
      const mat = new THREE.MeshStandardMaterial({
        map:              texture,
        color:            col,
        emissive:         col,
        emissiveIntensity: TIER_GLOW[c.tier] * 0.40,
        emissiveMap:      texture,
        roughness:        0.25,
        metalness:        0.05,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(positionForCandidate(c, modeKey));
      mesh.userData = { index:i, id:c.id };
      sg.add(mesh); meshesRef.current.push(mesh);

      // Glow halo
      const haloR = radius * (c.tier===0 ? 3.0 : c.tier===1 ? 2.4 : 1.8);
      const haloGeo = new THREE.SphereGeometry(haloR, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: col, transparent:true, opacity:c.tier===0?0.20:0.09,
        blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.FrontSide,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.copy(mesh.position);
      hg.add(haloMesh); haloMeshesRef.current.push(haloMesh);
    });

    applySelectionState(currentColorMode);
    rebuildLinks();
    rebuildCatLinks();
  }, [applySelectionState, clearGroup, colorMode, getStellarTexture, positionForCandidate, rebuildCatLinks, rebuildLinks, starSize, viewMode]);

  // ── Kinematic evolution — meshes / per-frame updates ─────────────────
  // Uses the same procedural stellar texture as the legacy top-50 view so
  // the 1000 stars look consistent with the rest of the framework and with
  // page 5. We reuse the existing textureCache, so only one canvas per
  // (color, temperature bin) is ever created.
  const rebuildKinematicMeshes = useCallback(() => {
    const kg = kinGroupRef.current, tg = kinTrailGroupRef.current;
    if (!kg || !tg) return;
    clearGroup(kg); clearGroup(tg);
    kinMeshesRef.current      = [];
    kinHaloMeshesRef.current  = [];
    kinTrailLinesRef.current  = [];
    kinTrailHistoryRef.current= [];

    // SHARED geometry — one sphere reused by all 1000 stars
    const sharedGeo = new THREE.SphereGeometry(1, 12, 10);

    // Pre-compute "top anomaly" set (these get procedural texture)
    const cands = kinCandidatesRef.current;
    const TOP_N = Math.min(15, cands.length);
    const topAnomSet = new Set(
      cands.map((c, i) => ({ i, s: c.anom }))
           .sort((a, b) => b.s - a.s)
           .slice(0, TOP_N)
           .map((x) => x.i)
    );

    cands.forEach((c, i) => {
      const hex     = c.stellarType.color;
      const col     = new THREE.Color(hex);
      // Visual radius proxy (compressed; not physical)
      const baseR   = 0.012 + (c.score * 0.018) + (Math.min(1, c.stellarType.temperature/10000) * 0.006);

      // Lightweight default material; selected + top-anomaly get richer look
      const useTexture = topAnomSet.has(i);
      const tex = useTexture ? getStellarTexture(hex, c.stellarType.temperature) : null;

      const mat = useTexture
        ? new THREE.MeshStandardMaterial({
            map: tex, color: col, emissive: col, emissiveMap: tex,
            emissiveIntensity: TIER_GLOW[c.tier] * 0.5,
            roughness: 0.32, metalness: 0.05,
          })
        : new THREE.MeshBasicMaterial({
            color: col, transparent: true, opacity: 0.95,
          });

      const mesh = new THREE.Mesh(sharedGeo, mat);
      mesh.scale.setScalar(baseR);
      mesh.position.set(c.pos0.x, c.pos0.y, c.pos0.z);
      mesh.userData = { index: i, id: c.id, kin: true, baseR };
      mesh.visible = !!kinSubsetMaskRef.current[i];
      kg.add(mesh);
      kinMeshesRef.current.push(mesh);

      // Halo only for tier-0 stars (≤ ~20 halos in practice)
      let haloMesh = null;
      if (c.tier === 0) {
        const haloMat = new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.20,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        haloMesh = new THREE.Mesh(sharedGeo, haloMat);
        haloMesh.scale.setScalar(baseR * 2.4);
        haloMesh.position.copy(mesh.position);
        haloMesh.visible = mesh.visible;
        kg.add(haloMesh);
      }
      kinHaloMeshesRef.current.push(haloMesh);

      // Trail line (initially empty)
      const tGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(TRAIL_LEN * 3);
      tGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      tGeo.setDrawRange(0, 0);
      const tMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0 });
      const line = new THREE.Line(tGeo, tMat);
      line.visible = false;
      tg.add(line);
      kinTrailLinesRef.current.push(line);
      kinTrailHistoryRef.current.push([mesh.position.clone()]);
    });
  }, [clearGroup, getStellarTexture]);

  const updateKinematicScene = useCallback((dtSeconds) => {
    if (viewModeRef.current !== "kinematicEvolution") return;
    const meshes = kinMeshesRef.current;
    const halos  = kinHaloMeshesRef.current;
    const cands  = kinCandidatesRef.current;
    if (!meshes.length || !cands.length) return;

    // Advance simulation time only while playing
    if (kinPlayRef.current) {
      const horizon = Math.max(1, kinTimeHorizonRef.current);
      let nextT = kinTimeRef.current + dtSeconds * kinTimeSpeedRef.current;
      if (nextT >  horizon) nextT =  horizon;
      if (nextT < -horizon) nextT = -horizon;
      kinTimeRef.current = nextT;
    }

    const t    = kinTimeRef.current;
    const mask = kinSubsetMaskRef.current;
    // motionScale is a pure VISUAL amplifier — the displayed time (years)
    // is not affected. Without amplification, Gaia mas/yr motions are
    // invisible in a few-thousand-year window.
    const gain = kinMotionScaleRef.current;

    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i]; const c = cands[i]; const h = halos[i];
      if (!m || !c) continue;
      const vis = !!mask[i];
      m.visible = vis;
      if (h) h.visible = vis;
      if (!vis) continue;

      const dt = t * gain;
      const x = c.pos0.x + c.vel3.x * dt;
      const y = c.pos0.y + c.vel3.y * dt;
      const z = c.pos0.z + c.vel3.z * dt;
      m.position.set(x, y, z);
      if (h) h.position.copy(m.position);

      const isSel = selectedIdRef.current && String(c.id) === String(selectedIdRef.current);
      const baseR = m.userData.baseR || 0.02;
      if (isSel) {
        m.material.color.set(SELECTED_COLOR);
        if (m.material.emissive) {
          m.material.emissive.set(SELECTED_COLOR);
          m.material.emissiveIntensity = 2.8;
        }
        m.scale.setScalar(baseR * 2.4);
        if (h) { h.material.color.set(SELECTED_COLOR); h.material.opacity = 0.55; }
      } else {
        const base = new THREE.Color(c.stellarType.color);
        m.material.color.set(base);
        if (m.material.emissive) {
          m.material.emissive.set(base);
          m.material.emissiveIntensity = TIER_GLOW[c.tier] * 0.5;
        }
        m.scale.setScalar(baseR);
        if (h) { h.material.color.set(base); h.material.opacity = 0.2; }
      }
    }

    // Sample trails periodically (~6 frames) for performance
    const shouldSample = (frameRef.current - kinLastSampleRef.current) >= 6;
    if (shouldSample) {
      kinLastSampleRef.current = frameRef.current;
      const trailsMode = kinTrailsModeRef.current;
      const baseOpacity = kinTrailOpacityRef.current;

      // Precompute "top anomaly" set if needed
      let topSet = null;
      if (trailsMode === "topAnomaly") {
        const top = cands
          .map((c, i) => ({ i, s: c.anom }))
          .sort((a, b) => b.s - a.s)
          .slice(0, Math.min(15, cands.length))
          .map((x) => x.i);
        topSet = new Set(top);
      }

      for (let i = 0; i < meshes.length; i++) {
        const line = kinTrailLinesRef.current[i];
        if (!line) continue;
        if (!mask[i]) { line.visible = false; continue; }

        const history = kinTrailHistoryRef.current[i];
        history.push(meshes[i].position.clone());
        if (history.length > TRAIL_LEN) history.shift();

        const isSel = selectedIdRef.current && String(cands[i].id) === String(selectedIdRef.current);
        let show = false;
        if      (trailsMode === "all")        show = true;
        else if (trailsMode === "selected")   show = !!isSel;
        else if (trailsMode === "topAnomaly") show = topSet ? topSet.has(i) : false;
        else                                  show = false;

        line.visible = show;
        if (show && history.length >= 2) {
          const attr = line.geometry.getAttribute("position");
          for (let k = 0; k < history.length; k++) {
            attr.setXYZ(k, history[k].x, history[k].y, history[k].z);
          }
          attr.needsUpdate = true;
          line.geometry.setDrawRange(0, history.length);
          line.geometry.computeBoundingSphere();
          line.material.opacity   = isSel ? Math.min(1, baseOpacity + 0.45) : baseOpacity;
          line.material.linewidth = isSel ? Math.max(2, kinTrailWidthRef.current * 1.8)
                                          : Math.max(1, kinTrailWidthRef.current);
        }
      }
    }
  }, []);

  const resetKinematic = useCallback(() => {
    kinTimeRef.current = 0;
    setKinTime(0);
    kinTrailHistoryRef.current = kinTrailHistoryRef.current.map(() => []);
    kinTrailLinesRef.current.forEach((l) => {
      if (!l) return;
      l.visible = false;
      l.geometry.setDrawRange(0, 0);
    });
    // Snap each star back to pos0
    const meshes = kinMeshesRef.current;
    const halos  = kinHaloMeshesRef.current;
    const cands  = kinCandidatesRef.current;
    for (let i = 0; i < meshes.length; i++) {
      const c = cands[i]; if (!c) continue;
      const s = c.sceneScale;
      const p = new THREE.Vector3(c.pos0.x * s, c.pos0.y * s, c.pos0.z * s);
      meshes[i].position.copy(p);
      if (halos[i]) halos[i].position.copy(p);
    }
  }, []);

  // Sync kinematic refs whenever data or subset changes
  useEffect(() => {
    kinCandidatesRef.current = kinCandidates;
    kinSubsetMaskRef.current = kinSubsetMask;
    if (kinGroupRef.current && viewMode === "kinematicEvolution") {
      rebuildKinematicMeshes();
      resetKinematic();
    }
  }, [kinCandidates, kinSubsetMask, viewMode, rebuildKinematicMeshes, resetKinematic]);

  // Toggle legacy vs kinematic groups when viewMode changes.
  // When entering evolution mode we explicitly stop any latent camera drift
  // and place the camera in a neutral, slightly-elevated viewpoint so the
  // stars are seen as a 3D field, not as a stripe.
  useEffect(() => {
    const inEvo = viewMode === "kinematicEvolution";
    if (sphereGroupRef.current)   sphereGroupRef.current.visible   = !inEvo;
    if (haloGroupRef.current)     haloGroupRef.current.visible     = !inEvo;
    if (linkGroupRef.current)     linkGroupRef.current.visible     = !inEvo;
    if (catLinkGroupRef.current)  catLinkGroupRef.current.visible  = !inEvo;
    if (kinGroupRef.current)      kinGroupRef.current.visible      = inEvo;
    if (kinTrailGroupRef.current) kinTrailGroupRef.current.visible = inEvo;
    if (inEvo) {
      // Neutral camera framing for the 3D field, no auto-rotation.
      orbitRef.current.theta  = 0.6;
      orbitRef.current.phi    = 1.15;
      orbitRef.current.radius = 3.6;
      focusRef.current.target.set(0,0,0);
      if (kinGroupRef.current && kinMeshesRef.current.length === 0) {
        rebuildKinematicMeshes();
      }
    }
  }, [viewMode, rebuildKinematicMeshes]);

  // Sync sim time into UI while playing
  useEffect(() => {
    if (viewMode !== "kinematicEvolution") return undefined;
    const id = window.setInterval(() => { setKinTime(kinTimeRef.current); }, 120);
    return () => window.clearInterval(id);
  }, [viewMode]);

  // ── Background particles ──────────────────────────────────────────────────────
  function buildParticleField(scene) {
    const count = 1200;
    const pos = new Float32Array(count*3);
    for (let i=0;i<count;i++) {
      pos[i*3]   = (Math.random()-0.5)*18;
      pos[i*3+1] = (Math.random()-0.5)*18;
      pos[i*3+2] = (Math.random()-0.5)*18;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos,3));
    const mat = new THREE.PointsMaterial({ color:0x8ab4cc, size:0.016, transparent:true, opacity:0.28, sizeAttenuation:true });
    const pts = new THREE.Points(geo,mat); scene.add(pts); return pts;
  }

  // ── Bootstrap Three.js ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current; if (!el) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:"high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.setClearColor(0x010912,1);
    rendererRef.current = renderer;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene(); sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(55,2,0.01,500); cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xffffff,0.42));
    const lA=new THREE.PointLight(0x00d2ff,1.3,50); lA.position.set(3,3,3); scene.add(lA);
    const lB=new THREE.PointLight(0x00ff8c,0.9,50); lB.position.set(-2,0,2); scene.add(lB);
    const lC=new THREE.PointLight(0xffd060,0.5,50); lC.position.set(1,-2,-1); scene.add(lC);

    const sg=new THREE.Group(); sphereGroupRef.current=sg; scene.add(sg);
    const hg=new THREE.Group(); haloGroupRef.current=hg;   scene.add(hg);
    const lg=new THREE.Group(); linkGroupRef.current=lg;   scene.add(lg);
    const clg=new THREE.Group(); catLinkGroupRef.current=clg; scene.add(clg);
    const kg=new THREE.Group(); kinGroupRef.current=kg;    scene.add(kg);   kg.visible = false;
    const ktg=new THREE.Group(); kinTrailGroupRef.current=ktg; scene.add(ktg); ktg.visible = false;

    particleRef.current = buildParticleField(scene);

    const handleResize = () => {
      const w=Math.max(320,el.clientWidth||680), h=Math.max(300,el.clientHeight||420);
      renderer.setSize(w,h,false);
      renderer.domElement.style.width=`${w}px`; renderer.domElement.style.height=`${h}px`;
      camera.aspect=w/h; camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(handleResize); ro.observe(el); handleResize();

    const handleWheel = (e) => {
      e.preventDefault();
      orbitRef.current.radius = Math.max(0.06, Math.min(40, orbitRef.current.radius + e.deltaY*0.0022));
    };
    el.addEventListener("wheel", handleWheel, { passive:false });

    candidatesRef.current = candidates;
    pairLinksRef.current  = pairLinks;
    catLinksRef.current   = catLinks;
    rebuildMeshes(viewMode, colorMode, starSize);

    let lastTs = performance.now();
    const animate = () => {
      rafRef.current = window.requestAnimationFrame(animate);
      const sc=sceneRef.current, ca=cameraRef.current, re=rendererRef.current;
      if (!sc||!ca||!re) return;

      const nowTs = performance.now();
      const dtSec = Math.min(0.1, Math.max(0, (nowTs - lastTs) / 1000));
      lastTs = nowTs;

      focusRef.current.current.lerp(focusRef.current.target, 0.08);
      const tgt = focusRef.current.current;

      const { theta, phi, radius } = orbitRef.current;

      const inEvo = viewModeRef.current === "kinematicEvolution";
      // Auto-rotation is disabled in kinematic evolution so the apparent
      // motion of each star is driven only by its own pmra/pmdec/RV proxy.
      if (!pausedRef.current && !dragRef.current.active && !inEvo) {
        orbitRef.current.theta += 0.004;
      }

      // Per-frame kinematic evolution update (per-star positions + trails)
      if (inEvo) updateKinematicScene(dtSec);

      // Free fly: camera moves along its own forward direction when zooming
      if (freeFlyRef.current) {
        const dir = new THREE.Vector3(0,0,-1).applyQuaternion(ca.quaternion).normalize();
        const dist = focusRef.current.target.distanceTo(ca.position);
        focusRef.current.target.copy(ca.position).addScaledVector(dir, Math.max(dist, 0.5));
      }

      ca.position.set(
        tgt.x + radius*Math.sin(phi)*Math.sin(theta),
        tgt.y + radius*Math.cos(phi),
        tgt.z + radius*Math.sin(phi)*Math.cos(theta),
      );
      ca.lookAt(tgt);

      // Transition
      const tr = transitionRef.current;
      if (tr.t < 1) {
        tr.t = Math.min(1, tr.t+0.038);
        const ease = 1-Math.pow(1-tr.t,3);
        meshesRef.current.forEach((m,i) => {
          if (tr.from[i]&&tr.to[i]) {
            m.position.lerpVectors(tr.from[i],tr.to[i],ease);
            if (haloMeshesRef.current[i]) haloMeshesRef.current[i].position.copy(m.position);
          }
        });
      } else {
        meshesRef.current.forEach((m,i) => { if (haloMeshesRef.current[i]) haloMeshesRef.current[i].position.copy(m.position); });
      }

      updateLinks();
      updateCatLinks();

      // Pulse
      const pulse = 0.3+0.25*Math.sin(frameRef.current*0.07);
      meshesRef.current.forEach((m,i) => {
        const c=candidatesRef.current[i]; if (!c||!m.material) return;
        const isSel = selectedSourceId && c.id && String(c.id)===String(selectedSourceId);
        if (isSel) { m.material.emissiveIntensity=3.0+pulse*0.8; return; }
        let intensity=TIER_GLOW[c.tier]*0.38;
        if (c.tier===0) intensity+=pulse*0.85;
        m.material.emissiveIntensity=intensity;
        if (haloMeshesRef.current[i]) haloMeshesRef.current[i].material.opacity=(c.tier===0?0.13:0.07)+pulse*(c.tier===0?0.11:0.04);
      });

      if (particleRef.current) particleRef.current.rotation.y+=0.0003;

      // Raycasting (mesh pool depends on view mode)
      raycasterRef.current.setFromCamera(mouseRef.current,ca);
      const pickPool = inEvo
        ? (kinGroupRef.current?.children?.filter((o) => o.userData?.kin) ?? [])
        : (sg.children ?? []);
      const hits=raycasterRef.current.intersectObjects(pickPool);
      const hovIdx=hits.length>0?hits[0].object.userData.index:null;
      const hovCand=hovIdx!==null
        ? (inEvo
            ? (kinCandidatesRef.current[hovIdx] ?? null)
            : (candidatesRef.current[hovIdx]   ?? null))
        : null;
      const hovId=hovCand?.id??null;
      if (hoveredIdRef.current!==hovId) { hoveredIdRef.current=hovId; setHovered(hovCand); }

      re.render(sc,ca);
      frameRef.current+=1;
    };
    animate();

    return () => {
      window.cancelAnimationFrame(rafRef.current);
      try { el.removeEventListener("wheel",handleWheel); } catch { /* safe */ }
      try { ro.disconnect(); } catch { /* safe */ }
      try { clearGroup(sg); clearGroup(hg); clearGroup(lg); clearGroup(clg); clearGroup(kg); clearGroup(ktg); } catch { /* safe */ }
      try { disposeObject3D(scene); } catch { /* safe */ }
      try { textureCache.current.forEach((t)=>t.dispose()); textureCache.current.clear(); } catch { /* safe */ }
      try { renderer.dispose?.(); } catch { /* safe */ }
      try { renderer.forceContextLoss?.(); } catch { /* safe */ }
      try { if (renderer.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); } catch { /* safe */ }
      rendererRef.current=null; sceneRef.current=null; cameraRef.current=null;
      sphereGroupRef.current=null; haloGroupRef.current=null; linkGroupRef.current=null; catLinkGroupRef.current=null;
      kinGroupRef.current=null; kinTrailGroupRef.current=null;
      meshesRef.current=[]; haloMeshesRef.current=[]; linkLinesRef.current=[]; catLinkLinesRef.current=[];
      kinMeshesRef.current=[]; kinHaloMeshesRef.current=[]; kinTrailLinesRef.current=[]; kinTrailHistoryRef.current=[];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effects ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    candidatesRef.current=candidates; pairLinksRef.current=pairLinks; catLinksRef.current=catLinks;
    if (sphereGroupRef.current) rebuildMeshes(viewMode,colorMode,starSize);
  }, [candidates,pairLinks,catLinks,rebuildMeshes,viewMode,colorMode,starSize]);

  useEffect(() => {
    if (!meshesRef.current.length) return;
    transitionRef.current = { t:0, from:meshesRef.current.map((m)=>m.position.clone()), to:buildPositions(viewMode) };
  }, [viewMode,buildPositions,spatialSpread]);

  useEffect(() => { applySelectionState(colorMode); }, [applySelectionState,colorMode,selectedSourceId,followSelected]);
  useEffect(() => { rebuildLinks(); }, [rebuildLinks,showLinks]);
  useEffect(() => { catLinksRef.current=catLinks; rebuildCatLinks(); }, [catLinks,rebuildCatLinks]);

  // ── Mouse handlers ────────────────────────────────────────────────────────────
  const handleMouseDown = (e) => { dragRef.current={ active:true, lastX:e.clientX, lastY:e.clientY }; };
  const handleMouseUp   = ()  => { dragRef.current.active=false; };
  const handleMouseMove = (e) => {
    if (dragRef.current.active) {
      orbitRef.current.theta -= (e.clientX-dragRef.current.lastX)*0.008;
      orbitRef.current.phi    = Math.max(0.08,Math.min(Math.PI-0.08, orbitRef.current.phi-(e.clientY-dragRef.current.lastY)*0.008));
      dragRef.current.lastX=e.clientX; dragRef.current.lastY=e.clientY;
    }
    const rect=mountRef.current?.getBoundingClientRect();
    if (rect&&rect.width>0&&rect.height>0) {
      mouseRef.current.set(
        ((e.clientX-rect.left)/rect.width)*2-1,
        -((e.clientY-rect.top)/rect.height)*2+1,
      );
    }
  };
  const handleDoubleClick = () => { orbitRef.current.radius=2.2; orbitRef.current.theta=0.75; orbitRef.current.phi=0.95; focusRef.current.target.set(0,0,0); };
  const handleClick = () => {
    if (hovered) {
      setSelected(hovered);
      if (followSelected) { const m=meshesRef.current.find((mesh)=>mesh.userData?.id===hovered.id); if (m) focusRef.current.target.copy(m.position); }
      if (typeof onCandidateSelect==="function") onCandidateSelect(hovered.record??hovered);
      return;
    }
    setSelected(null);
  };

  const activeInfo       = hovered ?? selected;
  const currentView      = VIEW_MODES[viewMode] ?? VIEW_MODES.graphCloud;
  const hasRealPairLinks = Array.isArray(possiblePairs) && possiblePairs.length>0;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="csm3d-shell">

      {/* Top bar */}
      <div className="csm3d-topbar">
        <span className="csm3d-title">Candidate Signal Map · 3D candidate cloud · top-50 anomaly pool</span>
        <div className="csm3d-axis-btns">
          {Object.entries(VIEW_MODES).map(([key,mode])=>(
            <button key={key} type="button" className={`csm3d-btn${viewMode===key?" on":""}`} onClick={()=>setViewMode(key)}>
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Controls row 1: color + star size + spread */}
      <div className="csm3d-controls">
        <div className="csm3d-ctrl-group">
          <span className="csm3d-ctrl-label">Color by</span>
          {Object.entries(COLOR_MODES).map(([key,label])=>(
            <button key={key} type="button" className={`csm3d-pill${colorMode===key?" on":""}`} onClick={()=>setColorMode(key)}>{label}</button>
          ))}
        </div>
        <div className="csm3d-ctrl-group">
          <span className="csm3d-ctrl-label">Star size</span>
          <input type="range" min="0.15" max="2.4" step="0.05" value={starSize}
            onChange={(e)=>setStarSize(Number(e.target.value))} className="csm3d-slider"/>
          <span className="csm3d-slider-val">{starSize.toFixed(2)}×</span>
        </div>
        <div className="csm3d-ctrl-group">
          <span className="csm3d-ctrl-label">Spread</span>
          <input type="range" min="0.6" max="5" step="0.1" value={spatialSpread}
            onChange={(e)=>setSpatialSpread(Number(e.target.value))} className="csm3d-slider"/>
          <span className="csm3d-slider-val">{spatialSpread.toFixed(1)}×</span>
        </div>
      </div>

      {/* Controls row 2: navigation + links + category */}
      <div className="csm3d-controls csm3d-controls-row2">
        {/* Pause / resume */}
        <button type="button" className={`csm3d-pill csm3d-pill-icon${paused?" on":""}`}
          onClick={()=>setPaused((v)=>!v)} title="Pause / resume auto-rotation">
          {paused ? "▶ Resume rotation" : "⏸ Pause rotation"}
        </button>

        {/* Free fly */}
        <button type="button" className={`csm3d-pill csm3d-pill-icon${freeFly?" on":""}`}
          onClick={()=>setFreeFly((v)=>!v)} title="Free fly: zoom toward camera look-at instead of origin">
          {freeFly ? "🚀 Free fly ON" : "🚀 Free fly"}
        </button>

        {/* Follow selected */}
        <button type="button" className={`csm3d-pill${followSelected?" on":""}`}
          onClick={()=>setFollowSelected((v)=>!v)}>
          Follow selected {followSelected?"on":"off"}
        </button>

        {/* Pair links */}
        <button type="button" className={`csm3d-pill${showLinks?" on":""}`}
          disabled={!hasRealPairLinks} onClick={()=>setShowLinks((v)=>!v)}
          title={hasRealPairLinks?"Show pair links":"No possiblePairs attached"}>
          Pair links {showLinks?"on":"off"}
        </button>

        {/* Category connection lines */}
        <div className="csm3d-ctrl-group">
          <span className="csm3d-ctrl-label">Connect by</span>
          {Object.entries(LINK_CATEGORIES).map(([key,label])=>(
            <button key={key} type="button"
              className={`csm3d-pill csm3d-pill-sm${linkCategory===key?" on":""}`}
              onClick={()=>setLinkCategory(key)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Kinematic evolution controls — visible only in motion mode */}
      {viewMode === "kinematicEvolution" && (
        <>
          <div className="csm3d-controls csm3d-controls-row3 csm3d-evo-bar">
            <button type="button"
              className={`csm3d-pill csm3d-pill-icon${kinPlay?" on":""}`}
              onClick={()=>setKinPlay((v)=>!v)}
              title="Play / pause candidate-level projected motion traces (proper-motion trajectories) — not confirmed orbits">
              {kinPlay ? "⏸ Pause" : "▶ Play"}
            </button>
            <button type="button" className="csm3d-pill csm3d-pill-icon"
              onClick={()=>{ setKinPlay(false); resetKinematic(); }}>
              ↺ Reset
            </button>

            <div className="csm3d-ctrl-group">
              <span className="csm3d-ctrl-label">Time speed</span>
              <input type="range" min="1" max="50000" step="1" value={kinTimeSpeed}
                onChange={(e)=>setKinTimeSpeed(Number(e.target.value))} className="csm3d-slider"/>
              <span className="csm3d-slider-val">{kinTimeSpeed.toLocaleString()} yr/s</span>
            </div>

            <div className="csm3d-ctrl-group">
              <span className="csm3d-ctrl-label">Motion scale</span>
              <input type="range" min="1" max="500" step="1" value={kinMotionScale}
                onChange={(e)=>setKinMotionScale(Number(e.target.value))} className="csm3d-slider"/>
              <span className="csm3d-slider-val">×{kinMotionScale}</span>
            </div>

            <div className="csm3d-time-display">
              t = {kinTime>=0?"+":""}{Math.round(kinTime).toLocaleString()} yr
            </div>
          </div>

          <div className="csm3d-controls csm3d-controls-row4 csm3d-evo-bar">
            <div className="csm3d-ctrl-group">
              <span className="csm3d-ctrl-label" title="Projected motion traces / proper-motion trajectories — not confirmed orbits">Motion traces</span>
              {[
                { k:"off",        l:"Off" },
                { k:"selected",   l:"Selected" },
                { k:"topAnomaly", l:"Top anomalies" },
                { k:"all",        l:"All" },
              ].map((opt)=>(
                <button key={opt.k} type="button"
                  className={`csm3d-pill csm3d-pill-sm${kinTrailsMode===opt.k?" on":""}`}
                  onClick={()=>setKinTrailsMode(opt.k)}>{opt.l}</button>
              ))}
            </div>

            <div className="csm3d-ctrl-group">
              <span className="csm3d-ctrl-label">Trace intensity</span>
              <input type="range" min="0.05" max="1" step="0.05" value={kinTrailOpacity}
                onChange={(e)=>setKinTrailOpacity(Number(e.target.value))} className="csm3d-slider"/>
              <span className="csm3d-slider-val">{kinTrailOpacity.toFixed(2)}</span>
            </div>

            <div className="csm3d-ctrl-group">
              <span className="csm3d-ctrl-label">Trace width</span>
              <input type="range" min="0.5" max="6" step="0.5" value={kinTrailWidth}
                onChange={(e)=>setKinTrailWidth(Number(e.target.value))} className="csm3d-slider"/>
              <span className="csm3d-slider-val">{kinTrailWidth.toFixed(1)}</span>
            </div>

            <div className="csm3d-ctrl-group">
              <span className="csm3d-ctrl-label">Subset</span>
              {[
                { k:"all",          l:"All 1000" },
                { k:"topAnomaly",   l:"Top anomalies" },
                { k:"neighborhood", l:"Selected · neighborhood" },
              ].map((opt)=>(
                <button key={opt.k} type="button"
                  className={`csm3d-pill csm3d-pill-sm${kinSubset===opt.k?" on":""}`}
                  onClick={()=>setKinSubset(opt.k)}>{opt.l}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Canvas */}
      <div ref={mountRef} className="csm3d-canvas-wrap"
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}    onMouseLeave={handleMouseUp}
        onClick={handleClick}        onDoubleClick={handleDoubleClick}
        style={{ cursor:dragRef.current?.active?"grabbing":hovered?"pointer":"grab" }}
      />

      {/* Info overlay */}
      {activeInfo && (
        <div className="csm3d-overlay">
          <div className="csm3d-ov-id">{activeInfo.id}</div>
          <div className="csm3d-ov-stellar">
            <span className="csm3d-stellar-dot" style={{ background:`#${activeInfo.stellarType.color.toString(16).padStart(6,"0")}` }}/>
            {activeInfo.stellarType.name}
          </div>
          <div className="csm3d-ov-grid">
            <div className="csm3d-ov-row"><span>Anomaly</span>     <strong>{activeInfo.anom.toFixed(4)}</strong></div>
            <div className="csm3d-ov-row"><span>Dynamics</span>    <strong>{activeInfo.dyn.toFixed(4)}</strong></div>
            <div className="csm3d-ov-row"><span>Structure</span>   <strong>{activeInfo.str.toFixed(4)}</strong></div>
            <div className="csm3d-ov-row"><span>Velocity</span>    <strong>{activeInfo.vel.toFixed(1)} km/s</strong></div>
            <div className="csm3d-ov-row"><span>BP-RP</span>       <strong>{activeInfo.col.toFixed(3)}</strong></div>
            <div className="csm3d-ov-row"><span>Distance</span>    <strong>{activeInfo.distance_pc?`${activeInfo.distance_pc.toFixed(1)} pc`:"N/A"}</strong></div>
            <div className="csm3d-ov-row"><span>~Temperature</span><strong>~{activeInfo.stellarType.temperature.toLocaleString()} K</strong></div>
          </div>
          <div className="csm3d-ov-tier">{TIER_NAMES[activeInfo.tier]}</div>
        </div>
      )}

      {/* Axis labels */}
      <div className="csm3d-ax-labels">
        <span>{currentView.description}</span>
        {viewMode === "kinematicEvolution" ? (
          <span>Kinematic projection · Gaia DR3 demo set · candidate-level · external validation required</span>
        ) : (
          <span>{hasRealPairLinks?"Pair links available":"No pair links"} · {linkCategory!=="none"?`Connecting: ${LINK_CATEGORIES[linkCategory]}`:"No category lines"}</span>
        )}
        <span>Selected → green · double-click → reset view</span>
      </div>

      {/* Footer legend */}
      <div className="csm3d-footer">
        {colorMode==="stellar" ? (
          <div className="csm3d-legend" style={{ flexWrap:"wrap" }}>
            {STELLAR_LEGEND.map((s)=>(
              <div key={s.label} className="csm3d-leg-item">
                <div className="csm3d-leg-dot" style={{ background:s.col }}/>{s.label}
              </div>
            ))}
          </div>
        ) : (
          <div className="csm3d-legend">
            {[{color:"#00ff8c",label:"Priority"},{color:"#00d2ff",label:"Strong"},{color:"#8b7fff",label:"Moderate"},{color:"rgba(90,130,150,0.7)",label:"Routine"}].map((item)=>(
              <div key={item.label} className="csm3d-leg-item">
                <div className="csm3d-leg-dot" style={{ background:item.color }}/>{item.label}
              </div>
            ))}
          </div>
        )}
        <span className="csm3d-hint">drag · scroll · double-click reset · click select</span>
      </div>

      <div className="csm3d-note">
        {viewMode === "kinematicEvolution" ? (
          <>
            Projected motion visualization of up to {KIN_MAX_SOURCES} Gaia DR3 demo sources. Positions are derived from a
            <em> local tangent projection</em> (RA−RA₀)·cos(Dec₀), (Dec−Dec₀), (distance−distance_median) centred on the dataset.
            Each star moves <em>individually</em> using its own <em>pmra</em>, <em>pmdec</em> and (when available) <em>radial_velocity</em>;
            sources without radial velocity move on the plane of sky only. <em>Motion scale</em> is a pure visual amplifier;
            the simulated time (years) displayed in the UI is unaffected.
            <strong> This is NOT an N-body simulation.</strong> Lines drawn are <em>projected motion traces</em>
            (also: <em>proper-motion trajectories</em>) — they are candidate-level and do NOT confirm orbits, binarity,
            close encounters, future dynamical states or gravitational interactions. External validation via Gaia Archive,
            SIMBAD, VizieR, Aladin or X-Match is required.
          </>
        ) : (
          <>
            Stellar textures simulate limb darkening, convection cells and corona glow based on BP-RP proxy temperature.
            Connection lines link stars sharing the selected category. No element represents a confirmed astrophysical classification.
          </>
        )}
      </div>
    </div>
  );
}

/*
────────────────────────────────────────────────────────────────────────────────
  CSS — aggiungi/sostituisci in styles.css
────────────────────────────────────────────────────────────────────────────────

.csm3d-shell {
  background: #010912;
  border-radius: 14px;
  overflow: hidden;
  font-family: 'Courier New', monospace;
  border: 1px solid rgba(0, 255, 140, 0.12);
  position: relative;
  box-shadow:
    0 0 0 1px rgba(0,255,140,0.06),
    0 8px 40px rgba(0,0,0,0.6),
    inset 0 1px 0 rgba(0,255,140,0.08);
}
.csm3d-topbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 10px 18px;
  border-bottom: 1px solid rgba(0, 255, 140, 0.1);
  background: rgba(1,9,18,0.85);
  flex-wrap: wrap;
}
.csm3d-title {
  font-size: 9px; color: #00ff8c; font-weight: 700;
  letter-spacing: .18em; text-transform: uppercase;
}
.csm3d-axis-btns { display: flex; gap: 5px; flex-wrap: wrap; }
.csm3d-btn {
  padding: 4px 11px; border-radius: 999px;
  border: 1px solid rgba(0,210,255,0.22); background: transparent;
  color: #00d2ff; font-size: 9px; cursor: pointer;
  font-family: inherit; transition: all .18s;
}
.csm3d-btn.on, .csm3d-btn:hover {
  background: rgba(0,210,255,0.14); border-color: #00d2ff;
  box-shadow: 0 0 10px rgba(0,210,255,0.2);
}
.csm3d-controls {
  display: flex; align-items: center; gap: 14px;
  padding: 8px 18px;
  background: rgba(1,6,14,0.7);
  border-bottom: 1px solid rgba(0,255,140,0.06);
  flex-wrap: wrap;
}
.csm3d-controls-row2 {
  border-bottom: 1px solid rgba(0,255,140,0.04);
  padding-top: 6px; padding-bottom: 6px;
}
.csm3d-ctrl-group { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.csm3d-ctrl-label {
  font-size: 9px; color: rgba(100,180,200,0.45);
  text-transform: uppercase; letter-spacing: .12em;
  margin-right: 2px; white-space: nowrap;
}
.csm3d-pill {
  padding: 4px 10px; border-radius: 999px;
  border: 1px solid rgba(0,210,255,0.16); background: rgba(1,6,14,0.6);
  color: rgba(0,210,255,0.55); font-size: 9px; cursor: pointer;
  font-family: inherit; transition: all .18s; white-space: nowrap;
}
.csm3d-pill-sm { padding: 3px 7px; font-size: 8px; }
.csm3d-pill-icon { font-size: 9px; }
.csm3d-pill.on, .csm3d-pill:hover:not(:disabled) {
  background: rgba(0,210,255,0.1); border-color: rgba(0,210,255,0.4); color: #00d2ff;
  box-shadow: 0 0 8px rgba(0,210,255,0.18);
}
.csm3d-pill:disabled { opacity: 0.28; cursor: not-allowed; }
.csm3d-slider { width: 82px; accent-color: #00ff8c; }
.csm3d-slider-val {
  font-size: 10px; color: #00ff8c;
  font-family: 'Courier New', monospace; min-width: 36px;
}
.csm3d-canvas-wrap {
  width: 100%; height: 420px;
  position: relative; overflow: hidden;
  background: radial-gradient(ellipse at center, #010f20 0%, #010912 100%);
}
.csm3d-canvas-wrap canvas {
  display: block; width: 100% !important; height: 100% !important;
}
.csm3d-overlay {
  position: absolute; top: 10px; right: 10px;
  background: rgba(1,6,16,0.94);
  border: 1px solid rgba(0,255,140,0.25);
  border-radius: 10px; padding: 12px 15px; min-width: 192px;
  pointer-events: none; z-index: 10;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,255,140,0.08);
  backdrop-filter: blur(8px);
}
.csm3d-ov-id {
  font-size: 10px; color: #00ff8c; font-weight: 700;
  margin-bottom: 6px; word-break: break-all;
}
.csm3d-ov-stellar {
  display: flex; align-items: center; gap: 6px;
  font-size: 9px; color: #d6eeff; margin-bottom: 8px;
  padding-bottom: 6px; border-bottom: 1px solid rgba(0,255,140,0.1);
}
.csm3d-stellar-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 6px currentColor; }
.csm3d-ov-grid { display: flex; flex-direction: column; gap: 2px; }
.csm3d-ov-row { display: flex; justify-content: space-between; gap: 10px; font-size: 9px; }
.csm3d-ov-row span   { color: #4a8aac; }
.csm3d-ov-row strong { color: #d6eeff; }
.csm3d-ov-tier {
  font-size: 9px; color: #00ff8c; margin-top: 8px; padding-top: 6px;
  border-top: 1px solid rgba(0,255,140,0.12);
}
.csm3d-ax-labels {
  position: absolute; bottom: 66px; left: 14px;
  font-size: 9px; color: rgba(80,160,190,0.35);
  line-height: 1.75; pointer-events: none; display: flex; flex-direction: column;
}
.csm3d-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 18px; border-top: 1px solid rgba(0,255,140,0.06);
  background: rgba(1,6,14,0.7); flex-wrap: wrap; gap: 6px;
}
.csm3d-legend { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.csm3d-leg-item {
  display: flex; align-items: center; gap: 4px;
  font-size: 9px; color: rgba(100,170,190,0.62);
}
.csm3d-leg-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  box-shadow: 0 0 4px currentColor;
}
.csm3d-hint { font-size: 9px; color: rgba(80,140,160,0.38); font-family: 'Courier New', monospace; }
.csm3d-note {
  padding: 7px 18px; font-size: 9px; color: rgba(80,130,150,0.35);
  border-top: 1px solid rgba(0,255,140,0.04);
  font-style: italic; line-height: 1.55;
  background: rgba(1,6,14,0.5);
}
*/
