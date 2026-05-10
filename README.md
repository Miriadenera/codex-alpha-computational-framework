# Codex Alpha Computational Framework

AI-assisted computational framework for exploratory analysis of large-scale cosmological structures, emergent correlations and high-dimensional astrophysical datasets.

---

## Overview

The Codex Alpha Computational Framework is an early-stage computational cosmology initiative focused on the development of AI-assisted tools for the analysis of complex astrophysical and cosmological datasets.

The project aims to explore emergent correlations, topological coherence patterns and large-scale gravitational structures through scalable computational infrastructure, statistical analysis and future AI integration.

Rather than building a new observational infrastructure, the framework is designed as a new interpretative computational layer operating on existing cosmological data.

---

# Installation and Usage

## Clone the repository

```bash
git clone https://github.com/Miriadenera/codex-alpha-computational-framework.git
```

## Enter the project directory

```bash
cd codex-alpha-computational-framework
```

## Install required dependencies

```bash
pip install -r requirements.txt
```

## Run the Gaia DR3 anomaly detection example

```bash
python -m examples.run_gaia_detection
```

---

# What the framework currently does

The current prototype pipeline:

- Loads real ESA Gaia DR3 datasets
- Parses multidimensional astrophysical features
- Applies unsupervised AI-based anomaly detection
- Identifies statistically anomalous astrophysical sources
- Generates anomaly rankings
- Computes feature contribution analysis
- Identifies anomaly families through multidimensional clustering
- Produces exploratory visualizations and structured outputs

Generated output:

```text
datasets/gaia/gaia_dr3_anomaly_results.csv
```

---

## Generate Gaia DR3 anomaly visualization

```bash
python -m visualization.plot_gaia_anomalies
```

The visualization module generates a sky-position projection of the analyzed Gaia DR3 sources.

This represents the first graphical exploratory layer of the Codex Alpha Computational Framework applied to real ESA Gaia DR3 observational data.

The current prototype:

- loads anomaly detection results,
- separates normal and anomalous sources,
- projects the dataset in RA/DEC space,
- highlights statistically anomalous sources detected through the AI-assisted exploratory pipeline.
Generated output:

```text
results/gaia_dr3_anomaly_sky_plot.png
```
---

## Generate feature contribution analysis

```bash
python -m analysis.feature_contribution
```

The feature contribution module analyzes the detected anomalies and identifies which astrophysical parameter contributes most strongly to each anomalous source.

The current prototype evaluates contributions from:

- parallax,
- proper motion,
- radial velocity,
- stellar magnitude,
- stellar color.

The module computes statistical feature deviations and generates an interpretability layer for the anomaly detection pipeline.

Generated output:

```text
results/gaia_dr3_feature_contributions.csv
```
---

## Generate anomaly clustering analysis

```bash
python -m analysis.anomaly_clustering
```

The anomaly clustering module analyzes whether detected anomalous sources form statistically coherent multidimensional families.

The current prototype:

- groups anomalous astrophysical sources,
- identifies anomaly families,
- evaluates dominant cluster characteristics,
- performs exploratory multidimensional clustering analysis.

The current clustering layer identified multiple anomaly families associated with different dominant astrophysical features.

Generated output:

```text
results/gaia_dr3_anomaly_clusters.csv
```

# Current Prototype Status

Current implemented components:

- Gaia DR3 dataset loader
- ESA VOTable support
- Unsupervised anomaly detection pipeline
- Feature contribution analysis
- Multidimensional anomaly clustering
- RA/DEC anomaly visualization
- Exploratory statistical reporting
- CSV structured result generation
- Initial end-to-end cosmological analysis workflow
- Modular AI analysis architecture

Planned future extensions:

- Topological analysis modules
- Graph-based cosmological structures
- Advanced visualization systems
- AI-assisted cosmological interpretation
- Distributed HPC computation
- Emergent correlation analysis
- Geometric coherence metrics

---

## Core Objectives

- Analysis of multidimensional cosmological datasets.
- Detection of emergent non-trivial correlations.
- Topological and geometric mapping of large-scale structures.
- Reduction of interpretative and retroactive selection bias.
- Development of exploratory AI-assisted analysis tools.
- Integration with scalable HPC and cloud infrastructure.

---

## Research Direction

The framework originates from the broader theoretical research project **Codex Alpha**, but its operational direction is computational and data-oriented.

Current development focuses on:

- exploratory correlation analysis,
- cosmological topology,
- anomaly detection,
- large-scale structure analysis,
- AI-assisted pattern recognition,
- scientific computing infrastructure.

---
## AI Architecture Direction

The AI layer of the framework is designed as a modular exploratory analysis infrastructure.

Rather than enforcing predefined cosmological assumptions, the AI modules are intended to assist the identification of:

- statistically anomalous astrophysical sources,
- emergent multidimensional structures,
- non-trivial correlations,
- anomaly families,
- graph-based cosmological relationships.

The current implementation uses unsupervised anomaly detection techniques, while future development may progressively integrate:

- deep learning anomaly models,
- graph neural networks,
- adaptive exploratory pipelines,
- autonomous analysis systems,
- large-scale distributed AI-assisted cosmological analysis.

---

## Development Status

Current status: **Operational Early Prototype Phase**

The project is currently focused on:

- defining software architecture,
- evaluating public cosmological datasets,
- developing exploratory topological metrics,
- planning computational pipelines,
- preparing the first operational prototype.

---

## Long-Term Vision

The long-term objective is to evolve the framework into a scalable computational platform capable of assisting cosmological and astrophysical research through advanced exploratory analysis of high-dimensional observational datasets.

Potential future directions include:

- distributed HPC infrastructure,
- AI-assisted cosmological analysis,
- automated anomaly detection,
- topological gravitational mapping,
- scientific visualization systems,
- large-scale cosmological data integration.

---

## Website

https://www.codexalpha.org/computational-framework

---

## Related Research

Codex Alpha Research:

https://www.codexalpha.org

DOI publications available online through Zenodo.

---

## Repository Structure

```text
ai/              -> AI-assisted cosmological analysis modules
│
├── anomaly_detection/   -> Unsupervised anomaly detection systems
├── ranking/             -> AI-assisted anomaly prioritization modules
├── pattern_discovery/   -> Emergent pattern and correlation analysis
├── interpretability/    -> AI explainability and feature interpretation
├── autonomous/          -> Future autonomous exploratory pipelines
└── graph_models/        -> Graph-based cosmological analysis modules
analysis/        -> Statistical analysis, feature contribution and anomaly clustering modules
datasets/        -> ESA Gaia DR3 datasets and dataset loaders
docs/            -> Technical documentation and architecture notes
examples/        -> End-to-end execution examples
prototypes/      -> Early experimental prototypes and future development modules
results/         -> Generated analysis outputs, reports, CSV files and plots
simulations/     -> Future computational simulations and cosmological modeling experiments
visualization/   -> Exploratory visualization modules

---

## Disclaimer

This repository currently represents an early-stage research and prototyping initiative.

The framework is under active conceptual and computational development.
