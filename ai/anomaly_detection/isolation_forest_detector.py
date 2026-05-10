"""
Codex Alpha Computational Framework
Isolation Forest Anomaly Detector

This module provides the core AI-assisted unsupervised anomaly detection engine
used inside the Codex Alpha Computational Framework.
"""

from __future__ import annotations

import pandas as pd

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


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


def run_isolation_forest(
    dataframe: pd.DataFrame,
    contamination: float = 0.05,
    random_state: int = 42,
) -> pd.DataFrame:
    """
    Execute unsupervised anomaly detection on Gaia DR3 features.

    Parameters
    ----------
    dataframe:
        Input astrophysical dataset.

    contamination:
        Expected anomaly fraction.

    random_state:
        Deterministic random seed.

    Returns
    -------
    pandas.DataFrame
        Original dataframe enriched with:
        - anomaly_score
        - anomaly_label
        - anomaly_rank
    """

    df = dataframe.copy()

    features = df[FEATURE_COLUMNS]

    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(features)

    model = IsolationForest(
        contamination=contamination,
        random_state=random_state,
    )

    model.fit(x_scaled)

    scores = -model.score_samples(x_scaled)
    labels = model.predict(x_scaled)

    df["anomaly_score"] = scores
    df["anomaly_label"] = labels

    df = df.sort_values(
        by="anomaly_score",
        ascending=False,
    ).reset_index(drop=True)

    df["anomaly_rank"] = df.index + 1

    return df
