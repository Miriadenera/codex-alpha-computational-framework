"""
Codex Alpha Computational Framework
Emergent Structure Detection Module

This module analyzes whether detected anomalous Gaia DR3 sources show
non-random spatial or multidimensional grouping behavior.

The goal is to move beyond isolated anomaly detection and begin exploring
whether anomalies form local emergent structures inside the analyzed dataset.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler


INPUT_PATH = Path("results/gaia_dr3_anomaly_clusters.csv")
OUTPUT_PATH = Path("results/gaia_dr3_emergent_structures.csv")


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


def detect_emergent_structures(
    input_path: Path = INPUT_PATH,
    output_path: Path = OUTPUT_PATH,
    n_neighbors: int = 5,
) -> pd.DataFrame:
    """
    Detect local emergent structures among anomalous Gaia DR3 sources.

    The method computes nearest-neighbor relationships in standardized
    multidimensional astrophysical feature space.

    Parameters
    ----------
    input_path:
        Path to clustered anomaly results.

    output_path:
        Output CSV file.

    n_neighbors:
        Number of nearest neighbors used to estimate local structure density.

    Returns
    -------
    pandas.DataFrame
        Anomalous sources enriched with local structure metrics.
    """

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    df = pd.read_csv(input_path)

    required = set(FEATURE_COLUMNS + ["SOURCE_ID", "anomaly_score", "anomaly_rank"])
    missing = required - set(df.columns)

    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    anomalies = df.copy()

    if len(anomalies) <= n_neighbors:
        raise ValueError(
            f"Not enough anomalous sources ({len(anomalies)}) "
            f"for n_neighbors={n_neighbors}."
        )

    features = anomalies[FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan)
    features = features.dropna()

    anomalies = anomalies.loc[features.index].copy()

    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(features)

    neighbors = NearestNeighbors(
        n_neighbors=n_neighbors + 1,
        metric="euclidean",
    )

    neighbors.fit(x_scaled)

    distances, indices = neighbors.kneighbors(x_scaled)

    # Remove self-distance at index 0
    neighbor_distances = distances[:, 1:]
    neighbor_indices = indices[:, 1:]

    local_density_score = 1.0 / (neighbor_distances.mean(axis=1) + 1e-12)

    anomalies["local_density_score"] = local_density_score
    anomalies["mean_neighbor_distance"] = neighbor_distances.mean(axis=1)
    anomalies["nearest_neighbor_ids"] = [
        ",".join(str(anomalies.iloc[idx]["SOURCE_ID"]) for idx in row)
        for row in neighbor_indices
    ]

    anomalies = anomalies.sort_values(
        by="local_density_score",
        ascending=False,
    ).reset_index(drop=True)

    anomalies["emergent_structure_rank"] = anomalies.index + 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    anomalies.to_csv(output_path, index=False)

    print("\nEmergent structure detection completed.")

    print("\nTop 10 local emergent structure candidates:")
    print(
        anomalies[
            [
                "SOURCE_ID",
                "anomaly_score",
                "local_density_score",
                "mean_neighbor_distance",
                "emergent_structure_rank",
            ]
        ].head(10)
    )

    print(f"\nEmergent structure results saved to: {output_path}")

    return anomalies


if __name__ == "__main__":
    detect_emergent_structures()
