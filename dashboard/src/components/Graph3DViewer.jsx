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

function getSourceId(item) {
  return String(item.SOURCE_ID ?? item.source_id ?? item.id);
}

function getNodeColor(node) {
  if (node.node_type === "background") {
    return "#6f86a8";
  }

  const rank = Number(node.structural_rank ?? 999);
  const score = normalizeScore(node.structural_importance_score);

  if (rank > 0 && rank <= 5) {
    return "#f7ef74";
  }

  if (score >= 0.45) {
    return "#7defff";
  }

  if (score >= 0.35) {
    return "#84a4ff";
  }

  return "#8c70ff";
}

function getNodeSize(node) {
  if (node.node_type === "background") {
    return 0.55;
  }

  const structuralScore = normalizeScore(node.structural_importance_score, 0.2);
  const rank = Number(node.structural_rank ?? 999);

  if (rank > 0 && rank <= 5) {
    return 5.8 + structuralScore * 2.4;
  }

  if (rank > 0 && rank <= 15) {
    return 4.8 + structuralScore * 2.0;
  }

  return 3.6 + structuralScore * 1.8;
}

function createNodeObject(node) {
  const group = new THREE.Group();

  const radius = getNodeSize(node) / 10;
  const color = getNodeColor(node);

  const sphereGeometry = new THREE.SphereGeometry(radius, 18, 18);
  const sphereMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: node.node_type === "background" ? 0.48 : 0.92,
  });

  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  group.add(sphere);

  if (node.node_type !== "background") {
    const glowGeometry = new THREE.SphereGeometry(radius * 1.85, 18, 18);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    group.add(glow);
  }

  return group;
}

function getRawCoordinates(source) {
  const ra = normalizeScore(source.ra);
  const dec = normalizeScore(source.dec);
  const parallax = normalizeScore(source.parallax);

  return {
    rawX: ra,
    rawY: dec,
    rawZ: parallax,
  };
}

function centerAndScaleNodes(inputNodes) {
  if (!inputNodes.length) {
    return [];
  }

  const rawNodes = inputNodes.map((node) => {
    const raw = getRawCoordinates(node);

    return {
      ...node,
      ...raw,
    };
  });

  const centerX =
    rawNodes.reduce((sum, node) => sum + node.rawX, 0) / rawNodes.length;
  const centerY =
    rawNodes.reduce((sum, node) => sum + node.rawY, 0) / rawNodes.length;
  const centerZ =
    rawNodes.reduce((sum, node) => sum + node.rawZ, 0) / rawNodes.length;

  const centeredNodes = rawNodes.map((node) => ({
    ...node,
    cx: node.rawX - centerX,
    cy: node.rawY - centerY,
    cz: node.rawZ - centerZ,
  }));

  const maxX = Math.max(
    1,
    ...centeredNodes.map((node) => Math.abs(node.cx)),
  );
  const maxY = Math.max(
    1,
    ...centeredNodes.map((node) => Math.abs(node.cy)),
  );
  const maxZ = Math.max(
    1,
    ...centeredNodes.map((node) => Math.abs(node.cz)),
  );

  const scaleX = 130 / maxX;
  const scaleY = 130 / maxY;
  const scaleZ = 90 / maxZ;

  return centeredNodes.map((node) => ({
    ...node,
    fx: node.cx * scaleX,
    fy: node.cy * scaleY,
    fz: node.cz * scaleZ,
    x: node.cx * scaleX,
    y: node.cy * scaleY,
    z: node.cz * scaleZ,
  }));
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
  const [lockLayout, setLockLayout] = useState(true);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [anomalyThreshold, setAnomalyThreshold] = useState(0);

  const graphData = useMemo(() => {
    const centralityMap = buildCentralityMap(centrality);

    let anomalyNodes = nodes.map((node) => {
      const sourceId = getSourceId(node);
      const centralityData = centralityMap.get(sourceId) ?? {};

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
      };
    });

    if (highCentralityOnly) {
      anomalyNodes = anomalyNodes.filter(
        (node) => normalizeScore(node.structural_importance_score) >= 0.4,
      );
    }

    if (topStructuralOnly) {
      anomalyNodes = anomalyNodes.filter(
        (node) =>
          Number(node.structural_rank) > 0 &&
          Number(node.structural_rank) <= 10,
      );
    }

    if (anomalyThreshold > 0) {
      anomalyNodes = anomalyNodes.filter(
        (node) => normalizeScore(node.anomaly_score) >= anomalyThreshold,
      );
    }

    const anomalySourceIds = new Set(
      anomalyNodes.map((node) => node.source_id),
    );

    const anomalyGraphNodeIds = new Set(
      anomalyNodes.map((node) => node.graph_node_id),
    );

    let backgroundNodes = [];

    if (showAllSources) {
      backgroundNodes = allSources
        .filter((source) => !anomalySourceIds.has(getSourceId(source)))
        .map((source) => {
          const sourceId = getSourceId(source);

          return {
            id: "source-" + sourceId,
            source_id: sourceId,
            label: sourceId,
            node_type: "background",
            ra: source.ra,
            dec: source.dec,
            parallax: source.parallax,
            pmra: source.pmra,
            pmdec: source.pmdec,
            radial_velocity: source.radial_velocity,
            anomaly_score: normalizeScore(source.anomaly_score),
            anomaly_label: source.anomaly_label,
          };
        });
    }

    const allVisibleNodes = centerAndScaleNodes([
      ...backgroundNodes,
      ...anomalyNodes,
    ]);

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
          anomalyGraphNodeIds.has(edge.source_node) &&
          anomalyGraphNodeIds.has(edge.target_node),
      );

    if (hideWeakLinks) {
      graphLinks = graphLinks.filter(
        (edge) => normalizeScore(edge.similarity_weight) >= 0.65,
      );
    }

    return {
      nodes: allVisibleNodes,
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

    graphRef.current.d3Force("charge").strength(showAllSources ? -10 : -42);

    graphRef.current.d3Force("link").distance((link) => {
      const distance = normalizeScore(link.feature_distance, 1);
      return 24 + distance * 8;
    });

    if (lockLayout) {
      graphRef.current.d3Force("center", null);
    }

    resetCamera();
  }, [graphData, showAllSources, lockLayout]);

  function handleNodeClick(node) {
    setSelectedNode(node);

    if (onNodeSelect) {
      onNodeSelect(node);
    }

    if (
      graphRef.current &&
      node.x !== undefined &&
      node.y !== undefined &&
      node.z !== undefined
    ) {
      const distance = node.node_type === "background" ? 80 : 95;
      const hypot = Math.hypot(node.x, node.y, node.z) || 1;
      const distRatio = 1 + distance / hypot;

      graphRef.current.cameraPosition(
        {
          x: node.x * distRatio,
          y: node.y * distRatio,
          z: node.z * distRatio,
        },
        node,
        1000,
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
        z: showAllSources ? 360 : 285,
      },
      {
        x: 0,
        y: 0,
        z: 0,
      },
      900,
    );
  }

  function toggleFullscreenMode() {
    setFullscreenMode((current) => !current);

    window.setTimeout(() => {
      resetCamera();
    }, 150);
  }

  return (
    <div
      className={
        fullscreenMode
          ? "graph-viewer-wrapper graph-viewer-fullscreen"
          : "graph-viewer-wrapper"
      }
    >
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

        <div className="graph-3d-canvas">
          <ForceGraph3D
            ref={graphRef}
            graphData={graphData}
            backgroundColor="#000000"
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
            linkColor={() => "rgba(125, 220, 255, 0.33)"}
            linkWidth={(link) =>
              Math.max(
                0.12,
                normalizeScore(link.similarity_weight, 0.2) * 0.28,
              )
            }
            linkOpacity={0.32}
            onNodeClick={handleNodeClick}
            enableNodeDrag={!lockLayout}
            showNavInfo={false}
            cooldownTicks={lockLayout ? 0 : 80}
            warmupTicks={lockLayout ? 0 : 40}
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
                {Number(selectedNode.structural_importance_score ?? 0).toFixed(
                  6,
                )}
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

      <div className="graph-controls">
        <button type="button" onClick={resetCamera}>
          Reset view
        </button>

        <button type="button" onClick={toggleFullscreenMode}>
          {fullscreenMode ? "Exit fullscreen" : "Fullscreen"}
        </button>

        <label>
          <input
            type="checkbox"
            checked={lockLayout}
            onChange={(event) => setLockLayout(event.target.checked)}
          />
          Lock node layout
        </label>

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
    </div>
  );
}

export default Graph3DViewer;
