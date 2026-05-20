import React, { useMemo, useState } from "react";
import CandidateSignalMap3D from "./CandidateSignalMap3D.jsx";

const GAIA_ARCHIVE_BASE = "https://gea.esac.esa.int/archive/";
const SIMBAD_BASE = "https://simbad.u-strasbg.fr/simbad/";
const VIZIER_BASE = "https://vizier.cds.unistra.fr/viz-bin/VizieR";
const ESASKY_BASE = "https://sky.esa.int/";

function normalizeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp01(value) {
  const number = normalizeNumber(value, 0);

  if (number >= 0 && number <= 1) {
    return number;
  }

  return Math.max(0, Math.min(1, number / 100));
}

function formatNumber(value, digits = 4) {
  const number = normalizeNumber(value, null);

  if (number === null) {
    return "N/A";
  }

  if (Math.abs(number) >= 10000) {
    return number.toExponential(3);
  }

  return number.toFixed(digits);
}

function text(value) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  return String(value);
}

function getSourceId(source) {
  return String(
    source?.SOURCE_ID ??
      source?.source_id ??
      source?.sourceId ??
      source?.id ??
      "",
  );
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
  const array = Array.isArray(items) ? items : [];

  for (const item of array) {
    const id = getSourceId(item);

    if (id) {
      map.set(id, item);
    }
  }

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

function computeApproximateSpaceVelocity(tangentialVelocity, radialVelocity) {
  const vt = normalizeNumber(tangentialVelocity, null);
  const rv = normalizeNumber(radialVelocity, null);

  if (vt === null && rv === null) {
    return null;
  }

  if (vt === null) {
    return Math.abs(rv);
  }

  if (rv === null) {
    return Math.abs(vt);
  }

  return Math.sqrt(vt * vt + rv * rv);
}

function estimateColorIndex(source) {
  const direct = normalizeNumber(
    firstAvailable(source, ["gaia_color_index", "bp_rp", "BP_RP"]),
    null,
  );

  if (direct !== null) {
    return direct;
  }

  const bp = normalizeNumber(
    firstAvailable(source, ["phot_bp_mean_mag", "PHOT_BP_MEAN_MAG"]),
    null,
  );

  const rp = normalizeNumber(
    firstAvailable(source, ["phot_rp_mean_mag", "PHOT_RP_MEAN_MAG"]),
    null,
  );

  if (bp !== null && rp !== null) {
    return bp - rp;
  }

  return null;
}

function classifyDynamics(record) {
  const dynamics = normalizeNumber(record.dynamics_index, 0);
  const velocity = normalizeNumber(record.approximate_space_velocity, 0);
  const pmTotal = normalizeNumber(record.proper_motion_total, 0);

  if (dynamics >= 0.72) {
    return "High-priority dynamical candidate";
  }

  if (dynamics >= 0.52) {
    return "Moderate-priority dynamical candidate";
  }

  if (velocity > 140) {
    return "High-velocity candidate";
  }

  if (pmTotal > 90) {
    return "High proper-motion candidate";
  }

  return "Candidate-level kinematic profile";
}

function classifyHiddenCompanion(record) {
  const value = normalizeNumber(record.hidden_companion_index, 0);

  if (value >= 0.7) {
    return "High unresolved-companion suspicion proxy";
  }

  if (value >= 0.45) {
    return "Moderate unresolved-companion suspicion proxy";
  }

  if (value >= 0.25) {
    return "Weak unresolved-companion suspicion proxy";
  }

  return "Low unresolved-companion suspicion proxy";
}

function enrichSource(source, maps) {
  const sourceId = getSourceId(source);

  const merged = {
    ...source,
    ...(maps.centralityMap.get(sourceId) ?? {}),
    ...(maps.featureMap.get(sourceId) ?? {}),
    ...(maps.emergentMap.get(sourceId) ?? {}),
  };

  const parallax = firstAvailable(merged, ["parallax", "PARALLAX"]);
  const pmra = firstAvailable(merged, ["pmra", "PMRA"]);
  const pmdec = firstAvailable(merged, ["pmdec", "PMDEC"]);
  const radialVelocity = firstAvailable(merged, [
    "radial_velocity",
    "RADIAL_VELOCITY",
    "rv",
  ]);

  const distancePc =
    normalizeNumber(
      firstAvailable(merged, ["distance_pc", "distancePc", "distance_estimate"]),
      null,
    ) ?? computeDistancePc(parallax);

  const properMotionTotal =
    normalizeNumber(
      firstAvailable(merged, ["proper_motion_total", "properMotionTotal"]),
      null,
    ) ?? computeProperMotionTotal(pmra, pmdec);

  const tangentialVelocity =
    normalizeNumber(
      firstAvailable(merged, ["tangential_velocity", "tangentialVelocity"]),
      null,
    ) ?? computeTangentialVelocity(properMotionTotal, parallax);

  const approximateSpaceVelocity =
    normalizeNumber(
      firstAvailable(merged, [
        "approximate_space_velocity",
        "approximateSpaceVelocity",
      ]),
      null,
    ) ?? computeApproximateSpaceVelocity(tangentialVelocity, radialVelocity);

  const anomalyScore = normalizeNumber(
    firstAvailable(merged, ["anomaly_score", "anomalyScore"]),
    0,
  );

  const structuralImportance = normalizeNumber(
    firstAvailable(merged, [
      "structural_importance_score",
      "structural_importance",
      "structuralImportance",
      "pagerank",
      "degree",
    ]),
    0,
  );

  const hiddenCompanionIndex = normalizeNumber(
    firstAvailable(merged, [
      "hidden_companion_index",
      "hiddenCompanionIndex",
      "hidden_companion_suspicion_index",
    ]),
    0,
  );

  const dynamicsIndex =
    normalizeNumber(
      firstAvailable(merged, ["dynamics_index", "dynamicsIndex"]),
      null,
    ) ??
    Math.min(
      1,
      0.36 * clamp01(anomalyScore) +
        0.26 * clamp01(structuralImportance) +
        0.24 * clamp01(hiddenCompanionIndex) +
        0.14 *
          Math.min(
            1,
            Math.abs(normalizeNumber(approximateSpaceVelocity, 0)) / 220,
          ),
    );

  const colorIndex = estimateColorIndex(merged);

  const enriched = {
    ...merged,

    SOURCE_ID: sourceId,

    parallax,
    pmra,
    pmdec,
    radial_velocity: radialVelocity,

    distance_pc: distancePc,
    proper_motion_total: properMotionTotal,
    tangential_velocity: tangentialVelocity,
    approximate_space_velocity: approximateSpaceVelocity,

    anomaly_score: anomalyScore,
    structural_importance_score: structuralImportance,

    dynamics_index: dynamicsIndex,
    hidden_companion_index: hiddenCompanionIndex,
    gaia_color_index: colorIndex,
  };

  return {
    ...enriched,

    dynamics_classification:
      merged.dynamics_classification ?? classifyDynamics(enriched),

    hidden_companion_classification:
      merged.hidden_companion_classification ??
      classifyHiddenCompanion(enriched),
  };
}

function anomalyPriorityScore(record) {
  return (
    0.34 * clamp01(record.anomaly_score) +
    0.24 * clamp01(record.dynamics_index) +
    0.22 * clamp01(record.hidden_companion_index) +
    0.14 * clamp01(record.structural_importance_score) +
    0.06 *
      Math.min(
        1,
        Math.abs(normalizeNumber(record.approximate_space_velocity, 0)) / 240,
      )
  );
}

function normalizePair(pair) {
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

  return {
    ...pair,
    source_a: sourceA,
    source_b: sourceB,
    binary_pair_score: normalizeNumber(
      pair?.binary_pair_score ?? pair?.pair_score ?? pair?.score,
      0,
    ),
    pair_classification:
      pair?.pair_classification ??
      pair?.classification ??
      "Possible pair candidate, not confirmed",
    angular_arcsec: normalizeNumber(pair?.angular_arcsec, null),
    proper_motion_difference: normalizeNumber(pair?.proper_motion_difference, null),
    parallax_relative_difference: normalizeNumber(
      pair?.parallax_relative_difference,
      null,
    ),
  };
}

function buildPairCountMap(pairs) {
  const map = new Map();

  for (const pair of pairs) {
    if (pair.source_a) {
      map.set(pair.source_a, (map.get(pair.source_a) ?? 0) + 1);
    }

    if (pair.source_b) {
      map.set(pair.source_b, (map.get(pair.source_b) ?? 0) + 1);
    }
  }

  return map;
}

function findCrossmatch(source, crossmatchResults = []) {
  const sourceId = getSourceId(source);

  if (!sourceId || !Array.isArray(crossmatchResults)) {
    return null;
  }

  return (
    crossmatchResults.find((item) => {
      const id = String(
        item?.SOURCE_ID ??
          item?.source_id ??
          item?.sourceId ??
          item?.gaia_source_id ??
          item?.id ??
          "",
      );

      return id === sourceId;
    }) ?? null
  );
}

function crossmatchStatus(crossmatch) {
  if (!crossmatch) {
    return "N/A";
  }

  const simbad = firstAvailable(crossmatch, [
    "simbad",
    "SIMBAD",
    "simbad_status",
    "simbad_main_id",
  ]);

  const vizier = firstAvailable(crossmatch, [
    "vizier",
    "VIZIER",
    "vizier_status",
    "vizier_catalogs",
  ]);

  const nss = firstAvailable(crossmatch, [
    "nss",
    "NSS",
    "gaia_nss",
    "nss_status",
    "non_single_star",
  ]);

  return (
    [
      simbad ? `SIMBAD: ${text(simbad)}` : null,
      vizier ? `VizieR: ${text(vizier)}` : null,
      nss ? `NSS: ${text(nss)}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || "Crossmatch attached"
  );
}

function buildGaiaArchiveUrl(source) {
  const id = getSourceId(source);

  if (!id) {
    return GAIA_ARCHIVE_BASE;
  }

  return `${GAIA_ARCHIVE_BASE}?target=${encodeURIComponent(`Gaia DR3 ${id}`)}`;
}

function buildSimbadUrl(source) {
  const ra = normalizeNumber(firstAvailable(source, ["ra", "RA"]), null);
  const dec = normalizeNumber(firstAvailable(source, ["dec", "DEC"]), null);

  if (ra === null || dec === null) {
    return SIMBAD_BASE;
  }

  return `${SIMBAD_BASE}sim-coo?Coord=${encodeURIComponent(
    `${ra.toFixed(10)} ${dec.toFixed(10)}`,
  )}&Radius=5&Radius.unit=arcsec`;
}

function buildVizierUrl(source) {
  const ra = normalizeNumber(firstAvailable(source, ["ra", "RA"]), null);
  const dec = normalizeNumber(firstAvailable(source, ["dec", "DEC"]), null);

  if (ra === null || dec === null) {
    return VIZIER_BASE;
  }

  return `${VIZIER_BASE}?-c=${encodeURIComponent(
    `${ra.toFixed(10)} ${dec.toFixed(10)}`,
  )}&-c.rs=5`;
}

function buildEsaSkyUrl(source) {
  const ra = normalizeNumber(firstAvailable(source, ["ra", "RA"]), null);
  const dec = normalizeNumber(firstAvailable(source, ["dec", "DEC"]), null);

  if (ra === null || dec === null) {
    return ESASKY_BASE;
  }

  return `${ESASKY_BASE}?target=${encodeURIComponent(
    `${ra.toFixed(10)} ${dec.toFixed(10)}`,
  )}&hips=Digitized%20Sky%20Survey%202%20color`;
}

function buildGaiaAdql(source) {
  const id = getSourceId(source);

  if (!id) {
    return "";
  }

  return `SELECT *
FROM gaiadr3.gaia_source
WHERE source_id = ${id};`;
}

function buildNssAdql(source) {
  const id = getSourceId(source);

  if (!id) {
    return "";
  }

  return `SELECT *
FROM gaiadr3.nss_two_body_orbit
WHERE source_id = ${id};`;
}

function buildNeighbourAdql(source) {
  const ra = normalizeNumber(firstAvailable(source, ["ra", "RA"]), null);
  const dec = normalizeNumber(firstAvailable(source, ["dec", "DEC"]), null);

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
  phot_g_mean_mag,
  bp_rp
FROM gaiadr3.gaia_source
WHERE 1 = CONTAINS(
  POINT('ICRS', ra, dec),
  CIRCLE('ICRS', ${ra.toFixed(10)}, ${dec.toFixed(10)}, 0.0166667)
);`;
}

function buildMissionBriefing(record, activePairs, crossmatch) {
  if (!record) {
    return "";
  }

  const lines = [];

  lines.push("CODEX ALPHA CANDIDATE INVESTIGATION COCKPIT");
  lines.push("");
  lines.push(`SOURCE_ID: ${getSourceId(record) || "N/A"}`);
  lines.push("");
  lines.push("Candidate-level interpretation:");
  lines.push(
    "This source is selected from the dashboard candidate pool using Gaia-derived proxies. It is not a confirmed planet host, binary system, exotic object, or new physical mechanism.",
  );
  lines.push("");
  lines.push(`Anomaly score: ${formatNumber(record.anomaly_score, 6)}`);
  lines.push(`Dynamics index: ${formatNumber(record.dynamics_index, 6)}`);
  lines.push(
    `Hidden companion index: ${formatNumber(record.hidden_companion_index, 6)}`,
  );
  lines.push(
    `Structural importance: ${formatNumber(
      record.structural_importance_score,
      6,
    )}`,
  );
  lines.push(
    `Approximate space velocity: ${formatNumber(
      record.approximate_space_velocity,
      6,
    )}`,
  );
  lines.push("");
  lines.push(`Dynamics classification: ${text(record.dynamics_classification)}`);
  lines.push(
    `Hidden companion classification: ${text(
      record.hidden_companion_classification,
    )}`,
  );
  lines.push(
    `Possible pair involvement: ${
      activePairs.length
        ? `${activePairs.length} possible pair candidate(s), not confirmed`
        : "N/A"
    }`,
  );
  lines.push(`Crossmatch: ${crossmatchStatus(crossmatch)}`);
  lines.push("");
  lines.push("Next validation steps:");
  lines.push("1. Verify the Gaia DR3 source directly in Gaia Archive.");
  lines.push("2. Check SIMBAD and VizieR object context.");
  lines.push("3. Check Gaia NSS, RUWE, astrometric excess noise and radial velocity.");
  lines.push(
    "4. Compare parallax and proper motion with nearby sources before any comoving-pair interpretation.",
  );
  lines.push(
    "5. Treat ∇𝒦 language as internal framework context only, not as a direct physical measurement.",
  );

  return lines.join("\n");
}

function MetricCard({ label, value, subtitle }) {
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

      {note && <small>{note}</small>}
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
        <code>{query || "N/A"}</code>
      </pre>
    </div>
  );
}

function HexagonStatsChart({ record }) {
  const metrics = [
    {
      label: "Anomaly",
      value: clamp01(record?.anomaly_score),
      raw: formatNumber(record?.anomaly_score, 3),
    },
    {
      label: "Dynamics",
      value: clamp01(record?.dynamics_index),
      raw: formatNumber(record?.dynamics_index, 3),
    },
    {
      label: "Hidden",
      value: clamp01(record?.hidden_companion_index),
      raw: formatNumber(record?.hidden_companion_index, 3),
    },
    {
      label: "Velocity",
      value: Math.min(
        1,
        Math.abs(normalizeNumber(record?.approximate_space_velocity, 0)) / 220,
      ),
      raw: formatNumber(record?.approximate_space_velocity, 2),
    },
    {
      label: "Structure",
      value: clamp01(record?.structural_importance_score),
      raw: formatNumber(record?.structural_importance_score, 3),
    },
    {
      label: "Color",
      value: Math.min(
        1,
        Math.max(
          0,
          (normalizeNumber(record?.gaia_color_index, 1.2) - 0.2) / 3.2,
        ),
      ),
      raw: formatNumber(record?.gaia_color_index, 3),
    },
  ];

  const cx = 190;
  const cy = 160;
  const radius = 112;

  function point(angle, scale = 1) {
    return [
      cx + Math.cos(angle) * radius * scale,
      cy + Math.sin(angle) * radius * scale,
    ];
  }

  const axisAngles = metrics.map(
    (_, index) => -Math.PI / 2 + (Math.PI * 2 * index) / metrics.length,
  );

  const outer = axisAngles.map((angle) => point(angle, 1));
  const mid = axisAngles.map((angle) => point(angle, 0.66));
  const inner = axisAngles.map((angle) => point(angle, 0.33));

  const polygon = metrics
    .map((metric, index) => point(axisAngles[index], metric.value))
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  return (
    <div className="candidate-explanation-card">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Candidate stat profile</div>
          <h2>Hexagonal Proxy Chart</h2>
        </div>
        <span>candidate-level</span>
      </div>

      <svg
        className="hexagon-stats-chart"
        viewBox="0 0 380 320"
        role="img"
        aria-label="Hexagonal proxy chart"
      >
        <polygon
          points={outer.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="rgba(0,245,255,0.025)"
          stroke="rgba(0,245,255,0.58)"
          strokeWidth="1.4"
        />

        <polygon
          points={mid.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="rgba(0,245,255,0.18)"
          strokeWidth="1"
        />

        <polygon
          points={inner.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="rgba(0,245,255,0.14)"
          strokeWidth="1"
        />

        {axisAngles.map((angle, index) => {
          const [x, y] = point(angle, 1);

          return (
            <line
              key={`axis-${metrics[index].label}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="rgba(170,210,255,0.18)"
              strokeWidth="1"
            />
          );
        })}

        <polygon
          points={polygon}
          fill="rgba(57,255,20,0.28)"
          stroke="rgba(57,255,20,0.95)"
          strokeWidth="2"
        />

        {metrics.map((metric, index) => {
          const [x, y] = point(axisAngles[index], metric.value);
          const [tx, ty] = point(axisAngles[index], 1.18);

          return (
            <g key={metric.label}>
              <circle cx={x} cy={y} r="4.8" fill="#39ff14" />
              <text
                x={tx}
                y={ty}
                textAnchor={tx < cx - 8 ? "end" : tx > cx + 8 ? "start" : "middle"}
                dominantBaseline="middle"
                fill="#e8fbff"
                fontSize="11"
                fontWeight="800"
              >
                {metric.label}
              </text>
              <text
                x={tx}
                y={ty + 13}
                textAnchor={tx < cx - 8 ? "end" : tx > cx + 8 ? "start" : "middle"}
                dominantBaseline="middle"
                fill="#39ff14"
                fontSize="10"
                fontWeight="800"
              >
                {metric.raw}
              </text>
            </g>
          );
        })}
      </svg>

      <p>
        All axes are normalized dashboard proxies. This chart supports candidate
        prioritization only and does not confirm an astrophysical classification.
      </p>
    </div>
  );
}

export default function CandidateInvestigationCockpit({
  allSources = [],
  selectedSource = null,
  graphCentrality = [],
  featureContributions = [],
  emergentStructures = [],
  candidateCrossmatchResults = [],
  possibleBinaryPairs = [],
  onSourceSelect = () => {},
  setCurrentPage = () => {},
}) {
  const [focusMode, setFocusMode] = useState("mission");
  const [copied, setCopied] = useState(null);

  const maps = useMemo(
    () => ({
      centralityMap: buildMapBySourceId(graphCentrality),
      featureMap: buildMapBySourceId(featureContributions),
      emergentMap: buildMapBySourceId(emergentStructures),
    }),
    [graphCentrality, featureContributions, emergentStructures],
  );

  const anomalyPool = useMemo(() => {
    const sourceArray = Array.isArray(allSources) ? allSources : [];

    return sourceArray
      .map((source) => enrichSource(source, maps))
      .sort((a, b) => anomalyPriorityScore(b) - anomalyPriorityScore(a))
      .slice(0, 50);
  }, [allSources, maps]);

  const recordMap = useMemo(() => buildMapBySourceId(anomalyPool), [anomalyPool]);

  const selectedSourceId = getSourceId(selectedSource);

  const externallySelectedRecord = useMemo(() => {
    if (!selectedSourceId || !selectedSource) {
      return null;
    }

    if (recordMap.has(selectedSourceId)) {
      return recordMap.get(selectedSourceId);
    }

    return enrichSource(selectedSource, maps);
  }, [selectedSourceId, selectedSource, recordMap, maps]);

  const signalRecords = useMemo(() => {
    if (!externallySelectedRecord) {
      return anomalyPool;
    }

    const externalId = getSourceId(externallySelectedRecord);
    const alreadyIncluded = anomalyPool.some(
      (record) => getSourceId(record) === externalId,
    );

    if (alreadyIncluded) {
      return anomalyPool;
    }

    return [externallySelectedRecord, ...anomalyPool];
  }, [anomalyPool, externallySelectedRecord]);

  const signalRecordMap = useMemo(
    () => buildMapBySourceId(signalRecords),
    [signalRecords],
  );

  const pairCandidates = useMemo(() => {
    const pairArray = Array.isArray(possibleBinaryPairs) ? possibleBinaryPairs : [];

    return pairArray
      .slice(0, 120)
      .map(normalizePair)
      .filter((pair) => pair.source_a && pair.source_b);
  }, [possibleBinaryPairs]);

  const pairCountMap = useMemo(
    () => buildPairCountMap(pairCandidates),
    [pairCandidates],
  );

  const activeRecord = useMemo(() => {
    if (selectedSourceId && signalRecordMap.has(selectedSourceId)) {
      return signalRecordMap.get(selectedSourceId);
    }

    return anomalyPool[0] ?? signalRecords[0] ?? null;
  }, [selectedSourceId, signalRecordMap, anomalyPool, signalRecords]);

  const activeSourceId = getSourceId(activeRecord);

  const activePairs = useMemo(() => {
    if (!activeSourceId) {
      return [];
    }

    return pairCandidates
      .filter(
        (pair) =>
          pair.source_a === activeSourceId || pair.source_b === activeSourceId,
      )
      .slice(0, 12);
  }, [pairCandidates, activeSourceId]);

  const crossmatch = useMemo(
    () => findCrossmatch(activeRecord, candidateCrossmatchResults),
    [activeRecord, candidateCrossmatchResults],
  );

  const topTargets = useMemo(() => {
    return anomalyPool.slice(0, 12).map((record) => {
      const id = getSourceId(record);
      const pairCount = pairCountMap.get(id) ?? 0;

      return {
        record,
        score: anomalyPriorityScore(record),
        pairCount,
      };
    });
  }, [anomalyPool, pairCountMap]);

  const missionBriefing = useMemo(
    () => buildMissionBriefing(activeRecord, activePairs, crossmatch),
    [activeRecord, activePairs, crossmatch],
  );

  async function copyText(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied("Copy failed");
      window.setTimeout(() => setCopied(null), 1500);
    }
  }

  function handleSelect(record) {
    if (!record) {
      return;
    }

    onSourceSelect?.(record);
  }

  function handleSignalMapSelect(candidate) {
    const candidateId = getSourceId(candidate);

    if (!candidateId) {
      return;
    }

    const matchedRecord = signalRecordMap.get(candidateId);

    if (matchedRecord) {
      handleSelect(matchedRecord);
      return;
    }

    handleSelect(candidate);
  }

  if (!activeRecord) {
    return (
      <section className="investigation-cockpit-shell">
        <div className="panel cockpit-briefing-panel">
          <div className="panel-header">
            <h2>Candidate Investigation Cockpit</h2>
            <span>No candidate pool available</span>
          </div>

          <p>
            No Gaia source records were received by the fourth analysis
            interface.
          </p>

          <div className="navigation-notice">
            To move through the framework, use only the Previous and Next
            controls at the top of the page.
          </div>
        </div>
      </section>
    );
  }

  const sourceAdql = buildGaiaAdql(activeRecord);
  const nssAdql = buildNssAdql(activeRecord);
  const neighbourAdql = buildNeighbourAdql(activeRecord);

  return (
    <section className="investigation-cockpit-shell">
      <div className="panel cockpit-constellation-panel">
        <CandidateSignalMap3D
          records={signalRecords}
          allRecords={allSources}
          possiblePairs={pairCandidates}
          onCandidateSelect={handleSignalMapSelect}
          selectedSourceId={activeSourceId}
        />
      </div>

      <div className="cockpit-command-grid" style={{ marginTop: 22 }}>
        <div className="panel cockpit-target-panel">
          <div className="cockpit-target-header">
            <div>
              <p>Active candidate</p>
              <h2>{activeSourceId || "N/A"}</h2>
              <p>{text(activeRecord.dynamics_classification)}</p>
            </div>

            <div className="cockpit-score-core">
              <div>
                <span>Priority</span>
                <strong>{formatNumber(anomalyPriorityScore(activeRecord), 4)}</strong>
              </div>
            </div>
          </div>

          <div className="cockpit-metric-grid">
            <MetricCard
              label="Anomaly score"
              value={formatNumber(activeRecord.anomaly_score, 4)}
              subtitle="Internal anomaly proxy"
            />

            <MetricCard
              label="Dynamics index"
              value={formatNumber(activeRecord.dynamics_index, 4)}
              subtitle={activeRecord.dynamics_classification}
            />

            <MetricCard
              label="Hidden companion"
              value={formatNumber(activeRecord.hidden_companion_index, 4)}
              subtitle={activeRecord.hidden_companion_classification}
            />

            <MetricCard
              label="Distance"
              value={`${formatNumber(activeRecord.distance_pc, 3)} pc`}
              subtitle="Parallax-derived if available"
            />

            <MetricCard
              label="Tangential velocity"
              value={`${formatNumber(activeRecord.tangential_velocity, 3)} km/s`}
              subtitle="Requires parallax and proper motion"
            />

            <MetricCard
              label="Approx. space velocity"
              value={`${formatNumber(
                activeRecord.approximate_space_velocity,
                3,
              )} km/s`}
              subtitle="Incomplete if radial velocity is missing"
            />

            <MetricCard
              label="BP-RP / color"
              value={formatNumber(activeRecord.gaia_color_index, 4)}
              subtitle="Gaia photometric proxy"
            />

            <MetricCard
              label="Possible pair links"
              value={activePairs.length ? `${activePairs.length}` : "N/A"}
              subtitle="Not confirmed"
            />

            <MetricCard
              label="Crossmatch"
              value={crossmatch ? "Attached" : "N/A"}
              subtitle={crossmatchStatus(crossmatch)}
            />
          </div>

          <div className="cockpit-mode-switch">
            <button
              type="button"
              className={focusMode === "mission" ? "active" : ""}
              onClick={() => setFocusMode("mission")}
            >
              Mission
            </button>

            <button
              type="button"
              className={focusMode === "evidence" ? "active" : ""}
              onClick={() => setFocusMode("evidence")}
            >
              Evidence
            </button>

            <button
              type="button"
              className={focusMode === "queries" ? "active" : ""}
              onClick={() => setFocusMode("queries")}
            >
              Queries
            </button>
          </div>
        </div>

        <div className="panel cockpit-constellation-panel">
          <HexagonStatsChart record={activeRecord} />
        </div>
      </div>

      {focusMode === "mission" && (
        <div className="cockpit-two-column" style={{ marginTop: 22 }}>
          <div className="panel cockpit-briefing-panel">
            <div className="panel-header">
              <h2>Mission Briefing</h2>
              <span>copy-ready</span>
            </div>

            <pre className="cockpit-briefing-text">{missionBriefing}</pre>

            <div className="candidate-action-row">
              <button
                type="button"
                className="dashboard-nav-button"
                onClick={() => copyText("mission briefing", missionBriefing)}
              >
                Copy briefing
              </button>

              <a
                className="dashboard-nav-button"
                href={buildGaiaArchiveUrl(activeRecord)}
                target="_blank"
                rel="noreferrer"
              >
                Gaia Archive
              </a>

              <a
                className="dashboard-nav-button"
                href={buildSimbadUrl(activeRecord)}
                target="_blank"
                rel="noreferrer"
              >
                SIMBAD
              </a>

              <a
                className="dashboard-nav-button"
                href={buildVizierUrl(activeRecord)}
                target="_blank"
                rel="noreferrer"
              >
                VizieR
              </a>

              {copied && <span className="copy-status">Copied: {copied}</span>}
            </div>
          </div>

          <div className="panel cockpit-target-list-panel">
            <div className="panel-header">
              <h2>Top Candidate Queue</h2>
              <span>{topTargets.length}/50 shown</span>
            </div>

            <div className="cockpit-target-queue">
              {topTargets.map((item, index) => {
                const id = getSourceId(item.record);
                const selected = id === activeSourceId;

                return (
                  <button
                    key={id || index}
                    type="button"
                    className={`cockpit-target-row ${
                      selected ? "cockpit-target-row-selected" : ""
                    }`}
                    onClick={() => handleSelect(item.record)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>

                    <div>
                      <strong>{id || "N/A"}</strong>
                      <small>
                        {text(item.record.hidden_companion_classification)}
                      </small>
                    </div>

                    <div>
                      <strong>{formatNumber(item.score, 4)}</strong>
                      <small>Priority</small>
                    </div>

                    <div>
                      <strong>{item.pairCount || "N/A"}</strong>
                      <small>Pairs</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {focusMode === "evidence" && (
        <div className="cockpit-two-column" style={{ marginTop: 22 }}>
          <div className="panel cockpit-evidence-panel">
            <div className="panel-header">
              <h2>Evidence Vector</h2>
              <span>proxy-only</span>
            </div>

            <div className="evidence-gauge-grid">
              <EvidenceGauge
                label="Anomaly"
                value={clamp01(activeRecord.anomaly_score)}
                note="Internal anomaly score. Not a physical classification."
              />

              <EvidenceGauge
                label="Dynamics"
                value={clamp01(activeRecord.dynamics_index)}
                note="Kinematic prioritization proxy."
              />

              <EvidenceGauge
                label="Hidden companion suspicion"
                value={clamp01(activeRecord.hidden_companion_index)}
                note="Heuristic flag, not a confirmed companion."
              />

              <EvidenceGauge
                label="Structural importance"
                value={clamp01(activeRecord.structural_importance_score)}
                note="Graph/ranking-derived importance proxy."
              />

              <EvidenceGauge
                label="Velocity extremeness"
                value={Math.min(
                  1,
                  Math.abs(
                    normalizeNumber(activeRecord.approximate_space_velocity, 0),
                  ) / 220,
                )}
                note="Approximate kinematic intensity."
              />
            </div>
          </div>

          <div className="panel cockpit-pair-panel">
            <div className="panel-header">
              <h2>Possible Pair Involvement</h2>
              <span>not confirmed</span>
            </div>

            {!activePairs.length && (
              <p>
                No possible pair involvement is currently attached to this
                candidate. The cockpit does not generate runtime pair candidates.
              </p>
            )}

            {!!activePairs.length && (
              <div className="cockpit-pair-list">
                {activePairs.map((pair, index) => {
                  const otherId =
                    pair.source_a === activeSourceId ? pair.source_b : pair.source_a;

                  return (
                    <div className="cockpit-pair-card" key={pair.pair_id ?? index}>
                      <span>{pair.pair_classification}</span>
                      <strong>{otherId || "N/A"}</strong>
                      <small>
                        Score {formatNumber(pair.binary_pair_score, 4)} | Sep{" "}
                        {formatNumber(pair.angular_arcsec, 3)} arcsec | PM diff{" "}
                        {formatNumber(pair.proper_motion_difference, 3)}
                      </small>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {focusMode === "queries" && (
        <div className="panel cockpit-query-panel" style={{ marginTop: 22 }}>
          <div className="panel-header">
            <h2>Validation Queries</h2>
            <span>external validation required</span>
          </div>

          <div className="candidate-action-row">
            <a
              className="dashboard-nav-button"
              href={buildGaiaArchiveUrl(activeRecord)}
              target="_blank"
              rel="noreferrer"
            >
              Gaia Archive
            </a>

            <a
              className="dashboard-nav-button"
              href={buildEsaSkyUrl(activeRecord)}
              target="_blank"
              rel="noreferrer"
            >
              ESA Sky
            </a>

            <a
              className="dashboard-nav-button"
              href={buildSimbadUrl(activeRecord)}
              target="_blank"
              rel="noreferrer"
            >
              SIMBAD
            </a>

            <a
              className="dashboard-nav-button"
              href={buildVizierUrl(activeRecord)}
              target="_blank"
              rel="noreferrer"
            >
              VizieR
            </a>
          </div>

          <div className="cockpit-query-grid">
            <QueryCard
              title="Gaia source query"
              query={sourceAdql}
              onCopy={copyText}
            />

            <QueryCard
              title="Gaia NSS query"
              query={nssAdql}
              onCopy={copyText}
            />

            <QueryCard
              title="Neighbourhood query"
              query={neighbourAdql}
              onCopy={copyText}
            />
          </div>

          {copied && (
            <p className="copy-status" style={{ marginTop: 14 }}>
              Copied: {copied}
            </p>
          )}
        </div>
      )}

      <div className="panel cockpit-briefing-panel" style={{ marginTop: 22 }}>
        <div className="panel-header">
          <h2>Scientific Caution</h2>
          <span>candidate-level only</span>
        </div>

        <p>
          This cockpit is a prioritization interface. It does not confirm
          planets, binaries, hidden companions, exotic objects, or new physical
          mechanisms. The ∇𝒦 notation is used only as Codex Alpha informational
          context and not as a direct physical measurement.
        </p>
        </div>
    </section>
  );
}
