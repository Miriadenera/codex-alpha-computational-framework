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
    return "#ff4d5e";
  }

  const rank = Number(node.structural_rank ?? 999);
  const score = normalizeScore(node.structural_importance_score);

  if (rank > 0 && rank <= 5) {
    return "#fff06a";
  }

  if (score >= 0.45) {
    return "#72f2ff";
  }

  if (score >= 0.35) {
    return "#86a7ff";
  }

  return "#9a7cff";
}

function getNodeSize(node, gaiaSize, anomalySize) {
  if (node.node_type === "background") {
    return gaiaSize;
  }

  return anomalySize;
}

function createNodeObject(node, controls) {
  const group = new THREE.Group();

  const radius = getNodeSize(
    node,
    controls.gaiaSize,
    controls.anomalySize,
  ) / 10;

  const color = getNodeColor(node);

  const sphereGeometry = new THREE.SphereGeometry(radius, 22, 22);
  const sphereMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity:
      node.node_type === "background"
        ? controls.gaiaBrightness
        : controls.anomalyBrightness,
  });

  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  group.add(sphere);

  const glowGeometry = new THREE.SphereGeometry(
    node.node_type === "background"
      ? radius * 1.28
      : radius * controls.anomalyGlow,
    22,
    22,
  );

  const glowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity:
      node.node_type === "background"
        ? controls.gaiaGlowOpacity
        : controls.anomalyGlowOpacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  group.add(glow);

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

function centerAndScaleNodes(inputNodes, offsets) {
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

  const scaleX = 120 / maxX;
  const scaleY = 120 / maxY;
  const scaleZ = 65 / maxZ;

  return centeredNodes.map((node) => ({
    ...node,
    fx: node.cx * scaleX + offsets.x,
    fy: node.cy * scaleY + offsets.y,
    fz: node.cz * scaleZ + offsets.z,
    x: node.cx * scaleX + offsets.x,
    y: node.cy * scaleY + offsets.y,
    z: node.cz * scaleZ + offsets.z,
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
  const containerRef = useRef(null);

  const [selectedNode, setSelectedNode] = useState(null);
  const [showAllSources, setShowAllSources] = useState(true);
  const [highCentralityOnly, setHighCentralityOnly] = useState(false);
  const [topStructuralOnly, setTopStructuralOnly] = useState(false);
  const [hideWeakLinks, setHideWeakLinks] = useState(false);
  const [lockLayout, setLockLayout] = useState(true);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [anomalyThreshold, setAnomalyThreshold] = useState(0);

  const [offsetX, setOffsetX] = useState(-70);
  const [offsetY, setOffsetY] = useState(0);
  const [offsetZ, setOffsetZ] = useState(0);

  const [gaiaBrightness, setGaiaBrightness] = useState(0.85);
  const [anomalyBrightness, setAnomalyBrightness] = useState(1.0);
  const [anomalyGlow, setAnomalyGlow] = useState(2.2);
  const [linkIntensity, setLinkIntensity] = useState(0.72);
  const [linkThickness, setLinkThickness] = useState(0.55);

  const visualControls = useMemo(
    () => ({
      gaiaSize: 3.3,
      anomalySize: 4.5,
      gaiaBrightness,
      anomalyBrightness,
      anomalyGlow,
      gaiaGlowOpacity: 0.08,
      anomalyGlowOpacity: 0.12,
    }),
    [gaiaBrightness, anomalyBrightness, anomalyGlow],
  );

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

    const allVisibleNodes = centerAndScaleNodes(
      [...backgroundNodes, ...anomalyNodes],
      {
        x: offsetX,
        y: offsetY,
        z: offsetZ,
      },
    );

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
    offsetX,
    offsetY,
    offsetZ,
  ]);

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }

    if (lockLayout) {
      graphRef.current.d3Force("charge").strength(0);
      graphRef.current.d3Force("center", null);
      graphRef.current.d3Force("link").strength(0);
    } else {
      graphRef.current.d3Force("charge").strength(showAllSources ? -8 : -35);

      graphRef.current.d3Force("link").distance((link) => {
        const distance = normalizeScore(link.feature_distance, 1);
        return 24 + distance * 8;
      });

      graphRef.current.d3Force("link").strength(0.12);
    }

    window.setTimeout(() => {
      resetCamera();
    }, 80);
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
      const distance = node.node_type === "background" ? 75 : 90;
      const hypot = Math.hypot(node.x, node.y, node.z) || 1;
      const distRatio = 1 + distance / hypot;

      graphRef.current.cameraPosition(
        {
          x: node.x * distRatio,
          y: node.y * distRatio,
          z: node.z * distRatio,
        },
        {
          x: node.x,
          y: node.y,
          z: node.z,
        },
        900,
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
        z: showAllSources ? 330 : 270,
      },
      {
        x: 0,
        y: 0,
        z: 0,
      },
      800,
    );
  }

  function recenterField() {
    setOffsetX(-70);
    setOffsetY(0);
    setOffsetZ(0);

    window.setTimeout(() => {
      resetCamera();
    }, 100);
  }

  function boostAnomalies() {
    setAnomalyBrightness(1);
    setAnomalyGlow(3.2);
    setLinkIntensity(0.9);
    setLinkThickness(0.75);
  }

  function softView() {
    setGaiaBrightness(0.55);
    setAnomalyBrightness(0.95);
    setAnomalyGlow(1.8);
    setLinkIntensity(0.38);
    setLinkThickness(0.28);
  }

  function balancedView() {
    setGaiaBrightness(0.85);
    setAnomalyBrightness(1.0);
    setAnomalyGlow(2.2);
    setLinkIntensity(0.72);
    setLinkThickness(0.55);
  }

  function toggleFullscreenMode() {
    setFullscreenMode((current) => !current);

    window.setTimeout(() => {
      resetCamera();
    }, 200);
  }

  return (
    <div
      ref={containerRef}
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
            anomaly
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
            nodeThreeObject={(node) => createNodeObject(node, visualControls)}
            linkColor={() =>
              "rgba(125, 220, 255, " + String(linkIntensity) + ")"
            }
            linkWidth={(link) =>
              Math.max(
                0.2,
                normalizeScore(link.similarity_weight, 0.2) * linkThickness,
              )
            }
            linkOpacity={linkIntensity}
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

        <button type="button" onClick={recenterField}>
          Recenter field
        </button>

        <button type="button" onClick={balancedView}>
          Balanced
        </button>

        <button type="button" onClick={boostAnomalies}>
          Boost anomalies
        </button>

        <button type="button" onClick={softView}>
          Soft view
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

        <label className="range-control">
          Gaia brightness
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            value={gaiaBrightness}
            onChange={(event) => setGaiaBrightness(Number(event.target.value))}
          />
          <span>{gaiaBrightness.toFixed(2)}</span>
        </label>

        <label className="range-control">
          Anomaly brightness
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            value={anomalyBrightness}
            onChange={(event) =>
              setAnomalyBrightness(Number(event.target.value))
            }
          />
          <span>{anomalyBrightness.toFixed(2)}</span>
        </label>

        <label className="range-control">
          Anomaly glow
          <input
            type="range"
            min="1"
            max="5"
            step="0.1"
            value={anomalyGlow}
            onChange={(event) => setAnomalyGlow(Number(event.target.value))}
          />
          <span>{anomalyGlow.toFixed(1)}</span>
        </label>

        <label className="range-control">
          Link intensity
          <input
            type="range"
            min="0.05"
            max="1"
            step="0.01"
            value={linkIntensity}
            onChange={(event) => setLinkIntensity(Number(event.target.value))}
          />
          <span>{linkIntensity.toFixed(2)}</span>
        </label>

        <label className="range-control">
          Link thickness
          <input
            type="range"
            min="0.05"
            max="1.2"
            step="0.01"
            value={linkThickness}
            onChange={(event) => setLinkThickness(Number(event.target.value))}
          />
          <span>{linkThickness.toFixed(2)}</span>
        </label>

        <label className="range-control">
          Shift X
          <input
            type="range"
            min="-220"
            max="220"
            step="1"
            value={offsetX}
            onChange={(event) => setOffsetX(Number(event.target.value))}
          />
          <span>{offsetX}</span>
        </label>

        <label className="range-control">
          Shift Y
          <input
            type="range"
            min="-220"
            max="220"
            step="1"
            value={offsetY}
            onChange={(event) => setOffsetY(Number(event.target.value))}
          />
          <span>{offsetY}</span>
        </label>

        <label className="range-control">
          Shift Z
          <input
            type="range"
            min="-220"
            max="220"
            step="1"
            value={offsetZ}
            onChange={(event) => setOffsetZ(Number(event.target.value))}
          />
          <span>{offsetZ}</span>
        </label>
      </div>
    </div>
  );
}

export default Graph3DViewer;
