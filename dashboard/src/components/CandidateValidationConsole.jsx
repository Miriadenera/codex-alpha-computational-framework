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

function formatBoolean(value) {
  if (value === true) {
    return "Yes";
  }

  if (value === false) {
    return "No";
  }

  return "N/A";
}

function normalizeLabel(value) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getValidationTone(status) {
  const normalized = String(status ?? "");

  if (
    normalized === "externally_contextualized" ||
    normalized === "high_priority_followup"
  ) {
    return "ready";
  }

  if (normalized === "incomplete_external_validation") {
    return "planned";
  }

  if (
    normalized === "pending_followup" ||
    normalized === "crossmatch_not_available"
  ) {
    return "planned";
  }

  return "ready";
}

function getServiceTone(status) {
  const normalized = String(status ?? "");

  if (normalized === "match" || normalized === "no_match") {
    return "ready";
  }

  if (normalized === "service_error" || normalized === "not_checked") {
    return "planned";
  }

  return "ready";
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

function getCrossmatchGaiaSourceAdql(source, crossmatchResult) {
  return crossmatchResult?.gaia_source_adql || buildSourceAdqlQuery(source);
}

function getCrossmatchConeSearchAdql(source, crossmatchResult) {
  return (
    crossmatchResult?.gaia_cone_search_adql ||
    buildConeSearchAdqlQuery(source)
  );
}

function getCrossmatchNssAdql(source, crossmatchResult) {
  return crossmatchResult?.gaia_nss_adql || buildGaiaNssAdqlQuery(source);
}

function buildValidationChecklist(source, crossmatchResult = null) {
  if (!source) {
    return "";
  }

  const sourceId = getSourceId(source);

  const crossmatchBlock = crossmatchResult
    ? `

Backend crossmatch result:
Validation status: ${normalizeLabel(crossmatchResult.validation_status)}
Classification hint: ${normalizeLabel(crossmatchResult.classification_hint)}

SIMBAD:
Status: ${crossmatchResult.simbad_status ?? "N/A"}
Match: ${formatBoolean(crossmatchResult.simbad_match)}
Main ID: ${crossmatchResult.simbad_main_id ?? "N/A"}
Object type: ${crossmatchResult.simbad_object_type ?? "N/A"}
Angular separation: ${formatNumber(
        crossmatchResult.simbad_angular_separation_arcsec,
        6,
      )} arcsec
Note: ${crossmatchResult.simbad_note ?? "N/A"}

VizieR:
Status: ${crossmatchResult.vizier_status ?? "N/A"}
Match count: ${crossmatchResult.vizier_match_count ?? "N/A"}
Catalogues: ${(crossmatchResult.vizier_catalogues ?? []).join("; ") || "N/A"}
Note: ${crossmatchResult.vizier_note ?? "N/A"}

Gaia NSS:
Status: ${crossmatchResult.nss_status ?? "N/A"}
Match: ${formatBoolean(crossmatchResult.nss_match)}
Solution type: ${crossmatchResult.nss_solution_type ?? "N/A"}
Note: ${crossmatchResult.nss_note ?? "N/A"}

Validation note:
${crossmatchResult.validation_note ?? "N/A"}`
    : `

Backend crossmatch result:
No automatic crossmatch result is currently available for this source.`;

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
- If matched, treat the anomaly as potentially related to candidate-level binarity indicators or projected proper-motion signatures. External validation remains required.

6. Known-object classification check
- Compare Gaia, SIMBAD, VizieR and NSS evidence.
- Classify the candidate conservatively as known object, likely stellar source, possible binary, possible variable, catalogue artefact, or unresolved candidate requiring further study.${crossmatchBlock}

Scientific note:
This validation checklist does not confirm exotic physics. It defines a reproducible external verification pathway for a computationally selected Gaia candidate.`;
}

function buildValidationReport(source, crossmatchResult = null) {
  if (!source) {
    return "";
  }

  const sourceId = getSourceId(source);

  const crossmatchBlock = crossmatchResult
    ? `

Automatic backend crossmatch:
Validation status: ${normalizeLabel(crossmatchResult.validation_status)}
Classification hint: ${normalizeLabel(crossmatchResult.classification_hint)}

SIMBAD:
Status: ${crossmatchResult.simbad_status ?? "N/A"}
Match: ${formatBoolean(crossmatchResult.simbad_match)}
Main ID: ${crossmatchResult.simbad_main_id ?? "N/A"}
Object type: ${crossmatchResult.simbad_object_type ?? "N/A"}
Angular separation: ${formatNumber(
        crossmatchResult.simbad_angular_separation_arcsec,
        6,
      )} arcsec
Note: ${crossmatchResult.simbad_note ?? "N/A"}

VizieR:
Status: ${crossmatchResult.vizier_status ?? "N/A"}
Match count: ${crossmatchResult.vizier_match_count ?? "N/A"}
Catalogues: ${(crossmatchResult.vizier_catalogues ?? []).join("; ") || "N/A"}
Note: ${crossmatchResult.vizier_note ?? "N/A"}

Gaia NSS:
Status: ${crossmatchResult.nss_status ?? "N/A"}
Match: ${formatBoolean(crossmatchResult.nss_match)}
Solution type: ${crossmatchResult.nss_solution_type ?? "N/A"}
Note: ${crossmatchResult.nss_note ?? "N/A"}

Backend validation note:
${crossmatchResult.validation_note ?? "N/A"}`
    : `

Automatic backend crossmatch:
No backend crossmatch record is currently available for this source.`;

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
Coherence-proxy index: ${formatNumber(source.coherence_proxy, 6)}${crossmatchBlock}

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
${getCrossmatchGaiaSourceAdql(source, crossmatchResult)}

Gaia ADQL cone-search query:
${getCrossmatchConeSearchAdql(source, crossmatchResult)}

Gaia NSS / binary-system ADQL query:
${getCrossmatchNssAdql(source, crossmatchResult)}

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

function ResultCard({ label, value, tone = "neutral" }) {
  return (
    <div className={"validation-result-card validation-result-" + tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CandidateValidationConsole({ selectedSource, crossmatchResult = null }) {
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
  const sourceAdqlQuery = getCrossmatchGaiaSourceAdql(
    selectedSource,
    crossmatchResult,
  );
  const coneSearchQuery = getCrossmatchConeSearchAdql(
    selectedSource,
    crossmatchResult,
  );
  const gaiaNssQuery = getCrossmatchNssAdql(selectedSource, crossmatchResult);
  const validationReport = buildValidationReport(
    selectedSource,
    crossmatchResult,
  );
  const validationChecklist = buildValidationChecklist(
    selectedSource,
    crossmatchResult,
  );

  const validationStatus =
    crossmatchResult?.validation_status ?? "crossmatch_not_available";

  const classificationHint =
    crossmatchResult?.classification_hint ?? "pending_external_crossmatch";

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

          <div className="validation-backend-summary">
            <ResultCard
              label="Backend validation"
              value={normalizeLabel(validationStatus)}
              tone={getValidationTone(validationStatus)}
            />

            <ResultCard
              label="Classification hint"
              value={normalizeLabel(classificationHint)}
              tone={getValidationTone(validationStatus)}
            />

            <ResultCard
              label="SIMBAD"
              value={normalizeLabel(crossmatchResult?.simbad_status)}
              tone={getServiceTone(crossmatchResult?.simbad_status)}
            />

            <ResultCard
              label="VizieR rows"
              value={String(crossmatchResult?.vizier_match_count ?? "N/A")}
              tone={getServiceTone(crossmatchResult?.vizier_status)}
            />

            <ResultCard
              label="Gaia NSS"
              value={normalizeLabel(crossmatchResult?.nss_status)}
              tone={getServiceTone(crossmatchResult?.nss_status)}
            />
          </div>

          {crossmatchResult && (
            <div className="validation-backend-details">
              <h3>Automatic crossmatch result</h3>

              <div className="validation-mini-grid">
                <p>
                  <span>SIMBAD match</span>
                  <strong>{formatBoolean(crossmatchResult.simbad_match)}</strong>
                </p>

                <p>
                  <span>SIMBAD main ID</span>
                  <strong>{crossmatchResult.simbad_main_id ?? "N/A"}</strong>
                </p>

                <p>
                  <span>SIMBAD object type</span>
                  <strong>
                    {crossmatchResult.simbad_object_type ?? "N/A"}
                  </strong>
                </p>

                <p>
                  <span>SIMBAD separation</span>
                  <strong>
                    {formatNumber(
                      crossmatchResult.simbad_angular_separation_arcsec,
                      6,
                    )}{" "}
                    arcsec
                  </strong>
                </p>

                <p>
                  <span>VizieR status</span>
                  <strong>{normalizeLabel(crossmatchResult.vizier_status)}</strong>
                </p>

                <p>
                  <span>VizieR match count</span>
                  <strong>{crossmatchResult.vizier_match_count ?? "N/A"}</strong>
                </p>

                <p>
                  <span>NSS match</span>
                  <strong>{formatBoolean(crossmatchResult.nss_match)}</strong>
                </p>

                <p>
                  <span>NSS solution type</span>
                  <strong>
                    {crossmatchResult.nss_solution_type ?? "N/A"}
                  </strong>
                </p>
              </div>

              <p className="validation-console-note">
                {crossmatchResult.validation_note ?? "No backend note available."}
              </p>
            </div>
          )}

          {!crossmatchResult && (
            <div className="validation-backend-details">
              <h3>Automatic crossmatch result</h3>

              <p className="validation-console-note">
                No automatic crossmatch record is currently available for this
                source. The console remains usable through external links and
                reproducible ADQL queries.
              </p>
            </div>
          )}

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
              href={crossmatchResult?.simbad_url ?? buildSimbadUrl(selectedSource)}
              target="_blank"
              rel="noreferrer"
            >
              Open SIMBAD
            </a>

            <a
              className="dashboard-nav-button"
              href={crossmatchResult?.vizier_url ?? buildVizierUrl(selectedSource)}
              target="_blank"
              rel="noreferrer"
            >
              Open VizieR
            </a>

            <a
              className="dashboard-nav-button"
              href={
                crossmatchResult?.gaia_archive_url ??
                buildGaiaArchiveUrl(selectedSource)
              }
              target="_blank"
              rel="noreferrer"
            >
              Open Gaia Archive
            </a>

            <a
              className="dashboard-nav-button"
              href={crossmatchResult?.esasky_url ?? buildEsaSkyUrl(selectedSource)}
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
              status={
                crossmatchResult
                  ? normalizeLabel(crossmatchResult.simbad_status)
                  : "External ready"
              }
              tone={getServiceTone(crossmatchResult?.simbad_status)}
            />

            <ValidationStep
              label="VizieR catalogue crossmatch"
              status={
                crossmatchResult
                  ? normalizeLabel(crossmatchResult.vizier_status)
                  : "External ready"
              }
              tone={getServiceTone(crossmatchResult?.vizier_status)}
            />

            <ValidationStep
              label="Gaia NSS / binary-system check"
              status={
                crossmatchResult
                  ? normalizeLabel(crossmatchResult.nss_status)
                  : "ADQL ready"
              }
              tone={getServiceTone(crossmatchResult?.nss_status)}
            />

            <ValidationStep
              label="Known-object classification check"
              status={
                crossmatchResult
                  ? normalizeLabel(crossmatchResult.classification_hint)
                  : "Checklist ready"
              }
              tone={getValidationTone(crossmatchResult?.validation_status)}
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