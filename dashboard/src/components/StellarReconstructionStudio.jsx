import React, { useMemo, useState } from "react";
import StarTwinViewer3D from "./StarTwinViewer3D.jsx";
import StellarInferencePanel from "./StellarInferencePanel.jsx";
import FullStellarDossier from "./FullStellarDossier.jsx";
import {
  buildFullStellarRecord,
  buildStarModel,
  buildScientificInterpretation,
  buildValidationSteps,
  formatNumber,
  getSourceId,
} from "../utils/stellarInference.js";
import {
  buildLatexReport,
  buildMarkdownReport,
  buildPlainTextReport,
  downloadJsonReport,
  downloadLatexReport,
  downloadMarkdownReport,
  downloadPlainTextReport,
  stringifyJsonExport,
} from "../utils/stellarExport.js";

/*
  StellarReconstructionStudio

  Fifth analysis interface:
  - global selected Gaia source
  - full stellar dossier
  - physically-informed synthetic 3D stellar reconstruction
  - compact Top-50 anomaly selector
  - copy/download reports

  Scientific caution:
  This page does not display a direct observation of the selected star.
  It generates a proxy-based synthetic reconstruction from available Gaia
  observables and internal dashboard metrics.
*/

function safeText(value) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  return String(value);
}

function formatValue(value, digits = 4, unit = "") {
  const formatted = formatNumber(value, digits);

  if (formatted === "N/A") {
    return "N/A";
  }

  return unit ? `${formatted} ${unit}` : formatted;
}

function toFiniteNumber(value, fallback = null) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number;
}

function findBestFallbackSource(allSources = []) {
  const sourceArray = Array.isArray(allSources) ? allSources : [];

  if (!sourceArray.length) {
    return null;
  }

  return (
    sourceArray.find((source) => getSourceId(source)) ??
    sourceArray[0] ??
    null
  );
}

function getAnomalyScore(source) {
  return (
    toFiniteNumber(source?.anomaly_score, null) ??
    toFiniteNumber(source?.anomalyScore, null) ??
    toFiniteNumber(source?.score, null) ??
    0
  );
}

function SummaryMetric({ label, value, note }) {
  return (
    <div className="stellar-summary-metric">
      <span>{label}</span>
      <strong>{safeText(value)}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

function ExportButton({ children, onClick, accent = false }) {
  return (
    <button
      type="button"
      className={`stellar-export-button${accent ? " accent" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CopyStatus({ copied }) {
  if (!copied) {
    return null;
  }

  return <span className="stellar-copy-status">Copied: {copied}</span>;
}

function MiniStar({ starModel }) {
  const color = starModel?.colorHex ?? "#ffb347";
  const glow = starModel?.emissiveHex ?? color;

  return (
    <span
      className="stellar-mini-star"
      style={{
        width: "18px",
        height: "18px",
        minWidth: "18px",
        borderRadius: "999px",
        display: "inline-block",
        background: `radial-gradient(circle at 35% 28%, #ffffff 0 7%, ${color} 24%, ${glow} 68%, rgba(0,0,0,0.35) 100%)`,
        boxShadow: `0 0 10px ${glow}`,
        border: "1px solid rgba(255,255,255,0.28)",
      }}
      aria-hidden="true"
    />
  );
}

function TopAnomalyQueue({
  allSources = [],
  selectedSource = null,
  graphCentrality = [],
  featureContributions = [],
  emergentStructures = [],
  candidateCrossmatchResults = [],
  possibleBinaryPairs = [],
  onSourceSelect = () => {},
}) {
  const [expanded, setExpanded] = useState(false);
  const selectedId = getSourceId(selectedSource);

  const topAnomalies = useMemo(() => {
    const sourceArray = Array.isArray(allSources) ? allSources : [];

    return sourceArray
      .filter((source) => getSourceId(source))
      .map((source) => {
        const record = buildFullStellarRecord(source, {
          graphCentrality,
          featureContributions,
          emergentStructures,
          candidateCrossmatchResults,
          possibleBinaryPairs,
        });

        const model = buildStarModel(record);

        return {
          source,
          record,
          model,
          sourceId: getSourceId(record),
          anomalyScore: getAnomalyScore(record),
        };
      })
      .sort((a, b) => {
        const delta = b.anomalyScore - a.anomalyScore;

        if (delta !== 0) {
          return delta;
        }

        return String(a.sourceId).localeCompare(String(b.sourceId));
      })
      .slice(0, 50);
  }, [
    allSources,
    graphCentrality,
    featureContributions,
    emergentStructures,
    candidateCrossmatchResults,
    possibleBinaryPairs,
  ]);

  if (!topAnomalies.length) {
    return (
      <div className="stellar-top50-box">
        <div className="eyebrow">Top-50 Anomaly Queue</div>
        <p className="empty-selection">No ranked source available.</p>
      </div>
    );
  }

  return (
    <div className="stellar-top50-box stellar-top50-collapsible">
      <button
        type="button"
        className="stellar-top50-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="stellar-top50-toggle-left">
          <span className="eyebrow">Top-50 Anomaly Queue</span>
          <strong>Ranked candidates</strong>
        </span>
        <span className="stellar-top50-toggle-right">
          <small>{topAnomalies.length} sources</small>
          <span className="stellar-top50-chevron" aria-hidden="true">
            {expanded ? "▾" : "▸"}
          </span>
        </span>
      </button>

      {!expanded && (
        <p className="stellar-top50-hint">
          Click to expand the ranked candidates list. Selecting a row will
          update the synthetic stellar reconstruction.
        </p>
      )}

      {expanded && (
      <div
        className="stellar-top50-list"
        style={{
          maxHeight: "360px",
          overflowY: "auto",
          display: "grid",
          gap: "8px",
          paddingRight: "4px",
        }}
      >
        {topAnomalies.map((item, index) => {
          const isActive = String(item.sourceId) === String(selectedId);
          const label =
            item.model?.spectralProxyShortLabel ??
            item.model?.spectralProxyLabel ??
            "stellar proxy";

          return (
            <button
              key={`${item.sourceId}-${index}`}
              type="button"
              className={`node-row node-button stellar-top50-row${
                isActive ? " active" : ""
              }`}
              onClick={() => onSourceSelect?.(item.source)}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "34px 24px minmax(0, 1fr) 76px",
                alignItems: "center",
                gap: "10px",
                textAlign: "left",
                borderColor: isActive
                  ? "rgba(45,255,26,0.9)"
                  : "rgba(0, 211, 255, 0.18)",
                boxShadow: isActive ? "0 0 16px rgba(45,255,26,0.18)" : "",
              }}
              title={`Select Gaia source ${item.sourceId}`}
            >
              <span
                style={{
                  color: isActive ? "#2dff1a" : "var(--muted)",
                  fontWeight: 800,
                  fontSize: "0.72rem",
                }}
              >
                #{String(index + 1).padStart(2, "0")}
              </span>

              <MiniStar starModel={item.model} />

              <span style={{ minWidth: 0 }}>
                <strong
                  style={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.sourceId}
                </strong>
                <small
                  style={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {safeText(label)}
                </small>
              </span>

              <span style={{ textAlign: "right" }}>
                <strong>{formatValue(item.anomalyScore, 3)}</strong>
                <small style={{ display: "block" }}>score</small>
              </span>
            </button>
          );
        })}

        <p
          style={{
            margin: "10px 0 0",
            color: "var(--muted)",
            fontSize: "0.74rem",
            lineHeight: 1.45,
          }}
        >
          Ranked by internal anomaly score. Click a row to update the selected
          stellar reconstruction.
        </p>
      </div>
      )}
    </div>
  );
}

export default function StellarReconstructionStudio({
  allSources = [],
  selectedSource = null,
  graphCentrality = [],
  featureContributions = [],
  emergentStructures = [],
  candidateCrossmatchResults = [],
  possibleBinaryPairs = [],
  onSourceSelect = () => {},
}) {
  const [activeTab, setActiveTab] = useState("model");
  const [copied, setCopied] = useState(null);

  const effectiveSource = useMemo(() => {
    if (selectedSource && getSourceId(selectedSource)) {
      return selectedSource;
    }

    return findBestFallbackSource(allSources);
  }, [selectedSource, allSources]);

  const fullRecord = useMemo(
    () =>
      buildFullStellarRecord(effectiveSource, {
        graphCentrality,
        featureContributions,
        emergentStructures,
        candidateCrossmatchResults,
        possibleBinaryPairs,
      }),
    [
      effectiveSource,
      graphCentrality,
      featureContributions,
      emergentStructures,
      candidateCrossmatchResults,
      possibleBinaryPairs,
    ],
  );

  const starModel = useMemo(() => buildStarModel(fullRecord), [fullRecord]);

  const interpretation = useMemo(
    () => buildScientificInterpretation(fullRecord, starModel),
    [fullRecord, starModel],
  );

  const validationSteps = useMemo(
    () => buildValidationSteps(fullRecord),
    [fullRecord],
  );

  const plainTextReport = useMemo(
    () => buildPlainTextReport(fullRecord, starModel),
    [fullRecord, starModel],
  );

  const markdownReport = useMemo(
    () => buildMarkdownReport(fullRecord, starModel),
    [fullRecord, starModel],
  );

  const latexReport = useMemo(
    () => buildLatexReport(fullRecord, starModel),
    [fullRecord, starModel],
  );

  const jsonReport = useMemo(
    () => stringifyJsonExport(fullRecord, starModel),
    [fullRecord, starModel],
  );

  async function copyText(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied("copy failed");
      window.setTimeout(() => setCopied(null), 1600);
    }
  }

  if (!fullRecord || !starModel) {
    return (
      <section className="stellar-studio-shell">
        <div className="panel stellar-studio-empty-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Fifth Analysis Interface</div>
              <h2>Stellar Reconstruction & Full Dossier</h2>
            </div>

            <span>No selected Gaia source</span>
          </div>

          <p>
            No selected Gaia source is currently available. Select a source from
            the Operational Dashboard, Advanced Analysis Layer, Astrometric
            Dynamics Lab or Candidate Investigation Cockpit.
          </p>

          <div className="navigation-notice">
            To move through the framework, use only the Previous and Next
            controls at the top of the page.
          </div>
        </div>
      </section>
    );
  }

  const sourceId = getSourceId(fullRecord);

  return (
    <section className="stellar-studio-shell">
      <div className="panel stellar-studio-hero">
        <div className="stellar-studio-hero-main">
          <div>
            <div className="eyebrow">Fifth Analysis Interface</div>

            <h2>Stellar Reconstruction & Full Dossier</h2>

            <p>
              Physically-informed synthetic 3D reconstruction and complete data
              dossier for the globally selected Gaia source.
            </p>
          </div>

          <div className="stellar-studio-source-chip">
            <span>Selected SOURCE_ID</span>
            <strong>{sourceId || "N/A"}</strong>
            <span className="stellar-candidate-level-badge" title="All outputs are candidate-level. External validation is required.">
              candidate-level
            </span>
          </div>
        </div>

        <div className="navigation-notice">
          To move through the framework, use only the Previous and Next controls
          at the top of the page.
        </div>
      </div>

      <div className="stellar-studio-grid">
        <div className="panel stellar-source-summary-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Selected Source Summary</div>
              <h2>{sourceId || "N/A"}</h2>
            </div>

            <span>{safeText(starModel.spectralProxyShortLabel)}</span>
          </div>

          <div className="stellar-summary-section">
            <div className="stellar-summary-subheader">
              <span>Gaia Observables</span>
              <small>Direct Gaia DR3 quantities</small>
            </div>
            <div className="stellar-summary-grid">
              <SummaryMetric
                label="RA"
                value={formatValue(fullRecord.ra, 10, "deg")}
              />
              <SummaryMetric
                label="DEC"
                value={formatValue(fullRecord.dec, 10, "deg")}
              />
              <SummaryMetric
                label="Distance"
                value={formatValue(fullRecord.distance_pc, 4, "pc")}
                note="Parallax-derived if available"
              />
              <SummaryMetric
                label="BP-RP"
                value={formatValue(fullRecord.gaia_color_index, 4)}
                note="Gaia color proxy"
              />
            </div>
          </div>

          <div className="stellar-summary-section">
            <div className="stellar-summary-subheader">
              <span>Framework Proxies</span>
              <small>Derived from Gaia observables — candidate-level only</small>
            </div>
            <div className="stellar-summary-grid">
              <SummaryMetric
                label="Temperature"
                value={formatValue(starModel.effectiveTemperatureK, 0, "K")}
                note="visual proxy"
              />
              <SummaryMetric
                label="Radius"
                value={formatValue(starModel.radiusRelative, 4, "R☉")}
                note="derived proxy"
              />
              <SummaryMetric
                label="Anomaly"
                value={formatValue(fullRecord.anomaly_score, 4)}
                note="internal proxy"
              />
              <SummaryMetric
                label="Dynamics"
                value={formatValue(fullRecord.dynamics_index, 4)}
                note="candidate-level"
              />
              <SummaryMetric
                label="Structural importance"
                value={formatValue(fullRecord.structural_importance_score, 4)}
              />
            </div>
          </div>

          <div className="stellar-summary-section">
            <div className="stellar-summary-subheader">
              <span>Candidate-Level Context</span>
              <small>Indicators that require external validation</small>
            </div>
            <div className="stellar-summary-grid">
              <SummaryMetric
                label="Hidden companion"
                value={formatValue(fullRecord.hidden_companion_index, 4)}
                note={safeText(fullRecord.hidden_companion_classification)}
              />
              <SummaryMetric
                label="Possible pairs"
                value={
                  Array.isArray(fullRecord.possible_pairs)
                    ? fullRecord.possible_pairs.length
                    : 0
                }
                note="not confirmed"
              />
              <SummaryMetric
                label="Crossmatch"
                value={fullRecord.crossmatch ? "Attached" : "N/A"}
              />
            </div>
          </div>

          <div className="stellar-studio-tabs">
            <button
              type="button"
              className={activeTab === "model" ? "active" : ""}
              onClick={() => setActiveTab("model")}
            >
              Model
            </button>

            <button
              type="button"
              className={activeTab === "dossier" ? "active" : ""}
              onClick={() => setActiveTab("dossier")}
            >
              Dossier
            </button>

            <button
              type="button"
              className={activeTab === "exports" ? "active" : ""}
              onClick={() => setActiveTab("exports")}
            >
              Exports
            </button>
          </div>

          <TopAnomalyQueue
            allSources={allSources}
            selectedSource={effectiveSource}
            graphCentrality={graphCentrality}
            featureContributions={featureContributions}
            emergentStructures={emergentStructures}
            candidateCrossmatchResults={candidateCrossmatchResults}
            possibleBinaryPairs={possibleBinaryPairs}
            onSourceSelect={(source) => {
              onSourceSelect?.(source);
              setActiveTab("model");
            }}
          />
        </div>

        <div className="panel stellar-viewer-panel">
          <StarTwinViewer3D starModel={starModel} />
        </div>
      </div>

      {activeTab === "model" && (
        <div className="stellar-studio-two-column">
          <StellarInferencePanel
            fullRecord={fullRecord}
            starModel={starModel}
          />

          <section className="panel stellar-interpretation-panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Interpretation</div>
                <h2>Scientific Reading</h2>
              </div>

              <span>candidate-level</span>
            </div>

            <p>{interpretation}</p>

            <div className="stellar-validation-preview">
              <h3>Recommended validation path</h3>

              <ol>
                {validationSteps.slice(0, 6).map((step, index) => (
                  <li key={`${sourceId}-studio-step-${index}`}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="stellar-model-warning">
              <strong>Important:</strong> the rendered star is a synthetic,
              physically-informed visual model. It is not a direct observation
              of the stellar surface and does not confirm stellar type,
              binarity, companions or exotic physical mechanisms.
            </div>
          </section>
        </div>
      )}

      {activeTab === "dossier" && (
        <FullStellarDossier fullRecord={fullRecord} starModel={starModel} />
      )}

      {activeTab === "exports" && (
        <section className="panel stellar-export-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Copy & Download</div>
              <h2>Export Full Stellar Dossier</h2>
            </div>

            <CopyStatus copied={copied} />
          </div>

          <p>
            Export the selected source dossier in plain text, Markdown, LaTeX or
            JSON. All exports preserve candidate-level caution language.
          </p>

          <div className="stellar-export-actions">
            <ExportButton
              accent
              onClick={() => copyText("plain text report", plainTextReport)}
            >
              Copy plain text
            </ExportButton>

            <ExportButton
              onClick={() => copyText("Markdown report", markdownReport)}
            >
              Copy Markdown
            </ExportButton>

            <ExportButton onClick={() => copyText("LaTeX report", latexReport)}>
              Copy LaTeX
            </ExportButton>

            <ExportButton onClick={() => copyText("JSON export", jsonReport)}>
              Copy JSON
            </ExportButton>

            <ExportButton
              accent
              onClick={() => downloadPlainTextReport(fullRecord, starModel)}
            >
              Download TXT
            </ExportButton>

            <ExportButton
              onClick={() => downloadMarkdownReport(fullRecord, starModel)}
            >
              Download MD
            </ExportButton>

            <ExportButton
              onClick={() => downloadLatexReport(fullRecord, starModel)}
            >
              Download TEX
            </ExportButton>

            <ExportButton onClick={() => downloadJsonReport(fullRecord, starModel)}>
              Download JSON
            </ExportButton>
          </div>

          <div className="stellar-export-preview-grid">
            <div className="stellar-export-preview">
              <div className="stellar-export-preview-header">
                <span>Plain text preview</span>
                <button
                  type="button"
                  onClick={() => copyText("plain text report", plainTextReport)}
                >
                  Copy
                </button>
              </div>

              <pre>{plainTextReport}</pre>
            </div>

            <div className="stellar-export-preview">
              <div className="stellar-export-preview-header">
                <span>JSON preview</span>
                <button
                  type="button"
                  onClick={() => copyText("JSON export", jsonReport)}
                >
                  Copy
                </button>
              </div>

              <pre>{jsonReport}</pre>
            </div>
          </div>

          <div className="stellar-export-caution">
            <strong>Scientific caution:</strong> exported reports describe
            candidate-level proxy information only. They do not confirm
            astrophysical classification, binarity, planets, hidden companions,
            activity or exotic physical mechanisms.
          </div>
        </section>
      )}

      <section className="panel stellar-studio-caution-panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Scientific Caution</div>
            <h2>Synthetic Reconstruction Limits</h2>
          </div>

          <span>not a direct observation</span>
        </div>

        <p>
          This fifth interface generates a physically-informed synthetic stellar
          reconstruction from Gaia-derived observables and internal dashboard
          proxies. The rendered surface texture, apparent activity, corona and
          visual morphology are procedural visualizations constrained by
          available data. They are not direct observational images.
        </p>

        <p>
          The page is intended to support research triage, communication,
          visualization and validation planning. All interpretations require
          external catalogue checks and expert review.
        </p>
      </section>
    </section>
  );
}
