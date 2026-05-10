import React, { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";

function normalizeScore(value, fallback = 0) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return fallback;
  }

  return number;
}

function buildCentralityMap(centrality = []) {
  const map = new Map();

  centrality.forEach((item) => {
    const sourceId = String(item.SOURCE_ID);

    map.set(sourceId, {
      structural_rank: item.structural_rank,
      degree_centrality: normalizeScore(item.degree_centrality),
      betweenness_centrality: normalizeScore(item.betweenness_centrality),
      closeness_centrality: normalizeScore(item.closeness_centrality),
      weighted_degree: normalizeScore(item.weighted_degree),
      structural_importance_score: normalizeScore(item.structural_importance_score),
    });
  });

  return map;
}

function getSourceId(item) {
  return String(item.SOURCE_ID ?? item.source_id ?? item.id);
}

function getNodeColor(node) {
  if (node.node_type === "background") {
    return "#29415c";
  }

  const score = normalizeScore(node.structural_importance_score);

  if (score >= 0.55) {
    return "#fff06a";
  }

  if (score >= 0.45) {
    return "#72f2ff";
  }

  if (score >= 0.35) {
    return "#6d8cff";
  }

  return "#7c5cff";
}

function getNodeSize(node) {
  if (node.node_type === "background") {
    return 1.1;
  }

  const anomalyScore = normalizeScore(node.anomaly_score, 0.5);
  const structuralScore = normalizeScore(node.structural_importance_score, 0.2);

  return 3.5 + anomalyScore * 4 + structuralScore * 7;
}

function createNodeObject(node) {
  const group = new THREE.Group();

  const radius = getNodeSize(node) / 10;
  const color = getNodeColor(node);

  const sphereGeometry = new THREE.SphereGeometry(radius, 24, 24);
  const sphereMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: node.node_type === "background" ? 0.38 : 0.96,
  });

  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  group.add(sphere);

  if (node.node_type !== "background") {
    const glowGeometry = new THREE.SphereGeometry(radius * 2.2, 24, 24);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    group.add(glow);
  }

  return group;
}

function createSpatialPosition(source) {
  const ra = normalizeScore(source.ra);
  const dec = normalizeScore(source.dec);
  const parallax = normalizeScore(source.parallax);

  return {
    fx: (ra - 45) * 42,
    fy: (dec - 2) * 70,
    fz: (parallax - 7) * 3.2,
  };
}

function Graph3DViewer({
  allSources = [],
  nodes = [],
  edges = [],
  centrality = [],
  onNodeSelect,
}) {
  const graphRef = useRef(null);

  const [selectedNode, setSelectedNode] = useState(null);
  const [showAllSources, setShowAllSources] = useState(false);
  const [highCentralityOnly, setHighCentralityOnly] = useState(false);
  const [topStructuralOnly, setTopStructuralOnly] = useState(false);
  const [hideWeakLinks, setHideWeakLinks] = useState(false);
  const [anomalyThreshold, setAnomalyThreshold] = useState(0);

  const graphData = useMemo(() => {
    const centralityMap = buildCentralityMap(centrality);

    let graphNodes = nodes.map((node) => {
      const sourceId = getSourceId(node);
      const centralityData = centralityMap.get(sourceId) ?? {};
      const position = createSpatialPosition(node);

      return {
        id: "graph-" + String(node.node_id),
        graph_node_id: String(node.node_id),
        source_id: sourceId,
        label: sourceId,
        node_type: "anomaly",
        ra: node.ra,
        dec: node.dec,
        parallax: node.parallax,
        pmra: node.pmra,
        pmdec: node.pmdec,
        radial_velocity: node.radial_velocity,
        anomaly_score: normalizeScore(node.anomaly_score),
        anomaly_rank: node.anomaly_rank,
        anomaly_cluster: node.anomaly_cluster,
        ...centralityData,
        ...position,
      };
    });

    if (highCentralityOnly) {
      graphNodes = graphNodes.filter(
        (node) => normalizeScore(node.structural_importance_score) >= 0.4,
      );
    }

    if (topStructuralOnly) {
      graphNodes = graphNodes.filter(
        (node) => Number(node.structural_rank) > 0 && Number(node.structural_rank) <= 10,
      );
    }

    if (anomalyThreshold > 0) {
      graphNodes = graphNodes.filter(
        (node) => normalizeScore(node.anomaly_score) >= anomalyThreshold,
      );
    }

    const graphSourceIds = new Set(graphNodes.map((node) => node.source_id));
    const graphNodeIds = new Set(graphNodes.map((node) => node.graph_node_id));

    let backgroundNodes = [];

    if (showAllSources) {
      backgroundNodes = allSources
        .filter((source) => !graphSourceIds.has(getSourceId(source)))
        .map((source) => {
          const sourceId = getSourceId(source);
          const position = createSpatialPosition(source);

          return {
            id: "source-" + sourceId,
            source_id: sourceId,
            label: sourceId,
            node_type: "background",
            ra: source.ra,
            dec: source.dec,
            parallax: source.parallax,
            radial_velocity: source.radial_velocity,
            anomaly_score: normalizeScore(source.anomaly_score),
            anomaly_label: source.anomaly_label,
            ...position,
          };
        });
    }

    let graphLinks = edges
      .map((edge) => ({
        source: "graph-" + String(edge.source_node),
        target: "graph-" + String(edge.target_node),
        source_node: String(edge.source_node),
        target_node: String(edge.target_node),
        feature_distance: normalizeScore(edge.feature_distance),
        similarity_weight: normalizeScore(edge.similarity_weight, 0.1),
      }))
      .filter(
        (edge) =>
          graphNodeIds.has(edge.source_node) && graphNodeIds.has(edge.target_node),
      );

    if (hideWeakLinks) {
      graphLinks = graphLinks.filter(
        (edge) => normalizeScore(edge.similarity_weight) >= 0.65,
      );
    }

    return {
      nodes: [...backgroundNodes, ...graphNodes],
      links: graphLinks,
    };
  }, [
    allSources,
    nodes,
    edges,
    centrality,
    showAllSources,
    highCentralityOnly,
    topStructuralOnly,
    hideWeakLinks,
    anomalyThreshold,
  ]);

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }

    graphRef.current.d3Force("charge").strength(showAllSources ? -35 : -120);

    graphRef.current.d3Force("link").distance((link) => {
      const distance = normalizeScore(link.feature_distance, 1);
      return 35 + distance * 18;
    });
  }, [graphData, showAllSources]);

  function handleNodeClick(node) {
    setSelectedNode(node);

    if (onNodeSelect) {
      onNodeSelect(node);
    }

    if (graphRef.current && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
      const distance = 95;
      const hypot = Math.hypot(node.x, node.y, node.z) || 1;
      const distRatio = 1 + distance / hypot;

      graphRef.current.cameraPosition(
        {
          x: node.x * distRatio,
          y: node.y * distRatio,
          z: node.z * distRatio,
        },
        node,
        1200,
      );
    }
  }

  function resetCamera() {
    if (!graphRef.current) {
      return;
    }

    graphRef.current.cameraPosition(
      {
        x: 0,
        y: 0,
        z: 260,
      },
      {
        x: 0,
        y: 0,
        z: 0,
      },
      1000,
    );
  }

  return (
    <div className="graph-3d-shell">
      <div className="graph-3d-toolbar">
        <div>
          <strong>Interactive Relational Graph</strong>
          <span>
            {graphData.nodes.length} nodes / {graphData.links.length} edges
          </span>
        </div>

        <div className="graph-legend">
          <span className="legend-dot high" />
          high centrality
          <span className="legend-dot medium" />
          medium
          <span className="legend-dot low" />
          peripheral
          <span className="legend-dot background" />
          Gaia source
        </div>
      </div>

      <div className="graph-controls">
        <button type="button" onClick={resetCamera}>
          Reset view
        </button>

        <label>
          <input
            type="checkbox"
            checked={showAllSources}
            onChange={(event) => setShowAllSources(event.target.checked)}
          />
          Show all 1000 Gaia sources
        </label>

        <label>
          <input
            type="checkbox"
            checked={highCentralityOnly}
            onChange={(event) => setHighCentralityOnly(event.target.checked)}
          />
          High centrality only
        </label>

        <label>
          <input
            type="checkbox"
            checked={topStructuralOnly}
            onChange={(event) => setTopStructuralOnly(event.target.checked)}
          />
          Top 10 structural
        </label>

        <label>
          <input
            type="checkbox"
            checked={hideWeakLinks}
            onChange={(event) => setHideWeakLinks(event.target.checked)}
          />
          Hide weak links
        </label>

        <label className="range-control">
          Min anomaly score
          <input
            type="range"
            min="0"
            max="0.7"
            step="0.01"
            value={anomalyThreshold}
            onChange={(event) => setAnomalyThreshold(Number(event.target.value))}
          />
          <span>{anomalyThreshold.toFixed(2)}</span>
        </label>
      </div>

      <div className="graph-3d-canvas">
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData}
          backgroundColor="#020617"
          nodeLabel={(node) =>
            "SOURCE_ID: " +
            node.source_id +
            "\nType: " +
            node.node_type +
            "\nAnomaly score: " +
            Number(node.anomaly_score ?? 0).toFixed(6) +
            "\nStructural score: " +
            Number(node.structural_importance_score ?? 0).toFixed(6) +
            "\nRank: " +
            (node.structural_rank ?? "N/A")
          }
          nodeThreeObject={createNodeObject}
          linkColor={() => "rgba(125, 220, 255, 0.42)"}
          linkWidth={(link) =>
            Math.max(0.35, normalizeScore(link.similarity_weight, 0.2) * 0.75)
          }
          linkOpacity={0.58}
          onNodeClick={handleNodeClick}
          enableNodeDrag={true}
          showNavInfo={false}
        />
      </div>

      {selectedNode && (
        <div className="selected-node-panel">
          <div>
            <span>Selected source</span>
            <strong>{selectedNode.source_id}</strong>
          </div>

          <div className="selected-node-grid">
            <p>
              <span>Type</span>
              {selectedNode.node_type}
            </p>

            <p>
              <span>Anomaly</span>
              {Number(selectedNode.anomaly_score ?? 0).toFixed(6)}
            </p>

            <p>
              <span>Structural</span>
              {Number(selectedNode.structural_importance_score ?? 0).toFixed(6)}
            </p>

            <p>
              <span>Rank</span>
              {selectedNode.structural_rank ?? "N/A"}
            </p>

            <p>
              <span>Radial velocity</span>
              {selectedNode.radial_velocity ?? "N/A"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Graph3DViewer;
