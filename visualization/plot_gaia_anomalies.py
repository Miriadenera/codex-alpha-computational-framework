"""
Codex Alpha Computational Framework
Gaia DR3 Anomaly Visualization

This module generates a sky-position plot from Gaia DR3 anomaly detection results.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt


INPUT_PATH = Path("results/gaia_dr3_anomaly_results.csv")
OUTPUT_PATH = Path("results/gaia_dr3_anomaly_sky_plot.png")


def plot_gaia_anomalies(
    input_path: Path = INPUT_PATH,
    output_path: Path = OUTPUT_PATH,
) -> None:
    """
    Generate a RA/DEC scatter plot highlighting anomalous Gaia DR3 sources.
    """

    if not input_path.exists():
        raise FileNotFoundError(f"Input results file not found: {input_path}")

    df = pd.read_csv(input_path)

    required_columns = {"ra", "dec", "anomaly_label", "anomaly_score"}

    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    normal = df[df["anomaly_label"] == 1]
    anomalies = df[df["anomaly_label"] == -1]

    plt.figure(figsize=(10, 7))

    plt.scatter(
        normal["ra"],
        normal["dec"],
        s=12,
        alpha=0.45,
        label="Normal sources",
    )

    plt.scatter(
        anomalies["ra"],
        anomalies["dec"],
        s=36,
        alpha=0.95,
        label="Anomalous sources",
    )

    plt.xlabel("Right Ascension [deg]")
    plt.ylabel("Declination [deg]")
    plt.title("Gaia DR3 Anomaly Detection - RA/DEC Projection")
    plt.legend()
    plt.grid(True, alpha=0.25)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path, dpi=200, bbox_inches="tight")
    plt.close()

    print(f"Plot saved to: {output_path}")


if __name__ == "__main__":
    plot_gaia_anomalies()
