# Structures

This directory contains modules dedicated to relational and graph-based structural analysis inside the Codex Alpha Computational Framework.

The purpose of this layer is to move beyond isolated anomaly detection and support candidate-level analysis of relationships between sources.

The structures layer helps the framework evaluate whether candidate sources show computational relationships, similarity patterns, local neighbourhoods or graph-based structural importance inside the processed feature space.

These relationships are prioritization aids.

They are not confirmations of physical association, common origin, binarity, companionship, gravitational interaction or astrophysical systems.

---

## Purpose

The structures layer is designed to analyze relationships between sources rather than treating each object as an isolated point.

This allows the framework to evaluate:

- source-to-source similarity;
- local multidimensional neighbourhoods;
- candidate connectivity;
- anomaly-family relationships;
- graph-based structural importance;
- relational candidate patterns;
- graph centrality indicators;
- validation-priority context.

The objective is to support candidate-level prioritization and validation planning.

---

## Conceptual Role

Earlier layers of the framework identify:

```text
individual candidate-level anomalies
```

The structures layer analyzes:

```text
computational relationships among candidate sources
```

This represents the transition from:

```text
isolated anomaly ranking
```

to:

```text
relational candidate prioritization
```

The output remains candidate-level and requires external validation.

---

## Current Operational Role

The current closed-beta framework already supports graph-based structural analysis.

Generated outputs may include:

```text
results/gaia_dr3_graph_nodes.csv
results/gaia_dr3_graph_edges.csv
results/gaia_dr3_graph_centrality.csv
results/gaia_dr3_relational_graph.png
```

These files support the dashboard graph visualization, source centrality analysis and relational candidate context.

---

## Current and Planned Modules

## graph_builder.py

Builds graph representations from Gaia DR3 candidate sources.

Expected or generated outputs may include:

```text
results/gaia_dr3_graph_nodes.csv
results/gaia_dr3_graph_edges.csv
```

In this representation:

- each node corresponds to a candidate source or source-level entry;
- each edge represents a computational relationship such as similarity, proximity or internal framework-defined candidate relation;
- graph properties can be analyzed to support candidate-level prioritization.

Graph edges do not confirm physical connection.

---

## graph_centrality_analysis.py

Computes graph centrality or structural-importance indicators for candidate sources.

Possible outputs may include:

```text
results/gaia_dr3_graph_centrality.csv
```

Centrality values are prioritization proxies.

They may help identify sources that are structurally important inside the internal graph representation.

They do not confirm astrophysical significance by themselves.

---

## community_detection.py

Future module for identifying candidate groups or relational substructures within the generated source graph.

Potential methods may include:

- connected components;
- modularity-based communities;
- density-based graph grouping;
- graph clustering;
- candidate-family grouping.

Community membership will not confirm physical association, binarity, companionship, common origin or gravitational interaction.

---

## filament_analysis.py

Future exploratory module for testing whether graph structures show elongated or filament-like computational patterns.

This module is not currently part of the active closed-beta analytical pipeline.

Any future filament-like output would require careful language and external validation.

It must not be interpreted as a confirmed cosmological filament, physical structure or large-scale astrophysical discovery.

---

## Current Status

```text
Closed Beta Structural Analysis Layer
```

The current operational framework supports:

- anomaly detection;
- feature contribution analysis;
- anomaly clustering;
- graph construction;
- graph node generation;
- graph edge generation;
- graph centrality analysis;
- relational graph visualization;
- candidate-level structural prioritization.

The structures layer extends the framework from isolated anomaly ranking toward relational candidate analysis.

---

## Scientific Boundaries

The structures layer does not confirm:

- planets;
- binary systems;
- hidden companions;
- black holes;
- exotic objects;
- physical association;
- common origin;
- gravitational interaction;
- physical orbits;
- close encounters;
- future stellar configurations;
- cosmological structures.

Graph outputs must be interpreted as:

```text
candidate-level relational indicators
```

not as:

```text
confirmed astrophysical structures
```

All candidate interpretations derived from graph structure require external astronomical validation and expert review.

---

## Relationship with the Dashboard

The structures layer supports dashboard visualization and candidate investigation.

Graph outputs may be used by:

- Operational Dashboard;
- Advanced Analysis Layer;
- Candidate Investigation Cockpit;
- source ranking components;
- candidate profile panels;
- validation-planning workflows.

The dashboard visualizes graph relationships to help the user understand candidate context, not to certify physical systems.

---

## Long-Term Vision

The long-term objective is to support scalable relational analysis of astronomical datasets.

Future directions may include:

- larger Gaia-derived graph datasets;
- multi-catalogue source similarity networks;
- graph-assisted candidate ranking;
- graph-based validation planning;
- uncertainty-aware relational scoring;
- explainable graph-based candidate prioritization;
- human-in-the-loop review of graph-derived candidate groups;
- optional graph neural network experiments.

This layer is a key step toward transforming the framework from isolated anomaly detection into a validation-oriented candidate intelligence system.

The focus remains:

```text
prioritization
interpretability
external validation
scientific caution
```