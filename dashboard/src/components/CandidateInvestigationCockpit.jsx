import React, { useMemo, useState } from "react";

const GAIA_ARCHIVE_BASE = "https://gea.esac.esa.int/archive/";
const SIMBAD_BASE = "https://simbad.cds.unistra.fr/simbad/";
const VIZIER_BASE = "https://vizier.cds.unistra.fr/viz-bin/VizieR";

function n(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fmt(value, digits = 4) {
  const number = n(value, null);
  if (number === null) return "N/A";
  if (Math.abs(number) >= 10000) return number.toExponential(3);
  return number.toFixed(digits);
}

function text(value) {
  if (value === null || value === undefined || value === "") return "N/A";
  return String(value);
}

function getSourceId(source) {
  return String(source?.SOURCE_ID ?? source?.source_id ?? source?.sourceId ?? source?.id ?? "");
}

function first(source, keys, fallback = null) {
  if (!source) return fallback;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function mapBySourceId(items) {
  const out = new Map();
  if (!Array.isArray(items)) return out;
  for (const item of items) {
    const id = getSourceId(item);
    if (id) out.set(id, item);
  }
  return out;
}

function computeDistancePc(parallaxMas) {
  const p = n(parallaxMas, null);
  if (p === null || p <= 0) return null;
  return 1000 / p;
}

function computeProperMotionTotal(pmra, pmdec) {
  const a = n(pmra, null);
  const d = n(pmdec, null);
  if (a === null || d === null) return null;
  return Math.sqrt(a * a + d * d);
}

function computeTangentialVelocity(pmTotal, parallaxMas) {
  const mu = n(pmTotal, null);
  const p = n(parallaxMas, null);
  if (mu === null || p === null || p <= 0) return null;
  return 4.74047 * mu / p;
}

function score01(value) {
  const valueNumber = n(value, 0);
  if (valueNumber >= 0 && valueNumber <= 1) return valueNumber;
  return Math.max(0, Math.min(1, valueNumber / 100));
}

function enrichSource(source, maps) {
  const sourceId = getSourceId(source);
  const merged = {
    ...source,
    ...(maps.emergent.get(sourceId) ?? {}),
    ...(maps.centrality.get(sourceId) ?? {}),
    ...(maps.features.get(sourceId) ?? {}),
    SOURCE_ID: sourceId,
    source_id: sourceId,
  };

  const parallax = first(merged, ["parallax", "PARALLAX"]);
  const pmra = first(merged, ["pmra", "PMRA"]);
  const pmdec = first(merged, ["pmdec", "PMDEC"]);
  const rv = first(merged, ["radial_velocity", "RADIAL_VELOCITY", "rv"]);

  const distancePc = first(merged, ["distance_pc", "distancePc", "distance_estimate"]) ?? computeDistancePc(parallax);
  const pmTotal = first(merged, ["proper_motion_total", "properMotionTotal"]) ?? computeProperMotionTotal(pmra, pmdec);
  const tangentialVelocity = first(merged, ["tangential_velocity", "tangentialVelocity"]) ?? computeTangentialVelocity(pmTotal, parallax);
  const approximateSpaceVelocity = first(merged, ["approximate_space_velocity", "approximateSpaceVelocity"]) ??
    (n(tangentialVelocity, null) !== null && n(rv, null) !== null
      ? Math.sqrt(n(tangentialVelocity, 0) ** 2 + n(rv, 0) ** 2)
      : n(tangentialVelocity, null) ?? n(rv, null));

  const anomalyScore = n(first(merged, ["anomaly_score", "anomalyScore"]), 0);
  const structuralImportance = n(first(merged, ["structural_importance_score", "structural_importance", "structuralImportance", "pagerank", "degree"]), 0);
  const hiddenCompanionIndex = n(first(merged, ["hidden_companion_index", "hiddenCompanionIndex", "hidden_companion_suspicion_index"]), 0);

  const dynamicsIndex = first(merged, ["dynamics_index", "dynamicsIndex"]) ?? Math.min(
    1,
    0.36 * score01(anomalyScore) +
      0.28 * score01(structuralImportance) +
      0.24 * score01(hiddenCompanionIndex) +
      0.12 * score01(approximateSpaceVelocity),
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
    hidden_companion_classification: first(merged, ["hidden_companion_classification"], "Candidate-level proxy only"),
  };
}

function normalizePair(pair) {
  const sourceA = String(pair?.source_a ?? pair?.source_id_a ?? pair?.SOURCE_ID_A ?? pair?.primary_source_id ?? pair?.sourceA ?? pair?.a ?? "");
  const sourceB = String(pair?.source_b ?? pair?.source_id_b ?? pair?.SOURCE_ID_B ?? pair?.secondary_source_id ?? pair?.sourceB ?? pair?.b ?? "");
  return {
    ...pair,
    source_a: sourceA,
    source_b: sourceB,
    binary_pair_score: n(pair?.binary_pair_score ?? pair?.pair_score ?? pair?.score, 0),
    pair_classification: pair?.pair_classification ?? pair?.classification ?? "Possible pair candidate, not confirmed",
  };
}

function buildLightPairs(records) {
  if (!Array.isArray(records) || records.length < 2) return [];
  const pool = records
    .slice()
    .sort((a, b) => n(b.dynamics_index, 0) + n(b.hidden_companion_index, 0) - (n(a.dynamics_index, 0) + n(a.hidden_companion_index, 0)))
    .slice(0, 36);
  const pairs = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      const pmDelta = Math.abs(n(a.proper_motion_total, 0) - n(b.proper_motion_total, 0));
      const pxDelta = Math.abs(n(a.parallax, 0) - n(b.parallax, 0));
      const score = Math.max(0, 1 - Math.min(1, pmDelta / 25) * 0.5 - Math.min(1, pxDelta / 2) * 0.5);
      if (score >= 0.68) {
        pairs.push({
          source_a: getSourceId(a),
          source_b: getSourceId(b),
          binary_pair_score: score,
          pair_classification: "Possible comoving-pair candidate, not confirmed",
        });
      }
      if (pairs.length >= 40) return pairs;
    }
  }
  return pairs;
}

function sourceLinks(record) {
  const ra = first(record, ["ra", "RA"]);
  const dec = first(record, ["dec", "DEC"]);
  const id = getSourceId(record);
  const simbadQuery = ra !== null && dec !== null ? `${SIMBAD_BASE}sim-coo?Coord=${encodeURIComponent(`${ra} ${dec}`)}&Radius=5&Radius.unit=arcsec` : SIMBAD_BASE;
  const vizierQuery = ra !== null && dec !== null ? `${VIZIER_BASE}?-c=${encodeURIComponent(`${ra} ${dec}`)}&-c.rs=5` : VIZIER_BASE;
  return {
    gaia: `${GAIA_ARCHIVE_BASE}`,
    simbad: simbadQuery,
    vizier: vizierQuery,
    label: id || "N/A",
  };
}

function buildBriefing(record, pairCount) {
  if (!record) return "No active source selected.";
  return `CODEX ALPHA CANDIDATE INVESTIGATION COCKPIT\n\nSOURCE_ID: ${getSourceId(record) || "N/A"}\n\nCandidate-level interpretation:\nThis source is flagged only through dashboard-level Gaia DR3 proxies. The metrics below may identify sources deserving follow-up inspection, but they do not confirm planets, binarity, hidden companions, or exotic physics.\n\nDynamics index: ${fmt(record.dynamics_index, 5)}\nHidden companion index: ${fmt(record.hidden_companion_index, 5)}\nHidden companion classification: ${text(record.hidden_companion_classification)}\nPossible pair involvement: ${pairCount > 0 ? `${pairCount} possible pair candidate(s), not confirmed` : "N/A"}\n\nNext validation steps:\n1. Verify the source in Gaia Archive.\n2. Check SIMBAD and VizieR.\n3. Check Gaia NSS, RUWE, astrometric excess noise, radial velocity and variability.\n4. Compare parallax and proper motion with nearby sources before claiming a comoving or binary interpretation.\n5. Treat any ∇𝒦-inspired coherence language as internal framework context only, not as direct physical measurement.`;
}

function Metric({ label, value, note }) {
  return (
    <div className="cockpit-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

export default function CandidateInvestigationCockpit({
  allSources = [],
  graphCentrality = [],
  featureContributions = [],
  emergentStructures = [],
  possibleBinaryPairs = [],
  selectedSource = null,
  onSourceSelect = () => {},
}) {
  const [mode, setMode] = useState("briefing");

  const maps = useMemo(() => ({
    centrality: mapBySourceId(graphCentrality),
    features: mapBySourceId(featureContributions),
    emergent: mapBySourceId(emergentStructures),
  }), [graphCentrality, featureContributions, emergentStructures]);

  const records = useMemo(() => {
    const sourceArray = Array.isArray(allSources) ? allSources : [];
    return sourceArray.map((source) => enrichSource(source, maps));
  }, [allSources, maps]);

  const recordMap = useMemo(() => mapBySourceId(records), [records]);

  const activeRecord = useMemo(() => {
    const selectedId = getSourceId(selectedSource);
    if (selectedId && recordMap.has(selectedId)) return recordMap.get(selectedId);
    return records[0] ?? null;
  }, [selectedSource, recordMap, records]);

  const targetQueue = useMemo(() => records
    .slice()
    .sort((a, b) => n(b.dynamics_index, 0) - n(a.dynamics_index, 0))
    .slice(0, 24), [records]);

  const pairs = useMemo(() => {
    if (Array.isArray(possibleBinaryPairs) && possibleBinaryPairs.length > 0) {
      return possibleBinaryPairs.slice(0, 80).map(normalizePair);
    }
    return buildLightPairs(records);
  }, [possibleBinaryPairs, records]);

  const activeId = getSourceId(activeRecord);
  const activePairs = useMemo(() => pairs.filter((pair) => pair.source_a === activeId || pair.source_b === activeId).slice(0, 12), [pairs, activeId]);
  const links = sourceLinks(activeRecord);
  const briefing = buildBriefing(activeRecord, activePairs.length);

  async function copyBriefing() {
    try { await navigator.clipboard.writeText(briefing); } catch { /* ignore */ }
  }


  const cssSafeAnimationStyle = `
    .candidate-constellation::before {
      content: "";
      position: absolute;
      inset: 10%;
      border-radius: 999px;
      border: 1px solid rgba(57, 255, 20, 0.14);
      box-shadow: 0 0 34px rgba(57, 255, 20, 0.12);
      animation: cockpitPulse 4.8s ease-in-out infinite;
      pointer-events: none;
    }

    .candidate-constellation::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 56%;
      height: 56%;
      transform: translate(-50%, -50%);
      border-radius: 999px;
      border: 1px dashed rgba(0, 245, 255, 0.18);
      animation: cockpitSlowSpin 28s linear infinite;
      pointer-events: none;
    }

    .constellation-core {
      animation: cockpitCoreGlow 3.6s ease-in-out infinite;
    }

    .constellation-satellite {
      animation: cockpitSatelliteFloat 4.2s ease-in-out infinite;
      animation-delay: var(--satellite-delay, 0s);
    }

    .cockpit-score-core {
      animation: cockpitCoreGlow 3.9s ease-in-out infinite;
    }

    .evidence-gauge-fill {
      animation: cockpitGaugeGlow 2.8s ease-in-out infinite;
    }

    @keyframes cockpitPulse {
      0%, 100% { opacity: 0.45; transform: scale(0.97); }
      50% { opacity: 0.95; transform: scale(1.03); }
    }

    @keyframes cockpitSlowSpin {
      from { transform: translate(-50%, -50%) rotate(0deg); }
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }

    @keyframes cockpitCoreGlow {
      0%, 100% { filter: brightness(1); }
      50% { filter: brightness(1.18); }
    }

    @keyframes cockpitSatelliteFloat {
      0%, 100% { margin-top: 0; }
      50% { margin-top: -8px; }
    }

    @keyframes cockpitGaugeGlow {
      0%, 100% { filter: brightness(1); }
      50% { filter: brightness(1.25); }
    }
  `;

  if (!records.length) {
    return (
      <section className="investigation-cockpit-shell">
        <div className="panel cockpit-hero-panel">
          <div className="eyebrow">Fourth Analysis Interface</div>
          <h2>Candidate Investigation Cockpit</h2>
          <div className="coherence-warning">No Gaia source records are available yet.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="investigation-cockpit-shell">
      <style>{cssSafeAnimationStyle}</style>
      <div className="panel cockpit-hero-panel">
        <div className="eyebrow">Fourth Analysis Interface</div>
        <h2>Candidate Investigation Cockpit</h2>
        <p>
          Stable candidate-level inspection console with CSS-only motion. This page uses Gaia DR3 proxies only and avoids any confirmed claim without external validation.
        </p>
      </div>

      <section className="cockpit-command-grid">
        <div className="panel cockpit-target-panel">
          <div className="cockpit-target-header">
            <div>
              <div className="candidate-id">Active Candidate</div>
              <h2>{activeId || "N/A"}</h2>
              <p>{text(activeRecord?.hidden_companion_classification)}</p>
            </div>
            <div className="cockpit-score-core">
              <div>
                <span>Dynamics index</span>
                <strong>{fmt(activeRecord?.dynamics_index, 4)}</strong>
              </div>
            </div>
          </div>

          <div className="cockpit-metric-grid">
            <Metric label="Anomaly score" value={fmt(activeRecord?.anomaly_score, 4)} note="Proxy, not confirmed" />
            <Metric label="Structural importance" value={fmt(activeRecord?.structural_importance_score, 4)} note="Graph-derived ranking" />
            <Metric label="Hidden companion index" value={fmt(activeRecord?.hidden_companion_index, 4)} note="Heuristic flag" />
            <Metric label="Distance pc" value={fmt(activeRecord?.distance_pc, 3)} note="Gaia parallax estimate if available" />
            <Metric label="Proper motion total" value={fmt(activeRecord?.proper_motion_total, 4)} note="mas/yr proxy" />
            <Metric label="Tangential velocity" value={fmt(activeRecord?.tangential_velocity, 3)} note="km/s estimate" />
            <Metric label="Approx. space velocity" value={fmt(activeRecord?.approximate_space_velocity, 3)} note="Requires RV for completeness" />
            <Metric label="BP-RP" value={fmt(first(activeRecord, ["bp_rp", "BP_RP", "gaia_color_index"]), 4)} note="Gaia color proxy" />
            <Metric label="Pair involvement" value={activePairs.length ? `${activePairs.length} candidate(s)` : "N/A"} note="Not confirmed" />
          </div>

          <div className="cockpit-mode-switch">
            <button type="button" className={mode === "briefing" ? "active" : ""} onClick={() => setMode("briefing")}>Briefing</button>
            <button type="button" className={mode === "pairs" ? "active" : ""} onClick={() => setMode("pairs")}>Possible pairs</button>
            <button type="button" className={mode === "validation" ? "active" : ""} onClick={() => setMode("validation")}>Validation</button>
          </div>
        </div>

        <div className="panel cockpit-constellation-panel">
          <div className="panel-header">
            <h2>Candidate Relation Field</h2>
            <span>CSS-safe animation mode</span>
          </div>

          <div className="candidate-constellation">
            <button type="button" className="constellation-core" onClick={() => onSourceSelect(activeRecord)}>
              <div>
                <span>Active source</span>
                <strong>{activeId || "N/A"}</strong>
              </div>
            </button>

            {targetQueue.slice(0, 8).map((record, index) => {
              const angle = (Math.PI * 2 * index) / Math.max(1, Math.min(8, targetQueue.length));
              const radius = 34;
              const left = 50 + Math.cos(angle) * radius;
              const top = 50 + Math.sin(angle) * radius;
              const id = getSourceId(record);
              return (
                <button
                  type="button"
                  key={id || index}
                  className="constellation-satellite"
                  style={{ left: `${left}%`, top: `${top}%`, "--satellite-score": score01(record.dynamics_index), "--satellite-delay": `${index * 0.18}s` }}
                  onClick={() => onSourceSelect(record)}
                >
                  <span>Priority target</span>
                  <strong>{id || "N/A"}</strong>
                  <small>D={fmt(record.dynamics_index, 3)} | H={fmt(record.hidden_companion_index, 3)}</small>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="cockpit-two-column">
        <div className="panel cockpit-briefing-panel">
          <div className="panel-header">
            <h2>{mode === "briefing" ? "Scientific Briefing" : mode === "pairs" ? "Possible Pair Candidates" : "Validation Console"}</h2>
            <span>Candidate-level only</span>
          </div>

          {mode === "briefing" && (
            <>
              <pre className="cockpit-briefing-text">{briefing}</pre>
              <div className="candidate-action-row">
                <button type="button" className="dashboard-nav-button" onClick={copyBriefing}>Copy briefing</button>
                <a className="dashboard-nav-button" href={links.gaia} target="_blank" rel="noreferrer">Gaia Archive</a>
                <a className="dashboard-nav-button" href={links.simbad} target="_blank" rel="noreferrer">SIMBAD</a>
                <a className="dashboard-nav-button" href={links.vizier} target="_blank" rel="noreferrer">VizieR</a>
              </div>
            </>
          )}

          {mode === "pairs" && (
            <div className="cockpit-pair-list">
              {activePairs.length ? activePairs.map((pair, index) => (
                <button type="button" className="cockpit-pair-card" key={`${pair.source_a}-${pair.source_b}-${index}`}>
                  <span>Possible pair candidate</span>
                  <strong>{pair.source_a} ↔ {pair.source_b}</strong>
                  <small>Score: {fmt(pair.binary_pair_score, 4)} — {pair.pair_classification}</small>
                </button>
              )) : <div className="coherence-warning">No possible pair involvement available for this source.</div>}
            </div>
          )}

          {mode === "validation" && (
            <div className="investigation-timeline">
              <div className="timeline-step timeline-step-ready"><div className="timeline-marker">1</div><div><strong>Gaia Archive</strong><p>Verify astrometry, photometry, quality flags and source metadata.</p></div></div>
              <div className="timeline-step timeline-step-ready"><div className="timeline-marker">2</div><div><strong>SIMBAD / VizieR</strong><p>Check object type, aliases, literature and catalog context.</p></div></div>
              <div className="timeline-step timeline-step-limited"><div className="timeline-marker">3</div><div><strong>Gaia NSS / RV</strong><p>Inspect non-single-star solutions and radial velocity only when available.</p></div></div>
              <div className="timeline-step timeline-step-priority"><div className="timeline-marker">4</div><div><strong>Scientific caution</strong><p>Do not claim planet, binary, exotic object, or new physical mechanism without external confirmation.</p></div></div>
            </div>
          )}
        </div>

        <div className="panel cockpit-target-list-panel">
          <div className="panel-header">
            <h2>Priority Queue</h2>
            <span>{targetQueue.length} targets</span>
          </div>
          <div className="cockpit-target-queue">
            {targetQueue.map((record, index) => {
              const id = getSourceId(record);
              return (
                <button
                  type="button"
                  key={id || index}
                  className={`cockpit-target-row ${id === activeId ? "cockpit-target-row-selected" : ""}`}
                  onClick={() => onSourceSelect(record)}
                >
                  <span>{index + 1}</span>
                  <div><strong>{id || "N/A"}</strong><small>{text(record.hidden_companion_classification)}</small></div>
                  <div><strong>{fmt(record.dynamics_index, 4)}</strong><small>Dynamics</small></div>
                  <div><strong>{fmt(record.hidden_companion_index, 4)}</strong><small>Hidden</small></div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </section>
  );
}
