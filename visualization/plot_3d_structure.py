"""
Codex Alpha Computational Framework
3D Structure Visualization Module

This module generates a 3D PCA projection of Gaia DR3 anomalous sources
using multidimensional astrophysical features.

The goal is to visualize emergent structures, clusters and relational
patterns inside the anomaly feature space.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler


INPUT_PATH = Path("results/gaia_dr3_graph_centrality.csv")
OUTPUT_PATH = Path("results/gaia_dr3_3d_structure.png")


FEATURE_COLUMNS = [
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
]


def plot_3d_structure(
    input_path: Path = INPUT_PATH,
    output_path: Path = OUTPUT_PATH,
) -> None:
    """
    Generate a 3D PCA projection of anomalous Gaia DR3 sources.
    """

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    df = pd.read_csv(input_path)

    missing = [col for col in FEATURE_COLUMNS if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required feature columns: {missing}")

    features = df[FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan)
    features = features.dropna()

    data = df.loc[features.index].copy()

    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(features)

    pca = PCA(n_components=3, random_state=42)
    projection = pca.fit_transform(x_scaled)

    data["pca_1"] = projection[:, 0]
    data["pca_2"] = projection[:, 1]
    data["pca_3"] = projection[:, 2]

    fig = plt.figure(figsize=(11, 8))
    ax = fig.add_subplot(111, projection="3d")

    sizes = 40 + data["anomaly_score"].fillna(0) * 140

    if "structural_importance_score" in data.columns:
        colors = data["structural_importance_score"]
        color_label = "Structural importance"
    else:
        colors = data["anomaly_score"]
        color_label = "Anomaly score"

    scatter = ax.scatter(
        data["pca_1"],
        data["pca_2"],
        data["pca_3"],
        s=sizes,
        c=colors,
        alpha=0.85,
    )

    ax.set_xlabel("PCA Component 1")
    ax.set_ylabel("PCA Component 2")
    ax.set_zlabel("PCA Component 3")

    ax.set_title("Gaia DR3 3D Structure Projection of Anomalous Sources")

    colorbar = fig.colorbar(scatter, ax=ax, pad=0.12)
    colorbar.set_label(color_label)

    explained = pca.explained_variance_ratio_

    text = (
        f"Explained variance: "
        f"PC1={explained[0]:.2%}, "
        f"PC2={explained[1]:.2%}, "
        f"PC3={explained[2]:.2%}"
    )

    fig.text(0.5, 0.03, text, ha="center")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path, dpi=220, bbox_inches="tight")
    plt.close()

    print(f"3D structure visualization saved to: {output_path}")


if __name__ == "__main__":
    plot_3d_structure()
