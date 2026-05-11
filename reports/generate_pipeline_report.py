"""
Codex Alpha Computational Framework
Pipeline Report Generator

This module generates a complete automatic Markdown report from the outputs
of the full Gaia DR3 analysis pipeline.

The report is intentionally verbose and complete:
- all detected anomalous sources are included;
- all analyzed Gaia DR3 sample sources are included;
- numerical values are exported without scientific notation.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pandas as pd


RESULTS_DIR = Path("results")

ANOMALY_RESULTS = RESULTS_DIR / "gaia_dr3_anomaly_results.csv"
FEATURE_CONTRIBUTIONS = RESULTS_DIR / "gaia_dr3_feature_contributions.csv"
ANOMALY_CLUSTERS = RESULTS_DIR / "gaia_dr3_anomaly_clusters.csv"
EMERGENT_STRUCTURES = RESULTS_DIR / "gaia_dr3_emergent_structures.csv"
GRAPH_NODES = RESULTS_DIR / "gaia_dr3_graph_nodes.csv"
GRAPH_EDGES = RESULTS_DIR / "gaia_dr3_graph_edges.csv"
GRAPH_CENTRALITY = RESULTS_DIR / "gaia_dr3_graph_centrality.csv"

REPORT_OUTPUT = RESULTS_DIR / "gaia_dr3_pipeline_report.md"


def load_csv(path: Path) -> pd.DataFrame:
    """Load a CSV file and raise a clear error if it is missing."""
    if not path.exists():
        raise FileNotFoundError(f"Required pipeline output not found: {path}")

    return pd.read_csv(path)


def format_value(value: object, decimals: int = 6) -> str:
    """
    Format values for Markdown export.

    Scientific notation is deliberately avoided.
    SOURCE_ID-like identifiers are preserved as plain strings.
    Missing values are represented as N/A.
    """
    if pd.isna(value):
        return "N/A"

    if isinstance(value, float):
        return f"{value:.{decimals}f}"

    return str(value)


def format_dataframe_for_markdown(
    df: pd.DataFrame,
    columns: list[str],
    max_rows: int | None = None,
    decimals: int = 6,
) -> pd.DataFrame:
    """
    Select and format dataframe columns for Markdown output.

    If max_rows is None, the complete dataframe is exported.
    """
    available_columns = [column for column in columns if column in df.columns]

    if not available_columns:
        return pd.DataFrame({"message": ["No matching columns available."]})

    if max_rows is None:
        subset = df[available_columns].copy()
    else:
        subset = df[available_columns].head(max_rows).copy()

    for column in subset.columns:
        if "SOURCE_ID" in column or column in {
            "source_id",
            "target_id",
            "source_node",
            "target_node",
            "node_id",
        }:
            subset[column] = subset[column].map(lambda value: format_value(value))

        elif subset[column].dtype.kind in {"f"}:
            subset[column] = subset[column].map(
                lambda value: format_value(value, decimals=decimals)
            )

        else:
            subset[column] = subset[column].map(lambda value: format_value(value))

    return subset


def dataframe_to_markdown_table(
    df: pd.DataFrame,
    columns: list[str],
    max_rows: int | None = None,
    decimals: int = 6,
) -> str:
    """Convert selected dataframe columns to a Markdown table."""
    formatted = format_dataframe_for_markdown(
        df=df,
        columns=columns,
        max_rows=max_rows,
        decimals=decimals,
    )

    return formatted.to_markdown(index=False)


def generate_pipeline_report(
    output_path: Path = REPORT_OUTPUT,
) -> None:
    """Generate a complete Markdown report summarizing the current pipeline results."""

    anomalies = load_csv(ANOMALY_RESULTS)
    feature_contributions = load_csv(FEATURE_CONTRIBUTIONS)
    clusters = load_csv(ANOMALY_CLUSTERS)
    emergent = load_csv(EMERGENT_STRUCTURES)
    graph_nodes = load_csv(GRAPH_NODES)
    graph_edges = load_csv(GRAPH_EDGES)
    graph_centrality = load_csv(GRAPH_CENTRALITY)

    anomalous_sources = anomalies[anomalies["anomaly_label"] == -1].copy()
    normal_sources = anomalies[anomalies["anomaly_label"] != -1].copy()

    anomaly_count = len(anomalous_sources)
    normal_count = len(normal_sources)
    total_count = len(anomalies)

    cluster_summary = (
        clusters.groupby("anomaly_cluster")
        .agg(
            count=("SOURCE_ID", "count"),
            mean_anomaly_score=("anomaly_score", "mean"),
            max_anomaly_score=("anomaly_score", "max"),
        )
        .reset_index()
        .sort_values(
            by="mean_anomaly_score",
            ascending=False,
        )
    )

    cluster_summary_table = dataframe_to_markdown_table(
        cluster_summary,
        [
            "anomaly_cluster",
            "count",
            "mean_anomaly_score",
            "max_anomaly_score",
        ],
        max_rows=None,
    )

    all_anomalies_table = dataframe_to_markdown_table(
        anomalous_sources.sort_values(by="anomaly_rank", ascending=True),
        [
            "SOURCE_ID",
            "anomaly_rank",
            "anomaly_score",
            "anomaly_label",
            "ra",
            "dec",
            "parallax",
            "pmra",
            "pmdec",
            "phot_g_mean_mag",
            "phot_bp_mean_mag",
            "phot_rp_mean_mag",
            "bp_rp",
            "radial_velocity",
        ],
        max_rows=None,
    )

    feature_contribution_table = dataframe_to_markdown_table(
        feature_contributions.sort_values(by="anomaly_rank", ascending=True),
        [
            "SOURCE_ID",
            "anomaly_rank",
            "anomaly_score",
            "dominant_anomaly_feature",
            "dominant_feature_zscore",
        ],
        max_rows=None,
    )

    anomaly_cluster_table = dataframe_to_markdown_table(
        clusters.sort_values(by=["anomaly_cluster", "anomaly_rank"], ascending=True),
        [
            "SOURCE_ID",
            "anomaly_rank",
            "anomaly_score",
            "anomaly_cluster",
            "dominant_anomaly_feature",
        ],
        max_rows=None,
    )

    emergent_structures_table = dataframe_to_markdown_table(
        emergent.sort_values(by="emergent_structure_rank", ascending=True),
        [
            "SOURCE_ID",
            "anomaly_score",
            "local_density_score",
            "mean_neighbor_distance",
            "emergent_structure_rank",
        ],
        max_rows=None,
    )

    graph_nodes_table = dataframe_to_markdown_table(
        graph_nodes.sort_values(by="node_id", ascending=True),
        [
            "node_id",
            "SOURCE_ID",
            "ra",
            "dec",
            "parallax",
            "pmra",
            "pmdec",
            "radial_velocity",
            "anomaly_score",
            "anomaly_rank",
            "anomaly_cluster",
        ],
        max_rows=None,
    )

    graph_edges_table = dataframe_to_markdown_table(
        graph_edges.sort_values(by="similarity_weight", ascending=False),
        [
            "source_node",
            "target_node",
            "source_id",
            "target_id",
            "feature_distance",
            "similarity_weight",
        ],
        max_rows=None,
    )

    graph_centrality_table = dataframe_to_markdown_table(
        graph_centrality.sort_values(by="structural_rank", ascending=True),
        [
            "SOURCE_ID",
            "structural_rank",
            "degree_centrality",
            "betweenness_centrality",
            "closeness_centrality",
            "weighted_degree",
            "structural_importance_score",
        ],
        max_rows=None,
    )

    all_sources_table = dataframe_to_markdown_table(
        anomalies.sort_values(by="anomaly_rank", ascending=True),
        [
            "SOURCE_ID",
            "anomaly_rank",
            "anomaly_score",
            "anomaly_label",
            "ra",
            "dec",
            "parallax",
            "pmra",
            "pmdec",
            "phot_g_mean_mag",
            "phot_bp_mean_mag",
            "phot_rp_mean_mag",
            "bp_rp",
            "radial_velocity",
        ],
        max_rows=None,
    )

    report = f"""
# Gaia DR3 Full Pipeline Report

Generated on: {datetime.now(UTC).isoformat()}

---

# Overview

This report was automatically generated by the Codex Alpha Computational Framework.

The pipeline analyzes a real ESA Gaia DR3 sample dataset and performs:

1. multidimensional anomaly detection
2. feature contribution analysis
3. anomaly clustering
4. emergent structure detection
5. relational graph construction
6. graph centrality analysis
7. exploratory visualization generation
8. dashboard-ready data export

The current analysis is exploratory and does not constitute a claim of new physical discovery.

---

# Dataset Summary

Total analyzed sources: {total_count}

Detected anomalous sources: {anomaly_count}

Non-anomalous sources: {normal_count}

Anomaly ratio: {anomaly_count / total_count:.6f}

Graph nodes: {len(graph_nodes)}

Graph edges: {len(graph_edges)}

Detected anomaly clusters: {clusters["anomaly_cluster"].nunique()}

---

# Complete Detected Anomalous Sources

This table contains all sources classified as anomalous by the current unsupervised anomaly detection stage.

{all_anomalies_table}

---

# Complete Feature Contribution Results

This table lists the dominant feature contribution associated with each detected anomalous source.

{feature_contribution_table}

---

# Anomaly Cluster Summary

{cluster_summary_table}

---

# Complete Anomaly Cluster Assignments

{anomaly_cluster_table}

---

# Complete Emergent Local Structure Candidates

This table reports local density indicators for all anomalous sources.

{emergent_structures_table}

---

# Relational Graph Summary

The relational graph represents anomalous Gaia DR3 sources as nodes and multidimensional similarity relationships as edges.

Graph nodes: {len(graph_nodes)}

Graph edges: {len(graph_edges)}

---

# Complete Graph Nodes

{graph_nodes_table}

---

# Complete Graph Edges

{graph_edges_table}

---

# Complete Graph Centrality Results

{graph_centrality_table}

---

# Complete Gaia DR3 Sample Source Table

This table contains all analyzed Gaia DR3 sample sources currently present in the pipeline output.

{all_sources_table}

---

# Generated Output Files

- results/gaia_dr3_anomaly_results.csv
- results/gaia_dr3_feature_contributions.csv
- results/gaia_dr3_anomaly_clusters.csv
- results/gaia_dr3_emergent_structures.csv
- results/gaia_dr3_graph_nodes.csv
- results/gaia_dr3_graph_edges.csv
- results/gaia_dr3_graph_centrality.csv
- results/gaia_dr3_anomaly_sky_plot.png
- results/gaia_dr3_relational_graph.png
- results/gaia_dr3_pipeline_report.md

---

# Interpretation Note

Higher anomaly scores indicate statistically rarer sources within the analyzed multidimensional feature space.

Higher local density scores indicate anomalous sources located near other anomalous sources in the standardized multidimensional feature space.

Higher structural importance scores indicate sources that occupy more relevant positions inside the relational graph.

The relational graph is not a direct Gaia sky map. It is an exploratory similarity graph derived from multidimensional astrophysical features.

These values are exploratory computational indicators and require additional astrophysical validation before any physical interpretation.
"""

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path.write_text(
        report.strip() + "\n",
        encoding="utf-8",
    )

    print(f"Pipeline report generated: {output_path}")


if __name__ == "__main__":
    generate_pipeline_report()
