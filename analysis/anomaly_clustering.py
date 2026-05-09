"""
Codex Alpha Computational Framework
Anomaly Clustering Module

This module analyzes whether detected Gaia DR3 anomalous sources form
statistical families or emergent groups in multidimensional feature space.

The goal is not only to detect isolated anomalies, but to identify whether
anomalous sources share common structural patterns.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


INPUT_PATH = Path("results/gaia_dr3_feature_contributions.csv")
OUTPUT_PATH = Path("results/gaia_dr3_anomaly_clusters.csv")


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


def cluster_anomalies(
    input_path: Path = INPUT_PATH,
    output_path: Path = OUTPUT_PATH,
    n_clusters: int = 3,
) -> pd.DataFrame:
    """
    Cluster anomalous Gaia DR3 sources using multidimensional astrophysical features.

    Parameters
    ----------
    input_path:
        Path to the feature contribution CSV file.

    output_path:
        Path where clustered anomaly results will be saved.

    n_clusters:
        Number of anomaly families to identify.

    Returns
    -------
    pandas.DataFrame
        Anomalous sources with assigned cluster labels.
    """

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    df = pd.read_csv(input_path)

    required = set(FEATURE_COLUMNS + ["anomaly_label", "anomaly_score", "anomaly_rank"])
    missing = required - set(df.columns)

    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    anomalies = df[df["anomaly_label"] == -1].copy()

    if anomalies.empty:
        raise ValueError("No anomalous sources found in the input dataset.")

    if len(anomalies) < n_clusters:
        raise ValueError(
            f"Number of anomalies ({len(anomalies)}) is smaller than n_clusters ({n_clusters})."
        )

    features = anomalies[FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan)
    features = features.dropna()

    anomalies = anomalies.loc[features.index].copy()

    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(features)

    model = KMeans(
        n_clusters=n_clusters,
        random_state=42,
        n_init=20,
    )

    anomalies["anomaly_cluster"] = model.fit_predict(x_scaled)

    cluster_summary = (
        anomalies.groupby("anomaly_cluster")
        .agg(
            count=("SOURCE_ID", "count"),
            mean_anomaly_score=("anomaly_score", "mean"),
            max_anomaly_score=("anomaly_score", "max"),
            dominant_feature=("dominant_anomaly_feature", lambda x: x.mode().iloc[0]),
        )
        .reset_index()
        .sort_values(by="mean_anomaly_score", ascending=False)
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    anomalies.to_csv(output_path, index=False)

    print("\nAnomaly clustering completed.")
    print(f"Detected anomaly families: {n_clusters}")

    print("\nCluster summary:")
    print(cluster_summary)

    print(f"\nClustered anomaly results saved to: {output_path}")

    return anomalies


if __name__ == "__main__":
    cluster_anomalies()
