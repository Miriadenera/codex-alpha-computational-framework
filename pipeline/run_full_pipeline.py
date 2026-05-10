"""
Codex Alpha Computational Framework
Full Gaia DR3 Analysis Pipeline

This script executes the complete early prototype workflow:

1. Load ESA Gaia DR3 dataset
2. Run AI-assisted unsupervised anomaly detection
3. Generate feature contribution analysis
4. Generate anomaly clustering
5. Generate emergent structure detection analysis
6. Build relational graph structure
7. Generate RA/DEC visualization

Run with:

    python -m pipeline.run_full_pipeline
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from datasets.loaders.gaia_loader import load_gaia_dataset, summarize_dataset
from ai.anomaly_detection.isolation_forest_detector import run_isolation_forest


DATASET_PATH = Path("datasets/gaia/gaia_dr3_sample_1000.vot")
ANOMALY_RESULTS_PATH = Path("results/gaia_dr3_anomaly_results.csv")


def run_step(command: list[str], description: str) -> None:
    """
    Run a pipeline step as a Python module command.
    """

    print(f"\n--- {description} ---")

    completed = subprocess.run(
        command,
        check=False,
        text=True,
    )

    if completed.returncode != 0:
        raise RuntimeError(f"Pipeline step failed: {description}")


def main() -> None:
    print("\nCodex Alpha Computational Framework")
    print("Full Gaia DR3 Analysis Pipeline\n")

    print("--- Step 1: Load ESA Gaia DR3 dataset ---")

    df = load_gaia_dataset(DATASET_PATH)
    summarize_dataset(df)

    print("\n--- Step 2: Run AI anomaly detection ---")

    results = run_isolation_forest(
        dataframe=df,
        contamination=0.05,
        random_state=42,
    )

    ANOMALY_RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    results.to_csv(ANOMALY_RESULTS_PATH, index=False)

    print(f"Anomaly results saved to: {ANOMALY_RESULTS_PATH}")

    print("\nTop 10 anomalous sources:")
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

    run_step(
        [sys.executable, "-m", "analysis.feature_contribution"],
        "Step 3: Generate feature contribution analysis",
    )

    run_step(
        [sys.executable, "-m", "analysis.anomaly_clustering"],
        "Step 4: Generate anomaly clustering analysis",
    )

    run_step(
        [sys.executable, "-m", "analysis.emergent_structure_detection"],
        "Step 5: Generate emergent structure detection analysis",
    )

    run_step(
        [sys.executable, "-m", "structures.graph_builder"],
        "Step 6: Build relational graph structure",
    )

    run_step(
        [sys.executable, "-m", "visualization.plot_gaia_anomalies"],
        "Step 7: Generate RA/DEC anomaly visualization",
    )

    print("\nFull pipeline completed successfully.")

    print("\nGenerated outputs:")
    print(" - results/gaia_dr3_anomaly_results.csv")
    print(" - results/gaia_dr3_feature_contributions.csv")
    print(" - results/gaia_dr3_anomaly_clusters.csv")
    print(" - results/gaia_dr3_emergent_structures.csv")
    print(" - results/gaia_dr3_graph_nodes.csv")
    print(" - results/gaia_dr3_graph_edges.csv")
    print(" - results/gaia_dr3_anomaly_sky_plot.png")


if __name__ == "__main__":
    main()
