"""
Codex Alpha Computational Framework
Unsupervised Anomaly Detection Module

This module implements the first neutral computational layer of the framework.

Goal:
    Detect non-trivial anomalies and emergent patterns in astrophysical or
    cosmological datasets without imposing a predefined theoretical structure.

This is intentionally model-agnostic:
    - no Codex Alpha-specific assumption is imposed at this stage
    - no coherence-gradient hypothesis is forced
    - no target pattern is predefined

The output is a ranked list of anomalous sources that can later be interpreted
through physical, statistical, topological, or Codex Alpha-specific metrics.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


@dataclass
class AnomalyDetectionResult:
    """
    Container for anomaly detection output.
    """

    data: pd.DataFrame
    feature_columns: list[str]
    score_column: str = "anomaly_score"
    rank_column: str = "anomaly_rank"


class UnsupervisedAnomalyDetector:
    """
    Model-agnostic anomaly detector for cosmological datasets.

    The detector uses numerical features only and applies an unsupervised
    Isolation Forest model to identify sources that differ statistically from
    the dominant population.

    This module represents the first neutral layer of the Codex Alpha
    Computational Framework.
    """

    def __init__(
        self,
        contamination: float = 0.05,
        random_state: int = 42,
        n_estimators: int = 300,
    ) -> None:
        """
        Parameters
        ----------
        contamination:
            Expected fraction of anomalous points in the dataset.

        random_state:
            Random seed for reproducibility.

        n_estimators:
            Number of trees used by Isolation Forest.
        """

        self.contamination = contamination
        self.random_state = random_state
        self.n_estimators = n_estimators
        self.scaler = StandardScaler()
        self.model = IsolationForest(
            n_estimators=n_estimators,
            contamination=contamination,
            random_state=random_state,
        )

    @staticmethod
    def select_numeric_features(
        df: pd.DataFrame,
        exclude_columns: Optional[Iterable[str]] = None,
    ) -> list[str]:
        """
        Select numerical columns suitable for anomaly detection.

        Parameters
        ----------
        df:
            Input dataframe.

        exclude_columns:
            Optional columns to exclude, such as names, IDs, labels or metadata.

        Returns
        -------
        list[str]
            Numerical feature columns.
        """

        exclude = set(exclude_columns or [])

        numeric_columns = [
            col
            for col in df.select_dtypes(include=[np.number]).columns
            if col not in exclude
        ]

        if not numeric_columns:
            raise ValueError("No numerical features found for anomaly detection.")

        return numeric_columns

    def fit_predict(
        self,
        df: pd.DataFrame,
        feature_columns: Optional[list[str]] = None,
        exclude_columns: Optional[Iterable[str]] = None,
    ) -> AnomalyDetectionResult:
        """
        Run unsupervised anomaly detection on a dataset.

        Parameters
        ----------
        df:
            Input astrophysical or cosmological catalogue.

        feature_columns:
            Optional explicit feature list. If None, numerical columns are selected.

        exclude_columns:
            Optional columns excluded from automatic feature selection.

        Returns
        -------
        AnomalyDetectionResult
            Dataset with anomaly scores and ranking.
        """

        if feature_columns is None:
            feature_columns = self.select_numeric_features(df, exclude_columns)

        clean = df.dropna(subset=feature_columns).copy()

        if clean.empty:
            raise ValueError("Dataset is empty after removing rows with missing features.")

        x = clean[feature_columns].to_numpy(dtype=float)
        x_scaled = self.scaler.fit_transform(x)

        self.model.fit(x_scaled)

        raw_scores = self.model.decision_function(x_scaled)

        anomaly_scores = -raw_scores

        clean["anomaly_score"] = anomaly_scores
        clean["anomaly_label"] = self.model.predict(x_scaled)

        clean = clean.sort_values(
            by="anomaly_score",
            ascending=False,
        ).reset_index(drop=True)

        clean["anomaly_rank"] = np.arange(1, len(clean) + 1)

        return AnomalyDetectionResult(
            data=clean,
            feature_columns=feature_columns,
        )


def run_anomaly_detection(
    csv_path: str,
    output_path: Optional[str] = None,
    exclude_columns: Optional[Iterable[str]] = None,
    contamination: float = 0.05,
) -> pd.DataFrame:
    """
    Convenience function to run anomaly detection directly from a CSV file.

    Parameters
    ----------
    csv_path:
        Input CSV dataset path.

    output_path:
        Optional path where the ranked results will be saved.

    exclude_columns:
        Optional metadata columns to exclude.

    contamination:
        Expected anomaly fraction.

    Returns
    -------
    pandas.DataFrame
        Ranked anomaly table.
    """

    df = pd.read_csv(csv_path)

    detector = UnsupervisedAnomalyDetector(contamination=contamination)

    result = detector.fit_predict(
        df,
        exclude_columns=exclude_columns,
    )

    if output_path:
        result.data.to_csv(output_path, index=False)

    return result.data


if __name__ == "__main__":
    print("Codex Alpha Computational Framework")
    print("Unsupervised anomaly detection module")
    print("Model-agnostic exploratory layer initialized.")
