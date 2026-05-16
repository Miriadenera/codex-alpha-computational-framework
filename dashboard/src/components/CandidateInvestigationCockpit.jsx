import React, { useMemo, useState } from "react";

const GAIA_ARCHIVE_BASE = "https://gea.esac.esa.int/archive/";
const SIMBAD_BASE = "https://simbad.cds.unistra.fr/simbad/";
const VIZIER_BASE = "https://vizier.cds.unistra.fr/viz-bin/VizieR";

function normalizeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatNumber(value, digits = 6) {
  const n = normalizeNumber(value, null);
  return n === null ? "N/A" : n.toFixed(digits);
}

function formatCompact(value, digits = 3) {
  const n = normalizeNumber(value, null);
  if (n === null) return "N/A";
  if (Math.abs(n) >= 1000) return n.toExponential(2);
  return n.toFixed(digits);
}

function getSourceId(source) {
  return String(source?.SOURCE_ID ?? source?.source_id ?? source?.sourceId ?? source?.id ?? "");
}

function firstAvailable(source, keys, fallback = null) {
  if (!source) return fallback;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function buildMapBySourceId(items = []) {
  const map = new Map();
  if (!Array.isArray(items)) return map;

  for (const item of items) {
    const id = getSourceId(item);
    if (id) map.set(id, item);
  }

  return map;
}

function computeDistancePc(parallaxMas) {
  const p = normalizeNumber(parallaxMas, null);
  if (p === null || p <= 0) return null;
  return 1000 / p;
}

function computeProperMotionTotal(pmra, pmdec) {
  const a = normalizeNumber(pmra, null);
  const d = normalizeNumber(pmdec, null);
  if (a === null || d === null) return null;
  return Math.sqrt(a * a + d * d);
}

function computeTangentialVelocity(pmTotal, parallaxMas) {
  const mu = normalizeNumber(pmTotal, null);
  const p = normalizeNumber(parallaxMas, null);
  if (mu === null || p === null || p <= 0) return null;
  return 4.74047 * mu / p;
}

function computeSpaceVelocity(tangentialVelocity, radialVelocity) {
  const vt = normalizeNumber(tangentialVelocity, null);
  const rv = normalizeNumber(radialVelocity, null);
  if (vt === null && rv === null) return null;
  if (vt !== null && rv === null) return vt;
  if (vt === null && rv !== null) return Math.abs(rv);
  return Math.sqrt(vt * vt + rv * rv);
}

function safeScore01(value) {
  const n = normalizeNumber(value, 0);
  if (!Number.isFinite(n)) return 0;
  if (n <= 1 && n >= 0) return n;
  return Math.max(0, Math.min(1, n / 100));
}

function enrichSource(source, maps) {
  const sourceId = getSourceId(source);
  const centrality = maps.centralityMap.get(sourceId) ?? {};
  const features = maps.featureMap.get(sourceId) ?? {};
  const emergent = maps.emergentMap.get(sourceId) ?? {};

  const merged = {
    ...source,
    ...emergent,
    ...centrality,
    ...features,
    SOURCE_ID: sourceId,
    source_id: sourceId,
  };

  const parallax = firstAvailable(merged, ["parallax", "PARALLAX"]);
  const pmra = firstAvailable(merged, ["pmra", "PMRA"]);
  const pmdec = firstAvailable(merged, ["pmdec", "PMDEC"]);
  const rv = firstAvailable(merged, ["radial_velocity", "RADIAL_VELOCITY", "rv"]);

  const distancePc =
    firstAvailable(merged, ["distance_pc", "distancePc", "distance_estimate"]) ??
    computeDistancePc(parallax);

  const pmTotal =
    firstAvailable(merged, ["proper_motion_total", "properMotionTotal"]) ??
    computeProperMotionTotal(pmra, pmdec);

  const tangentialVelocity =
    firstAvailable(merged, ["tangential_velocity", "tangentialVelocity"]) ??
    computeTangentialVelocity(pmTotal, parallax);

  const approximateSpaceVelocity =
    firstAvailable(merged, ["approximate_space_velocity", "approximateSpaceVelocity"]) ??
    computeSpaceVelocity(tangentialVelocity, rv);

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
    firstAvailable(merged, ["hidden_companion_index", "hiddenCompanionIndex"]),
    0,
  );

  const dynamicsIndex =
    firstAvailable(merged, ["dynamics_index", "dynamicsIndex"]) ??
    Math.min(
      1,
      0.34 * safeScore01(anomalyScore) +
        0.26 * safeScore01(structuralImportance) +
        0.25 * safeScore01(hiddenCompanionIndex) +
        0.15 * safeScore01(approximateSpaceVelocity),
    );

  return {
    ...merged,
    distance_pc: distancePc,
    proper_motion_total: pmTotal,
    tangential_velocity: tangentialVelocity,
    approximate_space_velocity: approximateSpaceVelocity,
    anomaly_score: anomalyScore,
    structural_importance_score: structuralImportance,
    hidden_companion_index: hiddenCompanionIndex,
    dynamics_index: dynamicsIndex,
  };
}

function normalizePair(pair, recordMap) {
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
    record_a: pair?.record_a ?? recordMap.get(sourceA) ?? null,
    record_b: pair?.record_b ?? recordMap.get(sourceB) ?? null,
    binary_pair_score: normalizeNumber(
      pair?.binary_pair_score ?? pair?.pair_score ?? pair?.score,
      0,
    ),
    pair_classification:
      pair?.pair_classification ??
      pair?.classification ??
      "Possible pair candidate, not confirmed",
  };
}

function buildLightweightPairCandidates(records, maxPairs = 80) {
  if (!Array.isArray(records) || records.length < 2) return [];

  const pool = records
    .filter((r) => getSourceId(r))
    .slice()
    .sort(
      (a, b) =>
        normalizeNumber(b.dynamics_index, 0) +
        normalizeNumber(b.hidden_companion_index, 0) -
        (normalizeNumber(a.dynamics_index, 0) +
          normalizeNumber(a.hidden_companion_index, 0)),
    )
    .slice(0, Math.min(records.length, 70));

  const pairs = [];

  for (let i = 0; i < pool.length; i++) {
    const a = pool[i];

    for (let j = i + 1; j < pool.length; j++) {
      const b = pool[j];

      const parallaxDelta = Math.abs(
        normalizeNumber(a.parallax, 0) - normalizeNumber(b.parallax, 0),
      );
      const pmDelta = Math.abs(
        normalizeNumber(a.proper_motion_total, 0) -
          normalizeNumber(b.proper_motion_total, 0),
      );

      const score = Math.max(
        0,
        1 -
          Math.min(1, parallaxDelta / 2) * 0.45 -
          Math.min(1, pmDelta / 20) * 0.35,
      );

      if (score < 0.62) continue;

      pairs.push({
        pair_id: `${getSourceId(a)}__${getSourceId(b)}`,
        source_a: getSourceId(a),
        source_b: getSourceId(b),
        record_a: a,
        record_b: b,
        binary_pair_score: score,
        pair_classification: "Possible comoving-pair candidate, not confirmed",
      });

      if (pairs.length >= maxPairs) return pairs;
    }
  }

  return pairs;
}

function findCrossmatch(record, crossmatchResults = []) {
  const sourceId = getSourceId(record);
  if (!sourceId || !Array.isArray(crossmatchResults)) return null;

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

function computeInvestigationScore(record, pairCount, crossmatch) {
  const dynamics = safeScore01(record?.dynamics_index);
  const companion = safeScore01(record?.hidden_companion_index);
  const anomaly = safeScore01(record?.anomaly_score);
  const structural = safeScore01(record?.structural_importance_score);
  const pairPressure = Math.min(1, pairCount / 4);
  const crossmatchPenalty = crossmatch ? 0.04 : 0;

  const score = Math.max(
    0,
    Math.min(
      1,
      0.31 * dynamics +
        0.26 * companion +
        0.2 * anomaly +
        0.15 * structural +
        0.08 * pairPressure -
        crossmatchPenalty,
    ),
  );

  let tier = "Low-priority candidate";
  if (score >= 0.72) tier = "High-priority candidate";
  else if (score >= 0.48) tier = "Moderate-priority candidate";

  return {
    investigationScore: score,
    tier,
    components: [
      { label: "Dynamics proxy", value: dynamics, note: "Kinematic prioritization only." },
      { label: "Hidden-companion proxy", value: companion, note: "Heuristic flag, not confirmation." },
      { label: "Anomaly proxy", value: anomaly, note: "Dashboard anomaly score." },
      { label: "Structural proxy", value: structural, note: "Graph/structural importance." },
      { label: "Pair pressure", value: pairPressure, note: "Possible pair involvement only." },
    ],
  };
}

function buildMissionBriefing(record, activePairs, risk, crossmatch) {
  const sourceId = getSourceId(record);
  const lines = [
    `Candidate Investigation Briefing`,
    ``,
    `SOURCE_ID: ${sourceId || "N/A"}`,
    `Investigation tier: ${risk.tier}`,
    `Investigation score: ${formatNumber(risk.investigationScore, 4)}`,
    ``,
    `Scientific status: candidate only. Not confirmed.`,
    `This cockpit uses Gaia-derived proxies and local dashboard scores to prioritize follow-up.`,
    ``,
    `Available proxy indicators:`,
    `- Dynamics index: ${formatNumber(record.dynamics_index, 6)}`,
    `- Hidden companion index: ${formatNumber(record.hidden_companion_index, 6)}`,
    `- Anomaly score: ${formatNumber(record.anomaly_score, 6)}`,
    `- Structural importance: ${formatNumber(record.structural_importance_score, 6)}`,
    `- Possible pair involvement: ${activePairs.length}`,
    ``,
    `External validation:`,
    `- Crossmatch record: ${crossmatch ? "available" : "N/A"}`,
    `- Gaia Archive: required`,
    `- SIMBAD/VizieR: required`,
    `- Gaia NSS: required when available`,
    ``,
    `Interpretation boundary:`,
    `No planet, binary system, hidden companion, exotic object or new physical mechanism is confirmed by this interface.`,
  ];

  return lines.join("\n");
}

function buildGaiaAdql(record) {
  const sourceId = getSourceId(record);
  return `SELECT *
FROM gaiadr3.gaia_source
WHERE source_id = ${sourceId || "0"};`;
}

function buildNssAdql(record) {
  const sourceId = getSourceId(record);
  return `SELECT *
FROM gaiadr3.nss_two_body_orbit
WHERE source_id = ${sourceId || "0"};`;
}

function buildNeighbourAdql(record) {
  const ra = normalizeNumber(firstAvailable(record, ["ra", "RA"]), null);
  const dec = normalizeNumber(firstAvailable(record, ["dec", "DEC"]), null);

  if (ra === null || dec === null) {
    return "-- RA/DEC not available for this source.";
  }

  return `SELECT TOP 100
  source_id, ra, dec, parallax, pmra, pmdec, radial_velocity, phot_g_mean_mag, bp_rp
FROM gaiadr3.gaia_source
WHERE 1 = CONTAINS(
  POINT('ICRS', ra, dec),
  CIRCLE('ICRS', ${ra}, ${dec}, 0.05)
);`;
}

function externalLinks(record) {
  const sourceId = getSourceId(record);
  const ra = normalizeNumber(firstAvailable(record, ["ra", "RA"]), null);
  const dec = normalizeNumber(firstAvailable(record, ["dec", "DEC"]), null);

  return {
    gaia: GAIA_ARCHIVE_BASE,
    simbad:
      ra !== null && dec !== null
        ? `${SIMBAD_BASE}sim-coo?Coord=${encodeURIComponent(`${ra} ${dec}`)}&Radius=5&Radius.unit=arcsec`
        : SIMBAD_BASE,
    vizier:
      ra !== null && dec !== null
        ? `${VIZIER_BASE}?-c=${encodeURIComponent(`${ra} ${dec}`)}&-c.rs=5`
        : VIZIER_BASE,
    esasky:
      ra !== null && dec !== null
        ? `https://sky.esa.int/esasky/?target=${ra}%20${dec}&hips=DSS2%20color`
        : "https://sky.esa.int/esasky/",
    sourceId,
  };
}

export default function CandidateInvestigationCockpit({
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
    if (!Array.isArray(allSources)) return [];
    return allSources.map((source) => enrichSource(source, maps));
  }, [allSources, maps]);

  const recordMap = useMemo(() => buildMapBySourceId(records), [records]);

  const pairCandidates = useMemo(() => {
    const normalizedInput = Array.isArray(possibleBinaryPairs)
      ? possibleBinaryPairs
          .map((pair) => normalizePair(pair, recordMap))
          .filter((pair) => pair.source_a && pair.source_b)
      : [];

    if (normalizedInput.length) return normalizedInput.slice(0, 140);
    return buildLightweightPairCandidates(records, 80);
  }, [possibleBinaryPairs, recordMap, records]);

  const pairCountMap = useMemo(() => {
    const map = new Map();

    for (const pair of pairCandidates) {
      if (pair.source_a) map.set(pair.source_a, (map.get(pair.source_a) ?? 0) + 1);
      if (pair.source_b) map.set(pair.source_b, (map.get(pair.source_b) ?? 0) + 1);
    }

    return map;
  }, [pairCandidates]);

  const selectedSourceId = selectedSource ? getSourceId(selectedSource) : "";

  const activeRecord = useMemo(() => {
    if (selectedSourceId && recordMap.has(selectedSourceId)) {
      return recordMap.get(selectedSourceId);
    }

    if (selectedSourceId && selectedSource) {
      return enrichSource(selectedSource, maps);
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
  }, [selectedSourceId, selectedSource, recordMap, records, maps]);

  const activeSourceId = getSourceId(activeRecord);

  const activePairs = useMemo(() => {
    if (!activeSourceId) return [];

    return pairCandidates
      .filter((pair) => pair.source_a === activeSourceId || pair.source_b === activeSourceId)
      .slice(0, 12);
  }, [pairCandidates, activeSourceId]);

  const crossmatch = useMemo(
    () => findCrossmatch(activeRecord, candidateCrossmatchResults),
    [activeRecord, candidateCrossmatchResults],
  );

  const riskVector = useMemo(
    () => computeInvestigationScore(activeRecord, activePairs.length, crossmatch),
    [activeRecord, activePairs.length, crossmatch],
  );

  const missionBriefing = useMemo(
    () => buildMissionBriefing(activeRecord, activePairs, riskVector, crossmatch),
    [activeRecord, activePairs, riskVector, crossmatch],
  );

  const topTargets = useMemo(() => {
    return records
      .slice()
      .sort((a, b) => {
        const scoreA = computeInvestigationScore(a, pairCountMap.get(getSourceId(a)) ?? 0, null)
          .investigationScore;
        const scoreB = computeInvestigationScore(b, pairCountMap.get(getSourceId(b)) ?? 0, null)
          .investigationScore;

        return scoreB - scoreA;
      })
      .slice(0, 12)
      .map((record) => ({
        record,
        pairCount: pairCountMap.get(getSourceId(record)) ?? 0,
        risk: computeInvestigationScore(record, pairCountMap.get(getSourceId(record)) ?? 0, null),
      }));
  }, [records, pairCountMap]);

  const sourceAdql = useMemo(() => buildGaiaAdql(activeRecord), [activeRecord]);
  const nssAdql = useMemo(() => buildNssAdql(activeRecord), [activeRecord]);
  const neighbourAdql = useMemo(() => buildNeighbourAdql(activeRecord), [activeRecord]);
  const links = useMemo(() => externalLinks(activeRecord), [activeRecord]);

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
    onSourceSelect?.(record);
  }

  if (!activeRecord) {
    return (
      <section className="advanced-page-shell investigation-cockpit-shell">
        <div className="panel advanced-hero-panel cockpit-hero-panel">
          <div className="eyebrow">Fourth Analysis Interface</div>
          <h2>Candidate Investigation Cockpit</h2>
          <p>No Gaia source is currently available. Load the dashboard dataset before opening the investigation cockpit.</p>

          <div className="advanced-actions">
            <button type="button" className="dashboard-nav-button" onClick={() => setCurrentPage?.("dynamics")}>
              Back to Astrometric Dynamics Lab
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="advanced-page-shell investigation-cockpit-shell">
      <div className="panel advanced-hero-panel cockpit-hero-panel">
        <div className="eyebrow">Fourth Analysis Interface</div>
        <h2>Candidate Investigation Cockpit</h2>
        <p>
          A stable follow-up cockpit for candidate-level Gaia investigation. All
          statements remain provisional and require external validation.
        </p>

        <div className="advanced-actions">
          <button type="button" className="dashboard-nav-button dashboard-nav-button-accent" onClick={() => setCurrentPage?.("dynamics")}>
            Back to Astrometric Dynamics Lab
          </button>

          <button type="button" className="dashboard-nav-button" onClick={() => setCurrentPage?.("advanced")}>
            Advanced Analysis Layer
          </button>

          <button type="button" className="dashboard-nav-button" onClick={() => setCurrentPage?.("dashboard")}>
            Operational Dashboard
          </button>
        </div>
      </div>

      <section className="cockpit-command-grid">
        <div className="panel cockpit-target-panel">
          <div className="cockpit-target-header">
            <div>
              <span className="candidate-id">Active Target</span>
              <h2>{activeSourceId || "N/A"}</h2>
              <p>{riskVector.tier}</p>
            </div>

            <div className="cockpit-score-core">
              <div>
                <span>Investigation Score</span>
                <strong>{formatNumber(riskVector.investigationScore, 3)}</strong>
              </div>
            </div>
          </div>

          <div className="cockpit-metric-grid">
            <div className="cockpit-metric">
              <span>Dynamics Index</span>
              <strong>{formatNumber(activeRecord.dynamics_index, 6)}</strong>
              <small>Proxy only, not confirmation.</small>
            </div>

            <div className="cockpit-metric">
              <span>Hidden Companion</span>
              <strong>{formatNumber(activeRecord.hidden_companion_index, 6)}</strong>
              <small>Heuristic suspicion index.</small>
            </div>

            <div className="cockpit-metric">
              <span>Pair Involvement</span>
              <strong>{activePairs.length}</strong>
              <small>Possible pairs, not confirmed binaries.</small>
            </div>

            <div className="cockpit-metric">
              <span>Distance</span>
              <strong>{formatCompact(activeRecord.distance_pc, 3)} pc</strong>
              <small>Derived from Gaia parallax when available.</small>
            </div>

            <div className="cockpit-metric">
              <span>Tangential Velocity</span>
              <strong>{formatCompact(activeRecord.tangential_velocity, 3)}</strong>
              <small>Kinematic proxy.</small>
            </div>

            <div className="cockpit-metric">
              <span>Crossmatch</span>
              <strong>{crossmatch ? "Available" : "N/A"}</strong>
              <small>Requires catalogue-level validation.</small>
            </div>
          </div>

          <div className="cockpit-mode-switch">
            <button type="button" className={focusMode === "mission" ? "active" : ""} onClick={() => setFocusMode("mission")}>
              Mission
            </button>
            <button type="button" className={focusMode === "evidence" ? "active" : ""} onClick={() => setFocusMode("evidence")}>
              Evidence
            </button>
            <button type="button" className={focusMode === "queries" ? "active" : ""} onClick={() => setFocusMode("queries")}>
              Queries
            </button>
          </div>
        </div>

        <div className="panel cockpit-constellation-panel">
          <div className="panel-header">
            <h2>Candidate Relation Field</h2>
            <span>bounded and stable</span>
          </div>

          <div className="candidate-constellation">
            <div className="constellation-radar-ring ring-one" />
            <div className="constellation-radar-ring ring-two" />
            <div className="constellation-radar-ring ring-three" />

            <button type="button" className="constellation-core" onClick={() => handleSelect(activeRecord)}>
              <div>
                <span>Selected Source</span>
                <strong>{activeSourceId}</strong>
              </div>
            </button>

            {activePairs.length > 0 ? (
              activePairs.slice(0, 8).map((pair, index) => {
                const otherId = pair.source_a === activeSourceId ? pair.source_b : pair.source_a;
                const otherRecord = recordMap.get(otherId);
                const angle = (2 * Math.PI * index) / Math.max(activePairs.slice(0, 8).length, 1);
                const radius = 38;
                const left = 50 + Math.cos(angle) * radius;
                const top = 50 + Math.sin(angle) * 32;

                return (
                  <button
                    key={pair.pair_id ?? `${pair.source_a}_${pair.source_b}_${index}`}
                    type="button"
                    className="constellation-satellite"
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      "--satellite-score": Math.max(0, Math.min(1, pair.binary_pair_score ?? 0)),
                    }}
                    onClick={() => otherRecord && handleSelect(otherRecord)}
                  >
                    <span>Possible Pair Candidate</span>
                    <strong>{otherId || "N/A"}</strong>
                    <small>{formatNumber(pair.binary_pair_score, 3)} · not confirmed</small>
                  </button>
                );
              })
            ) : (
              <div className="constellation-empty">
                <strong>No local pair involvement</strong>
                <span>No confirmed pair relation is inferred. This only means no local candidate survived the current bounded criteria.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="cockpit-two-column">
        <div className="panel cockpit-evidence-panel">
          <div className="panel-header">
            <h2>Evidence Pressure</h2>
            <span>proxy components</span>
          </div>

          <div className="evidence-gauge-grid">
            {riskVector.components.map((component) => (
              <div key={component.label} className="evidence-gauge">
                <div className="evidence-gauge-header">
                  <span>{component.label}</span>
                  <strong>{formatNumber(component.value, 3)}</strong>
                </div>
                <div className="evidence-gauge-track">
                  <div
                    className="evidence-gauge-fill"
                    style={{
                      width: `${Math.max(2, Math.min(100, component.value * 100))}%`,
                    }}
                  />
                </div>
                <small>{component.note}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="panel cockpit-briefing-panel">
          <div className="panel-header">
            <h2>Mission Briefing</h2>
            <span>copy-ready</span>
          </div>

          <pre className="cockpit-briefing-text">{missionBriefing}</pre>

          <div className="candidate-action-row">
            <button type="button" className="dashboard-nav-button" onClick={() => copyText("briefing", missionBriefing)}>
              Copy briefing
            </button>

            <a className="dashboard-nav-button" href={links.gaia} target="_blank" rel="noreferrer">
              Gaia Archive
            </a>

            <a className="dashboard-nav-button" href={links.simbad} target="_blank" rel="noreferrer">
              SIMBAD
            </a>

            <a className="dashboard-nav-button" href={links.vizier} target="_blank" rel="noreferrer">
              VizieR
            </a>

            {copied && <span className="copy-status">{copied}</span>}
          </div>
        </div>
      </section>

      <section className="panel cockpit-pair-panel">
        <div className="panel-header">
          <h2>Possible Pair / Comoving Context</h2>
          <span>candidate only</span>
        </div>

        <div className="coherence-warning">
          <strong>Scientific caution:</strong> these are possible local pair
          candidates only. No binary or gravitationally bound system is confirmed.
        </div>

        <div className="cockpit-pair-list">
          {activePairs.length ? (
            activePairs.map((pair, index) => {
              const otherId = pair.source_a === activeSourceId ? pair.source_b : pair.source_a;
              const otherRecord = recordMap.get(otherId);

              return (
                <button
                  key={pair.pair_id ?? `${pair.source_a}_${pair.source_b}_${index}`}
                  type="button"
                  className="cockpit-pair-card"
                  onClick={() => otherRecord && handleSelect(otherRecord)}
                >
                  <span>{pair.pair_classification}</span>
                  <strong>{pair.source_a} ↔ {pair.source_b}</strong>
                  <small>Score {formatNumber(pair.binary_pair_score, 4)} · requires external validation.</small>
                </button>
              );
            })
          ) : (
            <div className="empty-selection">
              No possible pair candidate is associated with the active source in the current bounded cockpit pass.
            </div>
          )}
        </div>
      </section>

      <section className="panel cockpit-query-panel">
        <div className="panel-header">
          <h2>Validation Query Console</h2>
          <span>ADQL templates</span>
        </div>

        <div className="cockpit-query-grid">
          <div className="cockpit-query-card">
            <div className="cockpit-query-header">
              <span>Gaia Source</span>
              <button type="button" onClick={() => copyText("Gaia ADQL", sourceAdql)}>Copy</button>
            </div>
            <pre><code>{sourceAdql}</code></pre>
          </div>

          <div className="cockpit-query-card">
            <div className="cockpit-query-header">
              <span>Gaia NSS</span>
              <button type="button" onClick={() => copyText("NSS ADQL", nssAdql)}>Copy</button>
            </div>
            <pre><code>{nssAdql}</code></pre>
          </div>

          <div className="cockpit-query-card">
            <div className="cockpit-query-header">
              <span>Neighbourhood</span>
              <button type="button" onClick={() => copyText("neighbour ADQL", neighbourAdql)}>Copy</button>
            </div>
            <pre><code>{neighbourAdql}</code></pre>
          </div>
        </div>
      </section>

      <section className="panel cockpit-target-list-panel">
        <div className="panel-header">
          <h2>Investigation Priority Queue</h2>
          <span>{topTargets.length} targets</span>
        </div>

        <div className="cockpit-target-queue">
          {topTargets.map((target, index) => {
            const id = getSourceId(target.record);
            const selected = id === activeSourceId;

            return (
              <button
                key={id || index}
                type="button"
                className={`cockpit-target-row ${selected ? "cockpit-target-row-selected" : ""}`}
                onClick={() => handleSelect(target.record)}
              >
                <span>{index + 1}</span>
                <div>
                  <strong>{id || "N/A"}</strong>
                  <small>{target.risk.tier}</small>
                </div>
                <div>
                  <strong>{formatNumber(target.risk.investigationScore, 3)}</strong>
                  <small>score</small>
                </div>
                <div>
                  <strong>{target.pairCount}</strong>
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
