import React, { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import CandidateDossierGenerator from "./CandidateDossierGenerator.jsx";

function normalizeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isNaN(number) ? fallback : number;
}

function getSourceId(source) {
  return String(source?.SOURCE_ID ?? source?.source_id ?? source?.id ?? "");
}

function formatNumber(value, digits = 6) {
  const number = Number(value);

  if (Number.isNaN(number) || value === null || value === undefined) {
    return "N/A";
  }

  return number.toFixed(digits);
}

function formatGaiaValue(value, digits = 10) {
  const number = Number(value);

  if (Number.isNaN(number) || value === null || value === undefined) {
    return "N/A";
  }

  return number.toFixed(digits);
}

function buildMapBySourceId(items = []) {
  const map = new Map();

  items.forEach((item) => {
    const sourceId = getSourceId(item);

    if (sourceId) {
      map.set(sourceId, item);
    }
  });

  return map;
}

function computeDistancePc(parallaxMas) {
  const parallax = normalizeNumber(parallaxMas, null);

  if (parallax === null || parallax <= 0) {
    return null;
  }

  return 1000 / parallax;
}

function computeProperMotionTotal(pmra, pmdec) {
  const a = normalizeNumber(pmra, null);
  const d = normalizeNumber(pmdec, null);

  if (a === null || d === null) {
    return null;
  }

  return Math.sqrt(a * a + d * d);
}

function computeTangentialVelocity(pmTotal, parallaxMas) {
  const mu = normalizeNumber(pmTotal, null);
  const parallax = normalizeNumber(parallaxMas, null);

  if (mu === null || parallax === null || parallax <= 0) {
    return null;
  }

  return 4.74047 * (mu / parallax);
}

function computeSpaceVelocity(tangentialVelocity, radialVelocity) {
  const vt = normalizeNumber(tangentialVelocity, null);
  const vr = normalizeNumber(radialVelocity, null);

  if (vt === null && vr === null) {
    return null;
  }

  if (vt === null) {
    return Math.abs(vr);
  }

  if (vr === null) {
    return Math.abs(vt);
  }

  return Math.sqrt(vt * vt + vr * vr);
}

function computeDynamicsIndex(source) {
  const pmTotal = computeProperMotionTotal(source.pmra, source.pmdec);
  const tangentialVelocity = computeTangentialVelocity(
    pmTotal,
    source.parallax,
  );

  const spaceVelocity = computeSpaceVelocity(
    tangentialVelocity,
    source.radial_velocity,
  );

  const anomaly = normalizeNumber(source.anomaly_score, 0);
  const featureZ = Math.abs(normalizeNumber(source.dominant_feature_zscore, 0));
  const structural = normalizeNumber(source.structural_importance_score, 0);

  const velocityTerm =
    spaceVelocity === null ? 0 : Math.min(1, Math.abs(spaceVelocity) / 180);

  const properMotionTerm =
    pmTotal === null ? 0 : Math.min(1, Math.abs(pmTotal) / 120);

  const featureTerm = Math.min(1, featureZ / 8);

  return (
    0.32 * anomaly +
    0.22 * structural +
    0.18 * velocityTerm +
    0.14 * properMotionTerm +
    0.14 * featureTerm
  );
}

function computeHiddenCompanionIndex(source) {
  const ruwe = normalizeNumber(source.ruwe, null);

  const astrometricExcessNoise = normalizeNumber(
    source.astrometric_excess_noise,
    null,
  );

  const visibilityPeriods = normalizeNumber(
    source.visibility_periods_used,
    null,
  );

  const ipdFracMultiPeak = normalizeNumber(source.ipd_frac_multi_peak, null);

  const ipdGofHarmonicAmplitude = normalizeNumber(
    source.ipd_gof_harmonic_amplitude,
    null,
  );

  const hasDirectAstrometricQuality =
    ruwe !== null ||
    astrometricExcessNoise !== null ||
    visibilityPeriods !== null ||
    ipdFracMultiPeak !== null ||
    ipdGofHarmonicAmplitude !== null;

  const pmTotal = computeProperMotionTotal(source.pmra, source.pmdec);

  const tangentialVelocity = computeTangentialVelocity(
    pmTotal,
    source.parallax,
  );

  const spaceVelocity = computeSpaceVelocity(
    tangentialVelocity,
    source.radial_velocity,
  );

  const anomaly = normalizeNumber(source.anomaly_score, 0);
  const featureZ = Math.abs(normalizeNumber(source.dominant_feature_zscore, 0));
  const structural = normalizeNumber(source.structural_importance_score, 0);

  const ruweTerm =
    ruwe === null ? 0 : Math.min(1, Math.max(0, (ruwe - 1.0) / 1.0));

  const excessNoiseTerm =
    astrometricExcessNoise === null
      ? 0
      : Math.min(1, Math.max(0, astrometricExcessNoise / 2.0));

  const visibilityPenalty =
    visibilityPeriods === null
      ? 0
      : visibilityPeriods < 8
        ? 0.35
        : visibilityPeriods < 12
          ? 0.15
          : 0;

  const ipdMultiPeakTerm =
    ipdFracMultiPeak === null ? 0 : Math.min(1, ipdFracMultiPeak / 50);

  const ipdHarmonicTerm =
    ipdGofHarmonicAmplitude === null
      ? 0
      : Math.min(1, ipdGofHarmonicAmplitude / 0.2);

  const kinematicTerm =
    spaceVelocity === null ? 0 : Math.min(1, Math.abs(spaceVelocity) / 220);

  const fallbackTerm =
    0.35 * anomaly +
    0.25 * structural +
    0.2 * Math.min(1, featureZ / 8) +
    0.2 * kinematicTerm;

  if (!hasDirectAstrometricQuality) {
    return {
      value: fallbackTerm * 0.45,
      status: "Indirect proxy only",
      hasDirectAstrometricQuality: false,
    };
  }

  const directScore =
    0.34 * ruweTerm +
    0.24 * excessNoiseTerm +
    0.14 * visibilityPenalty +
    0.12 * ipdMultiPeakTerm +
    0.1 * ipdHarmonicTerm +
    0.06 * fallbackTerm;

  return {
    value: Math.min(1, directScore),
    status: "Astrometric-quality proxy",
    hasDirectAstrometricQuality: true,
  };
}

function classifyHiddenCompanion(indexResult) {
  if (!indexResult) {
    return "Not available";
  }

  if (!indexResult.hasDirectAstrometricQuality) {
    if (indexResult.value >= 0.28) {
      return "Weak indirect multiplicity hint";
    }

    return "No direct astrometric-quality fields";
  }

  if (indexResult.value >= 0.7) {
    return "High unresolved-companion suspicion";
  }

  if (indexResult.value >= 0.45) {
    return "Moderate unresolved-companion suspicion";
  }

  if (indexResult.value >= 0.25) {
    return "Weak unresolved-companion suspicion";
  }

  return "Low unresolved-companion suspicion";
}

function classifyDynamics(source, dynamicsIndex) {
  const radialVelocity = normalizeNumber(source.radial_velocity, null);
  const pmTotal = computeProperMotionTotal(source.pmra, source.pmdec);

  const tangentialVelocity = computeTangentialVelocity(
    pmTotal,
    source.parallax,
  );

  const spaceVelocity = computeSpaceVelocity(tangentialVelocity, radialVelocity);

  if (dynamicsIndex >= 0.62) {
    return "High-priority dynamical follow-up";
  }

  if (dynamicsIndex >= 0.46) {
    return "Moderate dynamical interest";
  }

  if (spaceVelocity !== null && spaceVelocity > 120) {
    return "High-velocity stellar candidate";
  }

  if (pmTotal !== null && pmTotal > 80) {
    return "High proper-motion source";
  }

  return "Ordinary kinematic profile";
}

function estimateGaiaColorIndex(source) {
  const bpRp = normalizeNumber(source.bp_rp, null);

  if (bpRp !== null) {
    return bpRp;
  }

  const bp = normalizeNumber(source.phot_bp_mean_mag, null);
  const rp = normalizeNumber(source.phot_rp_mean_mag, null);

  if (bp !== null && rp !== null) {
    return bp - rp;
  }

  return null;
}

function getStellarColorFromGaia(source) {
  const colorIndex = estimateGaiaColorIndex(source);

  if (colorIndex === null) {
    if (source.dynamics_classification === "High-priority dynamical follow-up") {
      return "#ff3a4e";
    }

    if (source.dynamics_classification === "Moderate dynamical interest") {
      return "#ffe033";
    }

    if (source.dynamics_classification === "High-velocity stellar candidate") {
      return "#00f5ff";
    }

    if (source.dynamics_classification === "High proper-motion source") {
      return "#c084fc";
    }

    return "#f4f8ff";
  }

  if (colorIndex < -0.1) return "#8fb8ff";
  if (colorIndex < 0.35) return "#b8d7ff";
  if (colorIndex < 0.75) return "#f4f8ff";
  if (colorIndex < 1.15) return "#fff3c4";
  if (colorIndex < 1.65) return "#ffd28a";
  if (colorIndex < 2.4) return "#ff9a62";

  return "#ff6b4a";
}

function estimateStellarRadius(source) {
  const gMag = normalizeNumber(source.phot_g_mean_mag, null);
  const anomaly = normalizeNumber(source.anomaly_score, 0);
  const dynamics = normalizeNumber(source.dynamics_index, 0);

  if (gMag !== null) {
    const brightness = Math.max(0.15, Math.min(1.9, (18 - gMag) / 8));
    return 1.4 + brightness * 3.1 + anomaly * 1.7 + dynamics * 1.5;
  }

  return 2.1 + anomaly * 2.3 + dynamics * 1.7;
}

function buildDynamicsRecord(source) {
  const sourceId = getSourceId(source);
  const distancePc = computeDistancePc(source.parallax);
  const pmTotal = computeProperMotionTotal(source.pmra, source.pmdec);

  const tangentialVelocity = computeTangentialVelocity(
    pmTotal,
    source.parallax,
  );

  const spaceVelocity = computeSpaceVelocity(
    tangentialVelocity,
    source.radial_velocity,
  );

  const dynamicsIndex = computeDynamicsIndex(source);
  const hiddenCompanionIndex = computeHiddenCompanionIndex(source);

  const enriched = {
    ...source,
    SOURCE_ID: sourceId,
    source_id: sourceId,
    distance_pc: distancePc,
    proper_motion_total: pmTotal,
    tangential_velocity: tangentialVelocity,
    approximate_space_velocity: spaceVelocity,
    dynamics_index: dynamicsIndex,
    hidden_companion_index: hiddenCompanionIndex.value,
    hidden_companion_status: hiddenCompanionIndex.status,
    hidden_companion_classification:
      classifyHiddenCompanion(hiddenCompanionIndex),
    has_direct_astrometric_quality:
      hiddenCompanionIndex.hasDirectAstrometricQuality,
  };

  enriched.dynamics_classification = classifyDynamics(enriched, dynamicsIndex);
  enriched.gaia_color_index = estimateGaiaColorIndex(enriched);
  enriched.stellar_visual_color = getStellarColorFromGaia(enriched);
  enriched.stellar_visual_radius = estimateStellarRadius(enriched);

  return enriched;
}

function getClassOptions(records) {
  const classes = new Set();

  records.forEach((record) => {
    if (record.dynamics_classification) {
      classes.add(record.dynamics_classification);
    }
  });

  return ["All dynamics classes", ...Array.from(classes).sort()];
}

function getMinMax(values) {
  const validValues = values.filter(
    (value) => value !== null && value !== undefined && !Number.isNaN(value),
  );

  if (!validValues.length) {
    return {
      min: -1,
      max: 1,
    };
  }

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);

  if (min === max) {
    return {
      min: min - 1,
      max: max + 1,
    };
  }

  const padding = (max - min) * 0.12;

  return {
    min: min - padding,
    max: max + padding,
  };
}

function normalizeRange(value, min, max) {
  const number = normalizeNumber(value, null);

  if (number === null || max === min) {
    return 0;
  }

  return (number - min) / (max - min) - 0.5;
}

function compressSigned(value) {
  const number = normalizeNumber(value, 0);
  const sign = number < 0 ? -1 : 1;

  return sign * Math.log10(1 + Math.abs(number));
}

function compressPositive(value) {
  const number = normalizeNumber(value, 0);
  return Math.log10(1 + Math.max(0, number));
}

function getStableHash(text) {
  let hash = 2166136261;

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;

  return function random() {
    state += 0x6d2b79f5;

    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getStableJitter(sourceId, amplitude = 1) {
  const hash = getStableHash(sourceId);
  const random = seededRandom(hash);

  return {
    jx: (random() - 0.5) * amplitude,
    jy: (random() - 0.5) * amplitude,
    jz: (random() - 0.5) * amplitude,
  };
}

function angularSeparationArcsec(a, b) {
  const ra1 = normalizeNumber(a.ra, null);
  const dec1 = normalizeNumber(a.dec, null);
  const ra2 = normalizeNumber(b.ra, null);
  const dec2 = normalizeNumber(b.dec, null);

  if (ra1 === null || dec1 === null || ra2 === null || dec2 === null) {
    return null;
  }

  const degToRad = Math.PI / 180;
  const r1 = ra1 * degToRad;
  const d1 = dec1 * degToRad;
  const r2 = ra2 * degToRad;
  const d2 = dec2 * degToRad;

  const sinDDec = Math.sin((d2 - d1) / 2);
  const sinDRa = Math.sin((r2 - r1) / 2);

  const h =
    sinDDec * sinDDec + Math.cos(d1) * Math.cos(d2) * sinDRa * sinDRa;

  const angleRad = 2 * Math.asin(Math.min(1, Math.sqrt(h)));

  return angleRad * (180 / Math.PI) * 3600;
}

function computePairCandidateScore(a, b) {
  const angularArcsec = angularSeparationArcsec(a, b);

  if (angularArcsec === null) {
    return null;
  }

  const parallaxA = normalizeNumber(a.parallax, null);
  const parallaxB = normalizeNumber(b.parallax, null);
  const pmraA = normalizeNumber(a.pmra, null);
  const pmraB = normalizeNumber(b.pmra, null);
  const pmdecA = normalizeNumber(a.pmdec, null);
  const pmdecB = normalizeNumber(b.pmdec, null);

  const parallaxDiff =
    parallaxA === null || parallaxB === null
      ? null
      : Math.abs(parallaxA - parallaxB);

  const parallaxMean =
    parallaxA === null || parallaxB === null
      ? null
      : (Math.abs(parallaxA) + Math.abs(parallaxB)) / 2;

  const parallaxRelativeDiff =
    parallaxDiff === null || parallaxMean === null || parallaxMean === 0
      ? null
      : parallaxDiff / parallaxMean;

  const pmDiff =
    pmraA === null || pmraB === null || pmdecA === null || pmdecB === null
      ? null
      : Math.sqrt((pmraA - pmraB) ** 2 + (pmdecA - pmdecB) ** 2);

  const angularTerm = Math.max(0, 1 - angularArcsec / 60);

  const parallaxTerm =
    parallaxRelativeDiff === null
      ? 0.25
      : Math.max(0, 1 - parallaxRelativeDiff / 0.35);

  const properMotionTerm =
    pmDiff === null ? 0.25 : Math.max(0, 1 - pmDiff / 35);

  const hiddenTerm =
    (normalizeNumber(a.hidden_companion_index, 0) +
      normalizeNumber(b.hidden_companion_index, 0)) /
    2;

  const score =
    0.42 * angularTerm +
    0.28 * parallaxTerm +
    0.22 * properMotionTerm +
    0.08 * hiddenTerm;

  return {
    angular_arcsec: angularArcsec,
    parallax_difference: parallaxDiff,
    parallax_relative_difference: parallaxRelativeDiff,
    proper_motion_difference: pmDiff,
    binary_pair_score: score,
  };
}

function classifyBinaryPair(pair) {
  if (!pair) {
    return "Not available";
  }

  if (
    pair.binary_pair_score >= 0.78 &&
    pair.angular_arcsec <= 15 &&
    (pair.parallax_relative_difference === null ||
      pair.parallax_relative_difference <= 0.18) &&
    (pair.proper_motion_difference === null ||
      pair.proper_motion_difference <= 12)
  ) {
    return "Strong comoving-pair candidate";
  }

  if (
    pair.binary_pair_score >= 0.58 &&
    pair.angular_arcsec <= 35 &&
    (pair.parallax_relative_difference === null ||
      pair.parallax_relative_difference <= 0.28)
  ) {
    return "Possible wide-binary candidate";
  }

  if (pair.binary_pair_score >= 0.42 && pair.angular_arcsec <= 60) {
    return "Weak proximity-pair candidate";
  }

  return "Low pair significance";
}

function findBinaryPairCandidates(records, maxPairs = 80) {
  const candidates = [];

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      const pairScore = computePairCandidateScore(a, b);

      if (!pairScore) {
        continue;
      }

      const classification = classifyBinaryPair(pairScore);

      if (classification === "Low pair significance") {
        continue;
      }

      candidates.push({
        pair_id: `${getSourceId(a)}__${getSourceId(b)}`,
        source_a: getSourceId(a),
        source_b: getSourceId(b),
        source_id_a: getSourceId(a),
        source_id_b: getSourceId(b),
        record_a: a,
        record_b: b,
        pair_classification: classification,
        ...pairScore,
      });
    }
  }

  return candidates
    .sort((a, b) => b.binary_pair_score - a.binary_pair_score)
    .slice(0, maxPairs);
}

function makeTextSprite(text, color = "#d7f5ff") {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = 1024;
  canvas.height = 256;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "bold 52px Arial";
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 18;
  context.fillText(text, 20, 120);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(90, 22, 1);

  return sprite;
}

function createProceduralStarTexture(source, baseColor) {
  const canvas = document.createElement("canvas");
  const size = 256;

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  const sourceId = getSourceId(source);
  const random = seededRandom(getStableHash(sourceId + "-texture"));

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.43;
  const colorIndex = normalizeNumber(source.gaia_color_index, 0.85);

  const gradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.16, "#fffde8");
  gradient.addColorStop(0.42, baseColor);
  gradient.addColorStop(0.82, baseColor);
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  const textureMood =
    colorIndex < 0.35 ? "hot" : colorIndex > 1.6 ? "cool" : "solar";

  for (let i = 0; i < 220; i++) {
    const angle = random() * Math.PI * 2;
    const dist = Math.sqrt(random()) * radius * 0.92;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const spotRadius = random() * 2.6 + 0.7;
    const alpha = random() * 0.16 + 0.025;

    if (textureMood === "hot") {
      ctx.fillStyle = `rgba(${160 + random() * 80}, ${
        205 + random() * 40
      }, 255, ${alpha})`;
    } else if (textureMood === "cool") {
      ctx.fillStyle = `rgba(255, ${90 + random() * 80}, ${
        35 + random() * 40
      }, ${alpha})`;
    } else {
      ctx.fillStyle = `rgba(255, ${210 + random() * 35}, ${
        130 + random() * 80
      }, ${alpha})`;
    }

    ctx.beginPath();
    ctx.arc(x, y, spotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 34; i++) {
    const angle = random() * Math.PI * 2;
    const dist = Math.sqrt(random()) * radius * 0.72;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;

    ctx.strokeStyle =
      textureMood === "hot"
        ? `rgba(210,235,255,${random() * 0.18 + 0.04})`
        : textureMood === "cool"
          ? `rgba(255,170,90,${random() * 0.18 + 0.04})`
          : `rgba(255,245,190,${random() * 0.18 + 0.04})`;

    ctx.lineWidth = random() * 1.3 + 0.45;
    ctx.beginPath();
    ctx.arc(x, y, random() * 15 + 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  const limb = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius);
  limb.addColorStop(0, "rgba(255,255,255,0)");
  limb.addColorStop(0.72, "rgba(0,0,0,0.04)");
  limb.addColorStop(1, "rgba(0,0,0,0.58)");

  ctx.fillStyle = limb;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  if (THREE.SRGBColorSpace) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  return texture;
}

function createStarObject(node, controls) {
  const group = new THREE.Group();

  const selected = controls.selectedSourceId === node.source_id;
  const binaryCandidate = controls.binarySourceIds.has(node.source_id);

  const baseColor = selected
    ? "#39ff14"
    : binaryCandidate
      ? "#ff66ff"
      : node.stellar_visual_color;

  const color = new THREE.Color(baseColor);

  const radius = selected
    ? node.stellar_visual_radius * controls.sphereScale * 2.15
    : binaryCandidate
      ? node.stellar_visual_radius * controls.sphereScale * 1.25
      : node.stellar_visual_radius * controls.sphereScale;

  const texture = createProceduralStarTexture(node, baseColor);
  const sphereGeometry = new THREE.SphereGeometry(radius, 56, 56);

  const sphereMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: selected
      ? 3.0
      : binaryCandidate
        ? 2.05
        : controls.starGlow,
    map: texture,
    roughness: 0.31,
    metalness: 0.015,
    transparent: true,
    opacity: selected ? 1 : controls.starOpacity,
  });

  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  group.add(sphere);

  const glowGeometry = new THREE.SphereGeometry(
    selected ? radius * 5.2 : binaryCandidate ? radius * 3.4 : radius * 2.7,
    42,
    42,
  );

  const glowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: selected ? 0.3 : binaryCandidate ? 0.19 : 0.11 * controls.starGlow,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  group.add(new THREE.Mesh(glowGeometry, glowMaterial));

  if (selected || binaryCandidate) {
    const ringColor = selected ? "#39ff14" : "#ff66ff";

    const ringGeometry = new THREE.RingGeometry(
      radius * 2.7,
      radius * 3.05,
      96,
    );

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: selected ? 0.9 : 0.48,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2.16;
    group.add(ring);
  }

  if (selected) {
    const label = makeTextSprite(node.source_id, "#39ff14");
    label.position.set(radius * 3.8, radius * 2.6, 0);
    group.add(label);
  }

  return group;
}

function StellarVelocitySpace3D({
  records,
  activeRecord,
  onSelect,
  binaryPairCandidates,
}) {
  const graphRef = useRef(null);

  const [velocityScale, setVelocityScale] = useState(2.35);
  const [depthScale, setDepthScale] = useState(2.15);
  const [sphereScale, setSphereScale] = useState(0.72);
  const [starGlow, setStarGlow] = useState(0.95);
  const [starOpacity, setStarOpacity] = useState(1);
  const [showOrdinary, setShowOrdinary] = useState(true);
  const [showBinaryLinks, setShowBinaryLinks] = useState(true);
  const [depthMode, setDepthMode] = useState("distance_pc");
  const [declutterSpread, setDeclutterSpread] = useState(1.45);
  const [mapMode, setMapMode] = useState("hybrid");

  const binarySourceIds = useMemo(() => {
    const ids = new Set();

    binaryPairCandidates.forEach((pair) => {
      ids.add(pair.source_a);
      ids.add(pair.source_b);
    });

    return ids;
  }, [binaryPairCandidates]);

  const plotRecords = useMemo(() => {
    return records.filter((record) => {
      if (
        !showOrdinary &&
        record.dynamics_classification === "Ordinary kinematic profile"
      ) {
        return false;
      }

      if (mapMode === "physical" || mapMode === "hybrid") {
        return (
          normalizeNumber(record.ra, null) !== null &&
          normalizeNumber(record.dec, null) !== null
        );
      }

      return (
        normalizeNumber(record.radial_velocity, null) !== null &&
        normalizeNumber(record.tangential_velocity, null) !== null
      );
    });
  }, [records, showOrdinary, mapMode]);

  const preparedRecords = useMemo(() => {
    return plotRecords.map((record) => {
      const depthValue =
        depthMode === "proper_motion_total"
          ? record.proper_motion_total
          : depthMode === "dynamics_index"
            ? record.dynamics_index
            : record.distance_pc;

      const physicalZ =
        depthMode === "dynamics_index"
          ? normalizeNumber(record.dynamics_index, 0)
          : compressPositive(depthValue);

      if (mapMode === "physical") {
        return {
          ...record,
          source_id: getSourceId(record),
          x_value: normalizeNumber(record.ra, 0),
          y_value: normalizeNumber(record.dec, 0),
          z_value: physicalZ,
        };
      }

      if (mapMode === "hybrid") {
        return {
          ...record,
          source_id: getSourceId(record),
          x_value: normalizeNumber(record.ra, 0),
          y_value: normalizeNumber(record.dec, 0),
          z_value:
            depthMode === "dynamics_index"
              ? normalizeNumber(record.dynamics_index, 0)
              : compressPositive(record.distance_pc),
        };
      }

      return {
        ...record,
        source_id: getSourceId(record),
        x_value: compressSigned(record.radial_velocity),
        y_value: compressPositive(record.tangential_velocity),
        z_value:
          depthMode === "dynamics_index"
            ? normalizeNumber(depthValue, 0)
            : compressPositive(depthValue),
      };
    });
  }, [plotRecords, depthMode, mapMode]);

  const ranges = useMemo(() => {
    return {
      x: getMinMax(preparedRecords.map((record) => record.x_value)),
      y: getMinMax(preparedRecords.map((record) => record.y_value)),
      z: getMinMax(preparedRecords.map((record) => record.z_value)),
    };
  }, [preparedRecords]);

  const graphData = useMemo(() => {
    const visibleIds = new Set(
      preparedRecords.map((record) => getSourceId(record)),
    );

    const nodes = preparedRecords.map((record) => {
      const sourceId = getSourceId(record);

      const jitterAmplitude =
        mapMode === "physical" || mapMode === "hybrid"
          ? 32 * declutterSpread
          : 110 * declutterSpread;

      const jitter = getStableJitter(sourceId, jitterAmplitude);

      const xMultiplier =
        mapMode === "physical" || mapMode === "hybrid" ? 900 : 820;

      const yMultiplier =
        mapMode === "physical" || mapMode === "hybrid" ? 640 : 720;

      const zMultiplier =
        mapMode === "physical" || mapMode === "hybrid" ? 520 : 780;

      const x =
        normalizeRange(record.x_value, ranges.x.min, ranges.x.max) *
          xMultiplier *
          velocityScale +
        jitter.jx;

      const y =
        normalizeRange(record.y_value, ranges.y.min, ranges.y.max) *
          yMultiplier *
          velocityScale +
        jitter.jy;

      const z =
        normalizeRange(record.z_value, ranges.z.min, ranges.z.max) *
          zMultiplier *
          depthScale +
        jitter.jz;

      return {
        ...record,
        id: sourceId,
        source_id: sourceId,
        fx: x,
        fy: y,
        fz: z,
        x,
        y,
        z,
      };
    });

    let links = [];

    if (showBinaryLinks && (mapMode === "physical" || mapMode === "hybrid")) {
      links = binaryPairCandidates
        .filter(
          (pair) =>
            visibleIds.has(pair.source_a) && visibleIds.has(pair.source_b),
        )
        .slice(0, 80)
        .map((pair) => ({
          source: pair.source_a,
          target: pair.source_b,
          pair_classification: pair.pair_classification,
          binary_pair_score: pair.binary_pair_score,
        }));
    }

    return {
      nodes,
      links,
    };
  }, [
    preparedRecords,
    ranges,
    velocityScale,
    depthScale,
    declutterSpread,
    mapMode,
    showBinaryLinks,
    binaryPairCandidates,
  ]);

  const visualControls = useMemo(
    () => ({
      selectedSourceId: activeRecord ? getSourceId(activeRecord) : null,
      sphereScale,
      starGlow,
      starOpacity,
      binarySourceIds,
    }),
    [activeRecord, sphereScale, starGlow, starOpacity, binarySourceIds],
  );

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }

    graphRef.current.d3Force("charge").strength(0);
    graphRef.current.d3Force("center", null);
    graphRef.current.d3Force("link").strength(0);

    const controls = graphRef.current.controls();

    if (controls) {
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.zoomSpeed = 2.35;
      controls.rotateSpeed = 0.76;
      controls.panSpeed = 1.25;
      controls.minDistance = 0.2;
      controls.maxDistance = 9000;
      controls.update();
    }
  }, [graphData]);

  function resetCamera() {
    if (!graphRef.current) {
      return;
    }

    graphRef.current.cameraPosition(
      { x: 0, y: -560, z: 1180 },
      { x: 0, y: 0, z: 0 },
      900,
    );
  }

  function focusSelectedStar() {
    if (!graphRef.current || !activeRecord) {
      return;
    }

    const sourceId = getSourceId(activeRecord);
    const node = graphData.nodes.find((item) => item.source_id === sourceId);

    if (!node) {
      return;
    }

    graphRef.current.cameraPosition(
      {
        x: node.x + 20,
        y: node.y - 34,
        z: node.z + 42,
      },
      {
        x: node.x,
        y: node.y,
        z: node.z,
      },
      950,
    );
  }

  useEffect(() => {
    window.setTimeout(resetCamera, 120);
  }, []);

  useEffect(() => {
    if (activeRecord) {
      window.setTimeout(focusSelectedStar, 120);
    }
  }, [activeRecord]);

  if (!plotRecords.length) {
    return (
      <section className="panel dynamics-lab-panel">
        <div className="panel-header">
          <div>
            <h2>3D Stellar Velocity Space</h2>
            <span>No plottable records available</span>
          </div>
        </div>

        <div className="empty-selection">
          No compatible data available for the selected visualization mode.
        </div>
      </section>
    );
  }

  return (
    <section className="panel dynamics-lab-panel velocity-space-panel">
      <div className="panel-header">
        <div>
          <h2>3D Stellar Field</h2>
          <span>
            {mapMode === "kinematic"
              ? "Kinematic space with procedural stellar appearance"
              : mapMode === "physical"
                ? "Physical Gaia field with procedural stellar appearance"
                : "Hybrid Gaia/dynamics field with procedural stellar appearance"}
          </span>
        </div>

        <span className="source-table-count">
          {plotRecords.length} plotted sources
        </span>
      </div>

      <div className="coherence-warning">
        <strong>Scientific note:</strong> stellar colours and surfaces are
        visual simulations from Gaia colour and photometric proxies when
        available. Pair links are conservative proximity/comoving candidates,
        not confirmed binaries.
      </div>

      <div className="graph-controls" style={{ marginBottom: "12px" }}>
        <button type="button" onClick={resetCamera}>
          Reset 3D view
        </button>

        <button type="button" onClick={focusSelectedStar}>
          Focus selected star
        </button>

        <label>
          Map mode
          <select
            value={mapMode}
            onChange={(event) => setMapMode(event.target.value)}
          >
            <option value="hybrid">Hybrid Gaia / dynamics</option>
            <option value="physical">Physical Gaia field</option>
            <option value="kinematic">Kinematic velocity space</option>
          </select>
        </label>

        <label>
          Depth axis
          <select
            value={depthMode}
            onChange={(event) => setDepthMode(event.target.value)}
          >
            <option value="distance_pc">Distance</option>
            <option value="proper_motion_total">Proper motion total</option>
            <option value="dynamics_index">Dynamics index</option>
          </select>
        </label>

        <label>
          <input
            type="checkbox"
            checked={showOrdinary}
            onChange={(event) => setShowOrdinary(event.target.checked)}
          />
          Show ordinary profiles
        </label>

        <label>
          <input
            type="checkbox"
            checked={showBinaryLinks}
            onChange={(event) => setShowBinaryLinks(event.target.checked)}
          />
          Show possible binary links
        </label>

        <label className="range-control">
          Field scale
          <input
            type="range"
            min="0.45"
            max="5"
            step="0.05"
            value={velocityScale}
            onChange={(event) => setVelocityScale(Number(event.target.value))}
          />
          <span>{velocityScale.toFixed(2)}</span>
        </label>

        <label className="range-control">
          Depth scale
          <input
            type="range"
            min="0.25"
            max="5"
            step="0.05"
            value={depthScale}
            onChange={(event) => setDepthScale(Number(event.target.value))}
          />
          <span>{depthScale.toFixed(2)}</span>
        </label>

        <label className="range-control">
          Declutter spread
          <input
            type="range"
            min="0"
            max="4.5"
            step="0.05"
            value={declutterSpread}
            onChange={(event) => setDeclutterSpread(Number(event.target.value))}
          />
          <span>{declutterSpread.toFixed(2)}</span>
        </label>

        <label className="range-control">
          Sphere size
          <input
            type="range"
            min="0.12"
            max="3.5"
            step="0.05"
            value={sphereScale}
            onChange={(event) => setSphereScale(Number(event.target.value))}
          />
          <span>{sphereScale.toFixed(2)}</span>
        </label>

        <label className="range-control">
          Stellar glow
          <input
            type="range"
            min="0.15"
            max="3"
            step="0.05"
            value={starGlow}
            onChange={(event) => setStarGlow(Number(event.target.value))}
          />
          <span>{starGlow.toFixed(2)}</span>
        </label>

        <label className="range-control">
          Opacity
          <input
            type="range"
            min="0.2"
            max="1"
            step="0.02"
            value={starOpacity}
            onChange={(event) => setStarOpacity(Number(event.target.value))}
          />
          <span>{starOpacity.toFixed(2)}</span>
        </label>
      </div>

      <div
        style={{
          height: "820px",
          minHeight: "820px",
          borderRadius: "18px",
          overflow: "hidden",
          border: "1px solid rgba(0,245,255,0.22)",
          background:
            "radial-gradient(circle at center, rgba(0, 245, 255, 0.06), rgba(0, 0, 0, 1) 72%)",
          position: "relative",
        }}
      >
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData}
          backgroundColor="#000000"
          nodeThreeObject={(node) => createStarObject(node, visualControls)}
          nodeLabel={(node) =>
            `SOURCE_ID: ${node.source_id}
Class: ${node.dynamics_classification}
BP-RP / colour index: ${formatNumber(node.gaia_color_index, 4)}
RA: ${formatGaiaValue(node.ra, 10)} deg
DEC: ${formatGaiaValue(node.dec, 10)} deg
Parallax: ${formatGaiaValue(node.parallax, 10)} mas
Radial velocity: ${formatNumber(node.radial_velocity, 6)} km/s
Tangential velocity: ${formatNumber(node.tangential_velocity, 6)} km/s
Distance: ${formatNumber(node.distance_pc, 6)} pc
Proper motion total: ${formatNumber(node.proper_motion_total, 6)} mas/yr
Dynamics index: ${formatNumber(node.dynamics_index, 6)}
Hidden companion index: ${formatNumber(node.hidden_companion_index, 6)}`
          }
          onNodeClick={(node) => onSelect(node)}
          enableNodeDrag={false}
          showNavInfo={false}
          cooldownTicks={0}
          warmupTicks={0}
          linkColor={(link) =>
            link.pair_classification === "Strong comoving-pair candidate"
              ? "rgba(255, 102, 255, 0.85)"
              : "rgba(255, 224, 51, 0.58)"
          }
          linkWidth={(link) =>
            Math.max(0.45, normalizeNumber(link.binary_pair_score, 0.4) * 2.4)
          }
          linkOpacity={showBinaryLinks ? 0.62 : 0}
        />

        <div
          style={{
            position: "absolute",
            left: "18px",
            bottom: "18px",
            padding: "12px 14px",
            borderRadius: "14px",
            background: "rgba(2, 6, 23, 0.82)",
            border: "1px solid rgba(0,245,255,0.22)",
            color: "#d7f5ff",
            fontSize: "0.8rem",
            lineHeight: 1.45,
            maxWidth: "560px",
          }}
        >
          <strong style={{ color: "#00f5ff" }}>3D axes</strong>
          <br />

          {mapMode === "kinematic" && (
            <>
              X = compressed radial velocity · Y = compressed tangential velocity
            </>
          )}

          {mapMode === "physical" && <>X = RA · Y = DEC</>}
          {mapMode === "hybrid" && <>X = RA · Y = DEC</>}

          {" · "}Z ={" "}
          {depthMode === "distance_pc"
            ? "compressed distance"
            : depthMode === "proper_motion_total"
              ? "compressed proper motion total"
              : "dynamics index"}

          <br />
          Green = selected source. Magenta rings/links = possible comoving or
          wide-binary candidates.
        </div>
      </div>

      <div
        className="velocity-map-legend"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginTop: "12px",
          color: "#d7f5ff",
          fontSize: "0.86rem",
        }}
      >
        <span>
          <i
            style={{
              display: "inline-block",
              width: "11px",
              height: "11px",
              borderRadius: "50%",
              background: "#39ff14",
              boxShadow: "0 0 10px #39ff14",
              marginRight: "6px",
            }}
          />
          selected
        </span>

        <span>
          <i
            style={{
              display: "inline-block",
              width: "11px",
              height: "11px",
              borderRadius: "50%",
              background: "#ff66ff",
              boxShadow: "0 0 10px #ff66ff",
              marginRight: "6px",
            }}
          />
          possible pair source
        </span>

        <span>
          <i
            style={{
              display: "inline-block",
              width: "11px",
              height: "11px",
              borderRadius: "50%",
              background: "#9bbcff",
              boxShadow: "0 0 10px #9bbcff",
              marginRight: "6px",
            }}
          />
          blue / hot
        </span>

        <span>
          <i
            style={{
              display: "inline-block",
              width: "11px",
              height: "11px",
              borderRadius: "50%",
              background: "#f4f8ff",
              boxShadow: "0 0 10px #f4f8ff",
              marginRight: "6px",
            }}
          />
          white / solar-like
        </span>

        <span>
          <i
            style={{
              display: "inline-block",
              width: "11px",
              height: "11px",
              borderRadius: "50%",
              background: "#ffd28a",
              boxShadow: "0 0 10px #ffd28a",
              marginRight: "6px",
            }}
          />
          yellow-orange / cooler
        </span>

        <span>
          <i
            style={{
              display: "inline-block",
              width: "11px",
              height: "11px",
              borderRadius: "50%",
              background: "#ff6b4a",
              boxShadow: "0 0 10px #ff6b4a",
              marginRight: "6px",
            }}
          />
          red / cool
        </span>
      </div>

      <p className="candidate-registry-note">
        Hybrid and physical modes recover a Gaia-like spatial field, while
        kinematic mode emphasizes velocity-space outliers. Binary links are
        exploratory candidates based on angular proximity, parallax consistency
        and proper-motion similarity.
      </p>
    </section>
  );
}

function BinaryPairCandidatesPanel({
  binaryPairCandidates,
  activeRecord,
  onSelect,
}) {
  const activeSourceId = activeRecord ? getSourceId(activeRecord) : null;

  const activePairs = useMemo(() => {
    if (!activeSourceId) {
      return binaryPairCandidates.slice(0, 10);
    }

    const involvingSelected = binaryPairCandidates.filter(
      (pair) =>
        pair.source_a === activeSourceId || pair.source_b === activeSourceId,
    );

    if (involvingSelected.length) {
      return involvingSelected.slice(0, 12);
    }

    return binaryPairCandidates.slice(0, 12);
  }, [binaryPairCandidates, activeSourceId]);

  return (
    <section className="panel dynamics-lab-panel binary-pair-panel">
      <div className="panel-header">
        <div>
          <h2>Possible Binary / Comoving Pair Candidates</h2>
          <span>
            Angular proximity, parallax consistency and proper-motion similarity
          </span>
        </div>

        <span className="source-table-count">
          {binaryPairCandidates.length} candidate pairs
        </span>
      </div>

      <div className="coherence-warning">
        <strong>Scientific note:</strong> apparent contact in the 3D viewer is
        not sufficient to infer binarity. This table only flags conservative
        candidates where sky proximity, parallax and proper motion are mutually
        compatible enough to deserve external follow-up.
      </div>

      {!activePairs.length && (
        <div className="empty-selection">
          No pair candidate was found under the current conservative thresholds.
        </div>
      )}

      {!!activePairs.length && (
        <div className="candidate-table-wrapper">
          <table className="candidate-table dynamics-table">
            <thead>
              <tr>
                <th>Pair class</th>
                <th>Source A</th>
                <th>Source B</th>
                <th>Pair score</th>
                <th>Angular sep. (arcsec)</th>
                <th>Parallax diff.</th>
                <th>Parallax rel. diff.</th>
                <th>PM diff. (mas/yr)</th>
                <th>A dynamics</th>
                <th>B dynamics</th>
              </tr>
            </thead>

            <tbody>
              {activePairs.map((pair) => {
                const selected =
                  pair.source_a === activeSourceId ||
                  pair.source_b === activeSourceId;

                return (
                  <tr
                    key={pair.pair_id}
                    className={selected ? "candidate-row-selected" : ""}
                    onClick={() => onSelect(pair.record_a)}
                  >
                    <td>{pair.pair_classification}</td>
                    <td>{pair.source_a}</td>
                    <td>{pair.source_b}</td>
                    <td>{formatNumber(pair.binary_pair_score, 6)}</td>
                    <td>{formatNumber(pair.angular_arcsec, 6)}</td>
                    <td>{formatNumber(pair.parallax_difference, 6)}</td>
                    <td>{formatNumber(pair.parallax_relative_difference, 6)}</td>
                    <td>{formatNumber(pair.proper_motion_difference, 6)}</td>
                    <td>{pair.record_a.dynamics_classification}</td>
                    <td>{pair.record_b.dynamics_classification}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="candidate-registry-note">
        Click a row to select Source A. For real confirmation, the next step is
        catalogue crossmatch, Gaia NSS inspection and, when available,
        time-series astrometry or radial-velocity follow-up.
      </p>
    </section>
  );
}

function HiddenCompanionPanel({ activeRecord }) {
  if (!activeRecord) {
    return null;
  }

  return (
    <section className="panel dynamics-lab-panel hidden-companion-panel">
      <div className="panel-header">
        <div>
          <h2>Hidden Companion Suspicion Index</h2>
          <span>Conservative unresolved-multiplicity triage</span>
        </div>
      </div>

      <div className="coherence-warning">
        <strong>Scientific note:</strong> this index is not a planet detector.
        It is a conservative ranking aid for unresolved astrometric multiplicity.
        It becomes physically stronger only when Gaia quality fields such as
        RUWE, astrometric excess noise and visibility periods are available.
      </div>

      <div className="candidate-primary-card dynamics-primary-card">
        <div className="candidate-primary-header">
          <div>
            <span className="candidate-id">HCSI</span>

            <h3>{activeRecord.hidden_companion_classification}</h3>

            <p>
              SOURCE_ID <strong>{getSourceId(activeRecord)}</strong>
            </p>
          </div>

          <div className="candidate-score-orb">
            <span>Suspicion index</span>
            <strong>
              {formatNumber(activeRecord.hidden_companion_index, 4)}
            </strong>
          </div>
        </div>

        <div className="candidate-explanation-grid">
          <div className="candidate-explanation-card">
            <span>Index status</span>
            <strong>{activeRecord.hidden_companion_status}</strong>
            <p>
              Indicates whether direct astrometric-quality fields are available
              or whether the score is only an indirect proxy.
            </p>
          </div>

          <div className="candidate-explanation-card">
            <span>RUWE</span>
            <strong>{formatNumber(activeRecord.ruwe, 6)}</strong>
            <p>
              RUWE is one of the strongest Gaia indicators for potentially
              problematic or non-single-source astrometric solutions.
            </p>
          </div>

          <div className="candidate-explanation-card">
            <span>Astrometric excess noise</span>
            <strong>
              {formatNumber(activeRecord.astrometric_excess_noise, 6)}
            </strong>
            <p>
              Excess noise can indicate that a single-source astrometric model
              does not fully explain the observations.
            </p>
          </div>

          <div className="candidate-explanation-card">
            <span>Visibility periods</span>
            <strong>
              {formatNumber(activeRecord.visibility_periods_used, 0)}
            </strong>
            <p>
              Low visibility-period coverage weakens the robustness of any
              astrometric inference.
            </p>
          </div>
        </div>

        <div className="candidate-detailed-note">
          <h3>Interpretation boundary</h3>

          <p>
            This module can prioritize sources for follow-up, but it cannot
            identify planets or determine orbital masses from the current data
            alone. A strong claim would require time-series astrometry,
            radial-velocity curves, Gaia NSS solutions or independent catalogue
            confirmation.
          </p>
        </div>
      </div>
    </section>
  );
}

function AstrometricDynamicsLab({
  allSources = [],
  graphCentrality = [],
  featureContributions = [],
  emergentStructures = [],
  candidateCrossmatchResults = [],
  possibleBinaryPairs = [],
  selectedSource,
  onSourceSelect,
  setCurrentPage,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState("dynamics_index");
  const [classFilter, setClassFilter] = useState("All dynamics classes");

  const dynamicsRecords = useMemo(() => {
    const centralityMap = buildMapBySourceId(graphCentrality);
    const featureMap = buildMapBySourceId(featureContributions);
    const emergentMap = buildMapBySourceId(emergentStructures);

    return allSources.map((source) => {
      const sourceId = getSourceId(source);

      return buildDynamicsRecord({
        ...source,
        ...(emergentMap.get(sourceId) ?? {}),
        ...(centralityMap.get(sourceId) ?? {}),
        ...(featureMap.get(sourceId) ?? {}),
        SOURCE_ID: sourceId,
        source_id: sourceId,
      });
    });
  }, [allSources, graphCentrality, featureContributions, emergentStructures]);

  const binaryPairCandidates = useMemo(() => {
    return findBinaryPairCandidates(dynamicsRecords, 100);
  }, [dynamicsRecords]);

  const availablePairCandidates = useMemo(() => {
    if (binaryPairCandidates.length) {
      return binaryPairCandidates;
    }

    return possibleBinaryPairs;
  }, [binaryPairCandidates, possibleBinaryPairs]);

  const classOptions = useMemo(
    () => getClassOptions(dynamicsRecords),
    [dynamicsRecords],
  );

  const selectedSourceId = selectedSource ? getSourceId(selectedSource) : null;

  const activeRecord = useMemo(() => {
    if (selectedSourceId) {
      const match = dynamicsRecords.find(
        (record) => getSourceId(record) === selectedSourceId,
      );

      if (match) {
        return match;
      }
    }

    return dynamicsRecords[0] ?? null;
  }, [dynamicsRecords, selectedSourceId]);

  const visibleRecords = useMemo(() => {
    let filtered = dynamicsRecords.slice();

    if (classFilter !== "All dynamics classes") {
      filtered = filtered.filter(
        (record) => record.dynamics_classification === classFilter,
      );
    }

    if (searchTerm.trim()) {
      const query = searchTerm.trim().toLowerCase();

      filtered = filtered.filter((record) => {
        return (
          getSourceId(record).toLowerCase().includes(query) ||
          String(record.dynamics_classification ?? "")
            .toLowerCase()
            .includes(query) ||
          String(record.hidden_companion_classification ?? "")
            .toLowerCase()
            .includes(query) ||
          String(record.dominant_anomaly_feature ?? "")
            .toLowerCase()
            .includes(query)
        );
      });
    }

    filtered.sort((a, b) => {
      if (sortMode === "dynamics_index") {
        return b.dynamics_index - a.dynamics_index;
      }

      if (sortMode === "hidden_companion_index") {
        return (
          normalizeNumber(b.hidden_companion_index, -1) -
          normalizeNumber(a.hidden_companion_index, -1)
        );
      }

      if (sortMode === "space_velocity") {
        return (
          normalizeNumber(b.approximate_space_velocity, -1) -
          normalizeNumber(a.approximate_space_velocity, -1)
        );
      }

      if (sortMode === "tangential_velocity") {
        return (
          normalizeNumber(b.tangential_velocity, -1) -
          normalizeNumber(a.tangential_velocity, -1)
        );
      }

      if (sortMode === "proper_motion_total") {
        return (
          normalizeNumber(b.proper_motion_total, -1) -
          normalizeNumber(a.proper_motion_total, -1)
        );
      }

      if (sortMode === "distance_pc") {
        return (
          normalizeNumber(a.distance_pc, Number.MAX_SAFE_INTEGER) -
          normalizeNumber(b.distance_pc, Number.MAX_SAFE_INTEGER)
        );
      }

      return String(getSourceId(a)).localeCompare(String(getSourceId(b)));
    });

    return filtered;
  }, [dynamicsRecords, searchTerm, sortMode, classFilter]);

  const summary = useMemo(() => {
    const highPriority = dynamicsRecords.filter(
      (record) =>
        record.dynamics_classification === "High-priority dynamical follow-up",
    ).length;

    const moderate = dynamicsRecords.filter(
      (record) =>
        record.dynamics_classification === "Moderate dynamical interest",
    ).length;

    const highVelocity = dynamicsRecords.filter(
      (record) =>
        record.dynamics_classification === "High-velocity stellar candidate",
    ).length;

    const highProperMotion = dynamicsRecords.filter(
      (record) =>
        record.dynamics_classification === "High proper-motion source",
    ).length;

    const directAstrometricQuality = dynamicsRecords.filter(
      (record) => record.has_direct_astrometric_quality,
    ).length;

    const strongPairs = binaryPairCandidates.filter(
      (pair) => pair.pair_classification === "Strong comoving-pair candidate",
    ).length;

    return {
      highPriority,
      moderate,
      highVelocity,
      highProperMotion,
      directAstrometricQuality,
      binaryPairs: binaryPairCandidates.length,
      strongPairs,
      total: dynamicsRecords.length,
    };
  }, [dynamicsRecords, binaryPairCandidates]);

  function handleSelect(record) {
    if (onSourceSelect) {
      onSourceSelect(record);
    }
  }

  return (
    <section className="advanced-page-shell">
      <div className="panel advanced-hero-panel">
        <div className="eyebrow">Third Analysis Interface</div>

        <h2>Astrometric Dynamics Lab</h2>

        <p>
          This layer estimates astrometric and kinematic diagnostics from Gaia
          parameters. It is designed as a conservative follow-up prioritization
          environment for dynamical anomalies, high proper-motion sources,
          high-velocity candidates, unresolved companion scenarios and possible
          comoving binary pairs.
        </p>

        <div className="advanced-actions">
          <button
            type="button"
            className="dashboard-nav-button dashboard-nav-button-accent"
            onClick={() => setCurrentPage("advanced")}
          >
            Back to Advanced Analysis Layer
          </button>

          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => setCurrentPage("dashboard")}
          >
            Back to Operational Dashboard
          </button>
        </div>
      </div>

      <section className="metrics-grid dynamics-summary-grid">
        <div className="metric-card">
          <div>
            <div className="metric-label">High-priority</div>
            <div className="metric-value">{summary.highPriority}</div>
            <div className="metric-subtitle">dynamical follow-up</div>
          </div>
        </div>

        <div className="metric-card">
          <div>
            <div className="metric-label">Moderate interest</div>
            <div className="metric-value">{summary.moderate}</div>
            <div className="metric-subtitle">kinematic candidates</div>
          </div>
        </div>

        <div className="metric-card">
          <div>
            <div className="metric-label">Possible pairs</div>
            <div className="metric-value">{summary.binaryPairs}</div>
            <div className="metric-subtitle">
              {summary.strongPairs} strong candidates
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div>
            <div className="metric-label">High proper motion</div>
            <div className="metric-value">{summary.highProperMotion}</div>
            <div className="metric-subtitle">sources</div>
          </div>
        </div>
      </section>

      <section className="panel dynamics-lab-panel">
        <div className="panel-header">
          <div>
            <h2>Dynamics Inspector</h2>
            <span>Astrometric and kinematic source diagnostics</span>
          </div>
        </div>

        <div className="coherence-warning">
          <strong>Scientific note:</strong> this module does not infer confirmed
          planets, binary systems or orbital masses. It computes conservative
          diagnostics from available Gaia astrometry: distance, proper motion,
          tangential velocity, approximate space velocity and comoving-pair
          compatibility.
        </div>

        {activeRecord && (
          <div className="candidate-primary-card dynamics-primary-card">
            <div className="candidate-primary-header">
              <div>
                <span className="candidate-id">DYN-SELECTED</span>

                <h3>{activeRecord.dynamics_classification}</h3>

                <p>
                  SOURCE_ID <strong>{getSourceId(activeRecord)}</strong>
                </p>
              </div>

              <div className="candidate-score-orb">
                <span>Dynamics index</span>
                <strong>{formatNumber(activeRecord.dynamics_index, 4)}</strong>
              </div>
            </div>

            <div className="candidate-explanation-grid">
              <div className="candidate-explanation-card">
                <span>Distance estimate</span>
                <strong>{formatNumber(activeRecord.distance_pc, 3)} pc</strong>
                <p>
                  Estimated from Gaia parallax using d ≈ 1000 / parallax_mas.
                </p>
              </div>

              <div className="candidate-explanation-card">
                <span>Total proper motion</span>
                <strong>
                  {formatNumber(activeRecord.proper_motion_total, 6)} mas/yr
                </strong>
                <p>
                  Computed from PMRA and PMDEC as the Euclidean proper-motion
                  norm.
                </p>
              </div>

              <div className="candidate-explanation-card">
                <span>Tangential velocity</span>
                <strong>
                  {formatNumber(activeRecord.tangential_velocity, 6)} km/s
                </strong>
                <p>
                  Derived from proper motion and parallax using the standard
                  astrometric conversion factor.
                </p>
              </div>

              <div className="candidate-explanation-card">
                <span>Approximate space velocity</span>
                <strong>
                  {formatNumber(activeRecord.approximate_space_velocity, 6)}{" "}
                  km/s
                </strong>
                <p>
                  Approximate combination of tangential velocity and Gaia radial
                  velocity when available.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <StellarVelocitySpace3D
        records={visibleRecords}
        activeRecord={activeRecord}
        onSelect={handleSelect}
        binaryPairCandidates={binaryPairCandidates}
      />

      <BinaryPairCandidatesPanel
        binaryPairCandidates={binaryPairCandidates}
        activeRecord={activeRecord}
        onSelect={handleSelect}
      />

      <HiddenCompanionPanel activeRecord={activeRecord} />

      <CandidateDossierGenerator
        selectedSource={activeRecord}
        crossmatchResults={candidateCrossmatchResults ?? []}
        possiblePairs={availablePairCandidates ?? binaryPairCandidates ?? []}
        dynamicsMetrics={Object.fromEntries(
          dynamicsRecords.map((record) => [
            getSourceId(record),
            {
              ...record,

              structural_importance_score:
                record.structural_importance_score ??
                record.structuralImportance ??
                null,

              hidden_companion_index:
                record.hidden_companion_index ??
                record.hiddenCompanionIndex ??
                null,

              hidden_companion_classification:
                record.hidden_companion_classification ??
                record.hiddenCompanionClassification ??
                null,

              hidden_companion_status:
                record.hidden_companion_status ??
                record.hiddenCompanionStatus ??
                null,

              distance_pc: record.distance_pc ?? record.distancePc ?? null,

              proper_motion_total:
                record.proper_motion_total ?? record.properMotionTotal ?? null,

              tangential_velocity:
                record.tangential_velocity ?? record.tangentialVelocity ?? null,

              approximate_space_velocity:
                record.approximate_space_velocity ??
                record.approximateSpaceVelocity ??
                null,

              dynamics_index: record.dynamics_index ?? record.dynamicsIndex ?? null,

              dynamics_classification:
                record.dynamics_classification ??
                record.dynamicsClassification ??
                null,

              gaia_color_index:
                record.gaia_color_index ?? record.bp_rp ?? null,

              phot_g_mean_mag:
                record.phot_g_mean_mag ?? record.g_mag ?? null,

              bp_rp: record.bp_rp ?? record.gaia_color_index ?? null,

              phot_bp_mean_mag: record.phot_bp_mean_mag ?? null,

              phot_rp_mean_mag: record.phot_rp_mean_mag ?? null,

              dominant_anomaly_feature:
                record.dominant_anomaly_feature ??
                record.dominant_feature ??
                null,

              dominant_feature_zscore:
                record.dominant_feature_zscore ?? record.feature_zscore ?? null,

              local_density:
                record.local_density ?? record.localDensity ?? null,
            },
          ]),
        )}
      />

      <section className="panel dynamics-lab-panel">
        <div className="panel-header">
          <div>
            <h2>Astrometric Dynamics Table</h2>
            <span>Dedicated table for dynamical diagnostics</span>
          </div>

          <span className="source-table-count">
            {visibleRecords.length} / {dynamicsRecords.length} sources
          </span>
        </div>

        <div className="candidate-table-toolbar">
          <input
            type="search"
            placeholder="Search SOURCE_ID, dynamics class, companion status or feature..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <label>
            Dynamics class
            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
            >
              {classOptions.map((option) => (
                <option value={option} key={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sort by
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
            >
              <option value="dynamics_index">Dynamics index</option>
              <option value="hidden_companion_index">
                Hidden companion index
              </option>
              <option value="space_velocity">Approx. space velocity</option>
              <option value="tangential_velocity">Tangential velocity</option>
              <option value="proper_motion_total">Proper motion total</option>
              <option value="distance_pc">Distance</option>
              <option value="SOURCE_ID">SOURCE_ID</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setSortMode("dynamics_index");
              setClassFilter("All dynamics classes");
            }}
          >
            Reset dynamics filters
          </button>
        </div>

        <div className="candidate-table-wrapper">
          <table className="candidate-table dynamics-table">
            <thead>
              <tr>
                <th>SOURCE_ID</th>
                <th>Dynamics class</th>
                <th>Dynamics index</th>
                <th>Hidden companion index</th>
                <th>Hidden companion status</th>
                <th>Distance (pc)</th>
                <th>PMRA (mas/yr)</th>
                <th>PMDEC (mas/yr)</th>
                <th>PM total (mas/yr)</th>
                <th>Tangential velocity (km/s)</th>
                <th>Radial velocity (km/s)</th>
                <th>Approx. space velocity (km/s)</th>
                <th>Parallax (mas)</th>
                <th>BP-RP / colour index</th>
                <th>G mag</th>
                <th>RUWE</th>
                <th>Astrometric excess noise</th>
                <th>Anomaly score</th>
                <th>Structural importance</th>
                <th>Dominant feature</th>
              </tr>
            </thead>

            <tbody>
              {visibleRecords.map((record) => {
                const sourceId = getSourceId(record);

                const selected =
                  activeRecord && getSourceId(activeRecord) === sourceId;

                return (
                  <tr
                    key={sourceId}
                    className={selected ? "candidate-row-selected" : ""}
                    onClick={() => handleSelect(record)}
                  >
                    <td>{sourceId}</td>
                    <td>{record.dynamics_classification}</td>
                    <td>{formatNumber(record.dynamics_index, 6)}</td>
                    <td>{formatNumber(record.hidden_companion_index, 6)}</td>
                    <td>{record.hidden_companion_classification}</td>
                    <td>{formatNumber(record.distance_pc, 6)}</td>
                    <td>{formatGaiaValue(record.pmra, 10)}</td>
                    <td>{formatGaiaValue(record.pmdec, 10)}</td>
                    <td>{formatNumber(record.proper_motion_total, 6)}</td>
                    <td>{formatNumber(record.tangential_velocity, 6)}</td>
                    <td>{formatGaiaValue(record.radial_velocity, 10)}</td>
                    <td>
                      {formatNumber(record.approximate_space_velocity, 6)}
                    </td>
                    <td>{formatGaiaValue(record.parallax, 10)}</td>
                    <td>{formatNumber(record.gaia_color_index, 6)}</td>
                    <td>{formatNumber(record.phot_g_mean_mag, 6)}</td>
                    <td>{formatNumber(record.ruwe, 6)}</td>
                    <td>
                      {formatNumber(record.astrometric_excess_noise, 6)}
                    </td>
                    <td>{formatNumber(record.anomaly_score, 6)}</td>
                    <td>
                      {formatNumber(record.structural_importance_score, 6)}
                    </td>
                    <td>{record.dominant_anomaly_feature ?? "N/A"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="candidate-registry-note">
          The dynamics index, hidden-companion index and pair-candidate score
          are exploratory prioritization scores. They are not physical proof of
          binarity, planetary companions or exotic behaviour. Their purpose is
          to identify sources deserving deeper astrometric follow-up.
        </p>
      </section>

      <section className="panel dynamics-lab-panel">
        <div className="panel-header">
          <div>
            <h2>Continue Analysis</h2>
            <span>External validation and follow-up layer</span>
          </div>
        </div>

        <div className="coherence-warning">
          <strong>Scientific note:</strong> continue only after reviewing the
          current astrometric, kinematic, hidden-companion and possible-pair
          diagnostics. The next layer is intended for catalogue validation, Gaia
          NSS checks and follow-up triage.
        </div>

        <div className="advanced-actions">
          <button
            type="button"
            className="dashboard-nav-button dashboard-nav-button-accent"
            onClick={() => setCurrentPage("validation")}
          >
            Continue Analysis
          </button>
        </div>
      </section>
    </section>
  );
}

export default AstrometricDynamicsLab;