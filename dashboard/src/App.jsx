import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";

const DATA_BASE = "/data";
const CODEX_ALPHA_WEBSITE = "https://www.codexalpha.org";

const Graph3DViewer = lazy(() => import("./components/Graph3DViewer.jsx"));
const InteractiveSourceTable = lazy(() => import("./components/InteractiveSourceTable.jsx"));
const GaiaPhysicalMap = lazy(() => import("./components/GaiaPhysicalMap.jsx"));
const RelationalKnowledgeGraph = lazy(() => import("./components/RelationalKnowledgeGraph.jsx"));
const CoherenceGradientModule = lazy(() => import("./components/CoherenceGradientModule.jsx"));
const CandidateRegistry = lazy(() => import("./components/CandidateRegistry.jsx"));
const AstrometricDynamicsLab = lazy(() => import("./components/AstrometricDynamicsLab.jsx"));
const CandidateInvestigationCockpit = lazy(() => import("./components/CandidateInvestigationCockpit.jsx"));

class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Codex Alpha page error:", error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <section className="error-box">
          <strong>Page render error.</strong>
          <p>{this.state.error?.message ?? String(this.state.error)}</p>
          <p>The dashboard shell is alive. The failing page was isolated instead of blanking the whole app.</p>
        </section>
      );
    }

    return this.props.children;
  }
}

function LoadingPanel({ label = "Loading module" }) {
  return (
    <section className="panel">
      <div className="coherence-warning">
        <strong>{label}</strong>. Please wait.
      </div>
    </section>
  );
}

async function loadJson(path, fallback = null, required = true) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      if (required) throw new Error(`Unable to load ${path}`);
      return fallback;
    }
    return await response.json();
  } catch (error) {
    if (required) throw error;
    return fallback;
  }
}

async function loadOptionalArray(path) {
  const data = await loadJson(path, [], false);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function loadOptionalText(path) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

function formatNumber(value, digits = 6) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "N/A";
}

function formatGaiaValue(value, digits = 10) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "N/A";
}

function getSourceId(source) {
  return String(source?.SOURCE_ID ?? source?.source_id ?? source?.sourceId ?? source?.id ?? "");
}

function renderMarkdown(md) {
  if (!md) return [];
  return md.split("\n").slice(0, 400).map((line, index) => {
    if (line.startsWith("### ")) return <h3 key={index} className="md-h md-h3">{line.slice(4)}</h3>;
    if (line.startsWith("## ")) return <h2 key={index} className="md-h md-h2">{line.slice(3)}</h2>;
    if (line.startsWith("# ")) return <h1 key={index} className="md-h md-h1">{line.slice(2)}</h1>;
    if (!line.trim()) return <br key={index} />;
    return <p key={index} className="md-p">{line}</p>;
  });
}

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
      <a className="dashboard-nav-button" href={CODEX_ALPHA_WEBSITE} target="_blank" rel="noreferrer">
        Back to Website
      </a>

      {currentPage !== "dashboard" && (
        <button type="button" className="dashboard-nav-button" onClick={() => setCurrentPage("dashboard")}>
          Operational Dashboard
        </button>
      )}

      {currentPage !== "advanced" && (
        <button type="button" className="dashboard-nav-button" onClick={() => setCurrentPage("advanced")}>
          Advanced Analysis Layer
        </button>
      )}

      {currentPage !== "dynamics" && (
        <button type="button" className="dashboard-nav-button" onClick={() => setCurrentPage("dynamics")}>
          Astrometric Dynamics Lab
        </button>
      )}

      {currentPage !== "validation" && (
        <button type="button" className="dashboard-nav-button dashboard-nav-button-accent" onClick={() => setCurrentPage("validation")}>
          Candidate Investigation Cockpit
        </button>
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
        <p>Interpretative and coordinate-based Gaia DR3 analysis layers with candidate-level scientific caution.</p>
        <div className="advanced-actions">
          <button type="button" className="dashboard-nav-button dashboard-nav-button-accent" onClick={() => setCurrentPage("dynamics")}>
            Open Astrometric Dynamics Lab
          </button>
        </div>
      </div>

      <GaiaPhysicalMap sources={allSources} selectedSource={selectedNode} onSourceSelect={setSelectedNode} />
      <RelationalKnowledgeGraph sources={allSources} featureContributions={featureContributions} emergentStructures={emergentStructures} graphCentrality={graphCentrality} selectedSource={selectedNode} onSourceSelect={setSelectedNode} />
      <CoherenceGradientModule sources={allSources} emergentStructures={emergentStructures} graphCentrality={graphCentrality} featureContributions={featureContributions} selectedSource={selectedNode} onSourceSelect={setSelectedNode} />
      <CandidateRegistry sources={allSources} emergentStructures={emergentStructures} graphCentrality={graphCentrality} featureContributions={featureContributions} candidateCrossmatchResults={candidateCrossmatchResults} selectedSource={selectedNode} onSourceSelect={setSelectedNode} />
    </section>
  );
}

function DashboardPage({ summary, allSources, nodes, edges, centrality, selectedNode, setSelectedNode, renderedReport }) {
  const topCentralSources = useMemo(() => (Array.isArray(centrality) ? centrality.slice(0, 10) : []), [centrality]);

  return (
    <>
      <section className="metrics-grid">
        <MetricCard label="Dataset" value={summary?.dataset ?? "Loading"} subtitle="Local exported package" />
        <MetricCard label="Sources" value={summary?.total_sources ?? allSources.length ?? "..."} subtitle="Total analyzed" />
        <MetricCard label="Anomalies" value={summary?.anomalous_sources ?? "..."} subtitle="Detected sources" />
        <MetricCard label="Graph" value={(summary?.graph_nodes ?? nodes.length ?? "...") + " nodes"} subtitle={(summary?.graph_edges ?? edges.length ?? "...") + " edges"} />
      </section>

      <section className="viewer-stack">
        <div className="panel graph-panel">
          <div className="panel-header"><h2>3D Relational Graph Viewer</h2><span>Interactive local graph</span></div>
          <Graph3DViewer allSources={allSources} nodes={nodes} edges={edges} centrality={centrality} selectedNode={selectedNode} onNodeSelect={setSelectedNode} />
        </div>

        <section className="analysis-grid">
          <aside className="panel">
            <div className="panel-header"><h2>Top Structural Nodes</h2><span>Graph centrality</span></div>
            <div className="node-list compact-node-list">
              {topCentralSources.map((source, index) => (
                <button className="node-row node-button" key={getSourceId(source) || index} type="button" onClick={() => setSelectedNode(source)}>
                  <div><strong>{getSourceId(source) || "N/A"}</strong><small>rank {source.structural_rank ?? "N/A"}</small></div>
                  <span>{formatNumber(source.structural_importance_score, 4)}</span>
                </button>
              ))}
            </div>
          </aside>

          <aside className="panel">
            <div className="panel-header"><h2>Selected Source</h2><span>Inspection</span></div>
            {!selectedNode ? <div className="empty-selection">Select a node or table row.</div> : (
              <div className="details-list details-list-grid">
                <p><span>SOURCE_ID</span><strong>{getSourceId(selectedNode)}</strong></p>
                <p><span>Structural rank</span><strong>{selectedNode.structural_rank ?? "N/A"}</strong></p>
                <p><span>Structural importance</span><strong>{formatNumber(selectedNode.structural_importance_score, 6)}</strong></p>
                <p><span>Anomaly score</span><strong>{formatNumber(selectedNode.anomaly_score, 6)}</strong></p>
                <p><span>RA</span><strong>{formatGaiaValue(selectedNode.ra, 10)}</strong></p>
                <p><span>DEC</span><strong>{formatGaiaValue(selectedNode.dec, 10)}</strong></p>
              </div>
            )}
          </aside>
        </section>

        <InteractiveSourceTable sources={allSources} selectedNode={selectedNode} onSourceSelect={setSelectedNode} />
      </section>

      <section className="panel report-panel">
        <div className="panel-header"><h2>Automatic Pipeline Report</h2><span>Markdown export</span></div>
        <div className="md-body">{renderedReport}</div>
      </section>
    </>
  );
}

export default function App() {
  const [currentPage, rawSetCurrentPage] = useState(() => {
    try {
      return sessionStorage.getItem("codex-alpha-current-page") || "dashboard";
    } catch {
      return "dashboard";
    }
  });

  const setCurrentPage = (page) => {
    const normalized = page === "investigation" ? "validation" : page;
    try {
      sessionStorage.setItem("codex-alpha-current-page", normalized);
    } catch {}
    rawSetCurrentPage(normalized);
  };

  const [summary, setSummary] = useState(null);
  const [allSources, setAllSources] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [centrality, setCentrality] = useState([]);
  const [featureContributions, setFeatureContributions] = useState([]);
  const [emergentStructures, setEmergentStructures] = useState([]);
  const [candidateCrossmatchResults, setCandidateCrossmatchResults] = useState([]);
  const [possibleBinaryPairs, setPossibleBinaryPairs] = useState([]);
  const [report, setReport] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onError = (event) => {
      console.error("Global dashboard error:", event.error || event.message);
      setError(event.error?.message || event.message || "Unknown dashboard error");
    };

    const onUnhandled = (event) => {
      console.error("Unhandled dashboard rejection:", event.reason);
      setError(event.reason?.message || String(event.reason));
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [currentPage]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardData() {
      try {
        const [summaryData, allSourcesData, nodesData, edgesData, centralityData] = await Promise.all([
          loadJson(DATA_BASE + "/summary.json", null, true),
          loadJson(DATA_BASE + "/anomalies.json", [], true),
          loadJson(DATA_BASE + "/graph_nodes.json", [], true),
          loadJson(DATA_BASE + "/graph_edges.json", [], true),
          loadJson(DATA_BASE + "/graph_centrality.json", [], true),
        ]);

        const [featureData, emergentData, crossmatchData, pairsData, reportText] = await Promise.all([
          loadOptionalArray(DATA_BASE + "/feature_contributions.json"),
          loadOptionalArray(DATA_BASE + "/emergent_structures.json"),
          loadOptionalArray(DATA_BASE + "/candidate_crossmatch_results.json"),
          loadOptionalArray(DATA_BASE + "/possible_binary_pairs.json"),
          loadOptionalText(DATA_BASE + "/report.md"),
        ]);

        if (cancelled) return;
        setSummary(summaryData);
        setAllSources(Array.isArray(allSourcesData) ? allSourcesData : []);
        setNodes(Array.isArray(nodesData) ? nodesData : []);
        setEdges(Array.isArray(edgesData) ? edgesData : []);
        setCentrality(Array.isArray(centralityData) ? centralityData : []);
        setFeatureContributions(featureData);
        setEmergentStructures(emergentData);
        setCandidateCrossmatchResults(crossmatchData);
        setPossibleBinaryPairs(pairsData);
        setReport(reportText);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err?.message || String(err));
      }
    }

    loadDashboardData();
    return () => {
      cancelled = true;
    };
  }, []);

  const renderedReport = useMemo(() => renderMarkdown(report), [report]);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <div className="eyebrow">Local Scientific Interface</div>
          <h1>Codex Alpha Computational Framework</h1>
          <p>Local dashboard for exploratory analysis of multidimensional Gaia DR3 outputs.</p>
          <NavigationActions currentPage={currentPage} setCurrentPage={setCurrentPage} />
        </div>

        <div className="status-pill"><span className="status-dot" />Offline-first dashboard</div>
      </header>

      {error && (
        <section className="error-box">
          <strong>Dashboard runtime notice.</strong>
          <p>{error}</p>
          <button type="button" className="dashboard-nav-button" onClick={() => setCurrentPage("dashboard")}>Return to dashboard</button>
        </section>
      )}

      <PageErrorBoundary resetKey={currentPage}>
        <Suspense fallback={<LoadingPanel label="Loading Codex Alpha module" />}>
          {!error && currentPage === "advanced" && (
            <AdvancedAnalysisLayer setCurrentPage={setCurrentPage} allSources={allSources} featureContributions={featureContributions} emergentStructures={emergentStructures} graphCentrality={centrality} candidateCrossmatchResults={candidateCrossmatchResults} selectedNode={selectedNode} setSelectedNode={setSelectedNode} />
          )}

          {!error && currentPage === "dynamics" && (
            <AstrometricDynamicsLab allSources={allSources} graphCentrality={centrality} featureContributions={featureContributions} emergentStructures={emergentStructures} candidateCrossmatchResults={candidateCrossmatchResults} possibleBinaryPairs={possibleBinaryPairs} selectedSource={selectedNode} onSourceSelect={setSelectedNode} setCurrentPage={setCurrentPage} />
          )}

          {!error && currentPage === "validation" && (
            <CandidateInvestigationCockpit allSources={allSources} graphCentrality={centrality} featureContributions={featureContributions} emergentStructures={emergentStructures} candidateCrossmatchResults={candidateCrossmatchResults} possibleBinaryPairs={possibleBinaryPairs} selectedSource={selectedNode} onSourceSelect={setSelectedNode} setCurrentPage={setCurrentPage} />
          )}

          {!error && currentPage === "dashboard" && (
            <DashboardPage summary={summary} allSources={allSources} nodes={nodes} edges={edges} centrality={centrality} selectedNode={selectedNode} setSelectedNode={setSelectedNode} renderedReport={renderedReport} />
          )}
        </Suspense>
      </PageErrorBoundary>
    </main>
  );
}
