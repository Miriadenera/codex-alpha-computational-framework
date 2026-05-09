"""
Codex Alpha Computational Framework
Gaia DR3 Loader

Initial loader for ESA Gaia DR3 datasets.

This module loads Gaia VOTable or CSV datasets and prepares them
for exploratory anomaly detection and cosmological analysis.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from astropy.table import Table


SUPPORTED_EXTENSIONS = {".vot", ".xml", ".csv"}


def load_gaia_dataset(path: str | Path) -> pd.DataFrame:
    """
    Load a Gaia DR3 dataset into a pandas DataFrame.

    Supported formats:
        - VOTable (.vot, .xml)
        - CSV (.csv)

    Parameters
    ----------
    path:
        Path to Gaia dataset.

    Returns
    -------
    pandas.DataFrame
        Loaded dataset.
    """

    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    suffix = path.suffix.lower()

    if suffix not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file format: {suffix}. "
            f"Supported: {SUPPORTED_EXTENSIONS}"
        )

    if suffix in {".vot", ".xml"}:
        table = Table.read(path)
        df = table.to_pandas()

    elif suffix == ".csv":
        df = pd.read_csv(path)

    return df


def summarize_dataset(df: pd.DataFrame) -> None:
    """
    Print a quick summary of the dataset.
    """

    print("\n=== DATASET SUMMARY ===")
    print(f"Rows: {len(df)}")
    print(f"Columns: {len(df.columns)}")

    print("\nColumns:")
    for col in df.columns:
        print(f" - {col}")


if __name__ == "__main__":

    print("Codex Alpha Computational Framework")
    print("Gaia DR3 Loader initialized.")
