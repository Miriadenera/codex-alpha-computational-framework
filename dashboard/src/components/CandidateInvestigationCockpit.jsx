import React, { useMemo, useState } from "react";

const GAIA_ARCHIVE_BASE = "https://gea.esac.esa.int/archive/";
const ESASKY_BASE = "https://sky.esa.int/esasky/";
const SIMBAD_BASE = "https://simbad.cds.unistra.fr/simbad/";
const VIZIER_BASE = "https://vizier.cds.unistra.fr/viz-bin/VizieR";

function normalizeNumber(value, fallback = null) {
  const number = Number(value);

  if (value === null || value === undefined || value === "" || Number.isNaN(number)) {
    return fallback;
  }

  return number;
}

function formatNumber(value, digits = 6) {
  const number = normalizeNumber(value, null);

  if (number === null) {
    return "N/A";
  }

  return number.toFixed(digits);
}

function formatCompact(value, digits = 3) {
  const number = normalizeNumber(value, null);

  if (number === null) {
    return "N/A";
  }

  if (Math.abs(number) >= 1000) {
    return number.toExponential(2);
  }

  return number.toFixed(digits);
}

function getSourceId(source) {
  return String(source?.SOURCE_ID ?? source?.source_id ?? source?.id ?? "");
}

function firstAvailable(source, keys, fallback = null) {
  if (!source) {
    return fallback;
  }

  for (const key of keys) {
    const value = source[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
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

function computeAngularSeparationArcsec(a, b) {
  const ra1 = normalizeNumber(a?.ra, null);
  const dec1 = normalizeNumber(a?.dec, null);
  const ra2 = normalizeNumber(b?.ra, null);
  const dec2 = normalizeNumber(b?.dec, null);

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
    sinDDec * sinDDec +
    Math.cos(d1) * Math.cos(d2) * sinDRa * sinDRa;

  const angleRad = 2 * Math.asin(Math.min(1, Math.sqrt(h)));

  return angleRad * (180 / Math.PI) * 3600;
}

function computePairScore(a, b) {
  const angularArcsec = computeAngularSeparationArcsec(a, b);

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

function classifyPair(pair) {
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

function computeDynamicsIndex(source) {
  const pmTotal = computeProperMotionTotal(source.pmra, source.pmdec);
  const tangentialVelocity = computeTangentialVelocity(pmTotal, source.parallax);
  const spaceVelocity = computeSpaceVelocity(
    tangentialVelocity,
    source.radial_velocity,
  );

  const anomaly = normalizeNumber(source.anomaly_score, 0);
  const structural = normalizeNumber(source.structural_importance_score, 0);
  const featureZ = Math.abs(normalizeNumber(source.dominant_feature_zscore, 0));

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

function classifyDynamics(source, dynamicsIndex) {
  const pmTotal = computeProperMotionTotal(source.pmra, source.pmdec);
  const tangentialVelocity = computeTangentialVelocity(pmTotal, source.parallax);
  const spaceVelocity = computeSpaceVelocity(
    tangentialVelocity,
    source.radial_velocity,
  );

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

  const hasDirectAstrometricQuality =
    ruwe !== null || astrometricExcessNoise !== null || visibilityPeriods !== null;

  const pmTotal = computeProperMotionTotal(source.pmra, source.pmdec);
  const tangentialVelocity = computeTangentialVelocity(pmTotal, source.parallax);
  const spaceVelocity = computeSpaceVelocity(
    tangentialVelocity,
    source.radial_velocity,
  );

  const anomaly = normalizeNumber(source.anomaly_score, 0);
  const structural = normalizeNumber(source.structural_importance_score, 0);
  const featureZ = Math.abs(normalizeNumber(source.dominant_feature_zscore, 0));

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
    0.42 * ruweTerm +
    0.32 * excessNoiseTerm +
    0.16 * visibilityPenalty +
    0.1 * fallbackTerm;

  return {
    value: Math.min(1, directScore),
    status: "Astrometric-quality proxy",
    hasDirectAstrometricQuality: true,
  };
}

function classifyHiddenCompanion(result) {
  if (!result) {
    return "Not available";
  }

  if (!result.hasDirectAstrometricQuality) {
    if (result.value >= 0.28) {
      return "Weak indirect multiplicity hint";
    }

    return "No direct astrometric-quality fields";
  }

  if (result.value >= 0.7) {
    return "High unresolved-companion suspicion";
  }

  if (result.value >= 0.45) {
    return "Moderate unresolved-companion suspicion";
  }

  if (result.value >= 0.25) {
    return "Weak unresolved-companion suspicion";
  }

  return "Low unresolved-companion suspicion";
}

function estimateColourIndex(source) {
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

function enrichSource(source, maps) {
  const sourceId = getSourceId(source);

  const merged = {
    ...source,
    ...(maps.emergentMap.get(sourceId) ?? {}),
    ...(maps.centralityMap.get(sourceId) ?? {}),
    ...(maps.featureMap.get(sourceId) ?? {}),
    SOURCE_ID: sourceId,
    source_id: sourceId,
  };

  const distancePc =
    normalizeNumber(merged.distance_pc, null) ??
    computeDistancePc(merged.parallax);

  const properMotionTotal =
    normalizeNumber(merged.proper_motion_total, null) ??
    computeProperMotionTotal(merged.pmra, merged.pmdec);

  const tangentialVelocity =
    normalizeNumber(merged.tangential_velocity, null) ??
    computeTangentialVelocity(properMotionTotal, merged.parallax);

  const approximateSpaceVelocity =
    normalizeNumber(merged.approximate_space_velocity, null) ??
    computeSpaceVelocity(tangentialVelocity, merged.radial_velocity);

  const dynamicsIndex =
    normalizeNumber(merged.dynamics_index, null) ?? computeDynamicsIndex(merged);

  const hiddenCompanionResult = computeHiddenCompanionIndex(merged);

  const enriched = {
    ...merged,
    distance_pc: distancePc,
    proper_motion_total: properMotionTotal,
    tangential_velocity: tangentialVelocity,
    approximate_space_velocity: approximateSpaceVelocity,
    dynamics_index: dynamicsIndex,
    dynamics_classification:
      merged.dynamics_classification ?? classifyDynamics(merged, dynamicsIndex),
    hidden_companion_index:
      normalizeNumber(merged.hidden_companion_index, null) ??
      hiddenCompanionResult.value,
    hidden_companion_status:
      merged.hidden_companion_status ?? hiddenCompanionResult.status,
    hidden_companion_classification:
      merged.hidden_companion_classification ??
      classifyHiddenCompanion(hiddenCompanionResult),
    has_direct_astrometric_quality:
      merged.has_direct_astrometric_quality ??
      hiddenCompanionResult.hasDirectAstrometricQuality,
    gaia_color_index:
      normalizeNumber(merged.gaia_color_index, null) ?? estimateColourIndex(merged),
  };

  return enriched;
}

function buildGeneratedPairCandidates(records, maxPairs = 120) {
  const candidates = [];

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      const pair = computePairScore(a, b);

      if (!pair) {
        continue;
      }

      const classification = classifyPair(pair);

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
        ...pair,
      });
    }
  }

  return candidates
    .sort((a, b) => b.binary_pair_score - a.binary_pair_score)
    .slice(0, maxPairs);
}

function normalizeInputPair(pair, recordMap) {
  const sourceA = String(
    pair?.source_a ??
      pair?.source_id_a ??
      pair?.SOURCE_ID_A ??
      pair?.primary_source_id ??
      pair?.sourceA ??
      pair?.a ??
      "",
  );

  const sourceB = String(
    pair?.source_b ??
      pair?.source_id_b ??
      pair?.SOURCE_ID_B ??
      pair?.secondary_source_id ??
      pair?.sourceB ??
      pair?.b ??
      "",
  );

  const recordA = pair?.record_a ?? recordMap.get(sourceA);
  const recordB = pair?.record_b ?? recordMap.get(sourceB);

  return {
    ...pair,
    source_a: sourceA,
    source_b: sourceB,
    source_id_a: sourceA,
    source_id_b: sourceB,
    record_a: recordA,
    record_b: recordB,
    pair_classification:
      pair?.pair_classification ?? pair?.classification ?? "Pair candidate",
    binary_pair_score: normalizeNumber(pair?.binary_pair_score, null),
    angular_arcsec: normalizeNumber(pair?.angular_arcsec, null),
    parallax_relative_difference: normalizeNumber(
      pair?.parallax_relative_difference,
      null,
    ),
    proper_motion_difference: normalizeNumber(pair?.proper_motion_difference, null),
  };
}

function findCrossmatch(source, crossmatchResults = []) {
  const sourceId = getSourceId(source);

  if (!sourceId) {
    return null;
  }

  return (
    crossmatchResults.find((item) => {
      const itemId = String(
        item?.SOURCE_ID ??
          item?.source_id ??
          item?.gaia_source_id ??
          item?.id ??
          "",
      );

      return itemId === sourceId;
    }) ?? null
  );
}

function computeRiskVector(source, pairCount, crossmatch) {
  const dynamics = normalizeNumber(source.dynamics_index, 0);
  const hidden = normalizeNumber(source.hidden_companion_index, 0);
  const anomaly = normalizeNumber(source.anomaly_score, 0);
  const structural = normalizeNumber(source.structural_importance_score, 0);
  const velocity = normalizeNumber(source.approximate_space_velocity, 0);
  const pairTerm = Math.min(1, pairCount / 3);
  const crossmatchTerm = crossmatch ? 0.12 : 0;

  const investigationScore = Math.min(
    1,
    0.26 * dynamics +
      0.2 * hidden +
      0.18 * anomaly +
      0.14 * structural +
      0.12 * Math.min(1, velocity / 220) +
      0.08 * pairTerm +
      crossmatchTerm,
  );

  let tier = "Routine validation";

  if (investigationScore >= 0.72) {
    tier = "Priority investigation target";
  } else if (investigationScore >= 0.52) {
    tier = "Strong follow-up candidate";
  } else if (investigationScore >= 0.34) {
    tier = "Moderate follow-up candidate";
  }

  return {
    investigationScore,
    tier,
    components: [
      {
        label: "Dynamics",
        value: dynamics,
        note: "kinematic follow-up pressure",
      },
      {
        label: "Hidden companion",
        value: hidden,
        note: "unresolved-multiplicity pressure",
      },
      {
        label: "Anomaly",
        value: anomaly,
        note: "pipeline anomaly intensity",
      },
      {
        label: "Structure",
        value: structural,
        note: "graph/informational relevance",
      },
      {
        label: "Velocity",
        value: Math.min(1, velocity / 220),
        note: "space-velocity pressure",
      },
      {
        label: "Pair field",
        value: pairTerm,
        note: "local relation pressure",
      },
    ],
  };
}

function buildGaiaArchiveUrl(source) {
  const sourceId = getSourceId(source);

  return `${GAIA_ARCHIVE_BASE}?target=${encodeURIComponent(`Gaia DR3 ${sourceId}`)}`;
}

function buildEsaSkyUrl(source) {
  const ra = normalizeNumber(source.ra, null);
  const dec = normalizeNumber(source.dec, null);

  if (ra === null || dec === null) {
    return ESASKY_BASE;
  }

  return `${ESASKY_BASE}?target=${encodeURIComponent(`${ra} ${dec}`)}&hips=Digitized%20Sky%20Survey%202%20color`;
}

function buildSimbadUrl(source) {
  const ra = normalizeNumber(source.ra, null);
  const dec = normalizeNumber(source.dec, null);

  if (ra === null || dec === null) {
    return SIMBAD_BASE;
  }

  return `${SIMBAD_BASE}sim-coo?Coord=${encodeURIComponent(
    `${ra.toFixed(10)} ${dec.toFixed(10)}`,
  )}&CooFrame=ICRS&CooEpoch=2000&CooEqui=2000&Radius=5&Radius.unit=arcsec`;
}

function buildVizierUrl(source) {
  const ra = normalizeNumber(source.ra, null);
  const dec = normalizeNumber(source.dec, null);

  if (ra === null || dec === null) {
    return VIZIER_BASE;
  }

  return `${VIZIER_BASE}?-c=${encodeURIComponent(
    `${ra.toFixed(10)} ${dec.toFixed(10)}`,
  )}&-c.rs=5&-c.u=arcsec`;
}

function buildGaiaAdql(source) {
  const sourceId = getSourceId(source);

  if (!sourceId) {
    return "";
  }

  return `SELECT *
FROM gaiadr3.gaia_source
WHERE source_id = ${sourceId}`;
}

function buildNssAdql(source) {
  const sourceId = getSourceId(source);

  if (!sourceId) {
    return "";
  }

  return `SELECT TOP 20
  source_id,
  nss_solution_type
FROM gaiadr3.nss_two_body_orbit
WHERE source_id = ${sourceId}`;
}

function buildNeighbourAdql(source) {
  const ra = normalizeNumber(source.ra, null);
  const dec = normalizeNumber(source.dec, null);

  if (ra === null || dec === null) {
    return "";
  }

  return `SELECT TOP 100
  source_id,
  ra,
  dec,
  parallax,
  pmra,
  pmdec,
  radial_velocity,
  phot_g_mean_mag,
  bp_rp
FROM gaiadr3.gaia_source
WHERE 1 = CONTAINS(
  POINT('ICRS', ra, dec),
  CIRCLE('ICRS', ${ra.toFixed(10)}, ${dec.toFixed(10)}, 0.0166667)
)`;
}

function buildMissionBriefing(source, pairs, riskVector, crossmatch) {
  const sourceId = getSourceId(source);
  const lines = [];

  lines.push(`# Candidate Investigation Briefing`);
  lines.push("");
  lines.push(`SOURCE_ID: ${sourceId}`);
  lines.push(`Investigation tier: ${riskVector.tier}`);
  lines.push(`Investigation score: ${formatNumber(riskVector.investigationScore, 6)}`);
  lines.push("");
  lines.push(`## Primary evidence`);
  lines.push(`- Dynamics classification: ${source.dynamics_classification ?? "N/A"}`);
  lines.push(`- Dynamics index: ${formatNumber(source.dynamics_index, 6)}`);
  lines.push(
    `- Hidden companion classification: ${
      source.hidden_companion_classification ?? "N/A"
    }`,
  );
  lines.push(
    `- Hidden companion index: ${formatNumber(source.hidden_companion_index, 6)}`,
  );
  lines.push(`- Approximate space velocity: ${formatNumber(source.approximate_space_velocity, 6)} km/s`);
  lines.push(`- Pair relations attached: ${pairs.length}`);
  lines.push(`- Automatic crossmatch attached: ${crossmatch ? "yes" : "no"}`);
  lines.push("");
  lines.push(`## Immediate operational plan`);
  lines.push(`1. Verify Gaia DR3 identity and astrometric parameters.`);
  lines.push(`2. Inspect SIMBAD and VizieR around the source coordinates.`);
  lines.push(`3. Run Gaia NSS query for non-single-star solutions.`);
  lines.push(`4. Compare the candidate against local neighbours within 60 arcsec.`);
  lines.push(`5. Treat every internal score as a prioritization proxy, not as proof.`);
  lines.push("");
  lines.push(`## Codex Alpha note`);
  lines.push(
    `The source can be used as an internal node in the Codex Alpha computational workflow, but no direct physical measurement of $\\nabla\\mathcal{K}$ is implied by these dashboard proxies.`,
  );

  return lines.join("\n");
}

function getPairOtherSource(pair, sourceId) {
  if (pair.source_a === sourceId) {
    return pair.source_b;
  }

  return pair.source_a;
}

function InvestigationMetric({ label, value, subtitle }) {
  return (
    <div className="cockpit-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {subtitle && <small>{subtitle}</small>}
    </div>
  );
}

function EvidenceGauge({ label, value, note }) {
  const percentage = Math.max(0, Math.min(100, normalizeNumber(value, 0) * 100));

  return (
    <div className="evidence-gauge">
      <div className="evidence-gauge-header">
        <span>{label}</span>
        <strong>{percentage.toFixed(1)}%</strong>
      </div>

      <div className="evidence-gauge-track">
        <div
          className="evidence-gauge-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <small>{note}</small>
    </div>
  );
}

function CandidateConstellation({
  activeRecord,
  pairRelations,
  recordMap,
  onSelect,
}) {
  const sourceId = getSourceId(activeRecord);

  const satellites = pairRelations
    .map((pair) => {
      const otherId = getPairOtherSource(pair, sourceId);
      const otherRecord = recordMap.get(otherId);

      return {
        pair,
        otherId,
        otherRecord,
      };
    })
    .slice(0, 8);

  return (
    <div className="candidate-constellation">
      <div className="constellation-radar-ring ring-one" />
      <div className="constellation-radar-ring ring-two" />
      <div className="constellation-radar-ring ring-three" />

      <button
        type="button"
        className="constellation-core"
        onClick={() => onSelect(activeRecord)}
      >
        <span>Selected Source</span>
        <strong>{sourceId}</strong>
      </button>

      {satellites.map((item, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(1, satellites.length);
        const radius = index % 2 === 0 ? 38 : 31;
        const x = 50 + Math.cos(angle) * radius;
        const y = 50 + Math.sin(angle) * radius;
        const score = normalizeNumber(item.pair.binary_pair_score, 0);

        return (
          <button
            key={`${item.otherId}-${index}`}
            type="button"
            className="constellation-satellite"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              "--satellite-score": Math.max(0.18, Math.min(1, score)),
            }}
            onClick={() => {
              if (item.otherRecord) {
                onSelect(item.otherRecord);
              }
            }}
            title={item.pair.pair_classification}
          >
            <span>{item.pair.pair_classification}</span>
            <strong>{item.otherId}</strong>
            <small>score {formatNumber(item.pair.binary_pair_score, 3)}</small>
          </button>
        );
      })}

      {!satellites.length && (
        <div className="constellation-empty">
          <strong>No local pair relation attached</strong>
          <span>
            The selected source has no pair candidate under the active internal
            thresholds.
          </span>
        </div>
      )}
    </div>
  );
}

function InvestigationTimeline({ riskVector, activeRecord, pairRelations }) {
  const hasDirectQuality = Boolean(activeRecord?.has_direct_astrometric_quality);
  const hasPairs = pairRelations.length > 0;
  const hasRadialVelocity =
    normalizeNumber(activeRecord?.radial_velocity, null) !== null;

  const steps = [
    {
      label: "Gaia identity lock",
      status: "ready",
      text: "Verify source_id, position, parallax and proper motion directly in Gaia DR3.",
    },
    {
      label: "Astrometric-quality scan",
      status: hasDirectQuality ? "ready" : "limited",
      text: hasDirectQuality
        ? "Direct quality fields are available for stronger unresolved-companion triage."
        : "Direct quality fields are missing here; the hidden-companion layer remains indirect.",
    },
    {
      label: "Pair-field interrogation",
      status: hasPairs ? "ready" : "limited",
      text: hasPairs
        ? "At least one possible comoving or wide-binary relation is attached."
        : "No local pair relation is attached under the current pair-scoring thresholds.",
    },
    {
      label: "Velocity consistency",
      status: hasRadialVelocity ? "ready" : "limited",
      text: hasRadialVelocity
        ? "Radial velocity is available, allowing a stronger space-velocity estimate."
        : "Radial velocity is missing, so space velocity relies on tangential motion only.",
    },
    {
      label: "External validation",
      status: riskVector.investigationScore >= 0.52 ? "priority" : "planned",
      text:
        riskVector.investigationScore >= 0.52
          ? "This object deserves a priority external validation pass."
          : "External validation is still required before any physical interpretation.",
    },
  ];

  return (
    <div className="investigation-timeline">
      {steps.map((step, index) => (
        <div
          className={`timeline-step timeline-step-${step.status}`}
          key={step.label}
        >
          <div className="timeline-marker">{index + 1}</div>

          <div>
            <strong>{step.label}</strong>
            <p>{step.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function QueryCard({ title, query, onCopy }) {
  return (
    <div className="cockpit-query-card">
      <div className="cockpit-query-header">
        <span>{title}</span>

        <button type="button" onClick={() => onCopy(title, query)}>
          Copy
        </button>
      </div>

      <pre>
        <code>{query || "No query available for this source."}</code>
      </pre>
    </div>
  );
}

function CandidateInvestigationCockpit({
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
  const [copied, setCopied] = useState(null);
  const [focusMode, setFocusMode] = useState("mission");

  const maps = useMemo(
    () => ({
      centralityMap: buildMapBySourceId(graphCentrality),
      featureMap: buildMapBySourceId(featureContributions),
      emergentMap: buildMapBySourceId(emergentStructures),
    }),
    [graphCentrality, featureContributions, emergentStructures],
  );

  const records = useMemo(() => {
    return allSources.map((source) => enrichSource(source, maps));
  }, [allSources, maps]);

  const recordMap = useMemo(() => buildMapBySourceId(records), [records]);

  const generatedPairs = useMemo(() => {
    return buildGeneratedPairCandidates(records, 140);
  }, [records]);

  const normalizedInputPairs = useMemo(() => {
    return possibleBinaryPairs
      .map((pair) => normalizeInputPair(pair, recordMap))
      .filter((pair) => pair.source_a && pair.source_b);
  }, [possibleBinaryPairs, recordMap]);

  const pairCandidates = useMemo(() => {
    if (generatedPairs.length) {
      return generatedPairs;
    }

    return normalizedInputPairs;
  }, [generatedPairs, normalizedInputPairs]);

  const selectedSourceId = selectedSource ? getSourceId(selectedSource) : null;

  const activeRecord = useMemo(() => {
    if (selectedSourceId) {
      const match = records.find((record) => getSourceId(record) === selectedSourceId);

      if (match) {
        return match;
      }
    }

    return (
      records
        .slice()
        .sort(
          (a, b) =>
            normalizeNumber(b.dynamics_index, 0) -
            normalizeNumber(a.dynamics_index, 0),
        )[0] ?? null
    );
  }, [records, selectedSourceId]);

  const activeSourceId = activeRecord ? getSourceId(activeRecord) : "";

  const activePairs = useMemo(() => {
    if (!activeSourceId) {
      return [];
    }

    return pairCandidates.filter(
      (pair) => pair.source_a === activeSourceId || pair.source_b === activeSourceId,
    );
  }, [pairCandidates, activeSourceId]);

  const crossmatch = useMemo(() => {
    return findCrossmatch(activeRecord, candidateCrossmatchResults);
  }, [activeRecord, candidateCrossmatchResults]);

  const riskVector = useMemo(() => {
    if (!activeRecord) {
      return {
        investigationScore: 0,
        tier: "No target selected",
        components: [],
      };
    }

    return computeRiskVector(activeRecord, activePairs.length, crossmatch);
  }, [activeRecord, activePairs, crossmatch]);

  const missionBriefing = useMemo(() => {
    if (!activeRecord) {
      return "";
    }

    return buildMissionBriefing(activeRecord, activePairs, riskVector, crossmatch);
  }, [activeRecord, activePairs, riskVector, crossmatch]);

  const topTargets = useMemo(() => {
    return records
      .map((record) => {
        const sourceId = getSourceId(record);
        const pairCount = pairCandidates.filter(
          (pair) => pair.source_a === sourceId || pair.source_b === sourceId,
        ).length;

        const localCrossmatch = findCrossmatch(record, candidateCrossmatchResults);
        const localRisk = computeRiskVector(record, pairCount, localCrossmatch);

        return {
          record,
          pairCount,
          risk: localRisk,
        };
      })
      .sort((a, b) => b.risk.investigationScore - a.risk.investigationScore)
      .slice(0, 12);
  }, [records, pairCandidates, candidateCrossmatchResults]);

  async function copyText(label, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied("Copy failed");
      window.setTimeout(() => setCopied(null), 1600);
    }
  }

  function handleSelect(record) {
    if (onSourceSelect) {
      onSourceSelect(record);
    }
  }

  if (!activeRecord) {
    return (
      <section className="advanced-page-shell">
        <div className="panel advanced-hero-panel">
          <div className="eyebrow">Fourth Analysis Interface</div>

          <h2>Candidate Investigation Cockpit</h2>

          <p>
            No Gaia source is currently available. Load the dashboard dataset
            before opening the investigation cockpit.
          </p>

          <div className="advanced-actions">
            <button
              type="button"
              className="dashboard-nav-button"
              onClick={() => setCurrentPage?.("dynamics")}
            >
              Back to Astrometric Dynamics Lab
            </button>
          </div>
        </div>
      </section>
    );
  }

  const sourceAdql = buildGaiaAdql(activeRecord);
  const nssAdql = buildNssAdql(activeRecord);
  const neighbourAdql = buildNeighbourAdql(activeRecord);

  return (
    <section className="advanced-page-shell investigation-cockpit-shell">
      <div className="panel advanced-hero-panel cockpit-hero-panel">
        <div className="eyebrow">Fourth Analysis Interface</div>

        <h2>Candidate Investigation Cockpit</h2>

        <p>
          A mission-control layer for turning a selected Gaia candidate into a
          concrete investigation target: evidence pressure, pair-field context,
          validation sequence, external catalogue links and ready-to-copy ADQL
          queries.
        </p>

        <div className="advanced-actions">
          <button
            type="button"
            className="dashboard-nav-button dashboard-nav-button-accent"
            onClick={() => setCurrentPage?.("dynamics")}
          >
            Back to Astrometric Dynamics Lab
          </button>

          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => setCurrentPage?.("advanced")}
          >
            Advanced Analysis Layer
          </button>

          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => setCurrentPage?.("dashboard")}
          >
            Operational Dashboard
          </button>
        </div>
      </div>

      <section className="cockpit-command-grid">
        <div className="panel cockpit-target-panel">
          <div className="cockpit-target-header">
            <div>
              <span className="candidate-id">Active Target</span>
              <h2>{activeSourceId}</h2>
              <p>{riskVector.tier}</p>
            </div>

            <div className="cockpit-score-core">
              <span>Investigation score</span>
              <strong>{formatNumber(riskVector.investigationScore, 4)}</strong>
            </div>
          </div>

          <div className="cockpit-metric-grid">
            <InvestigationMetric
              label="Dynamics index"
              value={formatNumber(activeRecord.dynamics_index, 4)}
              subtitle={activeRecord.dynamics_classification}
            />

            <InvestigationMetric
              label="Hidden companion"
              value={formatNumber(activeRecord.hidden_companion_index, 4)}
              subtitle={activeRecord.hidden_companion_classification}
            />

            <InvestigationMetric
              label="Space velocity"
              value={`${formatNumber(activeRecord.approximate_space_velocity, 3)} km/s`}
              subtitle="approximate"
            />

            <InvestigationMetric
              label="Pair relations"
              value={activePairs.length}
              subtitle="local candidate links"
            />

            <InvestigationMetric
              label="Distance"
              value={`${formatNumber(activeRecord.distance_pc, 3)} pc`}
              subtitle="from parallax when available"
            />

            <InvestigationMetric
              label="BP-RP"
              value={formatNumber(activeRecord.gaia_color_index, 4)}
              subtitle="Gaia colour proxy"
            />
          </div>

          <div className="cockpit-mode-switch">
            <button
              type="button"
              className={focusMode === "mission" ? "active" : ""}
              onClick={() => setFocusMode("mission")}
            >
              Mission view
            </button>

            <button
              type="button"
              className={focusMode === "evidence" ? "active" : ""}
              onClick={() => setFocusMode("evidence")}
            >
              Evidence view
            </button>

            <button
              type="button"
              className={focusMode === "queries" ? "active" : ""}
              onClick={() => setFocusMode("queries")}
            >
              Query view
            </button>
          </div>
        </div>

        <div className="panel cockpit-constellation-panel">
          <div className="panel-header">
            <div>
              <h2>Relation Field</h2>
              <span>Possible local connections</span>
            </div>
          </div>

          <CandidateConstellation
            activeRecord={activeRecord}
            pairRelations={activePairs}
            recordMap={recordMap}
            onSelect={handleSelect}
          />
        </div>
      </section>

      {focusMode === "mission" && (
        <section className="cockpit-two-column">
          <div className="panel cockpit-evidence-panel">
            <div className="panel-header">
              <div>
                <h2>Mission Timeline</h2>
                <span>Validation sequence</span>
              </div>
            </div>

            <InvestigationTimeline
              riskVector={riskVector}
              activeRecord={activeRecord}
              pairRelations={activePairs}
            />
          </div>

          <div className="panel cockpit-briefing-panel">
            <div className="panel-header">
              <div>
                <h2>Mission Briefing</h2>
                <span>Export-ready scientific summary</span>
              </div>

              <button
                type="button"
                className="dashboard-nav-button"
                onClick={() => copyText("mission briefing", missionBriefing)}
              >
                Copy briefing
              </button>
            </div>

            <pre className="cockpit-briefing-text">{missionBriefing}</pre>
          </div>
        </section>
      )}

      {focusMode === "evidence" && (
        <section className="cockpit-two-column">
          <div className="panel cockpit-evidence-panel">
            <div className="panel-header">
              <div>
                <h2>Evidence Pressure Vector</h2>
                <span>Internal prioritization map</span>
              </div>
            </div>

            <div className="evidence-gauge-grid">
              {riskVector.components.map((component) => (
                <EvidenceGauge
                  key={component.label}
                  label={component.label}
                  value={component.value}
                  note={component.note}
                />
              ))}
            </div>
          </div>

          <div className="panel cockpit-pair-panel">
            <div className="panel-header">
              <div>
                <h2>Pair Candidate Details</h2>
                <span>Comoving / wide-binary triage</span>
              </div>
            </div>

            {!activePairs.length && (
              <div className="empty-selection">
                No local pair candidate is attached to this selected source.
              </div>
            )}

            {!!activePairs.length && (
              <div className="cockpit-pair-list">
                {activePairs.slice(0, 8).map((pair) => {
                  const otherId = getPairOtherSource(pair, activeSourceId);
                  const otherRecord = recordMap.get(otherId);

                  return (
                    <button
                      key={pair.pair_id ?? `${pair.source_a}-${pair.source_b}`}
                      type="button"
                      className="cockpit-pair-card"
                      onClick={() => {
                        if (otherRecord) {
                          handleSelect(otherRecord);
                        }
                      }}
                    >
                      <span>{pair.pair_classification}</span>
                      <strong>{otherId}</strong>

                      <small>
                        score {formatNumber(pair.binary_pair_score, 4)} · sep{" "}
                        {formatNumber(pair.angular_arcsec, 3)} arcsec · PM diff{" "}
                        {formatNumber(pair.proper_motion_difference, 3)}
                      </small>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {focusMode === "queries" && (
        <section className="panel cockpit-query-panel">
          <div className="panel-header">
            <div>
              <h2>Validation Query Console</h2>
              <span>Gaia Archive-ready ADQL snippets</span>
            </div>

            {copied && <span className="copy-status">Copied: {copied}</span>}
          </div>

          <div className="candidate-action-row">
            <a
              className="dashboard-nav-button dashboard-nav-button-accent"
              href={buildGaiaArchiveUrl(activeRecord)}
              target="_blank"
              rel="noreferrer"
            >
              Open Gaia Archive
            </a>

            <a
              className="dashboard-nav-button"
              href={buildEsaSkyUrl(activeRecord)}
              target="_blank"
              rel="noreferrer"
            >
              Open ESASky
            </a>

            <a
              className="dashboard-nav-button"
              href={buildSimbadUrl(activeRecord)}
              target="_blank"
              rel="noreferrer"
            >
              Open SIMBAD
            </a>

            <a
              className="dashboard-nav-button"
              href={buildVizierUrl(activeRecord)}
              target="_blank"
              rel="noreferrer"
            >
              Open VizieR
            </a>
          </div>

          <div className="cockpit-query-grid">
            <QueryCard title="Gaia source query" query={sourceAdql} onCopy={copyText} />
            <QueryCard title="Gaia NSS query" query={nssAdql} onCopy={copyText} />
            <QueryCard
              title="Neighbourhood query"
              query={neighbourAdql}
              onCopy={copyText}
            />
          </div>
        </section>
      )}

      <section className="panel cockpit-target-list-panel">
        <div className="panel-header">
          <div>
            <h2>Priority Target Queue</h2>
            <span>Best next objects to interrogate</span>
          </div>

          <span className="source-table-count">{topTargets.length} queued targets</span>
        </div>

        <div className="cockpit-target-queue">
          {topTargets.map((item, index) => {
            const sourceId = getSourceId(item.record);
            const selected = sourceId === activeSourceId;

            return (
              <button
                key={sourceId}
                type="button"
                className={`cockpit-target-row ${
                  selected ? "cockpit-target-row-selected" : ""
                }`}
                onClick={() => handleSelect(item.record)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>

                <div>
                  <strong>{sourceId}</strong>
                  <small>{item.risk.tier}</small>
                </div>

                <div>
                  <strong>{formatCompact(item.risk.investigationScore, 4)}</strong>
                  <small>score</small>
                </div>

                <div>
                  <strong>{item.pairCount}</strong>
                  <small>pairs</small>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}

export default CandidateInvestigationCockpit;