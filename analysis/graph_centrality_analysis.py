"""
Codex Alpha Computational Framework
Graph Centrality Analysis Module

This module analyzes the relational graph built from Gaia DR3 anomalous sources.

The goal is to identify structurally important anomalous sources inside the
relational graph, such as hub nodes and bridge-like nodes.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import networkx as nx


NODES_PATH = Path("results/gaia_dr3_graph_nodes.csv")
EDGES_PATH = Path("results/gaia_dr3_graph_edges.csv")
OUTPUT_PATH = Path("results/gaia_dr3_graph_centrality.csv")


def build_graph(nodes: pd.DataFrame, edges: pd.DataFrame) -> nx.Graph:
    """
    Build an undirected NetworkX graph from nodes and edges.
    """

    graph = nx.Graph()

    for _, row in nodes.iterrows():
        graph.add_node(
            int(row["node_id"]),
            source_id=row["SOURCE_ID"],
            anomaly_score=row.get("anomaly_score", None),
            ra=row.get("ra", None),
            dec=row.get("dec", None),
        )

    for _, row in edges.iterrows():
        graph.add_edge(
            int(row["source_node"]),
            int(row["target_node"]),
            weight=float(row["similarity_weight"]),
            feature_distance=float(row["feature_distance"]),
        )

    return graph


def compute_graph_centrality(
    nodes_path: Path = NODES_PATH,
    edges_path: Path = EDGES_PATH,
    output_path: Path = OUTPUT_PATH,
) -> pd.DataFrame:
    """
    Compute graph centrality metrics for anomalous Gaia DR3 sources.
    """

    if not nodes_path.exists():
        raise FileNotFoundError(f"Nodes file not found: {nodes_path}")

    if not edges_path.exists():
        raise FileNotFoundError(f"Edges file not found: {edges_path}")

    nodes = pd.read_csv(nodes_path)
    edges = pd.read_csv(edges_path)

    required_node_columns = {"node_id", "SOURCE_ID"}
    required_edge_columns = {"source_node", "target_node", "similarity_weight"}

    missing_nodes = required_node_columns - set(nodes.columns)
    missing_edges = required_edge_columns - set(edges.columns)

    if missing_nodes:
        raise ValueError(f"Missing node columns: {missing_nodes}")

    if missing_edges:
        raise ValueError(f"Missing edge columns: {missing_edges}")

    graph = build_graph(nodes, edges)

    degree_centrality = nx.degree_centrality(graph)
    betweenness_centrality = nx.betweenness_centrality(
        graph,
        weight="feature_distance",
        normalized=True,
    )
    closeness_centrality = nx.closeness_centrality(
        graph,
        distance="feature_distance",
    )

    weighted_degree = dict(graph.degree(weight="weight"))

    result = nodes.copy()

    result["degree_centrality"] = result["node_id"].map(degree_centrality)
    result["betweenness_centrality"] = result["node_id"].map(betweenness_centrality)
    result["closeness_centrality"] = result["node_id"].map(closeness_centrality)
    result["weighted_degree"] = result["node_id"].map(weighted_degree)

    result["structural_importance_score"] = (
        result["degree_centrality"].fillna(0)
        + result["betweenness_centrality"].fillna(0)
        + result["closeness_centrality"].fillna(0)
    )

    result = result.sort_values(
        by="structural_importance_score",
        ascending=False,
    ).reset_index(drop=True)

    result["structural_rank"] = result.index + 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(output_path, index=False)

    print("\nGraph centrality analysis completed.")
    print(f"Nodes analyzed: {graph.number_of_nodes()}")
    print(f"Edges analyzed: {graph.number_of_edges()}")

    print("\nTop 10 structurally important anomalous sources:")
    print(
        result[
            [
                "SOURCE_ID",
                "structural_rank",
                "degree_centrality",
                "betweenness_centrality",
                "closeness_centrality",
                "weighted_degree",
                "structural_importance_score",
            ]
        ].head(10)
    )

    print(f"\nGraph centrality results saved to: {output_path}")

    return result


if __name__ == "__main__":
    compute_graph_centrality()
