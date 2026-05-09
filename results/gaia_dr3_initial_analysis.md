# Gaia DR3 Initial Exploratory Analysis

## Dataset Source

Initial exploratory analysis was performed using a real ESA Gaia DR3 dataset obtained through the Gaia Archive:

https://gea.esac.esa.int/archive/

The following ADQL query was used inside the Gaia Archive interface:

```sql
SELECT TOP 1000
  source_id,
  ra,
  dec,
  parallax,
  pmra,
  pmdec,
  phot_g_mean_mag,
  phot_bp_mean_mag,
  phot_rp_mean_mag,
  bp_rp,
  radial_velocity
FROM gaiadr3.gaia_source
WHERE parallax IS NOT NULL
  AND pmra IS NOT NULL
  AND pmdec IS NOT NULL
  AND phot_g_mean_mag IS NOT NULL
  AND bp_rp IS NOT NULL
  AND radial_velocity IS NOT NULL
```

The query generated the dataset:

```text
gaia_dr3_sample_1000.vot
```

which was integrated into the repository and processed through the Codex Alpha Computational Framework.

---

# Exploratory AI Analysis

The framework loaded the Gaia DR3 dataset and applied an unsupervised anomaly detection pipeline based on multidimensional statistical analysis.

The current prototype performs:

- multidimensional feature extraction,
- normalization of astrophysical parameters,
- unsupervised anomaly detection,
- ranking of statistically unusual sources.

The analysis was performed without imposing predefined cosmological structures or target patterns.

---

# Interpretation of the Results

The framework identified astrophysical sources that appear statistically anomalous within the multidimensional Gaia feature space.

In practice, the model detected objects showing rare combinations of:

- parallax,
- proper motion,
- radial velocity,
- stellar magnitude,
- stellar color.

These sources differ statistically from the dominant population distribution.

---

# Meaning of anomaly_score

Higher `anomaly_score` values indicate sources that are statistically rarer within the analyzed dataset.

This does NOT automatically imply:

- errors,
- exotic phenomena,
- new physics discoveries.

Instead, it indicates:

> "This source deserves additional investigation."

The framework is designed as an exploratory computational layer intended to assist future astrophysical and cosmological analysis.

---

# Top 10 Detected Anomalous Sources

| Rank | SOURCE_ID | anomaly_score |
|------|------|------|
| 1 | 123424475948672 | 0.131517 |
| 2 | 83154862613888 | 0.127237 |
| 3 | 1435244927007872 | 0.118258 |
| 4 | 132667245587072 | 0.116813 |
| 5 | 1753553543188992 | 0.103758 |
| 6 | 1195551392247936 | 0.098195 |
| 7 | 92603790642688 | 0.097326 |
| 8 | 290653322568704 | 0.093983 |
| 9 | 755540582699392 | 0.082685 |
| 10 | 1604569717638528 | 0.082182 |

---

# Full Results

Complete anomaly detection results are available in:

```text
results/gaia_dr3_anomaly_results.csv
```

---

# Current Status

This analysis represents the first operational prototype of the Codex Alpha Computational Framework applied to real ESA Gaia DR3 observational data.
