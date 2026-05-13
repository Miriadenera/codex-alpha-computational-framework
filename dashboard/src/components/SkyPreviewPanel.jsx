import React, { useEffect, useMemo, useRef, useState } from "react";

const ALADIN_SCRIPT_ID = "aladin-lite-v3-script";
const ALADIN_SCRIPT_URL =
  "https://aladin.u-strasbg.fr/AladinLite/api/v3/latest/aladin.js";

function normalizeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isNaN(number) ? fallback : number;
}

function getSourceId(source) {
  return String(source?.SOURCE_ID ?? source?.source_id ?? source?.id ?? "");
}

function formatGaiaValue(value, digits = 10) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return "N/A";
  }

  return number.toFixed(digits);
}

function loadAladinScript() {
  return new Promise((resolve, reject) => {
    if (window.A?.aladin && window.A?.init) {
      resolve(window.A);
      return;
    }

    const existingScript = document.getElementById(ALADIN_SCRIPT_ID);

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.A));
      existingScript.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = ALADIN_SCRIPT_ID;
    script.src = ALADIN_SCRIPT_URL;
    script.async = true;
    script.charset = "utf-8";

    script.onload = () => resolve(window.A);
    script.onerror = reject;

    document.body.appendChild(script);
  });
}

function buildEsaSkyUrl(source) {
  const ra = normalizeNumber(source?.ra, null);
  const dec = normalizeNumber(source?.dec, null);

  if (ra === null || dec === null) {
    return "https://sky.esa.int/esasky/";
  }

  return (
    "https://sky.esa.int/esasky/?target=" +
    encodeURIComponent(`${ra} ${dec}`) +
    "&hips=Digitized%20Sky%20Survey%202%20color"
  );
}

function buildGaiaArchiveUrl(source) {
  const sourceId = getSourceId(source);

  return (
    "https://gea.esac.esa.int/archive/?target=" +
    encodeURIComponent("Gaia DR3 " + sourceId)
  );
}

function SkyPreviewPanel({ selectedSource }) {
  const containerIdRef = useRef(
    "aladin-preview-" + Math.random().toString(36).slice(2),
  );

  const aladinRef = useRef(null);
  const markerCatalogRef = useRef(null);

  const [survey, setSurvey] = useState("P/DSS2/color");
  const [fov, setFov] = useState(0.08);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const sourceId = getSourceId(selectedSource);

  const coordinates = useMemo(() => {
    const ra = normalizeNumber(selectedSource?.ra, null);
    const dec = normalizeNumber(selectedSource?.dec, null);

    if (ra === null || dec === null) {
      return null;
    }

    return {
      ra,
      dec,
      target: `${ra} ${dec}`,
    };
  }, [selectedSource]);

  useEffect(() => {
    let cancelled = false;

    async function initializeAladin() {
      if (!coordinates) {
        return;
      }

      try {
        setStatus("loading");
        setError(null);

        const A = await loadAladinScript();

        if (cancelled) {
          return;
        }

        await A.init;

        if (cancelled) {
          return;
        }

        if (!aladinRef.current) {
          aladinRef.current = A.aladin("#" + containerIdRef.current, {
            target: coordinates.target,
            survey,
            fov,
            cooFrame: "ICRSd",
            showReticle: true,
            showZoomControl: true,
            showFullscreenControl: true,
            showLayersControl: true,
            showGotoControl: true,
            showFrame: true,
            reticleColor: "rgb(57, 255, 20)",
            reticleSize: 28,
          });
        } else {
          aladinRef.current.setImageSurvey(survey);
          aladinRef.current.gotoRaDec(coordinates.ra, coordinates.dec);
          aladinRef.current.setFov(fov);
        }

        setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setError(err?.message ?? "Unable to load Aladin Lite.");
        }
      }
    }

    initializeAladin();

    return () => {
      cancelled = true;
    };
  }, [coordinates, survey, fov]);

  useEffect(() => {
    if (!coordinates || !window.A || !aladinRef.current) {
      return;
    }

    try {
      if (markerCatalogRef.current) {
        aladinRef.current.removeCatalog(markerCatalogRef.current);
        markerCatalogRef.current = null;
      }

      const popupDescription = `
        <strong>Codex Alpha candidate</strong><br/>
        SOURCE_ID: ${sourceId}<br/>
        RA: ${formatGaiaValue(coordinates.ra, 10)}<br/>
        DEC: ${formatGaiaValue(coordinates.dec, 10)}
      `;

      const marker = window.A.marker(coordinates.ra, coordinates.dec, {
        popupTitle: sourceId ? "Gaia DR3 " + sourceId : "Selected Gaia source",
        popupDesc: popupDescription,
      });

      const catalog = window.A.catalog({
        name: "Codex Alpha selected source",
        sourceSize: 18,
        color: "#39ff14",
        shape: "circle",
        onClick: "showPopup",
      });

      catalog.addSources([marker]);
      aladinRef.current.addCatalog(catalog);

      markerCatalogRef.current = catalog;
    } catch {
      /*
        Marker rendering is auxiliary. The sky preview itself must remain usable
        even if catalog overlay creation fails.
      */
    }
  }, [coordinates, sourceId]);

  if (!selectedSource || !coordinates) {
    return (
      <section className="panel sky-preview-panel">
        <div className="panel-header">
          <div>
            <h2>Candidate Sky Preview</h2>
            <span>Embedded Aladin Lite visual inspection</span>
          </div>
        </div>

        <div className="empty-selection">
          Select a candidate to load its sky preview.
        </div>
      </section>
    );
  }

  return (
    <section className="panel sky-preview-panel">
      <div className="panel-header">
        <div>
          <h2>Candidate Sky Preview</h2>
          <span>Embedded Aladin Lite visual inspection</span>
        </div>
      </div>

      <div className="sky-preview-toolbar">
        <div className="sky-preview-source-pill">
          <span>SOURCE_ID</span>
          <strong>{sourceId}</strong>
        </div>

        <div className="sky-preview-source-pill">
          <span>RA</span>
          <strong>{formatGaiaValue(coordinates.ra, 10)}</strong>
        </div>

        <div className="sky-preview-source-pill">
          <span>DEC</span>
          <strong>{formatGaiaValue(coordinates.dec, 10)}</strong>
        </div>

        <label>
          Survey
          <select value={survey} onChange={(event) => setSurvey(event.target.value)}>
            <option value="P/DSS2/color">DSS2 color</option>
            <option value="P/2MASS/color">2MASS color</option>
            <option value="P/WISE/color">WISE color</option>
            <option value="P/PanSTARRS/DR1/color-z-zg-g">Pan-STARRS color</option>
          </select>
        </label>

        <label className="range-control">
          FoV
          <input
            type="range"
            min="0.02"
            max="0.8"
            step="0.01"
            value={fov}
            onChange={(event) => setFov(Number(event.target.value))}
          />
          <span>{fov.toFixed(2)}°</span>
        </label>

        <a
          className="dashboard-nav-button"
          href={buildEsaSkyUrl(selectedSource)}
          target="_blank"
          rel="noreferrer"
        >
          Open in ESASky
        </a>

        <a
          className="dashboard-nav-button"
          href={buildGaiaArchiveUrl(selectedSource)}
          target="_blank"
          rel="noreferrer"
        >
          Open in Gaia Archive
        </a>
      </div>

      <div className="sky-preview-canvas-shell">
        <div id={containerIdRef.current} className="sky-preview-canvas" />

        {status === "loading" && (
          <div className="sky-preview-overlay">Loading Aladin Lite sky field...</div>
        )}

        {status === "error" && (
          <div className="sky-preview-overlay sky-preview-error">
            {error ?? "Unable to load Aladin Lite."}
          </div>
        )}
      </div>

      <p className="sky-preview-note">
        This embedded sky preview is intended for visual inspection only. It
        does not replace Gaia Archive, ESASky or catalogue-level astrophysical
        validation.
      </p>
    </section>
  );
}

export default SkyPreviewPanel;