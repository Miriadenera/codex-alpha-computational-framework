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

function normalizeArrayValue(value, min, max) {
  const number = normalizeNumber(value);

  if (max === min) {
    return 0.5;
  }

  return (number - min) / (max - min);
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
    This formula must remain identical to CoherenceGradientModule.jsx.
    It is an exploratory proxy, not a direct physical measurement of ∇𝒦.
  */
  const numerator =
    0.34 * anomaly +
    0.26 * structural +
    0.2 * density +
    0.2 * featureDeviation;

  const penalty = 1 + 0.55 * neighborDistance;

  return numerator / penalty;
}

function getCandidateStatus(rank, source) {
  if (rank === 1) {
    return "Primary Codex Alpha computational candidate";
  }

  if (rank <= 5) {
    return "High-priority computational candidate";
  }

  if (rank <= 15) {
    return "Moderate-priority computational candidate";
  }

  if (Number(source.anomaly_label) === -1) {
    return "Detected anomaly candidate";
  }

  return "Exploratory source";
}

function getCandidateId(index) {
  return "CAC-" + String(index + 1).padStart(3, "0");
}

function buildGaiaArchiveUrl(source) {
  const sourceId = getSourceId(source);

  return (
    "https://gea.esac.esa.int/archive/?target=" +
    encodeURIComponent("Gaia DR3 " + sourceId)
  );
}

function buildEsaSkyUrl(source) {
  const ra = normalizeNumber(source.ra, null);
  const dec = normalizeNumber(source.dec, null);

  if (ra === null || dec === null) {
    return "https://sky.esa.int/esasky/";
  }

  return (
    "https://sky.esa.int/esasky/?target=" +
    encodeURIComponent(`${ra} ${dec}`) +
    "&hips=Digitized%20Sky%20Survey%202%20color"
  );
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

function buildCandidateSummary(candidate) {
  if (!candidate) {
    return "";
  }

  return `Codex Alpha Candidate Summary

Candidate ID: ${candidate.candidate_id}
SOURCE_ID: ${getSourceId(candidate)}
Status: ${candidate.candidate_status}

Astrometric parameters:
RA: ${formatNumber(candidate.ra, 6)}
DEC: ${formatNumber(candidate.dec, 6)}
Parallax: ${formatNumber(candidate.parallax, 6)}
Radial velocity: ${formatNumber(candidate.radial_velocity, 6)}

Computational indicators:
Anomaly score: ${formatNumber(candidate.anomaly_score, 6)}
Anomaly rank: ${candidate.anomaly_rank ?? "N/A"}
Structural rank: ${candidate.structural_rank ?? "N/A"}
Structural importance: ${formatNumber(candidate.structural_importance_score, 6)}
Local density score: ${formatNumber(candidate.local_density_score, 6)}
Mean neighbor distance: ${formatNumber(candidate.mean_neighbor_distance, 6)}
Dominant anomaly feature: ${candidate.dominant_anomaly_feature ?? "N/A"}
Dominant feature z-score: ${formatNumber(candidate.dominant_feature_zscore, 6)}
Coherence-proxy index: ${formatNumber(candidate.coherence_proxy, 6)}

Interpretation:
This source is an internal computational candidate of the Codex Alpha Computational Framework. The candidate status is based on the convergence of anomaly score, graph centrality, local density, feature deviation and coherence-proxy ranking. This designation does not represent an official astronomical classification and requires independent astrophysical validation.`;
}

function CandidateRegistry({
  sources = [],
  emergentStructures = [],
  graphCentrality = [],
  featureContributions = [],
  selectedSource,
  onSourceSelect,
}) {
  const [sortMode, setSortMode] = useState("candidate_rank");
  const [searchTerm, setSearchTerm] = useState("");

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

  const candidates = useMemo(() => {
    /*
      Critical point:
      We first merge ALL sources and compute the normalization ranges on the
      complete dataset, exactly like CoherenceGradientModule.jsx.
      Only after computing the same coherence_proxy do we filter the anomalous
      candidates for the registry.
    */
    const mergedAllSources = sources.map((source) => {
      const sourceId = getSourceId(source);

      return mergeSourceContext({
        source,
        emergentStructure: emergentMap.get(sourceId) ?? {},
        centrality: centralityMap.get(sourceId) ?? {},
        featureContribution: featureMap.get(sourceId) ?? {},
      });
    });

    const ranges = {
      anomaly_score: getMinMax(
        mergedAllSources.map((source) => source.anomaly_score),
      ),
      structural_importance_score: getMinMax(
        mergedAllSources.map((source) => source.structural_importance_score),
      ),
      local_density_score: getMinMax(
        mergedAllSources.map((source) => source.local_density_score),
      ),
      dominant_feature_zscore: getMinMax(
        mergedAllSources.map((source) =>
          Math.abs(normalizeNumber(source.dominant_feature_zscore)),
        ),
      ),
      mean_neighbor_distance: getMinMax(
        mergedAllSources.map((source) => source.mean_neighbor_distance),
      ),
    };

    const enrichedAllSources = mergedAllSources.map((source) => ({
      ...source,
      coherence_proxy: computeCoherenceProxy(source, ranges),
    }));

    const ranked = enrichedAllSources
      .filter((source) => Number(source.anomaly_label) === -1)
      .sort((a, b) => b.coherence_proxy - a.coherence_proxy)
      .map((source, index) => ({
        ...source,
        candidate_id: getCandidateId(index),
        candidate_rank: index + 1,
        candidate_status: getCandidateStatus(index + 1, source),
      }));

    return ranked;
  }, [sources, emergentMap, centralityMap, featureMap]);

  const selectedSourceId = selectedSource ? getSourceId(selectedSource) : null;

  const activeCandidate = useMemo(() => {
    if (selectedSourceId) {
      const match = candidates.find(
        (candidate) => getSourceId(candidate) === selectedSourceId,
      );

      if (match) {
        return match;
      }
    }

    return candidates[0] ?? null;
  }, [candidates, selectedSourceId]);

  const visibleCandidates = useMemo(() => {
    let filtered = candidates.slice();

    if (searchTerm.trim()) {
      const query = searchTerm.trim().toLowerCase();

      filtered = filtered.filter((candidate) => {
        return (
          getSourceId(candidate).toLowerCase().includes(query) ||
          String(candidate.candidate_id).toLowerCase().includes(query) ||
          String(candidate.dominant_anomaly_feature ?? "")
            .toLowerCase()
            .includes(query)
        );
      });
    }

    filtered.sort((a, b) => {
      if (sortMode === "candidate_rank") {
        return a.candidate_rank - b.candidate_rank;
      }

      if (sortMode === "coherence_proxy") {
        return b.coherence_proxy - a.coherence_proxy;
      }

      if (sortMode === "anomaly_score") {
        return (
          normalizeNumber(b.anomaly_score) -
          normalizeNumber(a.anomaly_score)
        );
      }

      if (sortMode === "structural_rank") {
        return (
          normalizeNumber(a.structural_rank, 9999) -
          normalizeNumber(b.structural_rank, 9999)
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

      if (sortMode === "radial_velocity") {
        return (
          normalizeNumber(b.radial_velocity) -
          normalizeNumber(a.radial_velocity)
        );
      }

      return String(getSourceId(a)).localeCompare(String(getSourceId(b)));
    });

    return filtered;
  }, [candidates, sortMode, searchTerm]);

  function handleCandidateSelect(candidate) {
    if (onSourceSelect) {
      onSourceSelect(candidate);
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  function copySourceId(candidate) {
    copyText(getSourceId(candidate));
  }

  function copyCandidateSummary(candidate) {
    copyText(buildCandidateSummary(candidate));
  }

  return (
    <section className="panel candidate-registry-panel">
      <div className="panel-header">
        <div>
          <h2>Codex Alpha Candidate Registry</h2>
          <span>Internal computational candidate ranking</span>
        </div>
      </div>

      <div className="candidate-registry-warning">
        <strong>Scientific note:</strong> CAC identifiers are internal labels of
        the Codex Alpha Computational Framework. They do not represent official
        astronomical classifications. External ESA links are provided for
        independent inspection.
      </div>

      {activeCandidate && (
        <div className="candidate-primary-card">
          <div className="candidate-primary-header">
            <div>
              <span className="candidate-id">
                {activeCandidate.candidate_id}
              </span>

              <h3>{activeCandidate.candidate_status}</h3>

              <p>
                SOURCE_ID <strong>{getSourceId(activeCandidate)}</strong>
              </p>
            </div>

            <div className="candidate-score-orb">
              <span>K proxy</span>
              <strong>{formatNumber(activeCandidate.coherence_proxy, 4)}</strong>
            </div>
          </div>

          <div className="candidate-action-row">
            <a
              className="dashboard-nav-button dashboard-nav-button-accent"
              href={buildGaiaArchiveUrl(activeCandidate)}
              target="_blank"
              rel="noreferrer"
            >
              Open in Gaia Archive
            </a>

            <a
              className="dashboard-nav-button"
              href={buildEsaSkyUrl(activeCandidate)}
              target="_blank"
              rel="noreferrer"
            >
              Open in ESASky
            </a>

            <button
              type="button"
              className="dashboard-nav-button"
              onClick={() => copySourceId(activeCandidate)}
            >
              Copy SOURCE_ID
            </button>

            <button
              type="button"
              className="dashboard-nav-button"
              onClick={() => copyCandidateSummary(activeCandidate)}
            >
              Copy candidate summary
            </button>
          </div>

          <div className="candidate-explanation-grid">
            <div className="candidate-explanation-card">
              <span>Anomaly evidence</span>
              <strong>{formatNumber(activeCandidate.anomaly_score, 6)}</strong>
              <p>
                The source is statistically unusual inside the current
                multidimensional Gaia feature space. Its anomaly score places it
                among the detected anomalous sources of the pipeline.
              </p>
            </div>

            <div className="candidate-explanation-card">
              <span>Graph relevance</span>
              <strong>
                rank {activeCandidate.structural_rank ?? "N/A"}
              </strong>
              <p>
                The source has high relational importance inside the graph of
                multidimensional similarities. A low structural rank indicates
                that it occupies a central position within the anomaly network.
              </p>
            </div>

            <div className="candidate-explanation-card">
              <span>Local structure</span>
              <strong>
                {formatNumber(activeCandidate.local_density_score, 6)}
              </strong>
              <p>
                Local density estimates whether the source belongs to a compact
                neighborhood of similar anomalous sources instead of appearing
                as an isolated statistical outlier.
              </p>
            </div>

            <div className="candidate-explanation-card">
              <span>Dominant feature</span>
              <strong>
                {activeCandidate.dominant_anomaly_feature ?? "N/A"}
              </strong>
              <p>
                The dominant feature identifies the strongest contributor to the
                anomaly profile. Its z-score is{" "}
                {formatNumber(activeCandidate.dominant_feature_zscore, 6)}.
              </p>
            </div>
          </div>

          <div className="candidate-detailed-note">
            <h3>Candidate interpretation</h3>

            <p>
              {activeCandidate.candidate_id} is a computational candidate because
              multiple independent indicators converge on the same Gaia source:
              anomaly strength, structural graph importance, local density,
              dominant feature deviation and coherence-proxy ranking.
            </p>

            <p>
              The strongest point is not a single isolated value, but the
              simultaneous overlap of different computational layers. In the
              Codex Alpha workflow this makes the source suitable for deeper
              inspection, comparison against ESA archive data and future
              astrophysical validation.
            </p>

            <p>
              This does not mean that the source is physically exotic, nor that
              it represents a confirmed Codex Alpha object. At the current stage
              it should be treated as a high-priority internal candidate for
              exploratory triage only.
            </p>
          </div>
        </div>
      )}

      <div className="candidate-table-toolbar">
        <input
          type="search"
          placeholder="Search candidate ID, SOURCE_ID or dominant feature..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <label>
          Sort by
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
          >
            <option value="candidate_rank">Candidate rank</option>
            <option value="coherence_proxy">K proxy</option>
            <option value="anomaly_score">Anomaly score</option>
            <option value="structural_rank">Structural rank</option>
            <option value="structural_importance_score">
              Structural importance
            </option>
            <option value="local_density_score">Local density</option>
            <option value="radial_velocity">Radial velocity</option>
            <option value="SOURCE_ID">SOURCE_ID</option>
          </select>
        </label>

        <span>{visibleCandidates.length} candidates</span>
      </div>

      <div className="candidate-table-wrapper">
        <table className="candidate-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>SOURCE_ID</th>
              <th>Status</th>
              <th>K proxy</th>
              <th>Anomaly</th>
              <th>Structural rank</th>
              <th>Structural importance</th>
              <th>Local density</th>
              <th>Dominant feature</th>
              <th>Feature z</th>
              <th>RA</th>
              <th>DEC</th>
              <th>Parallax</th>
              <th>Radial velocity</th>
              <th>External</th>
            </tr>
          </thead>

          <tbody>
            {visibleCandidates.map((candidate) => {
              const sourceId = getSourceId(candidate);
              const selected =
                activeCandidate && getSourceId(activeCandidate) === sourceId;

              return (
                <tr
                  key={sourceId}
                  className={selected ? "candidate-row-selected" : ""}
                  onClick={() => handleCandidateSelect(candidate)}
                >
                  <td>{candidate.candidate_id}</td>
                  <td>{sourceId}</td>
                  <td>{candidate.candidate_status}</td>
                  <td>{formatNumber(candidate.coherence_proxy, 6)}</td>
                  <td>{formatNumber(candidate.anomaly_score, 6)}</td>
                  <td>{candidate.structural_rank ?? "N/A"}</td>
                  <td>
                    {formatNumber(candidate.structural_importance_score, 6)}
                  </td>
                  <td>{formatNumber(candidate.local_density_score, 6)}</td>
                  <td>{candidate.dominant_anomaly_feature ?? "N/A"}</td>
                  <td>{formatNumber(candidate.dominant_feature_zscore, 6)}</td>
                  <td>{formatNumber(candidate.ra, 6)}</td>
                  <td>{formatNumber(candidate.dec, 6)}</td>
                  <td>{formatNumber(candidate.parallax, 6)}</td>
                  <td>{formatNumber(candidate.radial_velocity, 6)}</td>
                  <td>
                    <div className="candidate-external-links">
                      <a
                        href={buildGaiaArchiveUrl(candidate)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Gaia
                      </a>

                      <a
                        href={buildEsaSkyUrl(candidate)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Sky
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="candidate-registry-note">
        Gaia Archive may require manual confirmation because of ESA interface
        popups. ESASky links are generated from RA/DEC coordinates and are
        intended for visual inspection.
      </p>
    </section>
  );
}

export default CandidateRegistry;