import React, { useMemo, useState } from "react";

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isNaN(number) ? fallback : number;
}

function getSourceId(source) {
  return String(source?.SOURCE_ID ?? source?.source_id ?? source?.id ?? "");
}

function formatNumber(value, digits = 6) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return "N/A";
  }

  return number.toFixed(digits);
}

function formatGaiaValue(value, digits = 10) {
  const number = Number(value);

  if (Number.isNaN(number)) {
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

function normalizeArrayValue(value, min, max) {
  const number = normalizeNumber(value);

  if (max === min) {
    return 0.5;
  }

  return (number - min) / (max - min);
}

function getMinMax(values) {
  const validValues = values
    .map((value) => normalizeNumber(value, null))
    .filter((value) => value !== null);

  if (!validValues.length) {
    return {
      min: 0,
      max: 1,
    };
  }

  return {
    min: Math.min(...validValues),
    max: Math.max(...validValues),
  };
}

function computeCoherenceProxy(source, ranges) {
  const anomaly = normalizeArrayValue(
    source.anomaly_score,
    ranges.anomaly_score.min,
    ranges.anomaly_score.max,
  );

  const structural = normalizeArrayValue(
    source.structural_importance_score,
    ranges.structural_importance_score.min,
    ranges.structural_importance_score.max,
  );

  const density = normalizeArrayValue(
    source.local_density_score,
    ranges.local_density_score.min,
    ranges.local_density_score.max,
  );

  const featureDeviation = normalizeArrayValue(
    Math.abs(normalizeNumber(source.dominant_feature_zscore)),
    ranges.dominant_feature_zscore.min,
    ranges.dominant_feature_zscore.max,
  );

  const neighborDistance = normalizeArrayValue(
    source.mean_neighbor_distance,
    ranges.mean_neighbor_distance.min,
    ranges.mean_neighbor_distance.max,
  );

  /*
    IMPORTANT:
    This formula must remain identical to CandidateRegistry.jsx.

    This is NOT a physical measurement of ∇𝒦.
    It is a computational exploratory indicator inspired by the Codex Alpha
    idea that high anomaly, high structural relevance, local density and
    feature deviation may identify sources worthy of deeper analysis.

    The denominator penalizes isolated candidates with large neighbor distance.
  */
  const numerator =
    0.34 * anomaly +
    0.26 * structural +
    0.2 * density +
    0.2 * featureDeviation;

  const penalty = 1 + 0.55 * neighborDistance;

  return numerator / penalty;
}

function getProxyClass(value) {
  if (value >= 0.62) {
    return "coherence-rank-high";
  }

  if (value >= 0.46) {
    return "coherence-rank-medium";
  }

  if (value >= 0.3) {
    return "coherence-rank-low";
  }

  return "coherence-rank-background";
}

function getInterpretation(value) {
  if (value >= 0.62) {
    return "High-priority coherence-proxy candidate";
  }

  if (value >= 0.46) {
    return "Moderate coherence-proxy candidate";
  }

  if (value >= 0.3) {
    return "Weak but non-trivial coherence-proxy signal";
  }

  return "Low coherence-proxy relevance";
}

function mergeSourceContext({
  source,
  emergentStructure,
  centrality,
  featureContribution,
}) {
  return {
    ...source,
    ...emergentStructure,
    ...centrality,
    ...featureContribution,
    SOURCE_ID: getSourceId(source),
    source_id: getSourceId(source),
  };
}

function CoherenceGradientModule({
  sources = [],
  emergentStructures = [],
  graphCentrality = [],
  featureContributions = [],
  selectedSource,
  onSourceSelect,
}) {
  const [sortMode, setSortMode] = useState("coherence_proxy");
  const [focusMode, setFocusMode] = useState("top");
  const [showFormula, setShowFormula] = useState(true);

  const emergentMap = useMemo(
    () => buildMapBySourceId(emergentStructures),
    [emergentStructures],
  );

  const centralityMap = useMemo(
    () => buildMapBySourceId(graphCentrality),
    [graphCentrality],
  );

  const featureMap = useMemo(
    () => buildMapBySourceId(featureContributions),
    [featureContributions],
  );

  const enrichedSources = useMemo(() => {
    const merged = sources.map((source) => {
      const sourceId = getSourceId(source);

      return mergeSourceContext({
        source,
        emergentStructure: emergentMap.get(sourceId) ?? {},
        centrality: centralityMap.get(sourceId) ?? {},
        featureContribution: featureMap.get(sourceId) ?? {},
      });
    });

    const ranges = {
      anomaly_score: getMinMax(merged.map((source) => source.anomaly_score)),
      structural_importance_score: getMinMax(
        merged.map((source) => source.structural_importance_score),
      ),
      local_density_score: getMinMax(
        merged.map((source) => source.local_density_score),
      ),
      dominant_feature_zscore: getMinMax(
        merged.map((source) =>
          Math.abs(normalizeNumber(source.dominant_feature_zscore)),
        ),
      ),
      mean_neighbor_distance: getMinMax(
        merged.map((source) => source.mean_neighbor_distance),
      ),
    };

    return merged.map((source) => {
      const coherenceProxy = computeCoherenceProxy(source, ranges);

      return {
        ...source,
        coherence_proxy: coherenceProxy,
        coherence_interpretation: getInterpretation(coherenceProxy),
      };
    });
  }, [sources, emergentMap, centralityMap, featureMap]);

  const selectedSourceId = selectedSource ? getSourceId(selectedSource) : null;

  const visibleSources = useMemo(() => {
    let filtered = enrichedSources.slice();

    if (focusMode === "top") {
      filtered = filtered.filter((source) => source.coherence_proxy >= 0.3);
    }

    if (focusMode === "high") {
      filtered = filtered.filter((source) => source.coherence_proxy >= 0.46);
    }

    if (focusMode === "anomalies") {
      filtered = filtered.filter((source) => Number(source.anomaly_label) === -1);
    }

    filtered.sort((a, b) => {
      if (sortMode === "coherence_proxy") {
        return b.coherence_proxy - a.coherence_proxy;
      }

      if (sortMode === "anomaly_score") {
        return (
          normalizeNumber(b.anomaly_score) -
          normalizeNumber(a.anomaly_score)
        );
      }

      if (sortMode === "structural_importance_score") {
        return (
          normalizeNumber(b.structural_importance_score) -
          normalizeNumber(a.structural_importance_score)
        );
      }

      if (sortMode === "local_density_score") {
        return (
          normalizeNumber(b.local_density_score) -
          normalizeNumber(a.local_density_score)
        );
      }

      return String(getSourceId(a)).localeCompare(String(getSourceId(b)));
    });

    return filtered.slice(0, 20);
  }, [enrichedSources, sortMode, focusMode]);

  const activeSource = useMemo(() => {
    if (!selectedSourceId) {
      return visibleSources[0] ?? null;
    }

    return (
      enrichedSources.find(
        (source) => String(getSourceId(source)) === String(selectedSourceId),
      ) ??
      visibleSources[0] ??
      null
    );
  }, [selectedSourceId, enrichedSources, visibleSources]);

  const summary = useMemo(() => {
    const high = enrichedSources.filter(
      (source) => source.coherence_proxy >= 0.62,
    ).length;

    const medium = enrichedSources.filter(
      (source) =>
        source.coherence_proxy >= 0.46 && source.coherence_proxy < 0.62,
    ).length;

    const low = enrichedSources.filter(
      (source) =>
        source.coherence_proxy >= 0.3 && source.coherence_proxy < 0.46,
    ).length;

    return {
      high,
      medium,
      low,
      total: enrichedSources.length,
    };
  }, [enrichedSources]);

  function handleSourceSelect(source) {
    if (onSourceSelect) {
      onSourceSelect(source);
    }
  }

  return (
    <section className="panel coherence-module-panel">
      <div className="panel-header">
        <div>
          <h2>Coherence Gradient Module</h2>
          <span>Exploratory ∇𝒦-inspired proxy analysis</span>
        </div>
      </div>

      <div className="coherence-warning">
        <strong>Scientific note:</strong> this module does not measure the
        physical coherence gradient ∇𝒦. It computes an exploratory
        coherence-proxy index from existing pipeline outputs to prioritize
        candidates for further analysis.
      </div>

      <div className="coherence-summary-grid">
        <div className="coherence-summary-card">
          <span>High proxy</span>
          <strong>{summary.high}</strong>
        </div>

        <div className="coherence-summary-card">
          <span>Medium proxy</span>
          <strong>{summary.medium}</strong>
        </div>

        <div className="coherence-summary-card">
          <span>Low proxy</span>
          <strong>{summary.low}</strong>
        </div>

        <div className="coherence-summary-card">
          <span>Total sources</span>
          <strong>{summary.total}</strong>
        </div>
      </div>

      <div className="knowledge-toolbar">
        <label>
          Focus
          <select
            value={focusMode}
            onChange={(event) => setFocusMode(event.target.value)}
          >
            <option value="top">Proxy candidates</option>
            <option value="high">High / medium only</option>
            <option value="anomalies">Anomalies only</option>
            <option value="all">All sources</option>
          </select>
        </label>

        <label>
          Sort by
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
          >
            <option value="coherence_proxy">Coherence proxy</option>
            <option value="anomaly_score">Anomaly score</option>
            <option value="structural_importance_score">
              Structural importance
            </option>
            <option value="local_density_score">Local density</option>
            <option value="SOURCE_ID">SOURCE_ID</option>
          </select>
        </label>

        <button
          type="button"
          className={showFormula ? "btn-active" : ""}
          onClick={() => setShowFormula((current) => !current)}
        >
          {showFormula ? "Hide formula" : "Show formula"}
        </button>
      </div>

      {showFormula && (
        <div className="coherence-formula-box">
          <div className="coherence-formula-title">
            Coherence Proxy Index
          </div>

          <code>
            K_proxy = (0.34A + 0.26S + 0.20D + 0.20F) / (1 + 0.55N)
          </code>

          <p>
            A = normalized anomaly score, S = normalized structural importance,
            D = normalized local density, F = normalized dominant feature
            deviation, N = normalized mean neighbor distance.
          </p>
        </div>
      )}

      <div className="coherence-layout">
        <div className="coherence-ranking-list">
          {visibleSources.map((source, index) => {
            const sourceId = getSourceId(source);
            const selected = selectedSourceId === sourceId;

            return (
              <button
                type="button"
                key={sourceId}
                className={
                  selected
                    ? "coherence-row coherence-row-selected"
                    : "coherence-row"
                }
                onClick={() => handleSourceSelect(source)}
              >
                <span className="coherence-row-rank">
                  #{index + 1}
                </span>

                <div>
                  <strong>{sourceId}</strong>
                  <small>{source.coherence_interpretation}</small>
                </div>

                <span
                  className={
                    "coherence-score-pill " +
                    getProxyClass(source.coherence_proxy)
                  }
                >
                  {formatNumber(source.coherence_proxy, 4)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="coherence-radar-panel">
          {!activeSource && (
            <div className="empty-selection">
              No coherence-proxy candidate available for the current filters.
            </div>
          )}

          {activeSource && (
            <>
              <div className="coherence-radar-core">
                <span>∇𝒦 proxy</span>
                <strong>{formatNumber(activeSource.coherence_proxy, 4)}</strong>
              </div>

              <div className="coherence-radar-ring ring-a" />
              <div className="coherence-radar-ring ring-b" />
              <div className="coherence-radar-ring ring-c" />

              <div
                className="coherence-factor factor-anomaly"
                style={{
                  "--factor-size": `${Math.max(
                    18,
                    normalizeNumber(activeSource.anomaly_score) * 52,
                  )}px`,
                }}
              >
                <span>Anomaly score</span>
                <strong>{formatNumber(activeSource.anomaly_score, 4)}</strong>
              </div>

              <div
                className="coherence-factor factor-structural"
                style={{
                  "--factor-size": `${Math.max(
                    18,
                    normalizeNumber(activeSource.structural_importance_score) *
                      82,
                  )}px`,
                }}
              >
                <span>Structural importance</span>
                <strong>
                  {formatNumber(activeSource.structural_importance_score, 4)}
                </strong>
              </div>

              <div
                className="coherence-factor factor-density"
                style={{
                  "--factor-size": `${Math.max(
                    18,
                    normalizeNumber(activeSource.local_density_score) * 82,
                  )}px`,
                }}
              >
                <span>Local density</span>
                <strong>
                  {formatNumber(activeSource.local_density_score, 4)}
                </strong>
              </div>

              <div
                className="coherence-factor factor-feature"
                style={{
                  "--factor-size": `${Math.max(
                    18,
                    Math.min(
                      1,
                      Math.abs(
                        normalizeNumber(activeSource.dominant_feature_zscore),
                      ) / 8,
                    ) * 82,
                  )}px`,
                }}
              >
                <span>Feature z-score</span>
                <strong>
                  {formatNumber(activeSource.dominant_feature_zscore, 4)}
                </strong>
              </div>

              <div
                className="coherence-factor factor-neighbor"
                style={{
                  "--factor-size": `${Math.max(
                    18,
                    Math.min(
                      1,
                      normalizeNumber(activeSource.mean_neighbor_distance) / 4,
                    ) * 82,
                  )}px`,
                }}
              >
                <span>Mean neighbor distance</span>
                <strong>
                  {formatNumber(activeSource.mean_neighbor_distance, 4)}
                </strong>
              </div>
            </>
          )}
        </div>

        <aside className="coherence-inspector">
          <h3>Proxy Candidate</h3>

          {!activeSource && (
            <p className="empty-selection">Select a source to inspect it.</p>
          )}

          {activeSource && (
            <div className="details-list">
              <p>
                <span>SOURCE_ID</span>
                <strong>{getSourceId(activeSource)}</strong>
              </p>

              <p>
                <span>Interpretation</span>
                <strong>{activeSource.coherence_interpretation}</strong>
              </p>

              <p>
                <span>RA (deg)</span>
                <strong>{formatGaiaValue(activeSource.ra, 10)}</strong>
              </p>

              <p>
                <span>DEC (deg)</span>
                <strong>{formatGaiaValue(activeSource.dec, 10)}</strong>
              </p>

              <p>
                <span>Parallax (mas)</span>
                <strong>{formatGaiaValue(activeSource.parallax, 10)}</strong>
              </p>

              <p>
                <span>Radial velocity (km/s)</span>
                <strong>
                  {formatGaiaValue(activeSource.radial_velocity, 10)}
                </strong>
              </p>

              <p>
                <span>K proxy</span>
                <strong>{formatNumber(activeSource.coherence_proxy, 6)}</strong>
              </p>

              <p>
                <span>Anomaly score</span>
                <strong>{formatNumber(activeSource.anomaly_score, 6)}</strong>
              </p>

              <p>
                <span>Structural importance</span>
                <strong>
                  {formatNumber(
                    activeSource.structural_importance_score,
                    6,
                  )}
                </strong>
              </p>

              <p>
                <span>Local density</span>
                <strong>
                  {formatNumber(activeSource.local_density_score, 6)}
                </strong>
              </p>

              <p>
                <span>Mean neighbor distance</span>
                <strong>
                  {formatNumber(activeSource.mean_neighbor_distance, 6)}
                </strong>
              </p>

              <p>
                <span>Dominant feature</span>
                <strong>
                  {activeSource.dominant_anomaly_feature ?? "N/A"}
                </strong>
              </p>

              <p>
                <span>Dominant feature z-score</span>
                <strong>
                  {formatNumber(activeSource.dominant_feature_zscore, 6)}
                </strong>
              </p>
            </div>
          )}
        </aside>
      </div>

      <p className="coherence-note">
        The coherence-proxy ranking is designed for exploratory triage. It
        helps identify sources where anomaly strength, local density and graph
        structure overlap. Physical interpretation requires independent
        validation.
      </p>
    </section>
  );
}

export default CoherenceGradientModule;