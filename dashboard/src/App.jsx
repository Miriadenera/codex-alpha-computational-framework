import React, { useEffect, useState } from "react";

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
  const [centrality, setCentrality] = useState([]);
  const [report, setReport] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const summaryData = await loadJson(`${DATA_BASE}/summary.json`);
        const centralityData = await loadJson(`${DATA_BASE}/graph_centrality.json`);
        const reportText = await loadText(`${DATA_BASE}/report.md`);

        setSummary(summaryData);
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
            Local dashboard for exploratory analysis of multidimensional Gaia DR3 outputs.
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
            Run <code>python -m pipeline.run_full_pipeline</code> from the repository root.
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
            <div className="panel graph-placeholder">
              <div className="panel-header">
                <h2>3D Relational Graph Viewer</h2>
                <span>Prototype UI</span>
              </div>

              <div className="orbital-preview">
                <div className="core-glow" />
                <div className="orbit orbit-a" />
                <div className="orbit orbit-b" />
                <div className="orbit orbit-c" />
              </div>

              <p>
                Interactive 3D graph rendering will be connected to local graph nodes and edges.
              </p>
            </div>

            <aside className="panel">
              <div className="panel-header">
                <h2>Top Structural Nodes</h2>
                <span>Graph centrality</span>
              </div>

              <div className="node-list">
                {topCentralSources.map((source) => (
                  <div className="node-row" key={source.SOURCE_ID}>
                    <div>
                      <strong>{source.SOURCE_ID}</strong>
                      <small>rank {source.structural_rank}</small>
                    </div>
                    <span>
                      {Number(source.structural_importance_score).toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
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
