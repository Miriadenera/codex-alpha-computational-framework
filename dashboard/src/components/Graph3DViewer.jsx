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
      structural_importance_score: normalizeScore(
        item.structural_importance_score,
      ),
    });
  });

  return map;
}

function getNodeColor(node) {
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

  return "#6b5cff";
}

function getNodeSize(node) {
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
    opacity: 0.95,
  });

  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  group.add(sphere);

  const glowGeometry = new THREE.SphereGeometry(radius * 1.9, 24, 24);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.13,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  group.add(glow);

  return group;
}

function Graph3DViewer({
  nodes = [],
  edges = [],
  centrality = [],
  onNodeSelect,
}) {
  const graphRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const graphData = useMemo(() => {
    const centralityMap = buildCentralityMap(centrality);

    const graphNodes = nodes.map((node) => {
      const sourceId = String(node.SOURCE_ID ?? node.source_id ?? node.id);
      const centralityData = centralityMap.get(sourceId) ?? {};

      return {
        id: String(node.node_id),
        source_id: sourceId,
        label: sourceId,
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
      };
    });

    const validNodeIds = new Set(graphNodes.map((node) => node.id));

    const graphLinks = edges
      .map((edge) => ({
        source: String(edge.source_node),
        target: String(edge.target_node),
        feature_distance: normalizeScore(edge.feature_distance),
        similarity_weight: normalizeScore(edge.similarity_weight, 0.1),
      }))
      .filter(
        (edge) => validNodeIds.has(edge.source) && validNodeIds.has(edge.target),
      );

    return {
      nodes: graphNodes,
      links: graphLinks,
    };
  }, [nodes, edges, centrality]);

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }

    graphRef.current.d3Force("charge").strength(-120);
    graphRef.current.d3Force("link").distance((link) => {
      const distance = normalizeScore(link.feature_distance, 1);
      return 35 + distance * 18;
    });
  }, [graphData]);

  function handleNodeClick(node) {
    setSelectedNode(node);

    if (onNodeSelect) {
      onNodeSelect(node);
    }

    if (graphRef.current) {
      const distance = 90;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

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
        </div>
      </div>

      <div className="graph-3d-canvas">
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData}
          backgroundColor="#020617"
          nodeLabel={(node) =>
            `SOURCE_ID: ${node.source_id}
Anomaly score: ${Number(node.anomaly_score).toFixed(6)}
Structural score: ${Number(
              node.structural_importance_score ?? 0,
            ).toFixed(6)}
Rank: ${node.structural_rank ?? "N/A"}`
          }
          nodeThreeObject={createNodeObject}
          linkColor={() => "rgba(125, 220, 255, 0.28)"}
          linkWidth={(link) =>
            Math.max(0.25, normalizeScore(link.similarity_weight, 0.2) * 0.55)
          }
          linkOpacity={0.45}
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
              <span>Anomaly</span>
              {Number(selectedNode.anomaly_score).toFixed(6)}
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
