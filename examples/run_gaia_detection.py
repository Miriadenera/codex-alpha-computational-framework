"""
Codex Alpha Computational Framework
Example: Gaia DR3 anomaly detection pipeline

This script loads a real ESA Gaia DR3 sample dataset
and executes the modular AI-assisted anomaly detection engine.
"""

from __future__ import annotations

from pathlib import Path

from datasets.loaders.gaia_loader import (
    load_gaia_dataset,
    summarize_dataset,
)

from ai.anomaly_detection.isolation_forest_detector import (
    run_isolation_forest,
)


DATASET_PATH = Path("datasets/gaia/gaia_dr3_sample_1000.vot")
OUTPUT_PATH = Path("results/gaia_dr3_anomaly_results.csv")


def main() -> None:
    print("\nCodex Alpha Computational Framework")
    print("Gaia DR3 anomaly detection pipeline\n")

    # Load dataset
    df = load_gaia_dataset(DATASET_PATH)

    # Dataset summary
    summarize_dataset(df)

    # Run modular AI anomaly detection engine
    results = run_isolation_forest(
        dataframe=df,
        contamination=0.05,
        random_state=42,
    )

    # Save results
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    results.to_csv(
        OUTPUT_PATH,
        index=False,
    )

    # Display top anomalies
    print("\nTop 10 anomalous Gaia DR3 sources:")

    print(
        results[
            [
                "SOURCE_ID",
                "ra",
                "dec",
                "parallax",
                "pmra",
                "pmdec",
                "radial_velocity",
                "anomaly_score",
                "anomaly_label",
                "anomaly_rank",
            ]
        ].head(10)
    )

    print(f"\nResults saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
