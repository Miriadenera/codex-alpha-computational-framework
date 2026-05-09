from __future__ import annotations

from pathlib import Path

import pandas as pd
import numpy as np


INPUT_PATH = Path("results/gaia_dr3_anomaly_results.csv")
OUTPUT_PATH = Path("results/gaia_dr3_feature_contributions.csv")


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


def compute_feature_contributions(
    input_path: Path = INPUT_PATH,
    output_path: Path = OUTPUT_PATH,
) -> pd.DataFrame:
    df = pd.read_csv(input_path)

    missing = [col for col in FEATURE_COLUMNS if col not in df.columns]
    if missing:
        raise ValueError(f"Missing feature columns: {missing}")

    features = df[FEATURE_COLUMNS].copy()

    means = features.mean()
    stds = features.std().replace(0, np.nan)

    zscores = (features - means) / stds
    abs_zscores = zscores.abs()

    dominant_feature = abs_zscores.idxmax(axis=1)
    dominant_score = abs_zscores.max(axis=1)

    result = df.copy()
    result["dominant_anomaly_feature"] = dominant_feature
    result["dominant_feature_zscore"] = dominant_score

    result = result.sort_values(
        by="anomaly_score",
        ascending=False,
    ).reset_index(drop=True)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(output_path, index=False)

    print("\nTop 10 anomaly feature contributions:")
    print(
        result[
            [
                "SOURCE_ID",
                "anomaly_rank",
                "anomaly_score",
                "dominant_anomaly_feature",
                "dominant_feature_zscore",
            ]
        ].head(10)
    )

    print(f"\nFeature contribution results saved to: {output_path}")

    return result


if __name__ == "__main__":
    compute_feature_contributions()
