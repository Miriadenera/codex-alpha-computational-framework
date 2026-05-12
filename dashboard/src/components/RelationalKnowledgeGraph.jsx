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

function getSourceStatus(source) {
  const anomalyScore = normalizeNumber(source.anomaly_score);
  const structuralScore = normalizeNumber(source.structural_importance_score);
  const localDensity = normalizeNumber(source.local_density_score);

  if (anomalyScore >= 0.64 || structuralScore >= 0.5) {
    return "High-interest source";
  }

  if (localDensity >= 0.55 || anomalyScore >= 0.58) {
    return "Emergent candidate";
  }

  if (Number(source.anomaly_label) === -1) {
    return "Detected anomaly";
  }

  return "Background Gaia source";
}

function getStatusClass(status) {
  if (status === "High-interest source") {
    return "knowledge-status-high";
  }

  if (status === "Emergent candidate") {
    return "knowledge-status-emergent";
  }

  if (status === "Detected anomaly") {
    return "knowledge-status-anomaly";
  }

  return "knowledge-status-background";
}

function mergeSourceContext({
  source,
  featureContribution,
  emergentStructure,
  centrality,
}) {
  return {
    ...source,
    ...featureContribution,
    ...emergentStructure,
    ...centrality,
    SOURCE_ID: getSourceId(source),
    source_id: getSourceId(source),
  };
}

function RelationalKnowledgeGraph({
  sources = [],
  featureContributions = [],
  emergentStructures = [],
  graphCentrality = [],
  selectedSource,
  onSourceSelect,
}) {
  const [search, setSearch] = useState("");
  const [focusMode, setFocusMode] = useState("ranked");
  const [sortMode, setSortMode] = useState("anomaly_score");

  const featureMap = useMemo(
    () => buildMapBySourceId(featureContributions),
    [featureContributions],
  );

  const emergentMap = useMemo(
    () => buildMapBySourceId(emergentStructures),
    [emergentStructures],
  );

  const centralityMap = useMemo(
    () => buildMapBySourceId(graphCentrality),
    [graphCentrality],
  );

  const enrichedSources = useMemo(() => {
    return sources.map((source) => {
      const sourceId = getSourceId(source);

      return mergeSourceContext({
        source,
        featureContribution: featureMap.get(sourceId) ?? {},
        emergentStructure: emergentMap.get(sourceId) ?? {},
        centrality: centralityMap.get(sourceId) ?? {},
      });
    });
  }, [sources, featureMap, emergentMap, centralityMap]);

  const selectedSourceId = selectedSource ? getSourceId(selectedSource) : null;

  const visibleSources = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    let filtered = enrichedSources.filter((source) => {
      const sourceId = getSourceId(source);

      if (normalizedSearch && !sourceId.toLowerCase().includes(normalizedSearch)) {
        return false;
      }

      if (focusMode === "anomalies") {
        return Number(source.anomaly_label) === -1;
      }

      if (focusMode === "structural") {
        return normalizeNumber(source.structural_importance_score) > 0;
      }

      if (focusMode === "emergent") {
        return normalizeNumber(source.local_density_score) > 0;
      }

      return true;
    });

    filtered = filtered.sort((a, b) => {
      if (sortMode === "anomaly_score") {
        return normalizeNumber(b.anomaly_score) - normalizeNumber(a.anomaly_score);
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

      if (sortMode === "dominant_feature_zscore") {
        return (
          normalizeNumber(b.dominant_feature_zscore) -
          normalizeNumber(a.dominant_feature_zscore)
        );
      }

      return String(getSourceId(a)).localeCompare(String(getSourceId(b)));
    });

    return filtered.slice(0, 30);
  }, [enrichedSources, search, focusMode, sortMode]);

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

  function handleSourceClick(source) {
    if (onSourceSelect) {
      onSourceSelect(source);
    }
  }

  return (
    <section className="panel relational-knowledge-panel">
      <div className="panel-header">
        <div>
          <h2>Relational Knowledge Graph</h2>
          <span>Analytical source context map</span>
        </div>
      </div>

      <div className="knowledge-toolbar">
        <input
          type="search"
          value={search}
          placeholder="Search SOURCE_ID..."
          onChange={(event) => setSearch(event.target.value)}
        />

        <label>
          Focus
          <select
            value={focusMode}
            onChange={(event) => setFocusMode(event.target.value)}
          >
            <option value="ranked">Ranked context</option>
            <option value="anomalies">Anomalies only</option>
            <option value="structural">Structural sources</option>
            <option value="emergent">Emergent candidates</option>
          </select>
        </label>

        <label>
          Sort by
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
          >
            <option value="anomaly_score">Anomaly score</option>
            <option value="structural_importance_score">
              Structural importance
            </option>
            <option value="local_density_score">Local density</option>
            <option value="dominant_feature_zscore">Feature z-score</option>
            <option value="SOURCE_ID">SOURCE_ID</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            setSearch("");
            setFocusMode("ranked");
            setSortMode("anomaly_score");
          }}
        >
          Reset graph context
        </button>
      </div>

      <div className="knowledge-layout">
        <div className="knowledge-source-list">
          {visibleSources.map((source) => {
            const sourceId = getSourceId(source);
            const selected = selectedSourceId === sourceId;
            const status = getSourceStatus(source);

            return (
              <button
                type="button"
                key={sourceId}
                className={
                  selected
                    ? "knowledge-source-card knowledge-source-card-selected"
                    : "knowledge-source-card"
                }
                onClick={() => handleSourceClick(source)}
              >
                <div>
                  <strong>{sourceId}</strong>
                  <small>{status}</small>
                </div>

                <span className={getStatusClass(status)}>
                  {formatNumber(source.anomaly_score, 4)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="knowledge-graph-canvas">
          {!activeSource && (
            <div className="empty-selection">
              No source context available for the current filters.
            </div>
          )}

          {activeSource && (
            <>
              <div className="knowledge-center-node">
                <span>Selected Source</span>
                <strong>{getSourceId(activeSource)}</strong>
              </div>

              <div className="knowledge-orbit knowledge-orbit-a" />
              <div className="knowledge-orbit knowledge-orbit-b" />

              <button
                type="button"
                className="knowledge-node knowledge-node-anomaly"
                onClick={() => handleSourceClick(activeSource)}
              >
                <span>Anomaly</span>
                <strong>{formatNumber(activeSource.anomaly_score, 6)}</strong>
              </button>

              <button
                type="button"
                className="knowledge-node knowledge-node-feature"
                onClick={() => handleSourceClick(activeSource)}
              >
                <span>Dominant feature</span>
                <strong>
                  {activeSource.dominant_anomaly_feature ?? "N/A"}
                </strong>
                <small>
                  z = {formatNumber(activeSource.dominant_feature_zscore, 4)}
                </small>
              </button>

              <button
                type="button"
                className="knowledge-node knowledge-node-cluster"
                onClick={() => handleSourceClick(activeSource)}
              >
                <span>Cluster</span>
                <strong>{activeSource.anomaly_cluster ?? "N/A"}</strong>
              </button>

              <button
                type="button"
                className="knowledge-node knowledge-node-emergent"
                onClick={() => handleSourceClick(activeSource)}
              >
                <span>Local density</span>
                <strong>
                  {formatNumber(activeSource.local_density_score, 6)}
                </strong>
                <small>
                  rank {activeSource.emergent_structure_rank ?? "N/A"}
                </small>
              </button>

              <button
                type="button"
                className="knowledge-node knowledge-node-structural"
                onClick={() => handleSourceClick(activeSource)}
              >
                <span>Structural</span>
                <strong>
                  {formatNumber(
                    activeSource.structural_importance_score,
                    6,
                  )}
                </strong>
                <small>rank {activeSource.structural_rank ?? "N/A"}</small>
              </button>

              <button
                type="button"
                className="knowledge-node knowledge-node-physical"
                onClick={() => handleSourceClick(activeSource)}
              >
                <span>Physical coordinates</span>
                <strong>RA / DEC / π</strong>
                <small>
                  {formatNumber(activeSource.ra, 3)} /{" "}
                  {formatNumber(activeSource.dec, 3)} /{" "}
                  {formatNumber(activeSource.parallax, 3)}
                </small>
              </button>
            </>
          )}
        </div>

        <aside className="knowledge-inspector">
          <h3>Source Context</h3>

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
                <span>Status</span>
                <strong>{getSourceStatus(activeSource)}</strong>
              </p>

              <p>
                <span>Anomaly score</span>
                <strong>{formatNumber(activeSource.anomaly_score, 6)}</strong>
              </p>

              <p>
                <span>Dominant feature</span>
                <strong>
                  {activeSource.dominant_anomaly_feature ?? "N/A"}
                </strong>
              </p>

              <p>
                <span>Feature z-score</span>
                <strong>
                  {formatNumber(activeSource.dominant_feature_zscore, 6)}
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
                <span>Structural importance</span>
                <strong>
                  {formatNumber(
                    activeSource.structural_importance_score,
                    6,
                  )}
                </strong>
              </p>

              <p>
                <span>Radial velocity</span>
                <strong>
                  {formatNumber(activeSource.radial_velocity, 6)}
                </strong>
              </p>
            </div>
          )}
        </aside>
      </div>

      <p className="knowledge-note">
        This module is an analytical context graph. It does not infer physical
        causality; it organizes existing pipeline outputs around each Gaia
        source to support exploratory investigation.
      </p>
    </section>
  );
}

export default RelationalKnowledgeGraph;