# Framework Architecture

## Codex Alpha Computational Framework

Operational architecture document for the Codex Alpha Computational Framework.

This document describes the current software structure, computational workflow, dashboard architecture and long-term architectural direction of the framework.

---

## Architectural Philosophy

The Codex Alpha Computational Framework is designed as a candidate-level, validation-oriented computational infrastructure for the exploratory analysis of astronomical datasets, starting from Gaia DR3.

The core objective is not to impose predefined astrophysical classifications or claim direct discoveries.

Instead, the framework is designed to:

- analyze multidimensional astronomical data;
- identify statistically unusual candidate sources;
- rank candidate-level anomalies;
- evaluate structural graph importance;
- compute astrometric and kinematic proxy indicators;
- visualize projected proper-motion evolution;
- support synthetic stellar reconstruction;
- generate exportable candidate dossiers;
- prepare candidates for external astronomical validation.

The architecture emphasizes:

- modularity;
- reproducibility;
- interpretability;
- local-first operation;
- candidate-level outputs;
- scientific caution;
- external validation readiness;
- future scalability.

---

## Current Operational Status

```text
Closed Beta Research Demonstrator
```

The framework is currently in closed beta.

It provides a working end-to-end local-first workflow based on:

- Python data-processing pipeline;
- Gaia DR3 demo dataset ingestion;
- anomaly detection and ranking;
- feature contribution analysis;
- graph construction and centrality analysis;
- dashboard-ready data export;
- React/Vite local dashboard;
- Three.js/WebGL scientific visualization;
- candidate investigation cockpit;
- projected proper-motion evolution;
- synthetic stellar reconstruction;
- full candidate dossier generation.

The current demonstrator operates on an approximately 1000-source Gaia DR3 demo package.

The dataset size is intentionally limited for closed-beta demonstration, reproducibility and dashboard performance.

---

## High-Level Architecture

```text
Gaia DR3 demo dataset
        │
        ▼
Dataset Loader Layer
        │
        ▼
Feature Extraction Layer
        │
        ▼
Anomaly Detection Layer
        │
        ▼
Feature Contribution Analysis
        │
        ▼
Graph Construction Layer
        │
        ▼
Graph Centrality Analysis
        │
        ▼
Candidate-Level Export Layer
        │
        ▼
dashboard/public/data/
        │
        ▼
React/Vite Dashboard
        │
        ├── Operational Dashboard
        ├── Advanced Analysis Layer
        ├── Astrometric Dynamics Lab
        ├── Candidate Investigation Cockpit
        └── Stellar Reconstruction & Full Dossier Studio
```

---

## Current Repository Architecture

```text
ai/              -> AI-assisted exploratory analysis modules
analysis/        -> Statistical, clustering, centrality and structure analysis modules
crossmatch/      -> Candidate crossmatch utilities
dashboard/       -> Local interactive React/Vite dashboard
datasets/        -> Gaia DR3 datasets and loaders
docs/            -> Technical documentation and architecture notes
examples/        -> End-to-end execution examples
export/          -> Dashboard export and data-package utilities
pipeline/        -> Automated analysis pipelines
prototypes/      -> Experimental prototype modules
reports/         -> Automatic report generation modules
results/         -> Generated outputs, reports and visualizations
simulations/     -> Future computational simulation modules
structures/      -> Relational graph construction modules
visualization/   -> Exploratory 2D and 3D visualization modules
```

---

## Module Descriptions

## datasets/

Handles astronomical dataset integration and preprocessing.

Current capabilities:

- Gaia DR3 VOTable loading;
- multidimensional feature parsing;
- dataset summarization;
- structured dataframe generation;
- local Gaia DR3 demo package support.

Future extensions may include:

- larger Gaia-derived source packages;
- Gaia DR4-compatible ingestion when applicable;
- multi-catalogue validation packages;
- survey-specific preprocessing modules;
- crossmatch-ready source tables.

---

## ai/

Contains AI-assisted analysis modules.

Current operational modules:

- unsupervised anomaly detection through Isolation Forest.

Future modules may include:

- explainable candidate scoring;
- uncertainty-aware candidate triage;
- AI-assisted validation planning;
- graph-assisted candidate ranking;
- human-in-the-loop candidate interpretation.

The AI layer is designed to support candidate prioritization, not autonomous astrophysical discovery.

All AI-assisted outputs must remain interpretable and externally validated.

---

## analysis/

Contains statistical and multidimensional analysis modules.

Current implemented systems include:

- feature contribution analysis;
- anomaly clustering;
- graph centrality analysis;
- multidimensional statistical interpretation;
- candidate-level ranking support.

Future development may include:

- uncertainty-aware scoring;
- topological feature-space analysis;
- graph-based candidate scoring;
- explainable anomaly-family analysis.

---

## structures/

Contains relational graph construction logic.

Current role:

- build graph node structures;
- define graph edges from candidate-level relationships;
- support graph-based structural interpretation;
- prepare data for dashboard graph visualization.

Graph relationships are prioritization aids.

They do not confirm physical association, binarity, companionship, common origin or gravitational interaction.

---

## crossmatch/

Contains utilities and data structures for candidate crossmatch support.

Current role:

- organize candidate-level crossmatch status;
- support validation-oriented workflows;
- prepare links or references toward external astronomical services.

The framework does not claim official integration, endorsement or partnership with external catalogue infrastructures.

---

## export/

Contains utilities for exporting pipeline outputs into dashboard-ready local data packages.

Current export target:

```text
dashboard/public/data/
```

The export layer separates scientific computation from dashboard visualization.

---

## dashboard/

Contains the local interactive React/Vite dashboard.

Current dashboard stack:

```text
React
Vite
Three.js
WebGL
ForceGraph3D
```

The dashboard provides five connected analysis interfaces:

1. Operational Dashboard
2. Advanced Analysis Layer
3. Astrometric Dynamics Lab
4. Candidate Investigation Cockpit
5. Stellar Reconstruction & Full Dossier Studio

The dashboard is local-first and API-free by default for the core workflow.

---

## visualization/

Contains exploratory visualization systems.

Current and related capabilities include:

- RA/DEC anomaly projection;
- anomaly highlighting;
- graph visualization support;
- 3D relational visualization;
- projected proper-motion visualization support;
- candidate-level visual analysis.

Future directions may include:

- larger-scale 3D source fields;
- improved uncertainty visualization;
- multi-catalogue visual overlays;
- cloud-ready visualization workflows.

---

## pipeline/

Contains automated end-to-end execution pipelines.

Current pipeline entry point:

```text
run_full_pipeline.py
```

Current automated workflow:

1. dataset loading;
2. feature extraction;
3. anomaly detection;
4. feature contribution analysis;
5. anomaly clustering;
6. graph construction;
7. graph centrality analysis;
8. visualization generation;
9. structured result export;
10. dashboard data-package generation.

The pipeline represents the reproducible computation layer of the framework.

It is not an autonomous discovery engine.

---

## reports/

Contains automatic report generation modules.

Current role:

- generate pipeline summaries;
- produce Markdown reports;
- document anomaly and candidate-level outputs;
- support reproducibility and review.

---

## results/

Contains generated outputs and analysis artifacts.

Current outputs may include:

- anomaly rankings;
- feature contribution reports;
- anomaly clustering outputs;
- graph node and edge files;
- graph centrality files;
- exploratory plots;
- Markdown pipeline reports;
- dashboard-ready exported data.

---

## examples/

Contains executable examples and reproducible workflows.

Purpose:

- demonstrate framework capabilities;
- provide reproducible execution paths;
- validate operational modules;
- help users run the local pipeline and dashboard.

---

## simulations/

Reserved for future computational simulation systems.

No production-ready simulation component is currently implemented here.

Potential future areas may include:

- controlled candidate-level simulation tests;
- synthetic benchmark datasets;
- uncertainty propagation experiments;
- visual simulation modules;
- non-production exploratory modelling.

This directory should not be interpreted as an active astrophysical simulation engine.

---

## Current Computational Workflow

The current closed-beta pipeline executes the following operational sequence:

```text
Local Gaia DR3 demo sample
        │
        ▼
VOTable parsing
        │
        ▼
Multidimensional feature extraction
        │
        ▼
Isolation Forest anomaly detection
        │
        ▼
Anomaly score generation
        │
        ▼
Anomaly ranking
        │
        ▼
Feature contribution analysis
        │
        ▼
Candidate clustering
        │
        ▼
Graph construction
        │
        ▼
Graph centrality analysis
        │
        ▼
Structured output generation
        │
        ▼
Dashboard data export
        │
        ▼
Interactive local visualization
```

---

## Current Dashboard Workflow

The dashboard uses the exported local data package and provides a five-stage interface:

```text
Operational Dashboard
        │
        ▼
Advanced Analysis Layer
        │
        ▼
Astrometric Dynamics Lab
        │
        ▼
Candidate Investigation Cockpit
        │
        ▼
Stellar Reconstruction & Full Dossier Studio
```

The selected source is synchronized across the framework where applicable.

This allows the user to move from dataset-level overview to candidate-level investigation and dossier generation.

---

## Current AI Workflow

The current AI workflow is based on unsupervised anomaly detection.

The system:

- analyzes multidimensional feature distributions;
- identifies statistically unusual candidate sources;
- computes anomaly scores;
- ranks candidate-level anomalies;
- supports feature contribution analysis;
- supports exploratory candidate prioritization.

The framework currently avoids:

- supervised labeling assumptions;
- predefined astrophysical classes;
- direct discovery claims;
- autonomous physical interpretation;
- confirmed object classification.

This is a deliberate architectural choice intended to reduce interpretative bias and avoid retroactive overclaiming.

---

## Projected Proper-Motion Architecture

The Candidate Investigation Cockpit includes a projected proper-motion evolution layer.

This module may use Gaia-derived quantities such as:

- right ascension;
- declination;
- parallax or distance proxy;
- `pmra`;
- `pmdec`;
- `radial_velocity` where available.

The module produces:

```text
projected motion traces
```

not:

```text
confirmed orbital paths
```

The visualization is not an N-body gravitational simulation.

It does not include:

- mutual stellar attraction;
- galactic potential modelling;
- confirmed orbital dynamics;
- confirmed future close encounters;
- confirmed binary evolution.

The motion scale is a visual amplification control and does not change the underlying Gaia-derived observables.

---

## Synthetic Stellar Reconstruction Architecture

The Stellar Reconstruction & Full Dossier Studio provides a candidate-level synthetic stellar twin.

This module may use:

- Gaia photometric indicators;
- BP-RP colour proxy where available;
- temperature proxy;
- radius proxy;
- luminosity proxy;
- procedural surface rendering;
- visual size scaling;
- visual colour scaling.

The synthetic stellar twin is:

```text
a proxy-based procedural visualization
```

not:

```text
an observational image of the selected source
```

The rendered stellar object does not confirm:

- stellar type;
- stellar activity;
- flare events;
- companions;
- binarity;
- planets;
- exotic physical mechanisms.

---

## External Validation Architecture

The framework is designed as a pre-validation intelligence layer.

Its role is to prepare and prioritize candidates before external validation.

The framework may support links or workflow references to:

- Gaia Archive;
- Gaia NSS where applicable;
- SIMBAD;
- VizieR;
- Aladin;
- X-Match;
- ESA Sky;
- related catalogue infrastructures.

Architectural rule:

```text
Codex Alpha prepares and prioritizes.
External astronomical services validate and contextualize.
```

No official integration, endorsement or partnership with ESA, CDS, SIMBAD, VizieR, Aladin, X-Match or related infrastructures is claimed by this framework.

---

## Current Technology Stack

Current framework technologies include:

```text
Python
NumPy
Pandas
Scikit-learn
Astropy
Matplotlib
React
Vite
Three.js
WebGL
ForceGraph3D
```

Current AI methodology:

```text
Isolation Forest
```

Current data format support:

```text
Gaia DR3 VOTable
CSV
JSON
Markdown
TXT
LaTeX
```

---

## Local-First Architecture

The current architecture is local-first.

Core principles:

- the Python pipeline processes local Gaia-derived data;
- the dashboard reads local exported files;
- the core workflow does not require external APIs;
- external links are used for validation and catalogue inspection;
- optional validation files may be absent;
- the dashboard should degrade gracefully when optional data are unavailable.

Local data flow:

```text
datasets/
    -> pipeline/
    -> results/
    -> dashboard/public/data/
    -> dashboard interface
```

---

## Long-Term Architectural Direction

The long-term objective is to evolve the framework into a scalable space-data intelligence platform.

Future architectural expansion may include:

- larger Gaia-derived datasets;
- Gaia DR4-compatible ingestion when applicable;
- multi-catalogue workflows;
- cloud-ready deployment;
- API-based data ingestion;
- collaborative candidate review;
- explainable AI candidate scoring;
- uncertainty-aware ranking;
- validation-oriented dossier generation;
- institutional deployment options;
- hosted dashboard services;
- premium analytics modules;
- structured handoff toward established astronomical validation services.

---

## Design Principles

The framework architecture follows several core principles.

## Modularity

Each analysis layer is designed as an independent and progressively replaceable module.

---

## Reproducibility

Outputs should be generated through documented computational workflows.

The v0.1.0 closed-beta state is documented by the public GitHub release and the Zenodo technical whitepaper.

---

## Scientific Caution

All outputs are candidate-level unless externally validated.

The framework does not claim direct astrophysical discovery by itself.

---

## Exploratory Neutrality

The framework attempts to minimize predefined interpretative assumptions during exploratory analysis.

---

## Scalability

The architecture is designed to progressively support larger astronomical datasets and future cloud or institutional deployment.

---

## Interpretability

AI-generated outputs should remain inspectable, explainable and statistically analyzable.

---

## Human-in-the-Loop Validation

The framework is intended to assist researchers, not replace scientific validation.

Human review and external catalogue validation remain mandatory for candidate interpretation.

---

## Related Documentation

Technical whitepaper:

```text
https://doi.org/10.5281/zenodo.20335018
```

GitHub release:

```text
v0.1.0-closed-beta
```

Live framework page:

```text
https://www.codexalpha.org/computational-framework
```

---

## Current Development Status

```text
Closed Beta Research Demonstrator
```

Current architecture status:

- functional end-to-end Python pipeline;
- Gaia DR3 demo dataset support;
- operational anomaly detection;
- operational feature contribution analysis;
- operational graph construction and centrality analysis;
- operational dashboard data export;
- operational local React/Vite dashboard;
- five connected analysis interfaces;
- projected proper-motion evolution interface;
- synthetic stellar reconstruction interface;
- full candidate dossier generation;
- GitHub release available;
- Zenodo technical whitepaper available.

The framework is currently transitioning from closed-beta stabilization toward scientific hardening, improved reproducibility, larger dataset preparation, explainable AI scoring and future scalable deployment.