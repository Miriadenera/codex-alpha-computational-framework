import React, { useEffect, useMemo, useState } from "react";
import Graph3DViewer from "./components/Graph3DViewer.jsx";
import InteractiveSourceTable from "./components/InteractiveSourceTable.jsx";
import GaiaPhysicalMap from "./components/GaiaPhysicalMap.jsx";
import RelationalKnowledgeGraph from "./components/RelationalKnowledgeGraph.jsx";
import CoherenceGradientModule from "./components/CoherenceGradientModule.jsx";
import CandidateRegistry from "./components/CandidateRegistry.jsx";
import AstrometricDynamicsLab from "./components/AstrometricDynamicsLab.jsx";
import CandidateInvestigationCockpit from "./components/CandidateInvestigationCockpit.jsx";

const DATA_BASE = "/data";
const CODEX_ALPHA_WEBSITE = "https://www.codexalpha.org";

async function loadJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error("Unable to load " + path);
  }

  return response.json();
}

async function loadOptionalJson(path, fallback = []) {
  try {
    const response = await fetch(path);

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.records)) {
      return data.records;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

async function loadText(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error("Unable to load " + path);
  }

  return response.text();
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

/* ─── Lightweight Markdown renderer ──────────────────────────────────────── */

function renderMarkdown(md) {
  if (!md) {
    return [];
  }

  const lines = md.split("\n");
  const elements = [];
  let i = 0;
  let key = 0;

  function inlineMarkup(text) {
    const parts = [];
    const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
    let last = 0;
    let m;

    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) {
        parts.push(text.slice(last, m.index));
      }

      if (m[2]) {
        parts.push(
          <strong key={key++}>
            <em>{m[2]}</em>
          </strong>,
        );
      } else if (m[3]) {
        parts.push(<strong key={key++}>{m[3]}</strong>);
      } else if (m[4]) {
        parts.push(<em key={key++}>{m[4]}</em>);
      } else if (m[5]) {
        parts.push(
          <code key={key++} className="md-inline-code">
            {m[5]}
          </code>,
        );
      }

      last = m.index + m[0].length;
    }

    if (last < text.length) {
      parts.push(text.slice(last));
    }

    return parts.length ? parts : text;
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;

      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }

      elements.push(
        <div key={key++} className="md-code-block">
          {lang && <span className="md-code-lang">{lang}</span>}
          <pre>
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>,
      );

      i++;
      continue;
    }

    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      elements.push(<hr key={key++} className="md-hr" />);
      i++;
      continue;
    }

    const hMatch = line.match(/^(#{1,6})\s+(.*)/);

    if (hMatch) {
      const level = hMatch[1].length;
      const Tag = `h${Math.min(level, 6)}`;

      elements.push(
        <Tag key={key++} className={`md-h md-h${level}`}>
          {inlineMarkup(hMatch[2])}
        </Tag>,
      );

      i++;
      continue;
    }

    if (line.startsWith(">")) {
      const qLines = [];

      while (i < lines.length && lines[i].startsWith(">")) {
        qLines.push(lines[i].slice(1).trim());
        i++;
      }

      elements.push(
        <blockquote key={key++} className="md-blockquote">
          {qLines.map((l, idx) => (
            <p key={idx}>{inlineMarkup(l)}</p>
          ))}
        </blockquote>,
      );

      continue;
    }

    if (/^[\-\*\+]\s/.test(line)) {
      const items = [];

      while (i < lines.length && /^[\-\*\+]\s/.test(lines[i])) {
        items.push(<li key={i}>{inlineMarkup(lines[i].slice(2))}</li>);
        i++;
      }

      elements.push(
        <ul key={key++} className="md-ul">
          {items}
        </ul>,
      );

      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items = [];

      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(
          <li key={i}>
            {inlineMarkup(lines[i].replace(/^\d+\.\s/, ""))}
          </li>,
        );

        i++;
      }

      elements.push(
        <ol key={key++} className="md-ol">
          {items}
        </ol>,
      );

      continue;
    }

    if (line.includes("|") && lines[i + 1]?.match(/^\|?[\s\-\|:]+\|?$/)) {
      const tableLines = [];

      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }

      const rows = tableLines
        .filter((l) => !l.match(/^\|?[\s\-\|:]+\|?$/))
        .map((l) =>
          l
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((c) => c.trim()),
        );

      if (rows.length > 0) {
        elements.push(
          <div key={key++} className="md-table-wrapper">
            <table className="md-table">
              <thead>
                <tr>
                  {rows[0].map((cell, ci) => (
                    <th key={ci}>{inlineMarkup(cell)}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci}>{inlineMarkup(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }

      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paraLines = [];

    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !/^[\-\*\+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !lines[i].startsWith(">") &&
      !/^(\-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length) {
      elements.push(
        <p key={key++} className="md-p">
          {inlineMarkup(paraLines.join(" "))}
        </p>,
      );
    }
  }

  return elements;
}

/* ─── sub-components ─────────────────────────────────────────────────────── */

function MetricCard({ label, value, subtitle }) {
  return (
    <div className="metric-card">
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

function NavigationActions({ currentPage, setCurrentPage }) {
  return (
    <div className="dashboard-nav-actions">
      <a
        className="dashboard-nav-button"
        href={CODEX_ALPHA_WEBSITE}
        target="_blank"
        rel="noreferrer"
      >
        Back to Website
      </a>

      {currentPage === "dashboard" && (
        <button
          type="button"
          className="dashboard-nav-button dashboard-nav-button-accent"
          onClick={() => setCurrentPage("advanced")}
        >
          Advanced Analysis Layer
        </button>
      )}

      {currentPage === "advanced" && (
        <>
          <button
            type="button"
            className="dashboard-nav-button dashboard-nav-button-accent"
            onClick={() => setCurrentPage("dashboard")}
          >
            Operational Dashboard
          </button>

          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => setCurrentPage("dynamics")}
          >
            Astrometric Dynamics Lab
          </button>
        </>
      )}

      {currentPage === "dynamics" && (
        <>
          <button
            type="button"
            className="dashboard-nav-button dashboard-nav-button-accent"
            onClick={() => setCurrentPage("advanced")}
          >
            Advanced Analysis Layer
          </button>

          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => setCurrentPage("dashboard")}
          >
            Operational Dashboard
          </button>

          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => setCurrentPage("validation")}
          >
            Continue Analysis
          </button>
        </>
      )}

      {currentPage === "validation" && (
        <>
          <button
            type="button"
            className="dashboard-nav-button dashboard-nav-button-accent"
            onClick={() => setCurrentPage("dynamics")}
          >
            Back to Dynamics Lab
          </button>

          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => setCurrentPage("advanced")}
          >
            Advanced Analysis Layer
          </button>

          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => setCurrentPage("dashboard")}
          >
            Operational Dashboard
          </button>
        </>
      )}
    </div>
  );
}

function AdvancedAnalysisLayer({
  setCurrentPage,
  allSources,
  featureContributions,
  emergentStructures,
  graphCentrality,
  candidateCrossmatchResults,
  selectedNode,
  setSelectedNode,
}) {
  return (
    <section className="advanced-page-shell">
      <div className="panel advanced-hero-panel">
        <div className="eyebrow">Second Analysis Interface</div>

        <h2>Advanced Analysis Layer</h2>

        <p>
          This page extends the Codex Alpha Computational Framework with
          interpretative and coordinate-based analysis layers. It explores Gaia
          physical projections, relational source context, exploratory
          coherence-proxy indicators, internal candidate ranking and external
          crossmatch validation outputs.
        </p>

        <div className="advanced-actions">
          <button
            type="button"
            className="dashboard-nav-button dashboard-nav-button-accent"
            onClick={() => setCurrentPage("dashboard")}
          >
            Back to Operational Dashboard
          </button>

          <a
            className="dashboard-nav-button"
            href={CODEX_ALPHA_WEBSITE}
            target="_blank"
            rel="noreferrer"
          >
            Back to Codex Alpha Website
          </a>
        </div>
      </div>

      <GaiaPhysicalMap
        sources={allSources}
        selectedSource={selectedNode}
        onSourceSelect={setSelectedNode}
      />

      <RelationalKnowledgeGraph
        sources={allSources}
        featureContributions={featureContributions}
        emergentStructures={emergentStructures}
        graphCentrality={graphCentrality}
        selectedSource={selectedNode}
        onSourceSelect={setSelectedNode}
      />

      <CoherenceGradientModule
        sources={allSources}
        emergentStructures={emergentStructures}
        graphCentrality={graphCentrality}
        featureContributions={featureContributions}
        selectedSource={selectedNode}
        onSourceSelect={setSelectedNode}
      />

      <CandidateRegistry
        sources={allSources}
        emergentStructures={emergentStructures}
        graphCentrality={graphCentrality}
        featureContributions={featureContributions}
        candidateCrossmatchResults={candidateCrossmatchResults}
        selectedSource={selectedNode}
        onSourceSelect={setSelectedNode}
      />

      <section className="panel dynamics-launch-panel">
        <div>
          <div className="eyebrow">Third Analysis Interface</div>

          <h2>Astrometric Dynamics Lab</h2>

          <p>
            Continue to the third analysis interface for astrometric distance,
            proper-motion, tangential-velocity, possible comoving-pair and
            dynamical follow-up diagnostics.
          </p>
        </div>

        <button
          type="button"
          className="dashboard-nav-button dashboard-nav-button-accent"
          onClick={() => setCurrentPage("dynamics")}
        >
          Open Astrometric Dynamics Lab
        </button>
      </section>
    </section>
  );
}

function ExternalValidationLayer({
  setCurrentPage,
  selectedNode,
  candidateCrossmatchResults,
  possibleBinaryPairs,
}) {
  const selectedSourceId = String(
    selectedNode?.SOURCE_ID ?? selectedNode?.source_id ?? selectedNode?.id ?? "",
  );

  const selectedCrossmatch = useMemo(() => {
    if (!selectedSourceId) {
      return null;
    }

    return (
      candidateCrossmatchResults.find((item) => {
        const itemId = String(
          item?.SOURCE_ID ??
            item?.source_id ??
            item?.gaia_source_id ??
            item?.id ??
            "",
        );

        return itemId === selectedSourceId;
      }) ?? null
    );
  }, [candidateCrossmatchResults, selectedSourceId]);

  const selectedPairs = useMemo(() => {
    if (!selectedSourceId) {
      return [];
    }

    return possibleBinaryPairs.filter((pair) => {
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

      return sourceA === selectedSourceId || sourceB === selectedSourceId;
    });
  }, [possibleBinaryPairs, selectedSourceId]);

  return (
    <section className="advanced-page-shell">
      <div className="panel advanced-hero-panel">
        <div className="eyebrow">Fourth Analysis Interface</div>

        <h2>External Validation & Follow-up Layer</h2>

        <p>
          This layer is reserved for catalogue validation, follow-up planning,
          crossmatch review, Gaia NSS inspection and candidate-status tracking.
          It does not confirm astrophysical claims by itself; it organizes the
          evidence required before any stronger interpretation.
        </p>

        <div className="advanced-actions">
          <button
            type="button"
            className="dashboard-nav-button dashboard-nav-button-accent"
            onClick={() => setCurrentPage("dynamics")}
          >
            Back to Astrometric Dynamics Lab
          </button>

          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => setCurrentPage("advanced")}
          >
            Back to Advanced Analysis Layer
          </button>
        </div>
      </div>

      <section className="metrics-grid dynamics-summary-grid">
        <MetricCard
          label="Crossmatch records"
          value={candidateCrossmatchResults.length}
          subtitle="Loaded validation entries"
        />

        <MetricCard
          label="Possible pairs"
          value={possibleBinaryPairs.length}
          subtitle="Imported/local candidate relations"
        />

        <MetricCard
          label="Selected source"
          value={selectedSourceId || "None"}
          subtitle="Current validation target"
        />

        <MetricCard
          label="Attached pairs"
          value={selectedPairs.length}
          subtitle="Relations involving selected source"
        />
      </section>

      <section className="panel dynamics-lab-panel">
        <div className="panel-header">
          <div>
            <h2>Selected Source Validation Snapshot</h2>
            <span>External catalogue and local relation status</span>
          </div>
        </div>

        {!selectedNode && (
          <div className="empty-selection">
            Select a source from the dashboard, advanced layer or dynamics lab
            to populate this validation page.
          </div>
        )}

        {selectedNode && (
          <div className="candidate-primary-card dynamics-primary-card">
            <div className="candidate-primary-header">
              <div>
                <span className="candidate-id">VALIDATION TARGET</span>

                <h3>Gaia DR3 Source {selectedSourceId}</h3>

                <p>
                  This panel summarizes whether the selected source already has
                  local crossmatch evidence or possible pair relations.
                </p>
              </div>

              <div className="candidate-score-orb">
                <span>Pair links</span>
                <strong>{selectedPairs.length}</strong>
              </div>
            </div>

            <div className="candidate-explanation-grid">
              <div className="candidate-explanation-card">
                <span>SIMBAD status</span>
                <strong>
                  {selectedCrossmatch?.simbad_status ??
                    selectedCrossmatch?.simbad_match ??
                    selectedCrossmatch?.simbad ??
                    "N/A"}
                </strong>
                <p>
                  External object identification should be checked manually
                  before assigning any physical class.
                </p>
              </div>

              <div className="candidate-explanation-card">
                <span>SIMBAD main ID</span>
                <strong>
                  {selectedCrossmatch?.simbad_main_id ??
                    selectedCrossmatch?.main_id ??
                    selectedCrossmatch?.simbad_id ??
                    "N/A"}
                </strong>
                <p>
                  A catalogue name or alias can indicate a known source, but not
                  necessarily a binary or planet-host classification.
                </p>
              </div>

              <div className="candidate-explanation-card">
                <span>VizieR status</span>
                <strong>
                  {selectedCrossmatch?.vizier_status ??
                    selectedCrossmatch?.vizier_match ??
                    selectedCrossmatch?.vizier ??
                    "N/A"}
                </strong>
                <p>
                  VizieR associations are useful for photometry, variability
                  surveys and catalogue-level context.
                </p>
              </div>

              <div className="candidate-explanation-card">
                <span>Gaia NSS status</span>
                <strong>
                  {selectedCrossmatch?.nss_status ??
                    selectedCrossmatch?.nss_match ??
                    selectedCrossmatch?.gaia_nss ??
                    selectedCrossmatch?.nss ??
                    "N/A"}
                </strong>
                <p>
                  Gaia NSS is the key catalogue layer for non-single-star
                  solutions when available.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="panel dynamics-lab-panel">
        <div className="panel-header">
          <div>
            <h2>Follow-up Queue Blueprint</h2>
            <span>Planned validation workflow</span>
          </div>
        </div>

        <div className="candidate-detailed-note">
          <h3>Recommended validation order</h3>

          <ol className="dossier-validation-list">
            <li>Verify Gaia DR3 source identity and astrometric parameters.</li>
            <li>Check SIMBAD object type, aliases and bibliography.</li>
            <li>Check VizieR catalogue context and photometric associations.</li>
            <li>Inspect Gaia NSS for non-single-star solutions.</li>
            <li>
              For possible pair candidates, compare angular separation,
              parallax, proper motion and radial velocity.
            </li>
            <li>
              Only after external confirmation, promote the source from
              candidate-level status to a stronger scientific interpretation.
            </li>
          </ol>
        </div>

        <p className="candidate-registry-note">
          This fourth layer is currently a structured validation shell. It is
          ready for the next implementation step: manual status labels, export
          queue, confirmed/rejected candidate flags and persistent follow-up
          notes.
        </p>
      </section>
    </section>
  );
}

/* ─── App ────────────────────────────────────────────────────────────────── */

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");

  const [summary, setSummary] = useState(null);
  const [allSources, setAllSources] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [centrality, setCentrality] = useState([]);
  const [featureContributions, setFeatureContributions] = useState([]);
  const [emergentStructures, setEmergentStructures] = useState([]);
  const [candidateCrossmatchResults, setCandidateCrossmatchResults] = useState(
    [],
  );
  const [possibleBinaryPairs, setPossibleBinaryPairs] = useState([]);
  const [report, setReport] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [currentPage]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [
          summaryData,
          allSourcesData,
          nodesData,
          edgesData,
          centralityData,
          featureContributionsData,
          emergentStructuresData,
          candidateCrossmatchData,
          possibleBinaryPairsData,
          reportText,
        ] = await Promise.all([
          loadJson(DATA_BASE + "/summary.json"),
          loadJson(DATA_BASE + "/anomalies.json"),
          loadJson(DATA_BASE + "/graph_nodes.json"),
          loadJson(DATA_BASE + "/graph_edges.json"),
          loadJson(DATA_BASE + "/graph_centrality.json"),
          loadJson(DATA_BASE + "/feature_contributions.json"),
          loadJson(DATA_BASE + "/emergent_structures.json"),
          loadOptionalJson(DATA_BASE + "/candidate_crossmatch_results.json", []),
          loadOptionalJson(DATA_BASE + "/possible_binary_pairs.json", []),
          loadText(DATA_BASE + "/report.md"),
        ]);

        setSummary(summaryData);
        setAllSources(allSourcesData);
        setNodes(nodesData);
        setEdges(edgesData);
        setCentrality(centralityData);
        setFeatureContributions(featureContributionsData);
        setEmergentStructures(emergentStructuresData);
        setCandidateCrossmatchResults(candidateCrossmatchData);
        setPossibleBinaryPairs(possibleBinaryPairsData);
        setReport(reportText);
      } catch (err) {
        setError(err.message);
      }
    }

    loadDashboardData();
  }, []);

  const topCentralSources = useMemo(() => centrality.slice(0, 10), [centrality]);
  const renderedReport = useMemo(() => renderMarkdown(report), [report]);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <div className="eyebrow">Local Scientific Interface</div>

          <h1>Codex Alpha Computational Framework</h1>

          <p>
            Local dashboard for exploratory analysis of multidimensional Gaia
            DR3 outputs.
          </p>

          <NavigationActions
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
          />
        </div>

        <div className="status-pill">
          <span className="status-dot" />
          Offline-first dashboard
        </div>
      </header>

      {error && (
        <section className="error-box">
          <strong>Dashboard data not available.</strong>
          <p>{error}</p>
          <p>
            Run <code>python -m pipeline.run_full_pipeline</code> from the
            repository root.
          </p>
        </section>
      )}

      {!error && currentPage === "advanced" && (
        <AdvancedAnalysisLayer
          setCurrentPage={setCurrentPage}
          allSources={allSources}
          featureContributions={featureContributions}
          emergentStructures={emergentStructures}
          graphCentrality={centrality}
          candidateCrossmatchResults={candidateCrossmatchResults}
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
        />
      )}

      {!error && currentPage === "dynamics" && (
        <AstrometricDynamicsLab
          allSources={allSources}
          graphCentrality={centrality}
          featureContributions={featureContributions}
          emergentStructures={emergentStructures}
          candidateCrossmatchResults={candidateCrossmatchResults}
          possibleBinaryPairs={possibleBinaryPairs}
          selectedSource={selectedNode}
          onSourceSelect={setSelectedNode}
          setCurrentPage={setCurrentPage}
        />
      )}

      {!error && currentPage === "validation" && (
        <CandidateInvestigationCockpit
          allSources={allSources}
          graphCentrality={centrality}
          featureContributions={featureContributions}
          emergentStructures={emergentStructures}
          candidateCrossmatchResults={candidateCrossmatchResults}
          possibleBinaryPairs={possibleBinaryPairs}
          selectedSource={selectedNode}
          onSourceSelect={setSelectedNode}
          setCurrentPage={setCurrentPage}
        />
      )}

      {!error && currentPage === "dashboard" && (
        <>
          <section className="metrics-grid">
            <MetricCard
              label="Dataset"
              value={summary?.dataset ?? "Loading"}
              subtitle="Local exported package"
            />

            <MetricCard
              label="Sources"
              value={summary?.total_sources ?? "..."}
              subtitle="Total analyzed"
            />

            <MetricCard
              label="Anomalies"
              value={summary?.anomalous_sources ?? "..."}
              subtitle="Detected sources"
            />

            <MetricCard
              label="Graph"
              value={(summary?.graph_nodes ?? "...") + " nodes"}
              subtitle={(summary?.graph_edges ?? "...") + " edges"}
            />
          </section>

          <section className="viewer-stack">
            <div className="panel graph-panel">
              <div className="panel-header">
                <h2>3D Relational Graph Viewer</h2>
                <span>Interactive local graph</span>
              </div>

              <Graph3DViewer
                allSources={allSources}
                nodes={nodes}
                edges={edges}
                centrality={centrality}
                selectedNode={selectedNode}
                onNodeSelect={setSelectedNode}
              />
            </div>

            <section className="analysis-grid">
              <aside className="panel">
                <div className="panel-header">
                  <h2>Top Structural Nodes</h2>
                  <span>Graph centrality</span>
                </div>

                <div className="node-list compact-node-list">
                  {topCentralSources.map((source) => (
                    <button
                      className="node-row node-button"
                      key={source.SOURCE_ID}
                      type="button"
                      onClick={() => setSelectedNode(source)}
                    >
                      <div>
                        <strong>{source.SOURCE_ID}</strong>
                        <small>rank {source.structural_rank}</small>
                      </div>

                      <span>
                        {formatNumber(source.structural_importance_score, 4)}
                      </span>
                    </button>
                  ))}
                </div>
              </aside>

              <aside className="panel">
                <div className="panel-header">
                  <h2>Selected Source</h2>
                  <span>Inspection</span>
                </div>

                {!selectedNode && (
                  <div className="empty-selection">
                    Select a node in the 3D viewer, from the structural ranking
                    or from the interactive source table.
                  </div>
                )}

                {selectedNode && (
                  <div className="details-list details-list-grid">
                    <p>
                      <span>SOURCE_ID</span>
                      <strong>
                        {selectedNode.source_id ?? selectedNode.SOURCE_ID}
                      </strong>
                    </p>

                    <p>
                      <span>Type</span>
                      <strong>{selectedNode.node_type ?? "source"}</strong>
                    </p>

                    <p>
                      <span>Structural rank</span>
                      <strong>{selectedNode.structural_rank ?? "N/A"}</strong>
                    </p>

                    <p>
                      <span>Structural importance</span>
                      <strong>
                        {formatNumber(
                          selectedNode.structural_importance_score,
                          6,
                        )}
                      </strong>
                    </p>

                    <p>
                      <span>Anomaly score</span>
                      <strong>
                        {formatNumber(selectedNode.anomaly_score, 6)}
                      </strong>
                    </p>

                    <p>
                      <span>RA (deg)</span>
                      <strong>{formatGaiaValue(selectedNode.ra, 10)}</strong>
                    </p>

                    <p>
                      <span>DEC (deg)</span>
                      <strong>{formatGaiaValue(selectedNode.dec, 10)}</strong>
                    </p>

                    <p>
                      <span>Parallax (mas)</span>
                      <strong>
                        {formatGaiaValue(selectedNode.parallax, 10)}
                      </strong>
                    </p>

                    <p>
                      <span>Radial velocity (km/s)</span>
                      <strong>
                        {formatGaiaValue(selectedNode.radial_velocity, 10)}
                      </strong>
                    </p>
                  </div>
                )}
              </aside>
            </section>

            <InteractiveSourceTable
              sources={allSources}
              selectedNode={selectedNode}
              onSourceSelect={setSelectedNode}
            />
          </section>

          <section className="panel report-panel">
            <div className="panel-header">
              <h2>Automatic Pipeline Report</h2>
              <span>Markdown export</span>
            </div>

            <div className="md-body">{renderedReport}</div>
          </section>
        </>
      )}
    </main>
  );
}

export default App;