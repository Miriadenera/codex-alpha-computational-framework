"""
Codex Alpha Computational Framework
Example: Gaia DR3 anomaly detection pipeline

This script loads a real ESA Gaia DR3 sample dataset and runs the first
model-agnostic anomaly detection layer.
"""

from datasets.loaders.gaia_loader import load_gaia_dataset, summarize_dataset
from ai.anomaly_detection.unsupervised_detector import UnsupervisedAnomalyDetector


DATASET_PATH = "datasets/gaia/gaia_dr3_sample_1000.vot"
OUTPUT_PATH = "datasets/gaia/gaia_dr3_anomaly_results.csv"


def main():
    print("\nCodex Alpha Computational Framework")
    print("Gaia DR3 anomaly detection pipeline\n")

    df = load_gaia_dataset(DATASET_PATH)

    summarize_dataset(df)

    detector = UnsupervisedAnomalyDetector(
        contamination=0.05,
        random_state=42,
        n_estimators=300,
    )

    result = detector.fit_predict(
        df,
        exclude_columns=["source_id"],
    )

    result.data.to_csv(OUTPUT_PATH, index=False)

    print("\nTop 10 anomalous Gaia DR3 sources:")
    print(result.data.head(10))

    print(f"\nResults saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
