# Codex Alpha Computational Framework

AI-assisted computational framework for exploratory analysis of large-scale cosmological structures, emergent correlations, relational graph structures, and high-dimensional astrophysical datasets.

## Overview

The Codex Alpha Computational Framework is an operational early-stage computational cosmology initiative focused on the development of AI-assisted tools for exploratory analysis of complex astrophysical and cosmological datasets.

The framework is designed to investigate statistically anomalous sources, emergent multidimensional structures, non-trivial correlations, and relational graph patterns within large-scale observational datasets through scalable computational infrastructure, statistical analysis, graph-based modeling, automated reporting, and local scientific visualization.

Rather than building a new observational infrastructure, the project aims to provide a new interpretative computational layer operating on existing cosmological data.

The current operational prototype already supports:

- real ESA Gaia DR3 dataset integration
- multidimensional astrophysical preprocessing
- unsupervised anomaly detection
- feature contribution analysis
- anomaly family clustering
- emergent local structure detection
- relational graph construction
- graph centrality analysis
- exploratory 2D visualization
- exploratory 3D structure projection
- automatic Markdown report generation
- local dashboard data export
- offline-first interactive dashboard visualization
- automated end-to-end execution pipelines
- modular AI-assisted analysis architecture

## Installation and Usage

### Clone the repository

```bash
git clone https://github.com/Miriadenera/codex-alpha-computational-framework.git
```

### Enter the project directory

```bash
cd codex-alpha-computational-framework
```

### Install required Python dependencies

```bash
pip install -r requirements.txt
```

## Execute the Full Gaia DR3 Analysis Pipeline

From the repository root, run:

```bash
python -m pipeline.run_full_pipeline
```

The full pipeline automatically performs:

1. ESA Gaia DR3 dataset loading
2. Multidimensional feature extraction
3. AI-assisted unsupervised anomaly detection
4. Feature contribution analysis
5. Multidimensional anomaly clustering
6. Emergent local structure detection
7. Relational graph construction
8. Graph centrality analysis
9. RA/DEC anomaly visualization
10. Relational graph visualization
11. Automatic Markdown report generation
12. Dashboard-ready local data export

## Run the Local Dashboard

After running the full pipeline, enter the dashboard directory:

```bash
cd dashboard
```

Install dashboard dependencies:

```bash
npm install
```

Start the local dashboard:

```bash
npm run dev
```

The dashboard will be available locally through the Vite development server, usually at:

```text
http://localhost:5173/
```

The dashboard is local-first and reads generated files from:

```text
dashboard/public/data/
```

No external API is required.

## Important Execution Notes

The Python pipeline must be launched from the repository root:

```bash
cd codex-alpha-computational-framework
python -m pipeline.run_full_pipeline
```

Do not launch the Python pipeline from inside the `dashboard/` directory, otherwise Python may not find the `pipeline` module.

Correct:

```text
D:\PYTHON\codex-alpha-computational-framework> python -m pipeline.run_full_pipeline
```

Incorrect:

```text
D:\PYTHON\codex-alpha-computational-framework\dashboard> python -m pipeline.run_full_pipeline
```

## Current Pipeline Outputs

The current operational prototype generates:

```text
results/gaia_dr3_anomaly_results.csv
results/gaia_dr3_feature_contributions.csv
results/gaia_dr3_anomaly_clusters.csv
results/gaia_dr3_emergent_structures.csv
results/gaia_dr3_graph_nodes.csv
results/gaia_dr3_graph_edges.csv
results/gaia_dr3_graph_centrality.csv
results/gaia_dr3_anomaly_sky_plot.png
results/gaia_dr3_relational_graph.png
results/gaia_dr3_pipeline_report.md
```

The dashboard export layer generates:

```text
dashboard/public/data/summary.json
dashboard/public/data/anomalies.json
dashboard/public/data/feature_contributions.json
dashboard/public/data/clusters.json
dashboard/public/data/emergent_structures.json
dashboard/public/data/graph_nodes.json
dashboard/public/data/graph_edges.json
dashboard/public/data/graph_centrality.json
dashboard/public/data/report.md
```

The generated outputs include:

- ranked anomalous astrophysical sources
- complete Gaia DR3 analyzed source table
- feature contribution analysis
- anomaly family clustering
- emergent local structure candidates
- relational graph nodes
- relational graph edges
- graph centrality ranking
- exploratory RA/DEC visualization
- relational graph visualization
- complete automatic Markdown report
- dashboard-ready JSON and Markdown data package

## Local Dashboard Capabilities

The current local dashboard provides an offline-first scientific interface for exploring pipeline outputs.

Implemented dashboard capabilities include:

- dataset summary cards
- anomaly statistics
- graph node and edge counts
- top structural node inspection
- selected source inspection panel
- automatic pipeline report viewer
- interactive 3D relational graph viewer
- node click inspection
- zoomable and rotatable 3D graph navigation
- visualization of all 1000 Gaia sample sources
- highlighted anomalous sources
- graph edge visualization
- node layout lock/unlock
- adjustable field recentering
- X/Y/Z graph shifting controls
- anomaly brightness controls
- Gaia source brightness controls
- anomaly glow controls
- link intensity controls
- link thickness controls
- fullscreen graph mode
- local-only data loading

The dashboard does not require external APIs.

## Current Operational Capabilities

Current implemented capabilities include:

- ESA Gaia DR3 dataset integration
- ESA VOTable support
- multidimensional astrophysical preprocessing
- unsupervised AI-assisted anomaly detection
- statistical anomaly ranking
- feature contribution analysis
- multidimensional anomaly clustering
- emergent local structure detection
- relational graph construction
- graph centrality analysis
- RA/DEC exploratory visualization
- 3D anomalous structure projection
- automatic full pipeline reporting
- dashboard-ready local data export
- offline-first local dashboard
- modular AI architecture
- structured result generation
- end-to-end automated pipeline execution

## AI Architecture

The AI layer of the framework is designed as a modular exploratory analysis infrastructure.

Rather than enforcing predefined cosmological assumptions, the AI modules are intended to assist the identification of:

- statistically anomalous astrophysical sources
- emergent multidimensional structures
- non-trivial correlations
- anomaly families
- local emergent structures
- graph-based cosmological relationships
- structurally important nodes inside relational graphs

Current implementation includes:

- Isolation Forest-based anomaly detection
- feature interpretability layers
- multidimensional clustering analysis
- local emergent structure detection
- graph-based similarity modeling
- graph centrality analysis

Future AI development may progressively integrate:

- deep learning anomaly models
- graph neural networks
- adaptive exploratory pipelines
- autonomous analysis systems
- local open-source LLM assistance
- distributed AI-assisted cosmological analysis

## Emergent Structure Detection

The framework includes an initial emergent structure detection layer.

This module analyzes whether statistically anomalous astrophysical sources exhibit local multidimensional grouping behavior inside the analyzed feature space.

The current implementation:

- computes nearest-neighbor relationships
- evaluates local multidimensional density
- identifies candidate emergent structures
- ranks statistically coherent local anomaly groups

This represents a transition from isolated anomaly analysis toward exploratory relational cosmological analysis.

The current system does not assign predefined physical meaning to detected structures.

Instead, the framework identifies statistically interesting local configurations that may deserve additional investigation.

## Relational Graph Analysis

The framework includes a graph construction layer that models anomalous Gaia DR3 sources as nodes and multidimensional similarity relationships as edges.

The relational graph layer currently generates:

- graph node tables
- graph edge tables
- feature-space similarity weights
- graph centrality rankings
- structurally important source candidates

Graph centrality analysis currently evaluates:

- degree centrality
- betweenness centrality
- closeness centrality
- weighted degree
- structural importance score

The graph is not a direct Gaia sky map.

It is an exploratory similarity graph derived from multidimensional astrophysical features.

## Automatic Pipeline Report

The framework automatically generates a complete Markdown report at:

```text
results/gaia_dr3_pipeline_report.md
```

The dashboard receives a local copy at:

```text
dashboard/public/data/report.md
```

The report includes:

- dataset summary
- complete anomalous source table
- complete feature contribution table
- anomaly cluster summary
- complete anomaly cluster assignments
- complete emergent local structure candidates
- complete graph node table
- complete graph edge table
- complete graph centrality table
- complete Gaia DR3 sample source table
- interpretation notes
- generated output references

Numerical values are exported without scientific notation where possible.

## Core Objectives

- analysis of multidimensional cosmological datasets
- detection of emergent non-trivial correlations
- exploratory anomaly detection
- emergent structure identification
- relational graph modeling of anomalous sources
- topological and geometric analysis of large-scale structures
- reduction of interpretative and retroactive selection bias
- development of scalable AI-assisted scientific analysis pipelines
- development of local-first scientific visualization tools
- integration with HPC and distributed computational infrastructure

## Research Direction

The framework originates from the broader theoretical research project **Codex Alpha**, but its operational direction is computational and data-oriented.

Current development focuses on:

- exploratory cosmological analysis
- anomaly detection
- multidimensional astrophysical statistics
- emergent structure identification
- relational graph construction
- graph-based astrophysical analysis
- AI-assisted pattern recognition
- scalable scientific computing infrastructure
- local interactive scientific visualization

The framework is intentionally designed to avoid imposing predefined cosmological target structures during exploratory analysis.

## Development Status

Current status:

```text
Operational Early Prototype Phase
```

The framework currently supports complete end-to-end execution on real ESA Gaia DR3 observational datasets.

The current operational pipeline includes:

- anomaly detection
- feature analysis
- multidimensional clustering
- emergent local structure detection
- relational graph construction
- graph centrality analysis
- automatic reporting
- dashboard data export
- local 3D dashboard visualization

Ongoing development focuses on:

- improved Gaia-like validation views
- graph-based cosmological analysis
- exploratory topology modules
- autonomous AI-assisted workflows
- local open-source assistant integration
- distributed computation systems
- scalable large-volume dataset analysis
- advanced scientific visualization

## Long-Term Vision

The long-term objective is to evolve the framework into a scalable computational infrastructure capable of assisting cosmological and astrophysical research through advanced exploratory analysis of large-scale high-dimensional observational datasets.

Potential future directions include:

- distributed HPC infrastructure
- AI-assisted cosmological analysis
- autonomous exploratory pipelines
- graph-based cosmological mapping
- topological gravitational structure analysis
- emergent pattern discovery
- large-scale cosmological survey integration
- advanced visualization systems
- multidimensional relational cosmology frameworks
- local AI-assisted scientific interfaces
- open-source reproducible astrophysical analysis workflows

## Website

https://www.codexalpha.org/computational-framework

## Related Research

Codex Alpha Research:

https://www.codexalpha.org

DOI publications are available online through Zenodo.

## Repository Structure

```text
ai/              -> AI-assisted cosmological analysis modules
analysis/        -> Statistical, clustering, centrality and structure analysis modules
dashboard/       -> Local offline-first interactive visualization dashboard
datasets/        -> ESA Gaia DR3 datasets and dataset loaders
docs/            -> Technical documentation and architecture notes
examples/        -> End-to-end execution examples
pipeline/        -> Full automated analysis pipelines
prototypes/      -> Experimental prototype modules
reports/         -> Automatic report generation modules
results/         -> Generated outputs, reports and visualizations
simulations/     -> Future computational simulations
structures/      -> Relational graph construction modules
visualization/   -> Exploratory 2D and 3D visualization modules
```

## Quick Start

Run the full computational pipeline:

```bash
python -m pipeline.run_full_pipeline
```

Start the local dashboard:

```bash
cd dashboard
npm install
npm run dev
```

Open:

```text
http://localhost:5173/
```

## Disclaimer

This repository represents an operational early-stage research and prototyping initiative.

The framework is under active computational and architectural development.

Current outputs represent exploratory statistical and AI-assisted analysis layers and do not constitute claims of new physical discoveries.

Detected anomalies, relational graph structures, centrality rankings, and emergent local structures require additional astrophysical validation before any physical interpretation.
