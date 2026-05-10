import { useEffect, useState } from "react";
import { Activity, Database, Network, FileText, Orbit } from "lucide-react";

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

function MetricCard({ icon: Icon, label, value, subtitle }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">
        <Icon size={22} />
      </div>
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
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [
          summaryData,
          nodesData,
          edgesData,
          centralityData,
          reportText,
        ] = await Promise.all([
          loadJson(`${DATA_BASE}/summary.json`),
          loadJson(`${DATA_BASE}/graph_nodes.json`),
          loadJson(`${DATA_BASE}/graph_edges.json`),
          loadJson(`${DATA_BASE}/graph_centrality.json`),
          loadText(`${DATA_BASE}/report.md`),
        ]);

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
            AI-assisted exploratory analysis of multidimensional astrophysical
            datasets.
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
            repository root to generate dashboard data.
          </p>
        </section>
      )}

      {!error && (
        <>
          <section className="metrics-grid">
            <MetricCard
              icon={Database}
              label="Dataset"
              value={summary?.dataset ?? "Loading"}
              subtitle="Local exported package"
            />

            <MetricCard
              icon={Activity}
              label="Sources"
              value={summary?.total_sources ?? "..."}
              subtitle="Total analyzed"
            />

            <MetricCard
              icon={Orbit}
              label="Anomalies"
              value={summary?.anomalous_sources ?? "..."}
              subtitle="Detected sources"
            />

            <MetricCard
              icon={Network}
              label="Graph"
              value={`${summary?.graph_nodes ?? "..."} nodes`}
              subtitle={`${summary?.graph_edges ?? "..."} edges`}
            />
          </section>

          <section className="main-grid">
            <div className="panel graph-placeholder">
              <div className="panel-header">
                <h2>3D Relational Graph Viewer</h2>
                <span>Coming next</span>
              </div>

              <div className="orbital-preview">
                <div className="core-glow" />
                <div className="orbit orbit-a" />
                <div className="orbit orbit-b" />
                <div className="orbit orbit-c" />
              </div>

              <p>
                The next dashboard layer will render the Gaia DR3 relational
                graph interactively in 3D using local exported graph nodes and
                edges.
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
              <h2>
                <FileText size={20} />
                Automatic Pipeline Report
              </h2>
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
