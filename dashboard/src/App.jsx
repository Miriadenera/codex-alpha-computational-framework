import React, { useEffect, useState } from "react";
import Graph3DViewer from "./components/Graph3DViewer.jsx";

const DATA_BASE = "/data";

async function loadJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Unable to load ${path}`);
  }

  return response.json();
}

async function loadText(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Unable to load ${path}`);
  }

  return response.text();
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

function App() {
  const [summary, setSummary] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [centrality, setCentrality] = useState([]);
  const [report, setReport] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const summaryData = await loadJson(`${DATA_BASE}/summary.json`);
        const nodesData = await loadJson(`${DATA_BASE}/graph_nodes.json`);
        const edgesData = await loadJson(`${DATA_BASE}/graph_edges.json`);
        const centralityData = await loadJson(
          `${DATA_BASE}/graph_centrality.json`,
        );
        const reportText = await loadText(`${DATA_BASE}/report.md`);

        setSummary(summaryData);
        setNodes(nodesData);
        setEdges(edgesData);
        setCentrality(centralityData);
        setReport(reportText);
      } catch (err) {
        setError(err.message);
      }
    }

    loadDashboardData();
  }, []);

  const topCentralSources = centrality.slice(0, 5);

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

      {!error && (
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
              value={`${summary?.graph_nodes ?? "..."} nodes`}
              subtitle={`${summary?.graph_edges ?? "..."} edges`}
            />
          </section>

          <section className="main-grid">
            <div className="panel graph-panel">
              <div className="panel-header">
                <h2>3D Relational Graph Viewer</h2>
                <span>Interactive local graph</span>
              </div>

              <Graph3DViewer
                nodes={nodes}
                edges={edges}
                centrality={centrality}
                onNodeSelect={setSelectedNode}
              />
            </div>

            <aside className="panel">
              <div className="panel-header">
                <h2>Top Structural Nodes</h2>
                <span>Graph centrality</span>
              </div>

              <div className="node-list">
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
                      {Number(source.structural_importance_score).toFixed(4)}
                    </span>
                  </button>
                ))}
              </div>

              {selectedNode && (
                <div className="details-card">
                  <div className="panel-header">
                    <h2>Selected Source</h2>
                    <span>Inspection</span>
                  </div>

                  <div className="details-list">
                    <p>
                      <span>SOURCE_ID</span>
                      <strong>
                        {selectedNode.source_id ?? selectedNode.SOURCE_ID}
                      </strong>
                    </p>

                    <p>
                      <span>Structural rank</span>
                      <strong>{selectedNode.structural_rank ?? "N/A"}</strong>
                    </p>

                    <p>
                      <span>Structural importance</span>
                      <strong>
                        {Number(
                          selectedNode.structural_importance_score ?? 0,
                        ).toFixed(6)}
                      </strong>
                    </p>

                    <p>
                      <span>Anomaly score</span>
                      <strong>
                        {Number(selectedNode.anomaly_score ?? 0).toFixed(6)}
                      </strong>
                    </p>

                    <p>
                      <span>Radial velocity</span>
                      <strong>{selectedNode.radial_velocity ?? "N/A"}</strong>
                    </p>
                  </div>
                </div>
              )}
            </aside>
          </section>

          <section className="panel report-panel">
            <div className="panel-header">
              <h2>Automatic Pipeline Report</h2>
              <span>Markdown export</span>
            </div>

            <pre>{report.slice(0, 5000)}</pre>
          </section>
        </>
      )}
    </main>
  );
}

export default App;
