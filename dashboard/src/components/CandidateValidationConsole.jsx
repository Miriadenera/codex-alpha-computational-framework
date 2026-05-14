import React from "react";

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

function formatNumber(value, digits = 6) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return "N/A";
  }

  return number.toFixed(digits);
}

function buildGaiaArchiveUrl(source) {
  const sourceId = getSourceId(source);

  return (
    "https://gea.esac.esa.int/archive/?target=" +
    encodeURIComponent("Gaia DR3 " + sourceId)
  );
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

function buildSimbadUrl(source) {
  const ra = normalizeNumber(source?.ra, null);
  const dec = normalizeNumber(source?.dec, null);

  if (ra === null || dec === null) {
    return "https://simbad.cds.unistra.fr/simbad/";
  }

  return (
    "https://simbad.cds.unistra.fr/simbad/sim-coo?Coord=" +
    encodeURIComponent(`${formatGaiaValue(ra, 10)} ${formatGaiaValue(dec, 10)}`) +
    "&CooFrame=ICRS&CooEpoch=2000&CooEqui=2000&Radius=5&Radius.unit=arcsec"
  );
}

function buildVizierUrl(source) {
  const ra = normalizeNumber(source?.ra, null);
  const dec = normalizeNumber(source?.dec, null);

  if (ra === null || dec === null) {
    return "https://vizier.cds.unistra.fr/viz-bin/VizieR";
  }

  return (
    "https://vizier.cds.unistra.fr/viz-bin/VizieR?-c=" +
    encodeURIComponent(`${formatGaiaValue(ra, 10)} ${formatGaiaValue(dec, 10)}`) +
    "&-c.rs=5&-c.u=arcsec"
  );
}

function buildSourceAdqlQuery(source) {
  const sourceId = getSourceId(source);

  if (!sourceId) {
    return "";
  }

  return `SELECT *
FROM gaiadr3.gaia_source
WHERE source_id = ${sourceId}`;
}

function buildConeSearchAdqlQuery(source) {
  const ra = normalizeNumber(source?.ra, null);
  const dec = normalizeNumber(source?.dec, null);

  if (ra === null || dec === null) {
    return "";
  }

  return `SELECT TOP 100 *
FROM gaiadr3.gaia_source
WHERE 1 = CONTAINS(
  POINT('ICRS', ra, dec),
  CIRCLE('ICRS', ${formatGaiaValue(ra, 10)}, ${formatGaiaValue(dec, 10)}, 0.05)
)`;
}

function buildGaiaNssAdqlQuery(source) {
  const sourceId = getSourceId(source);

  if (!sourceId) {
    return "";
  }

  return `SELECT *
FROM gaiadr3.nss_two_body_orbit
WHERE source_id = ${sourceId}`;
}

function buildValidationChecklist(source) {
  if (!source) {
    return "";
  }

  const sourceId = getSourceId(source);

  return `Codex Alpha Candidate External Validation Checklist

SOURCE_ID:
${sourceId}

1. Gaia Archive source inspection
- Open the Gaia Archive source page.
- Verify astrometric parameters, photometry, RUWE, proper motion and available Gaia flags.
- Confirm that the SOURCE_ID corresponds to the selected candidate.

2. Gaia cone-search inspection
- Run the prepared ADQL cone-search query.
- Inspect neighbouring Gaia sources within the selected radius.
- Check whether the candidate is isolated or embedded in a local stellar neighbourhood.

3. SIMBAD crossmatch
- Open the prepared SIMBAD cone-search link.
- Check whether the source is already associated with a known object.
- Record object type, identifiers, bibliographic references and angular separation.

4. VizieR catalogue crossmatch
- Open the prepared VizieR cone-search link.
- Inspect available catalogue matches around the same coordinates.
- Check 2MASS, WISE, Pan-STARRS, variable-star catalogues and other relevant datasets.

5. Gaia NSS / binary-system check
- Run the Gaia NSS ADQL query.
- Verify whether the source is listed as a non-single-star or binary-system solution.
- If matched, treat the anomaly as potentially explainable by binarity or orbital motion.

6. Known-object classification check
- Compare Gaia, SIMBAD, VizieR and NSS evidence.
- Classify the candidate conservatively as known object, likely stellar source, possible binary, possible variable, catalogue artefact, or unresolved candidate requiring further study.

Scientific note:
This validation checklist does not confirm exotic physics. It defines a reproducible external verification pathway for a computationally selected Gaia candidate.`;
}

function buildValidationReport(source) {
  if (!source) {
    return "";
  }

  const sourceId = getSourceId(source);

  return `Codex Alpha Candidate Validation Report

SOURCE_ID:
${sourceId}

Gaia astrometric parameters:
RA: ${formatGaiaValue(source.ra, 10)} deg
DEC: ${formatGaiaValue(source.dec, 10)} deg
Parallax: ${formatGaiaValue(source.parallax, 10)} mas
Radial velocity: ${formatGaiaValue(source.radial_velocity, 10)} km/s

Computational indicators:
Anomaly score: ${formatNumber(source.anomaly_score, 6)}
Anomaly rank: ${source.anomaly_rank ?? "N/A"}
Structural rank: ${source.structural_rank ?? "N/A"}
Structural importance: ${formatNumber(source.structural_importance_score, 6)}
Local density score: ${formatNumber(source.local_density_score, 6)}
Mean neighbor distance: ${formatNumber(source.mean_neighbor_distance, 6)}
Dominant anomaly feature: ${source.dominant_anomaly_feature ?? "N/A"}
Dominant feature z-score: ${formatNumber(source.dominant_feature_zscore, 6)}
Coherence-proxy index: ${formatNumber(source.coherence_proxy, 6)}

External inspection:
Gaia Archive:
${buildGaiaArchiveUrl(source)}

ESASky:
${buildEsaSkyUrl(source)}

SIMBAD cone search:
${buildSimbadUrl(source)}

VizieR cone search:
${buildVizierUrl(source)}

Gaia ADQL source query:
${buildSourceAdqlQuery(source)}

Gaia ADQL cone-search query:
${buildConeSearchAdqlQuery(source)}

Gaia NSS / binary-system ADQL query:
${buildGaiaNssAdqlQuery(source)}

Scientific note:
This source is an internal computational candidate of the Codex Alpha Computational Framework. The candidate status is based on anomaly score, structural graph relevance, local density, feature deviation and coherence-proxy ranking. This is not an official astronomical classification and does not imply that the source is physically exotic. Independent astrophysical validation is required.`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

function ValidationStep({ label, status, tone = "ready" }) {
  return (
    <div className={"validation-step validation-step-" + tone}>
      <span>{label}</span>
      <strong>{status}</strong>
    </div>
  );
}

function CandidateValidationConsole({ selectedSource }) {
  if (!selectedSource) {
    return (
      <section className="panel candidate-validation-console">
        <div className="panel-header">
          <div>
            <h2>Candidate Validation Console</h2>
            <span>External validation workflow</span>
          </div>
        </div>

        <div className="empty-selection">
          Select a candidate to prepare validation queries and external
          inspection links.
        </div>
      </section>
    );
  }

  const sourceId = getSourceId(selectedSource);
  const sourceAdqlQuery = buildSourceAdqlQuery(selectedSource);
  const coneSearchQuery = buildConeSearchAdqlQuery(selectedSource);
  const gaiaNssQuery = buildGaiaNssAdqlQuery(selectedSource);
  const validationReport = buildValidationReport(selectedSource);
  const validationChecklist = buildValidationChecklist(selectedSource);

  return (
    <section className="panel candidate-validation-console">
      <div className="panel-header">
        <div>
          <h2>Candidate Validation Console</h2>
          <span>External validation workflow</span>
        </div>
      </div>

      <div className="validation-console-warning">
        <strong>Validation note:</strong> this console prepares reproducible
        inspection steps for the selected Gaia source. It does not confirm an
        astrophysical classification.
      </div>

      <div className="validation-console-grid">
        <div className="validation-console-card validation-console-main">
          <div className="validation-console-title">
            <span>Selected candidate</span>
            <strong>{sourceId}</strong>
          </div>

          <div className="validation-mini-grid">
            <p>
              <span>RA (deg)</span>
              <strong>{formatGaiaValue(selectedSource.ra, 10)}</strong>
            </p>

            <p>
              <span>DEC (deg)</span>
              <strong>{formatGaiaValue(selectedSource.dec, 10)}</strong>
            </p>

            <p>
              <span>Parallax (mas)</span>
              <strong>{formatGaiaValue(selectedSource.parallax, 10)}</strong>
            </p>

            <p>
              <span>Radial velocity (km/s)</span>
              <strong>
                {formatGaiaValue(selectedSource.radial_velocity, 10)}
              </strong>
            </p>
          </div>

          <div className="validation-action-row">
            <button
              type="button"
              className="dashboard-nav-button dashboard-nav-button-accent"
              onClick={() => copyText(sourceAdqlQuery)}
            >
              Copy Gaia source ADQL
            </button>

            <button
              type="button"
              className="dashboard-nav-button"
              onClick={() => copyText(coneSearchQuery)}
            >
              Copy cone-search ADQL
            </button>

            <button
              type="button"
              className="dashboard-nav-button"
              onClick={() => copyText(gaiaNssQuery)}
            >
              Copy Gaia NSS ADQL
            </button>

            <button
              type="button"
              className="dashboard-nav-button"
              onClick={() => copyText(validationReport)}
            >
              Copy validation report
            </button>

            <button
              type="button"
              className="dashboard-nav-button"
              onClick={() => copyText(validationChecklist)}
            >
              Copy validation checklist
            </button>
          </div>

          <div className="validation-action-row">
            <a
              className="dashboard-nav-button"
              href={buildSimbadUrl(selectedSource)}
              target="_blank"
              rel="noreferrer"
            >
              Open SIMBAD
            </a>

            <a
              className="dashboard-nav-button"
              href={buildVizierUrl(selectedSource)}
              target="_blank"
              rel="noreferrer"
            >
              Open VizieR
            </a>

            <a
              className="dashboard-nav-button"
              href={buildGaiaArchiveUrl(selectedSource)}
              target="_blank"
              rel="noreferrer"
            >
              Open Gaia Archive
            </a>

            <a
              className="dashboard-nav-button"
              href={buildEsaSkyUrl(selectedSource)}
              target="_blank"
              rel="noreferrer"
            >
              Open ESASky
            </a>
          </div>
        </div>

        <div className="validation-console-card">
          <h3>Validation status</h3>

          <div className="validation-step-list">
            <ValidationStep
              label="Gaia Archive source link"
              status="Ready"
              tone="ready"
            />

            <ValidationStep
              label="Embedded sky preview"
              status="Ready"
              tone="ready"
            />

            <ValidationStep
              label="Gaia ADQL query"
              status="Ready"
              tone="ready"
            />

            <ValidationStep
              label="SIMBAD crossmatch"
              status="External ready"
              tone="ready"
            />

            <ValidationStep
              label="VizieR catalogue crossmatch"
              status="External ready"
              tone="ready"
            />

            <ValidationStep
              label="Gaia NSS / binary-system check"
              status="ADQL ready"
              tone="ready"
            />

            <ValidationStep
              label="Known-object classification check"
              status="Checklist ready"
              tone="ready"
            />
          </div>
        </div>
      </div>

      <div className="validation-query-grid">
        <div className="validation-query-box">
          <div className="validation-query-header">
            <span>Gaia source ADQL</span>

            <button type="button" onClick={() => copyText(sourceAdqlQuery)}>
              Copy
            </button>
          </div>

          <pre>
            <code>{sourceAdqlQuery}</code>
          </pre>
        </div>

        <div className="validation-query-box">
          <div className="validation-query-header">
            <span>Gaia cone-search ADQL</span>

            <button type="button" onClick={() => copyText(coneSearchQuery)}>
              Copy
            </button>
          </div>

          <pre>
            <code>{coneSearchQuery}</code>
          </pre>
        </div>

        <div className="validation-query-box">
          <div className="validation-query-header">
            <span>Gaia NSS / binary-system ADQL</span>

            <button type="button" onClick={() => copyText(gaiaNssQuery)}>
              Copy
            </button>
          </div>

          <pre>
            <code>{gaiaNssQuery}</code>
          </pre>
        </div>
      </div>

      <p className="validation-console-note">
        This console defines a reproducible external validation pathway:
        Gaia Archive source inspection, ESASky/Aladin visual inspection,
        ADQL cone-search, SIMBAD crossmatch, VizieR catalogue crossmatch,
        Gaia NSS binary-system screening and conservative known-object
        classification.
      </p>
    </section>
  );
}

export default CandidateValidationConsole;