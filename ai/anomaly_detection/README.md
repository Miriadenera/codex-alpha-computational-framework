# Anomaly Detection

This module contains AI-assisted anomaly detection components for candidate-level analysis inside the Codex Alpha Computational Framework.

Current implementation:

- unsupervised multidimensional anomaly detection;
- model-agnostic exploratory analysis;
- Isolation Forest-based ranking of statistically unusual Gaia DR3 candidate sources.

The goal is to identify sources that may deserve deeper inspection without imposing predefined astrophysical classifications or theoretical interpretations.

Input:

- cleaned astronomical datasets;
- multidimensional numerical features;
- Gaia-derived astrometric, photometric and kinematic indicators where available.

Output:

- anomaly scores;
- anomaly labels;
- anomaly rankings;
- candidate-level prioritization indicators.

Scientific interpretation:

- anomaly scores are prioritization proxies;
- anomaly labels are not final astrophysical classifications;
- anomaly rankings do not confirm planets, binary systems, hidden companions, black holes, exotic objects or other physical interpretations;
- all candidate interpretations require external validation through authoritative astronomical services and expert review.

This module is intended to support exploratory triage and validation planning, not direct discovery claims.
