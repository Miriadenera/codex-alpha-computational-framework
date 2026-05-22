
# Gaia Dataset Package

This directory contains the local Gaia DR3 demo dataset used by the Codex Alpha Computational Framework closed-beta demonstrator.

Current dataset file:

```text
gaia_dr3_sample_1000.vot
```

## Dataset Role

This Gaia DR3 sample is used as the local demonstration package for the current framework workflow.

It supports:

- candidate-level source analysis;
- anomaly ranking;
- graph-based structural analysis;
- astrometric dynamics;
- projected proper-motion evolution;
- candidate investigation workflows;
- synthetic stellar reconstruction;
- candidate dossier generation;
- validation-oriented external workflow preparation.

The dataset is intentionally limited to approximately 1000 Gaia DR3 sources.

Its purpose is to demonstrate the end-to-end workflow of the framework, not to represent complete Gaia catalogue coverage.

## Data Format

The current dataset is stored as a VOTable file:

```text
gaia_dr3_sample_1000.vot
```

VOTable is a standard XML-based format commonly used in astronomy for tabular data exchange.

## Expected Gaia-Derived Fields

Depending on availability in the local sample, the framework may use fields such as:

- source identifier;
- right ascension;
- declination;
- parallax;
- proper motion in right ascension;
- proper motion in declination;
- radial velocity where available;
- photometric magnitudes;
- colour indicators such as BP-RP where available;
- astrometric quality indicators where available.

The pipeline is designed to degrade gracefully when some optional fields are absent.

## Local-First Data Mode

The framework does not query the full Gaia Archive directly during normal local execution.

The local workflow is:

```text
Gaia DR3 demo sample
    -> Python pipeline
    -> results/
    -> dashboard/public/data/
    -> local dashboard
```

The Python pipeline processes the local Gaia sample and exports dashboard-ready JSON and Markdown files.

## Scientific Boundaries

This dataset is used for candidate-level exploratory analysis only.

It does not confirm:

- planets;
- binary systems;
- hidden companions;
- black holes;
- exotic objects;
- physical orbits;
- close encounters;
- future stellar configurations;
- observational stellar images.

Outputs derived from this dataset must be interpreted as prioritization indicators, proxy values or visual aids.

They are not final astrophysical classifications.

## Projected Proper-Motion Evolution

The projected proper-motion module may use Gaia-derived values such as:

- right ascension;
- declination;
- parallax or distance proxy;
- `pmra`;
- `pmdec`;
- `radial_velocity` where available.

The resulting traces are:

```text
projected motion traces
```

not:

```text
confirmed orbital paths
```

The visualization is not an N-body simulation and does not include mutual gravitational attraction, galactic potential modelling or confirmed future encounters.

## Validation Requirement

All candidate interpretations derived from this Gaia sample require independent validation through authoritative astronomical services and expert review.

Relevant external validation resources may include:

- Gaia Archive;
- Gaia NSS where applicable;
- SIMBAD;
- VizieR;
- Aladin;
- X-Match;
- ESA Sky;
- other catalogue or survey infrastructures.

## Status

```text
Closed Beta Demo Dataset
```

This dataset is part of the current v0.1.0 Closed Beta Research Demonstrator.

It is included to support reproducible local testing, dashboard visualization and candidate-level workflow demonstration.