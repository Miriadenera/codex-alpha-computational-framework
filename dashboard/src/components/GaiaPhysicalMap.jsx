import React, { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isNaN(number) ? fallback : number;
}

function getSourceId(source) {
  return String(source.SOURCE_ID ?? source.source_id ?? source.id ?? "");
}

function formatNumber(value, digits = 6) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return "N/A";
  }

  return number.toFixed(digits);
}

function getValue(source, key) {
  return normalizeNumber(source[key]);
}

function normalizeRange(value, min, max) {
  if (max === min) {
    return 0.5;
  }

  return (value - min) / (max - min);
}

function buildRanges(sources) {
  const keys = ["ra", "dec", "parallax", "radial_velocity", "anomaly_score"];

  const ranges = {};

  keys.forEach((key) => {
    const values = sources
      .map((source) => normalizeNumber(source[key], null))
      .filter((value) => value !== null);

    if (!values.length) {
      ranges[key] = {
        min: 0,
        max: 1,
      };

      return;
    }

    ranges[key] = {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  });

  return ranges;
}

function getColorByMode(source, colorMode, ranges) {
  if (colorMode === "anomaly_score") {
    const v = normalizeRange(
      getValue(source, "anomaly_score"),
      ranges.anomaly_score.min,
      ranges.anomaly_score.max,
    );

    if (v > 0.85) return "#39ff14";
    if (v > 0.7) return "#ffe033";
    if (v > 0.5) return "#00f5ff";
    return "#a78bfa";
  }

  if (colorMode === "parallax") {
    const v = normalizeRange(
      getValue(source, "parallax"),
      ranges.parallax.min,
      ranges.parallax.max,
    );

    if (v > 0.75) return "#ffe033";
    if (v > 0.5) return "#00f5ff";
    if (v > 0.25) return "#a78bfa";
    return "#ff3a4e";
  }

  if (colorMode === "radial_velocity") {
    const velocity = getValue(source, "radial_velocity");

    if (velocity > 50) return "#39ff14";
    if (velocity > 0) return "#00f5ff";
    if (velocity > -50) return "#a78bfa";
    return "#ff3a4e";
  }

  if (colorMode === "cluster") {
    const cluster = Number(source.anomaly_cluster ?? -1);

    if (cluster === 0) return "#00f5ff";
    if (cluster === 1) return "#ffe033";
    if (cluster === 2) return "#c084fc";
    return "#ff3a4e";
  }

  return "#00f5ff";
}

function projectSource2D(source, projection, ranges, zoom) {
  const ra = getValue(source, "ra");
  const dec = getValue(source, "dec");
  const parallax = getValue(source, "parallax");
  const radialVelocity = getValue(source, "radial_velocity");

  const xRa = normalizeRange(ra, ranges.ra.min, ranges.ra.max);
  const yDec = normalizeRange(dec, ranges.dec.min, ranges.dec.max);
  const zParallax = normalizeRange(
    parallax,
    ranges.parallax.min,
    ranges.parallax.max,
  );
  const vRadial = normalizeRange(
    radialVelocity,
    ranges.radial_velocity.min,
    ranges.radial_velocity.max,
  );

  let x = xRa;
  let y = 1 - yDec;

  if (projection === "ra_dec") {
    x = xRa;
    y = 1 - yDec;
  }

  if (projection === "ra_parallax") {
    x = xRa;
    y = 1 - zParallax;
  }

  if (projection === "dec_parallax") {
    x = yDec;
    y = 1 - zParallax;
  }

  if (projection === "ra_radial_velocity") {
    x = xRa;
    y = 1 - vRadial;
  }

  const centeredX = (x - 0.5) * zoom + 0.5;
  const centeredY = (y - 0.5) * zoom + 0.5;

  return {
    x: centeredX * 100,
    y: centeredY * 100,
  };
}

function projectSource3D(source, ranges, depthMode, scale) {
  const ra = getValue(source, "ra");
  const dec = getValue(source, "dec");
  const parallax = getValue(source, "parallax");
  const radialVelocity = getValue(source, "radial_velocity");

  const x = normalizeRange(ra, ranges.ra.min, ranges.ra.max) - 0.5;
  const y = normalizeRange(dec, ranges.dec.min, ranges.dec.max) - 0.5;

  let z = normalizeRange(parallax, ranges.parallax.min, ranges.parallax.max) - 0.5;

  if (depthMode === "radial_velocity") {
    z =
      normalizeRange(
        radialVelocity,
        ranges.radial_velocity.min,
        ranges.radial_velocity.max,
      ) - 0.5;
  }

  return {
    x: x * scale,
    y: y * scale,
    z: z * scale * 0.72,
  };
}

function create3DNodeObject(node) {
  const group = new THREE.Group();

  const color = node.selected ? "#39ff14" : node.map_color;
  const hex = parseInt(color.replace("#", ""), 16);
  const radius = node.selected ? 1.9 : node.node_radius;

  const sphereGeometry = new THREE.SphereGeometry(radius, 20, 20);
  const sphereMaterial = new THREE.MeshStandardMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity: node.selected ? 3.2 : 1.35,
    transparent: true,
    opacity: node.selected ? 1 : 0.9,
    roughness: 0.2,
    metalness: 0.05,
  });

  group.add(new THREE.Mesh(sphereGeometry, sphereMaterial));

  const glowGeometry = new THREE.SphereGeometry(
    node.selected ? radius * 4.2 : radius * 2.2,
    20,
    20,
  );

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: hex,
    transparent: true,
    opacity: node.selected ? 0.28 : 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  group.add(new THREE.Mesh(glowGeometry, glowMaterial));

  return group;
}

function GaiaPhysicalMap({ sources = [], selectedSource, onSourceSelect }) {
  const graphRef = useRef(null);

  const [viewMode, setViewMode] = useState("2d");
  const [projection, setProjection] = useState("ra_dec");
  const [depthMode, setDepthMode] = useState("parallax");
  const [colorMode, setColorMode] = useState("anomaly_score");
  const [showLabels, setShowLabels] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [zoom, setZoom] = useState(0.92);
  const [pointScale, setPointScale] = useState(1);
  const [spaceScale, setSpaceScale] = useState(230);

  const ranges = useMemo(() => buildRanges(sources), [sources]);

  const projectedSources2D = useMemo(() => {
    if (!sources.length) {
      return [];
    }

    return sources.map((source) => {
      const position = projectSource2D(source, projection, ranges, zoom);
      const color = getColorByMode(source, colorMode, ranges);
      const sourceId = getSourceId(source);

      const selected =
        selectedSource &&
        String(getSourceId(selectedSource)) === String(sourceId);

      const anomalyScore = normalizeNumber(source.anomaly_score);
      const radius = selected
        ? 9 * pointScale
        : Math.max(3.2, 3.5 + anomalyScore * 5) * pointScale;

      return {
        ...source,
        source_id: sourceId,
        map_x: position.x,
        map_y: position.y,
        map_color: selected ? "#39ff14" : color,
        map_radius: radius,
        selected,
      };
    });
  }, [sources, projection, colorMode, ranges, selectedSource, zoom, pointScale]);

  const graphData3D = useMemo(() => {
    if (!sources.length) {
      return { nodes: [], links: [] };
    }

    const nodes = sources.map((source) => {
      const sourceId = getSourceId(source);
      const position = projectSource3D(source, ranges, depthMode, spaceScale);
      const color = getColorByMode(source, colorMode, ranges);

      const selected =
        selectedSource &&
        String(getSourceId(selectedSource)) === String(sourceId);

      const anomalyScore = normalizeNumber(source.anomaly_score);
      const nodeRadius = Math.max(0.7, 0.75 + anomalyScore * 1.7) * pointScale;

      return {
        ...source,
        id: sourceId,
        source_id: sourceId,
        fx: position.x,
        fy: position.y,
        fz: position.z,
        x: position.x,
        y: position.y,
        z: position.z,
        map_color: selected ? "#39ff14" : color,
        node_radius: nodeRadius,
        selected,
      };
    });

    return {
      nodes,
      links: [],
    };
  }, [
    sources,
    ranges,
    depthMode,
    spaceScale,
    colorMode,
    selectedSource,
    pointScale,
  ]);

  useEffect(() => {
    if (viewMode !== "3d") {
      return;
    }

    if (!graphRef.current) {
      return;
    }

    const controls = graphRef.current.controls();

    if (!controls) {
      return;
    }

    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 1.1;

    if (panMode) {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      };
    } else {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
    }

    controls.update();
  }, [panMode, viewMode, graphData3D]);

  function reset3DView() {
    if (!graphRef.current) {
      return;
    }

    graphRef.current.cameraPosition(
      { x: 0, y: 0, z: 360 },
      { x: 0, y: 0, z: 0 },
      900,
    );
  }

  const selected = selectedSource;

  return (
    <section className="panel gaia-physical-map-panel">
      <div className="panel-header">
        <h2>Gaia Physical Map</h2>
        <span>Coordinate analysis layer</span>
      </div>

      <div className="gaia-map-controls">
        <label>
          View mode
          <select
            value={viewMode}
            onChange={(event) => setViewMode(event.target.value)}
          >
            <option value="2d">2D Physical Map</option>
            <option value="3d">3D Physical Map</option>
          </select>
        </label>

        {viewMode === "2d" && (
          <label>
            Projection
            <select
              value={projection}
              onChange={(event) => setProjection(event.target.value)}
            >
              <option value="ra_dec">RA / DEC</option>
              <option value="ra_parallax">RA / Parallax</option>
              <option value="dec_parallax">DEC / Parallax</option>
              <option value="ra_radial_velocity">RA / Radial Velocity</option>
            </select>
          </label>
        )}

        {viewMode === "3d" && (
          <label>
            Depth
            <select
              value={depthMode}
              onChange={(event) => setDepthMode(event.target.value)}
            >
              <option value="parallax">Parallax</option>
              <option value="radial_velocity">Radial velocity</option>
            </select>
          </label>
        )}

        <label>
          Color mode
          <select
            value={colorMode}
            onChange={(event) => setColorMode(event.target.value)}
          >
            <option value="anomaly_score">Anomaly score</option>
            <option value="parallax">Parallax</option>
            <option value="radial_velocity">Radial velocity</option>
            <option value="cluster">Cluster</option>
          </select>
        </label>

        {viewMode === "2d" && (
          <label className="range-control">
            Zoom
            <input
              type="range"
              min="0.55"
              max="1.6"
              step="0.01"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
            <span>{zoom.toFixed(2)}</span>
          </label>
        )}

        {viewMode === "3d" && (
          <>
            <button type="button" onClick={reset3DView}>
              Reset 3D view
            </button>

            <button
              type="button"
              className={panMode ? "btn-active" : ""}
              onClick={() => setPanMode((current) => !current)}
            >
              {panMode ? "Pan mode ON" : "Pan mode"}
            </button>

            <label className="range-control">
              Space scale
              <input
                type="range"
                min="90"
                max="420"
                step="5"
                value={spaceScale}
                onChange={(event) => setSpaceScale(Number(event.target.value))}
              />
              <span>{spaceScale}</span>
            </label>
          </>
        )}

        <label className="range-control">
          Source size
          <input
            type="range"
            min="0.45"
            max="2.4"
            step="0.05"
            value={pointScale}
            onChange={(event) => setPointScale(Number(event.target.value))}
          />
          <span>{pointScale.toFixed(2)}</span>
        </label>

        {viewMode === "2d" && (
          <label>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(event) => setShowLabels(event.target.checked)}
            />
            Show labels
          </label>
        )}
      </div>

      <div className="gaia-map-layout">
        {viewMode === "2d" && (
          <div className="gaia-map-canvas">
            <div className="gaia-axis gaia-axis-x">
              {projection === "dec_parallax" ? "DEC" : "RA"}
            </div>

            <div className="gaia-axis gaia-axis-y">
              {projection === "ra_dec"
                ? "DEC"
                : projection === "ra_radial_velocity"
                  ? "Radial velocity"
                  : "Parallax"}
            </div>

            {projectedSources2D.map((source) => (
              <button
                type="button"
                key={source.source_id}
                className={
                  source.selected
                    ? "gaia-map-point gaia-map-point-selected"
                    : "gaia-map-point"
                }
                style={{
                  left: `${source.map_x}%`,
                  top: `${source.map_y}%`,
                  width: `${source.map_radius}px`,
                  height: `${source.map_radius}px`,
                  background: source.map_color,
                  boxShadow: source.selected
                    ? `0 0 28px ${source.map_color}, 0 0 60px ${source.map_color}`
                    : `0 0 12px ${source.map_color}`,
                }}
                title={`SOURCE_ID: ${source.source_id}`}
                onClick={() => onSourceSelect(source)}
              >
                {showLabels && (
                  <span className="gaia-map-label">{source.source_id}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {viewMode === "3d" && (
          <div className="gaia-map-3d-canvas">
            <ForceGraph3D
              ref={graphRef}
              graphData={graphData3D}
              backgroundColor="#000000"
              nodeThreeObject={create3DNodeObject}
              nodeLabel={(node) =>
                `SOURCE_ID: ${node.source_id}\nRA: ${formatNumber(
                  node.ra,
                  6,
                )}\nDEC: ${formatNumber(
                  node.dec,
                  6,
                )}\nParallax: ${formatNumber(
                  node.parallax,
                  6,
                )}\nRadial velocity: ${formatNumber(
                  node.radial_velocity,
                  6,
                )}\nAnomaly: ${formatNumber(node.anomaly_score, 6)}`
              }
              onNodeClick={(node) => onSourceSelect(node)}
              enableNodeDrag={false}
              showNavInfo={false}
              cooldownTicks={0}
              warmupTicks={0}
            />
          </div>
        )}

        <aside className="gaia-map-inspector">
          <h3>Selected Gaia Source</h3>

          {!selected && (
            <p className="empty-selection">
              Select a source inside the physical map to inspect its Gaia
              parameters.
            </p>
          )}

          {selected && (
            <div className="details-list">
              <p>
                <span>SOURCE_ID</span>
                <strong>{getSourceId(selected)}</strong>
              </p>

              <p>
                <span>RA</span>
                <strong>{formatNumber(selected.ra, 6)}</strong>
              </p>

              <p>
                <span>DEC</span>
                <strong>{formatNumber(selected.dec, 6)}</strong>
              </p>

              <p>
                <span>Parallax</span>
                <strong>{formatNumber(selected.parallax, 6)}</strong>
              </p>

              <p>
                <span>Radial velocity</span>
                <strong>{formatNumber(selected.radial_velocity, 6)}</strong>
              </p>

              <p>
                <span>Anomaly score</span>
                <strong>{formatNumber(selected.anomaly_score, 6)}</strong>
              </p>

              <p>
                <span>Anomaly rank</span>
                <strong>{selected.anomaly_rank ?? "N/A"}</strong>
              </p>

              <p>
                <span>Cluster</span>
                <strong>{selected.anomaly_cluster ?? "N/A"}</strong>
              </p>
            </div>
          )}
        </aside>
      </div>

      <p className="gaia-map-note">
        This physical map is an exploratory coordinate projection of the Gaia
        dataset. It is intended for visual inspection and does not replace
        astrophysical validation.
      </p>
    </section>
  );
}

export default GaiaPhysicalMap;