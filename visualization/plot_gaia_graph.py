"""
Codex Alpha Computational Framework
Gaia DR3 Relational Graph Visualization

This module visualizes the relational graph built from anomalous Gaia DR3 sources.

Nodes represent anomalous astrophysical sources.
Edges represent multidimensional similarity between sources.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt


NODES_PATH = Path("results/gaia_dr3_graph_nodes.csv")
EDGES_PATH = Path("results/gaia_dr3_graph_edges.csv")
OUTPUT_PATH = Path("results/gaia_dr3_relational_graph.png")


def plot_gaia_graph(
    nodes_path: Path = NODES_PATH,
    edges_path: Path = EDGES_PATH,
    output_path: Path = OUTPUT_PATH,
) -> None:
    """
    Generate a relational graph projection in RA/DEC space.
    """

    if not nodes_path.exists():
        raise FileNotFoundError(f"Nodes file not found: {nodes_path}")

    if not edges_path.exists():
        raise FileNotFoundError(f"Edges file not found: {edges_path}")

    nodes = pd.read_csv(nodes_path)
    edges = pd.read_csv(edges_path)

    required_node_columns = {"node_id", "SOURCE_ID", "ra", "dec", "anomaly_score"}
    required_edge_columns = {
        "source_node",
        "target_node",
        "feature_distance",
        "similarity_weight",
    }

    missing_nodes = required_node_columns - set(nodes.columns)
    missing_edges = required_edge_columns - set(edges.columns)

    if missing_nodes:
        raise ValueError(f"Missing node columns: {missing_nodes}")

    if missing_edges:
        raise ValueError(f"Missing edge columns: {missing_edges}")

    node_lookup = nodes.set_index("node_id")

    plt.figure(figsize=(11, 8))

    # Draw graph edges
    for _, edge in edges.iterrows():
        source = int(edge["source_node"])
        target = int(edge["target_node"])

        if source not in node_lookup.index or target not in node_lookup.index:
            continue

        source_row = node_lookup.loc[source]
        target_row = node_lookup.loc[target]

        weight = float(edge["similarity_weight"])

        plt.plot(
            [source_row["ra"], target_row["ra"]],
            [source_row["dec"], target_row["dec"]],
            linewidth=max(0.3, min(weight, 1.5)),
            alpha=0.25,
        )

    # Draw graph nodes
    plt.scatter(
        nodes["ra"],
        nodes["dec"],
        s=40 + nodes["anomaly_score"] * 120,
        alpha=0.9,
        label="Anomalous sources",
    )

    plt.xlabel("Right Ascension [deg]")
    plt.ylabel("Declination [deg]")
    plt.title("Gaia DR3 Relational Graph of Anomalous Sources")
    plt.grid(True, alpha=0.25)
    plt.legend()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path, dpi=220, bbox_inches="tight")
    plt.close()

    print(f"Relational graph visualization saved to: {output_path}")


if __name__ == "__main__":
    plot_gaia_graph()
