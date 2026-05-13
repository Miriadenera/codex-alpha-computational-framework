"""
Codex Alpha Computational Framework
Dashboard Data Exporter

This module converts pipeline CSV and Markdown outputs into local JSON files
that can be consumed by the interactive dashboard without external APIs.

The dashboard remains local-first and offline-ready.

Important scientific-data policy:
- This exporter does not intentionally round scientific numeric values.
- Compact visual rounding must happen only in the frontend display layer.
- Gaia SOURCE_ID-like identifiers are preserved as strings.
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

IDENTIFIER_COLUMNS = [
    "SOURCE_ID",
    "source_id",
    "target_id",
    "node_id",
    "source_node",
    "target_node",
]


def load_csv(path: Path) -> pd.DataFrame:
    """
    Load a pipeline CSV file while preserving floating-point values as
    faithfully as possible.

    Pandas' float_precision='round_trip' helps avoid unnecessary float
    representation changes during CSV parsing.
    """

    if not path.exists():
        raise FileNotFoundError(f"Required file not found: {path}")

    df = pd.read_csv(
        path,
        float_precision="round_trip",
    )

    for column in IDENTIFIER_COLUMNS:
        if column in df.columns:
            df[column] = df[column].astype(str)

    return df


def dataframe_to_records(df: pd.DataFrame) -> list[dict]:
    """
    Convert a dataframe to JSON-safe records.

    Numeric values are not rounded here. The frontend may decide whether to
    display compact values or full scientific precision.
    """

    clean_df = df.where(pd.notnull(df), None)

    return clean_df.to_dict(orient="records")


def write_json(path: Path, data: object) -> None:
    """
    Write JSON output with stable UTF-8 encoding.

    Note:
    Python's json module preserves numeric values passed from pandas records.
    It does not apply display rounding.
    """

    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(
            data,
            file,
            indent=2,
            ensure_ascii=False,
            allow_nan=False,
        )


def copy_report() -> None:
    """
    Copy the generated Markdown pipeline report into the dashboard data folder.
    """

    if not PIPELINE_REPORT.exists():
        return

    REPORT_OUTPUT.write_text(
        PIPELINE_REPORT.read_text(encoding="utf-8"),
        encoding="utf-8",
    )


def build_summary(
    anomalies: pd.DataFrame,
    clusters: pd.DataFrame,
    graph_nodes: pd.DataFrame,
    graph_edges: pd.DataFrame,
) -> dict:
    """
    Build a compact dashboard summary.
    """

    total_sources = int(len(anomalies))

    anomalous_sources = (
        int((anomalies["anomaly_label"] == -1).sum())
        if "anomaly_label" in anomalies.columns
        else 0
    )

    cluster_count = (
        int(clusters["anomaly_cluster"].nunique())
        if "anomaly_cluster" in clusters.columns
        else 0
    )

    anomaly_ratio = (
        anomalous_sources / total_sources
        if total_sources
        else 0
    )

    return {
        "project": "Codex Alpha Computational Framework",
        "dataset": "ESA Gaia DR3 sample",
        "total_sources": total_sources,
        "anomalous_sources": anomalous_sources,
        "anomaly_ratio": anomaly_ratio,
        "cluster_count": cluster_count,
        "graph_nodes": int(len(graph_nodes)),
        "graph_edges": int(len(graph_edges)),
        "has_report": PIPELINE_REPORT.exists(),
        "numeric_precision_policy": (
            "Scientific numeric values are exported without intentional "
            "rounding. Display precision is handled by the frontend."
        ),
        "description": (
            "Local dashboard data package generated from the Codex Alpha "
            "Computational Framework pipeline outputs."
        ),
    }


def export_dashboard_data() -> None:
    """
    Export all pipeline outputs required by the dashboard.
    """

    anomalies = load_csv(ANOMALY_RESULTS)
    feature_contributions = load_csv(FEATURE_CONTRIBUTIONS)
    clusters = load_csv(ANOMALY_CLUSTERS)
    emergent_structures = load_csv(EMERGENT_STRUCTURES)
    graph_nodes = load_csv(GRAPH_NODES)
    graph_edges = load_csv(GRAPH_EDGES)
    graph_centrality = load_csv(GRAPH_CENTRALITY)

    DASHBOARD_DATA_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    summary = build_summary(
        anomalies=anomalies,
        clusters=clusters,
        graph_nodes=graph_nodes,
        graph_edges=graph_edges,
    )

    outputs = [
        (SUMMARY_OUTPUT, summary),
        (ANOMALIES_OUTPUT, dataframe_to_records(anomalies)),
        (FEATURES_OUTPUT, dataframe_to_records(feature_contributions)),
        (CLUSTERS_OUTPUT, dataframe_to_records(clusters)),
        (EMERGENT_OUTPUT, dataframe_to_records(emergent_structures)),
        (GRAPH_NODES_OUTPUT, dataframe_to_records(graph_nodes)),
        (GRAPH_EDGES_OUTPUT, dataframe_to_records(graph_edges)),
        (CENTRALITY_OUTPUT, dataframe_to_records(graph_centrality)),
    ]

    for output_path, payload in outputs:
        write_json(output_path, payload)

    copy_report()

    print("Dashboard data export completed.")
    print(f"Data directory: {DASHBOARD_DATA_DIR}")
    print("Generated files:")

    for output_path, _ in outputs:
        print(f" - {output_path}")

    print(f" - {REPORT_OUTPUT}")


if __name__ == "__main__":
    export_dashboard_data()