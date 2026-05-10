"""
Codex Alpha Computational Framework
Dashboard Data Exporter

This module converts pipeline CSV and Markdown outputs into local JSON files
that can be consumed by the interactive dashboard without external APIs.

The dashboard remains local-first and offline-ready.
"""

from __future__ import annotations

from pathlib import Path
import json

import pandas as pd


RESULTS_DIR = Path("results")
DASHBOARD_DATA_DIR = Path("dashboard/public/data")

ANOMALY_RESULTS = RESULTS_DIR / "gaia_dr3_anomaly_results.csv"
FEATURE_CONTRIBUTIONS = RESULTS_DIR / "gaia_dr3_feature_contributions.csv"
ANOMALY_CLUSTERS = RESULTS_DIR / "gaia_dr3_anomaly_clusters.csv"
EMERGENT_STRUCTURES = RESULTS_DIR / "gaia_dr3_emergent_structures.csv"
GRAPH_NODES = RESULTS_DIR / "gaia_dr3_graph_nodes.csv"
GRAPH_EDGES = RESULTS_DIR / "gaia_dr3_graph_edges.csv"
GRAPH_CENTRALITY = RESULTS_DIR / "gaia_dr3_graph_centrality.csv"
PIPELINE_REPORT = RESULTS_DIR / "gaia_dr3_pipeline_report.md"

SUMMARY_OUTPUT = DASHBOARD_DATA_DIR / "summary.json"
ANOMALIES_OUTPUT = DASHBOARD_DATA_DIR / "anomalies.json"
FEATURES_OUTPUT = DASHBOARD_DATA_DIR / "feature_contributions.json"
CLUSTERS_OUTPUT = DASHBOARD_DATA_DIR / "clusters.json"
EMERGENT_OUTPUT = DASHBOARD_DATA_DIR / "emergent_structures.json"
GRAPH_NODES_OUTPUT = DASHBOARD_DATA_DIR / "graph_nodes.json"
GRAPH_EDGES_OUTPUT = DASHBOARD_DATA_DIR / "graph_edges.json"
CENTRALITY_OUTPUT = DASHBOARD_DATA_DIR / "graph_centrality.json"
REPORT_OUTPUT = DASHBOARD_DATA_DIR / "report.md"


def load_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Required file not found: {path}")

    df = pd.read_csv(path)

    if "SOURCE_ID" in df.columns:
        df["SOURCE_ID"] = df["SOURCE_ID"].astype(str)

    if "source_id" in df.columns:
        df["source_id"] = df["source_id"].astype(str)

    if "target_id" in df.columns:
        df["target_id"] = df["target_id"].astype(str)

    return df


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)


def dataframe_to_records(df: pd.DataFrame) -> list[dict]:
    return df.where(pd.notnull(df), None).to_dict(orient="records")


def export_dashboard_data() -> None:
    anomalies = load_csv(ANOMALY_RESULTS)
    feature_contributions = load_csv(FEATURE_CONTRIBUTIONS)
    clusters = load_csv(ANOMALY_CLUSTERS)
    emergent_structures = load_csv(EMERGENT_STRUCTURES)
    graph_nodes = load_csv(GRAPH_NODES)
    graph_edges = load_csv(GRAPH_EDGES)
    graph_centrality = load_csv(GRAPH_CENTRALITY)

    DASHBOARD_DATA_DIR.mkdir(parents=True, exist_ok=True)

    total_sources = int(len(anomalies))
    anomalous_sources = int((anomalies["anomaly_label"] == -1).sum())

    cluster_count = (
        int(clusters["anomaly_cluster"].nunique())
        if "anomaly_cluster" in clusters.columns
        else 0
    )

    summary = {
        "project": "Codex Alpha Computational Framework",
        "dataset": "ESA Gaia DR3 sample",
        "total_sources": total_sources,
        "anomalous_sources": anomalous_sources,
        "anomaly_ratio": anomalous_sources / total_sources if total_sources else 0,
        "cluster_count": cluster_count,
        "graph_nodes": int(len(graph_nodes)),
        "graph_edges": int(len(graph_edges)),
        "has_report": PIPELINE_REPORT.exists(),
        "description": (
            "Local dashboard data package generated from the Codex Alpha "
            "Computational Framework pipeline outputs."
        ),
    }

    write_json(SUMMARY_OUTPUT, summary)
    write_json(ANOMALIES_OUTPUT, dataframe_to_records(anomalies))
    write_json(FEATURES_OUTPUT, dataframe_to_records(feature_contributions))
    write_json(CLUSTERS_OUTPUT, dataframe_to_records(clusters))
    write_json(EMERGENT_OUTPUT, dataframe_to_records(emergent_structures))
    write_json(GRAPH_NODES_OUTPUT, dataframe_to_records(graph_nodes))
    write_json(GRAPH_EDGES_OUTPUT, dataframe_to_records(graph_edges))
    write_json(CENTRALITY_OUTPUT, dataframe_to_records(graph_centrality))

    if PIPELINE_REPORT.exists():
        REPORT_OUTPUT.write_text(
            PIPELINE_REPORT.read_text(encoding="utf-8"),
            encoding="utf-8",
        )

    print("Dashboard data export completed.")
    print(f"Data directory: {DASHBOARD_DATA_DIR}")
    print("Generated files:")
    print(f" - {SUMMARY_OUTPUT}")
    print(f" - {ANOMALIES_OUTPUT}")
    print(f" - {FEATURES_OUTPUT}")
    print(f" - {CLUSTERS_OUTPUT}")
    print(f" - {EMERGENT_OUTPUT}")
    print(f" - {GRAPH_NODES_OUTPUT}")
    print(f" - {GRAPH_EDGES_OUTPUT}")
    print(f" - {CENTRALITY_OUTPUT}")
    print(f" - {REPORT_OUTPUT}")


if __name__ == "__main__":
    export_dashboard_data()
