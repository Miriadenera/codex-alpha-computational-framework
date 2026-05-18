import React from "react";
import { formatNumber } from "../utils/stellarInference.js";

/*
  StellarInferencePanel

  Scientific explanation panel for the synthetic stellar reconstruction.

  It explains which Gaia-derived quantities and internal proxies were used
  to build the 3D visual model.

  This component does not claim confirmed stellar classification.
*/

function safeText(value) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  return String(value);
}

function percent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "N/A";
  }

  return `${Math.max(0, Math.min(100, number * 100)).toFixed(1)}%`;
}

function ConfidenceBadge({ level }) {
  const normalized = safeText(level).toLowerCase();

  let label = "Limited";
  let className = "stellar-confidence-badge limited";

  if (normalized === "medium") {
    label = "Medium";
    className = "stellar-confidence-badge medium";
  }

  if (normalized === "low") {
    label = "Low";
    className = "stellar-confidence-badge low";
  }

  return <span className={className}>{label} confidence</span>;
}

function InferenceMetric({ label, value, unit, note }) {
  return (
    <div className="stellar-inference-metric">
      <span>{label}</span>

      <strong>
        {value}
        {unit ? <small> {unit}</small> : null}
      </strong>

      {note ? <p>{note}</p> : null}
    </div>
  );
}

function ProxyBar({ label, value, note }) {
  const numeric = Number(value);
  const percentage = Number.isFinite(numeric)
    ? Math.max(0, Math.min(100, numeric * 100))
    : 0;

  return (
    <div className="stellar-proxy-bar">
      <div className="stellar-proxy-bar-header">
        <span>{label}</span>
        <strong>{Number.isFinite(numeric) ? `${percentage.toFixed(1)}%` : "N/A"}</strong>
      </div>

      <div className="stellar-proxy-track">
        <div
          className="stellar-proxy-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {note ? <small>{note}</small> : null}
    </div>
  );
}

export default function StellarInferencePanel({ fullRecord, starModel }) {
  if (!fullRecord || !starModel) {
    return (
      <section className="panel stellar-inference-panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Derived Stellar Inference</div>
            <h2>No selected source</h2>
          </div>
        </div>

        <p>
          Select a Gaia source from any framework page to generate a
          physically-informed synthetic stellar reconstruction.
        </p>
      </section>
    );
  }

  const confidenceFlags = Array.isArray(starModel.confidenceFlags)
    ? starModel.confidenceFlags
    : [];

  return (
    <section className="panel stellar-inference-panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Derived Stellar Inference</div>
          <h2>Proxy-Based Stellar Model</h2>
        </div>

        <ConfidenceBadge level={starModel.confidenceLevel} />
      </div>

      <div className="stellar-inference-summary">
        <div className="stellar-inference-class-card">
          <span>Visual stellar proxy</span>
          <strong>{safeText(starModel.spectralProxyShortLabel)}</strong>
          <p>{safeText(starModel.spectralProxyDescription)}</p>
        </div>

        <div className="stellar-inference-color-card">
          <span>Rendering color</span>

          <div className="stellar-color-row">
            <div
              className="stellar-color-swatch"
              style={{
                background: starModel.colorHex ?? "#ffb347",
                boxShadow: `0 0 22px ${starModel.emissiveHex ?? "#ff7a2c"}`,
              }}
            />
            <div>
              <strong>{safeText(starModel.colorHex)}</strong>
              <small>emissive {safeText(starModel.emissiveHex)}</small>
            </div>
          </div>
        </div>
      </div>

      <div className="stellar-inference-grid">
        <InferenceMetric
          label="BP-RP / Gaia color proxy"
          value={formatNumber(starModel.colorIndex, 4)}
          note="Used as the main color-temperature visual proxy."
        />

        <InferenceMetric
          label="Estimated effective temperature"
          value={formatNumber(starModel.effectiveTemperatureK, 0)}
          unit="K"
          note="Approximate color-temperature estimate, not spectroscopic confirmation."
        />

        <InferenceMetric
          label="Absolute Gaia-G magnitude"
          value={formatNumber(starModel.absoluteMagnitudeG, 3)}
          unit="mag"
          note="Derived from apparent G magnitude and distance estimate when available."
        />

        <InferenceMetric
          label="Estimated luminosity"
          value={formatNumber(starModel.luminosityRelative, 4)}
          unit="L☉"
          note="Broad luminosity proxy derived from absolute Gaia-G magnitude."
        />

        <InferenceMetric
          label="Estimated radius"
          value={formatNumber(starModel.radiusRelative, 4)}
          unit="R☉"
          note="Derived from luminosity and temperature proxies."
        />

        <InferenceMetric
          label="Visual scale"
          value={formatNumber(starModel.visualScale, 3)}
          unit="×"
          note="Compressed rendering scale used to keep the 3D viewer readable."
        />
      </div>

      <div className="stellar-proxy-section">
        <ProxyBar
          label="Activity render proxy"
          value={starModel.activityProxy}
          note="Controls surface texture intensity only. Not a measured stellar activity index."
        />

        <ProxyBar
          label="Corona intensity proxy"
          value={starModel.coronaIntensity}
          note="Controls visual halo/glow intensity only."
        />

        <ProxyBar
          label="Surface contrast proxy"
          value={starModel.surfaceContrast}
          note="Controls visible granulation and starspot contrast in the synthetic texture."
        />

        <ProxyBar
          label="Anomaly score"
          value={starModel.anomalyScore}
          note="Internal anomaly prioritization indicator."
        />

        <ProxyBar
          label="Dynamics index"
          value={starModel.dynamicsIndex}
          note="Candidate-level kinematic prioritization proxy."
        />

        <ProxyBar
          label="Hidden companion index"
          value={starModel.hiddenCompanionIndex}
          note="Heuristic unresolved-companion suspicion proxy, not a confirmation."
        />
      </div>

      <div className="stellar-inference-notes">
        <div>
          <h3>Model construction logic</h3>

          <p>
            The visual reconstruction is generated from Gaia-derived observable
            proxies such as color index, apparent magnitude, parallax-derived
            distance, proper motion and internal dashboard scores. The resulting
            3D object is a physically-informed synthetic visualization, not an
            observed stellar surface.
          </p>
        </div>

        <div>
          <h3>Confidence limitations</h3>

          {confidenceFlags.length === 0 ? (
            <p>
              No major missing proxy flags were detected for this synthetic
              reconstruction. The model remains candidate-level and still
              requires external validation.
            </p>
          ) : (
            <ul>
              {confidenceFlags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="stellar-inference-caution">
        <strong>Scientific caution:</strong>{" "}
        This reconstruction does not confirm stellar type, luminosity class,
        magnetic activity, binarity, companions, planets, exotic objects or new
        physical mechanisms. It is a visual synthesis of available Gaia-derived
        and framework-derived proxies.
      </div>
    </section>
  );
}