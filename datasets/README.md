# Datasets

This directory contains references, metadata and integration notes for astronomical datasets used or planned inside the Codex Alpha Computational Framework.

The current closed-beta demonstrator is based on a local Gaia DR3 demo package of approximately 1000 sources.

Dataset-related material may include:

- Gaia DR3 source packages;
- dataset metadata;
- loading notes;
- preprocessing notes;
- feature-selection notes;
- catalogue-field documentation;
- validation-oriented dataset references;
- future multi-catalogue integration notes.

## Current Data Mode

The framework currently operates in local-first mode.

The Python pipeline processes local dataset inputs and exports dashboard-ready data into:

```text
dashboard/public/data/
```

The dashboard does not query the full Gaia catalogue directly during normal local execution.

## Scientific Boundaries

The current dataset is a controlled demo package.

It is intended to demonstrate:

- candidate-level analysis;
- anomaly ranking;
- graph-based structural analysis;
- astrometric dynamics;
- projected proper-motion evolution;
- synthetic stellar reconstruction;
- candidate dossier generation;
- external validation planning.

It is not intended to claim complete Gaia catalogue coverage.

It is not intended to confirm astrophysical discoveries by itself.

All candidate interpretations derived from the dataset require independent validation through external astronomical services and expert review.

## Future Dataset Directions

Future dataset work may include:

- larger Gaia-derived source packages;
- improved Gaia DR3 ingestion workflows;
- Gaia DR4-compatible preparation when applicable;
- multi-catalogue validation packages;
- crossmatch-ready source tables;
- survey-specific preprocessing modules;
- benchmark datasets for candidate-level prioritization;
- uncertainty-aware dataset documentation.

This directory supports dataset organization and integration planning for the framework. It should not be interpreted as a repository of confirmed astrophysical discoveries.
