import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function normalizeScore(value, fallback = 0) {
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
}

function buildCentralityMap(centrality = []) {
  const map = new Map();

  centrality.forEach((item) => {
    const id = String(item.SOURCE_ID);

    map.set(id, {
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
  return String(item?.SOURCE_ID ?? item?.source_id ?? item?.id ?? "");
}

/* ─── vivid colour palette ────────────────────────────────────────────────── */

const COLORS = {
  selected: "#39ff14",
  topNode: "#ffe033",
  highNode: "#00f5ff",
  midNode: "#a78bfa",
  lowNode: "#c084fc",
  background: "#ff3a4e",
  link: "rgba(0,245,255,",
};

function isSelectedNode(node, controls) {
  if (!controls.selectedSourceId) {
    return false;
  }

  return String(node.source_id) === String(controls.selectedSourceId);
}

function getNodeColor(node, controls) {
  if (isSelectedNode(node, controls)) {
    return COLORS.selected;
  }

  if (node.node_type === "background") {
    return COLORS.background;
  }

  const rank = Number(node.structural_rank ?? 999);
  const score = normalizeScore(node.structural_importance_score);

  if (rank > 0 && rank <= 5) {
    return COLORS.topNode;
  }

  if (score >= 0.45) {
    return COLORS.highNode;
  }

  if (score >= 0.35) {
    return COLORS.midNode;
  }

  return COLORS.lowNode;
}

function createNodeObject(node, controls) {
  const group = new THREE.Group();

  const selected = isSelectedNode(node, controls);
  const isBackground = node.node_type === "background";

  const baseRadius =
    (isBackground ? controls.gaiaSize : controls.anomalySize) / 10;

  const radius = selected ? baseRadius * 1.55 : baseRadius;
  const color = getNodeColor(node, controls);
  const hex = parseInt(color.replace("#", ""), 16);

  const sphereGeo = new THREE.SphereGeometry(radius, 24, 24);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity: selected ? 3.4 : isBackground ? 0.55 : 1.6,
    transparent: true,
    opacity: selected
      ? 1
      : isBackground
        ? controls.gaiaBrightness
        : controls.anomalyBrightness,
    roughness: 0.15,
    metalness: 0.1,
  });

  group.add(new THREE.Mesh(sphereGeo, sphereMat));

  const glowRadius = selected
    ? radius * 3.2
    : isBackground
      ? radius * 1.35
      : radius * controls.anomalyGlow;

  const glowGeo = new THREE.SphereGeometry(glowRadius, 24, 24);
  const glowMat = new THREE.MeshBasicMaterial({
    color: hex,
    transparent: true,
    opacity: selected
      ? 0.34
      : isBackground
        ? controls.gaiaGlowOpacity
        : controls.anomalyGlowOpacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  group.add(new THREE.Mesh(glowGeo, glowMat));

  if (!isBackground || selected) {
    const outerGeo = new THREE.SphereGeometry(
      selected ? radius * 5.2 : radius * controls.anomalyGlow * 1.7,
      16,
      16,
    );

    const outerMat = new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity: selected ? 0.09 : 0.04,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    group.add(new THREE.Mesh(outerGeo, outerMat));
  }

  return group;
}

/* ─── coordinate helpers ─────────────────────────────────────────────────── */

function getRawCoordinates(source) {
  return {
    rawX: normalizeScore(source.ra),
    rawY: normalizeScore(source.dec),
    rawZ: normalizeScore(source.parallax),
  };
}

function centerAndScaleNodes(inputNodes, offsets) {
  if (!inputNodes.length) {
    return [];
  }

  const raw = inputNodes.map((n) => ({
    ...n,
    ...getRawCoordinates(n),
  }));

  const cx = raw.reduce((s, n) => s + n.rawX, 0) / raw.length;
  const cy = raw.reduce((s, n) => s + n.rawY, 0) / raw.length;
  const cz = raw.reduce((s, n) => s + n.rawZ, 0) / raw.length;

  const centered = raw.map((n) => ({
    ...n,
    cx: n.rawX - cx,
    cy: n.rawY - cy,
    cz: n.rawZ - cz,
  }));

  const maxX = Math.max(1, ...centered.map((n) => Math.abs(n.cx)));
  const maxY = Math.max(1, ...centered.map((n) => Math.abs(n.cy)));
  const maxZ = Math.max(1, ...centered.map((n) => Math.abs(n.cz)));

  const sx = 120 / maxX;
  const sy = 120 / maxY;
  const sz = 65 / maxZ;

  return centered.map((n) => ({
    ...n,
    fx: n.cx * sx + offsets.x,
    fy: n.cy * sy + offsets.y,
    fz: n.cz * sz + offsets.z,
    x: n.cx * sx + offsets.x,
    y: n.cy * sy + offsets.y,
    z: n.cz * sz + offsets.z,
  }));
}

/* ─── fullscreen portal wrapper ──────────────────────────────────────────── */

function FullscreenPortal({ children }) {
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "#000",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ─── main component ─────────────────────────────────────────────────────── */

function Graph3DViewer({
  allSources = [],
  nodes = [],
  edges = [],
  centrality = [],
  selectedNode: controlledSelectedNode,
  onNodeSelect,
}) {
  const graphRef = useRef(null);

  const [internalSelectedNode, setInternalSelectedNode] = useState(null);

  const selectedNode =
    controlledSelectedNode === undefined
      ? internalSelectedNode
      : controlledSelectedNode;

  const [showAllSources, setShowAllSources] = useState(true);
  const [highCentralityOnly, setHighCentralityOnly] = useState(false);
  const [topStructuralOnly, setTopStructuralOnly] = useState(false);
  const [hideWeakLinks, setHideWeakLinks] = useState(false);
  const [lockLayout, setLockLayout] = useState(true);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [freeFly, setFreeFly] = useState(false);
  const [anomalyThreshold, setAnomalyThreshold] = useState(0);

  const [offsetX, setOffsetX] = useState(-70);
  const [offsetY, setOffsetY] = useState(0);
  const [offsetZ, setOffsetZ] = useState(0);

  const [gaiaBrightness, setGaiaBrightness] = useState(0.85);
  const [anomalyBrightness, setAnomalyBrightness] = useState(1.0);
  const [anomalyGlow, setAnomalyGlow] = useState(2.4);
  const [linkIntensity, setLinkIntensity] = useState(0.72);
  const [linkThickness, setLinkThickness] = useState(0.55);

  function updateSelectedNode(node) {
    if (controlledSelectedNode === undefined) {
      setInternalSelectedNode(node);
    }

    if (onNodeSelect) {
      onNodeSelect(node);
    }
  }

  const visualControls = useMemo(
    () => ({
      gaiaSize: 3.3,
      anomalySize: 4.5,
      gaiaBrightness,
      anomalyBrightness,
      anomalyGlow,
      gaiaGlowOpacity: 0.1,
      anomalyGlowOpacity: 0.18,
      selectedSourceId: selectedNode ? getSourceId(selectedNode) : null,
    }),
    [
      gaiaBrightness,
      anomalyBrightness,
      anomalyGlow,
      selectedNode,
    ],
  );

  const graphData = useMemo(() => {
    const centralityMap = buildCentralityMap(centrality);

    let anomalyNodes = nodes.map((node) => {
      const sourceId = getSourceId(node);
      const cd = centralityMap.get(sourceId) ?? {};

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
        ...cd,
      };
    });

    if (highCentralityOnly) {
      anomalyNodes = anomalyNodes.filter(
        (n) => normalizeScore(n.structural_importance_score) >= 0.4,
      );
    }

    if (topStructuralOnly) {
      anomalyNodes = anomalyNodes.filter(
        (n) => Number(n.structural_rank) > 0 && Number(n.structural_rank) <= 10,
      );
    }

    if (anomalyThreshold > 0) {
      anomalyNodes = anomalyNodes.filter(
        (n) => normalizeScore(n.anomaly_score) >= anomalyThreshold,
      );
    }

    const anomalySourceIds = new Set(anomalyNodes.map((n) => n.source_id));

    const anomalyGraphNodeIds = new Set(
      anomalyNodes.map((n) => n.graph_node_id),
    );

    let backgroundNodes = [];

    if (showAllSources) {
      backgroundNodes = allSources
        .filter((s) => !anomalySourceIds.has(getSourceId(s)))
        .map((s) => {
          const sid = getSourceId(s);

          return {
            id: "source-" + sid,
            source_id: sid,
            label: sid,
            node_type: "background",
            ra: s.ra,
            dec: s.dec,
            parallax: s.parallax,
            pmra: s.pmra,
            pmdec: s.pmdec,
            radial_velocity: s.radial_velocity,
            anomaly_score: normalizeScore(s.anomaly_score),
            anomaly_label: s.anomaly_label,
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
      .map((e) => ({
        source: "graph-" + String(e.source_node),
        target: "graph-" + String(e.target_node),
        source_node: String(e.source_node),
        target_node: String(e.target_node),
        feature_distance: normalizeScore(e.feature_distance),
        similarity_weight: normalizeScore(e.similarity_weight, 0.1),
      }))
      .filter(
        (e) =>
          anomalyGraphNodeIds.has(e.source_node) &&
          anomalyGraphNodeIds.has(e.target_node),
      );

    if (hideWeakLinks) {
      graphLinks = graphLinks.filter(
        (e) => normalizeScore(e.similarity_weight) >= 0.65,
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

      graphRef.current.d3Force("link").distance((l) => {
        return 24 + normalizeScore(l.feature_distance, 1) * 8;
      });

      graphRef.current.d3Force("link").strength(0.12);
    }

    window.setTimeout(() => resetCamera(), 80);
  }, [graphData, showAllSources, lockLayout]);

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }

    const controls = graphRef.current.controls();

    if (!controls) {
      return;
    }

    if (freeFly) {
      controls.enablePan = true;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.zoomSpeed = 1.8;

      let animFrame;

      function trackTarget() {
        const camera = graphRef.current?.camera?.();

        if (!camera || !controls) {
          animFrame = requestAnimationFrame(trackTarget);
          return;
        }

        const dir = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(camera.quaternion)
          .normalize();

        const dist = controls.target.distanceTo(camera.position);

        controls.target
          .copy(camera.position)
          .addScaledVector(dir, Math.max(dist, 60));

        controls.update();

        animFrame = requestAnimationFrame(trackTarget);
      }

      animFrame = requestAnimationFrame(trackTarget);

      return () => cancelAnimationFrame(animFrame);
    }

    controls.enablePan = true;
    controls.zoomSpeed = 1.0;
    controls.dampingFactor = 0.1;
  }, [freeFly]);

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
    window.setTimeout(() => resetCamera(), 100);
  }

  function boostAnomalies() {
    setAnomalyBrightness(1);
    setAnomalyGlow(3.4);
    setLinkIntensity(0.9);
    setLinkThickness(0.75);
  }

  function softView() {
    setGaiaBrightness(0.5);
    setAnomalyBrightness(0.95);
    setAnomalyGlow(1.8);
    setLinkIntensity(0.38);
    setLinkThickness(0.28);
  }

  function balancedView() {
    setGaiaBrightness(0.85);
    setAnomalyBrightness(1.0);
    setAnomalyGlow(2.4);
    setLinkIntensity(0.72);
    setLinkThickness(0.55);
  }

  const handleNodeClick = useCallback(
    (node) => {
      updateSelectedNode(node);

      /*
        Important:
        clicking a node must not move the camera.
        The user's current view is preserved.
      */
    },
    [controlledSelectedNode, onNodeSelect],
  );

  function closeSelectedNodePanel() {
    updateSelectedNode(null);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape" && fullscreenMode) {
        setFullscreenMode(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreenMode]);

  useEffect(() => {
    window.setTimeout(() => {
      if (graphRef.current) {
        window.dispatchEvent(new Event("resize"));
        resetCamera();
      }
    }, 80);
  }, [fullscreenMode]);

  const graphCanvas = (
    <div className="graph-3d-canvas">
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        backgroundColor="#000000"
        nodeLabel={(node) =>
          `SOURCE_ID: ${node.source_id}\nType: ${node.node_type}\nAnomaly: ${Number(
            node.anomaly_score ?? 0,
          ).toFixed(6)}\nStructural: ${Number(
            node.structural_importance_score ?? 0,
          ).toFixed(6)}\nRank: ${node.structural_rank ?? "N/A"}`
        }
        nodeThreeObject={(node) => createNodeObject(node, visualControls)}
        linkColor={() => COLORS.link + String(linkIntensity) + ")"}
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
  );

  const toolbar = (
    <div className="graph-3d-toolbar">
      <div>
        <strong>Interactive Relational Graph</strong>
        <span>
          {graphData.nodes.length} nodes / {graphData.links.length} edges
        </span>
      </div>

      <div className="graph-legend">
        <span className="legend-dot selected" /> selected
        <span className="legend-dot top" /> top 5
        <span className="legend-dot high" /> high centrality
        <span className="legend-dot mid" /> medium
        <span className="legend-dot low" /> anomaly
        <span className="legend-dot background" /> Gaia source
      </div>
    </div>
  );

  const controls = (
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

      <button
        type="button"
        className={fullscreenMode ? "btn-active" : ""}
        onClick={() => setFullscreenMode((v) => !v)}
      >
        {fullscreenMode ? "✕ Exit fullscreen" : "⛶ Fullscreen"}
      </button>

      <button
        type="button"
        className={freeFly ? "btn-active" : ""}
        onClick={() => setFreeFly((v) => !v)}
        title="Zoom toward camera direction instead of scene origin"
      >
        {freeFly ? "🚀 Free fly ON" : "🚀 Free fly"}
      </button>

      <label>
        <input
          type="checkbox"
          checked={lockLayout}
          onChange={(e) => setLockLayout(e.target.checked)}
        />
        Lock node layout
      </label>

      <label>
        <input
          type="checkbox"
          checked={showAllSources}
          onChange={(e) => setShowAllSources(e.target.checked)}
        />
        Show all 1000 Gaia sources
      </label>

      <label>
        <input
          type="checkbox"
          checked={highCentralityOnly}
          onChange={(e) => setHighCentralityOnly(e.target.checked)}
        />
        High centrality only
      </label>

      <label>
        <input
          type="checkbox"
          checked={topStructuralOnly}
          onChange={(e) => setTopStructuralOnly(e.target.checked)}
        />
        Top 10 structural
      </label>

      <label>
        <input
          type="checkbox"
          checked={hideWeakLinks}
          onChange={(e) => setHideWeakLinks(e.target.checked)}
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
          onChange={(e) => setAnomalyThreshold(Number(e.target.value))}
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
          onChange={(e) => setGaiaBrightness(Number(e.target.value))}
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
          onChange={(e) => setAnomalyBrightness(Number(e.target.value))}
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
          onChange={(e) => setAnomalyGlow(Number(e.target.value))}
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
          onChange={(e) => setLinkIntensity(Number(e.target.value))}
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
          onChange={(e) => setLinkThickness(Number(e.target.value))}
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
          onChange={(e) => setOffsetX(Number(e.target.value))}
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
          onChange={(e) => setOffsetY(Number(e.target.value))}
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
          onChange={(e) => setOffsetZ(Number(e.target.value))}
        />
        <span>{offsetZ}</span>
      </label>
    </div>
  );

  const nodePanel = selectedNode && (
    <div className="selected-node-panel">
      <button
        type="button"
        className="selected-node-close"
        onClick={closeSelectedNodePanel}
        aria-label="Close selected source panel"
      >
        ×
      </button>

      <div>
        <span>Selected source</span>
        <strong>{getSourceId(selectedNode)}</strong>
      </div>

      <div className="selected-node-grid">
        <p>
          <span>Type</span>
          {selectedNode.node_type ?? "source"}
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
  );

  if (fullscreenMode) {
    return (
      <FullscreenPortal>
        <div
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            background: "#000",
          }}
        >
          {toolbar}
          {graphCanvas}
          {nodePanel}
        </div>

        <div
          style={{
            flexShrink: 0,
            background: "rgba(2,6,23,0.96)",
            borderTop: "1px solid rgba(0,245,255,0.14)",
            maxHeight: "220px",
            overflowY: "auto",
          }}
        >
          {controls}
        </div>
      </FullscreenPortal>
    );
  }

  return (
    <div className="graph-viewer-wrapper">
      <div className="graph-3d-shell">
        {toolbar}
        {graphCanvas}
        {nodePanel}
      </div>

      {controls}
    </div>
  );
}

export default Graph3DViewer;