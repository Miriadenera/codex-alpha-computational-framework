import React, { useMemo, useState } from "react";
import {
  buildScientificInterpretation,
  buildValidationSteps,
  formatNumber,
  getSourceId,
} from "../utils/stellarInference.js";

/*
  FullStellarDossier

  Complete data dossier for the globally selected Gaia source.

  It shows:
  - Gaia identity and astrometry
  - photometry
  - derived kinematics
  - internal framework metrics
  - crossmatch context
  - possible pair involvement
  - scientific interpretation
  - validation steps

  Scientific caution:
  This is a structured candidate dossier, not a confirmed astrophysical
  classification.
*/

function safeText(value) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  return String(value);
}

function formatValue(value, digits = 4, unit = "") {
  const formatted = formatNumber(value, digits);

  if (formatted === "N/A") {
    return "N/A";
  }

  return unit ? `${formatted} ${unit}` : formatted;
}

function getCrossmatchValue(crossmatch, keys) {
  if (!crossmatch) {
    return "N/A";
  }

  for (const key of keys) {
    const value = crossmatch[key];

    if (value !== undefined && value !== null && value !== "") {
      if (Array.isArray(value)) {
        return value.length ? value.join(", ") : "N/A";
      }

      if (typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch {
          return "Attached";
        }
      }

      return String(value);
    }
  }

  return "N/A";
}

function normalizePairEndpoint(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

function getPairOtherSourceId(pair, sourceId) {
  const a = normalizePairEndpoint(
    pair?.source_a ??
      pair?.source_id_a ??
      pair?.SOURCE_ID_A ??
      pair?.sourceA ??
      pair?.a,
  );

  const b = normalizePairEndpoint(
    pair?.source_b ??
      pair?.source_id_b ??
      pair?.SOURCE_ID_B ??
      pair?.sourceB ??
      pair?.b,
  );

  if (a === sourceId) {
    return b || "N/A";
  }

  if (b === sourceId) {
    return a || "N/A";
  }

  return b || a || "N/A";
}

function DataRow({ label, value, note }) {
  return (
    <div className="stellar-dossier-row">
      <span>{label}</span>

      <div>
        <strong>{safeText(value)}</strong>
        {note ? <small>{note}</small> : null}
      </div>
    </div>
  );
}

function DataSection({ title, subtitle, children }) {
  return (
    <section className="stellar-dossier-section">
      <div className="stellar-dossier-section-header">
        <h3>{title}</h3>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>

      <div className="stellar-dossier-rows">{children}</div>
    </section>
  );
}

function PairCard({ pair, sourceId, index }) {
  const otherId = getPairOtherSourceId(pair, sourceId);

  const score =
    pair?.binary_pair_score ??
    pair?.pair_score ??
    pair?.score ??
    pair?.pairScore ??
    null;

  const classification =
    pair?.pair_classification ??
    pair?.classification ??
    "Possible pair candidate, not confirmed";

  return (
    <div className="stellar-pair-card">
      <div>
        <span>Pair candidate #{index + 1}</span>
        <strong>{otherId}</strong>
      </div>

      <p>{classification}</p>

      <div className="stellar-pair-metrics">
        <span>score {formatValue(score, 4)}</span>
        <span>
          separation{" "}
          {formatValue(
            pair?.angular_arcsec ?? pair?.angular_separation_arcsec,
            3,
            "arcsec",
          )}
        </span>
        <span>
          PM diff{" "}
          {formatValue(
            pair?.proper_motion_difference ?? pair?.pm_difference,
            3,
          )}
        </span>
        <span>
          parallax rel. diff{" "}
          {formatValue(
            pair?.parallax_relative_difference ??
              pair?.relative_parallax_difference,
            4,
          )}
        </span>
      </div>
    </div>
  );
}

export default function FullStellarDossier({ fullRecord, starModel }) {
  const [mode, setMode] = useState("data");

  const sourceId = getSourceId(fullRecord);

  const validationSteps = useMemo(
    () => buildValidationSteps(fullRecord),
    [fullRecord],
  );

  const interpretation = useMemo(
    () => buildScientificInterpretation(fullRecord, starModel),
    [fullRecord, starModel],
  );

  if (!fullRecord || !starModel) {
    return (
      <section className="panel stellar-dossier-panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Full Stellar Dossier</div>
            <h2>No selected source</h2>
          </div>
        </div>

        <p>
          Select a Gaia source from any framework page to generate a full
          stellar dossier.
        </p>
      </section>
    );
  }

  const crossmatch = fullRecord.crossmatch ?? null;
  const possiblePairs = Array.isArray(fullRecord.possible_pairs)
    ? fullRecord.possible_pairs
    : [];

  return (
    <section className="panel stellar-dossier-panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Full Stellar Dossier</div>
          <h2>{sourceId || "Selected Gaia Source"}</h2>
        </div>

        <div className="stellar-dossier-tabs">
          <button
            type="button"
            className={mode === "data" ? "active" : ""}
            onClick={() => setMode("data")}
          >
            Data
          </button>

          <button
            type="button"
            className={mode === "context" ? "active" : ""}
            onClick={() => setMode("context")}
          >
            Context
          </button>

          <button
            type="button"
            className={mode === "validation" ? "active" : ""}
            onClick={() => setMode("validation")}
          >
            Validation
          </button>
        </div>
      </div>

      {mode === "data" && (
        <div className="stellar-dossier-grid">
          <DataSection
            title="Source Identity"
            subtitle="Gaia catalogue identifiers and sky position"
          >
            <DataRow label="SOURCE_ID" value={sourceId || "N/A"} />
            <DataRow label="RA" value={formatValue(fullRecord.ra, 10, "deg")} />
            <DataRow label="DEC" value={formatValue(fullRecord.dec, 10, "deg")} />
            <DataRow
              label="Parallax"
              value={formatValue(fullRecord.parallax, 6, "mas")}
            />
            <DataRow
              label="Distance estimate"
              value={formatValue(fullRecord.distance_pc, 4, "pc")}
              note="Derived from parallax if no direct estimate is available."
            />
          </DataSection>

          <DataSection
            title="Astrometric Motion"
            subtitle="Proper motion and approximate velocity quantities"
          >
            <DataRow label="PMRA" value={formatValue(fullRecord.pmra, 6, "mas/yr")} />
            <DataRow
              label="PMDEC"
              value={formatValue(fullRecord.pmdec, 6, "mas/yr")}
            />
            <DataRow
              label="Proper motion total"
              value={formatValue(fullRecord.proper_motion_total, 6, "mas/yr")}
            />
            <DataRow
              label="Tangential velocity"
              value={formatValue(fullRecord.tangential_velocity, 6, "km/s")}
            />
            <DataRow
              label="Radial velocity"
              value={formatValue(fullRecord.radial_velocity, 6, "km/s")}
            />
            <DataRow
              label="Approximate space velocity"
              value={formatValue(
                fullRecord.approximate_space_velocity,
                6,
                "km/s",
              )}
              note="Incomplete if radial velocity is missing."
            />
          </DataSection>

          <DataSection
            title="Gaia Photometry"
            subtitle="Brightness and color proxies"
          >
            <DataRow
              label="G mean magnitude"
              value={formatValue(fullRecord.phot_g_mean_mag, 6, "mag")}
            />
            <DataRow
              label="BP mean magnitude"
              value={formatValue(fullRecord.phot_bp_mean_mag, 6, "mag")}
            />
            <DataRow
              label="RP mean magnitude"
              value={formatValue(fullRecord.phot_rp_mean_mag, 6, "mag")}
            />
            <DataRow
              label="BP-RP"
              value={formatValue(fullRecord.bp_rp, 6)}
            />
            <DataRow
              label="Gaia color index"
              value={formatValue(fullRecord.gaia_color_index, 6)}
              note="Direct BP-RP when available, otherwise BP minus RP."
            />
          </DataSection>

          <DataSection
            title="Derived Stellar Proxies"
            subtitle="Approximate values used for the synthetic reconstruction"
          >
            <DataRow
              label="Absolute Gaia-G magnitude"
              value={formatValue(fullRecord.absolute_magnitude_g, 6, "mag")}
            />
            <DataRow
              label="Estimated effective temperature"
              value={formatValue(
                fullRecord.estimated_effective_temperature_k,
                0,
                "K",
              )}
            />
            <DataRow
              label="Estimated luminosity"
              value={formatValue(
                fullRecord.estimated_luminosity_relative,
                6,
                "L☉",
              )}
            />
            <DataRow
              label="Estimated radius"
              value={formatValue(
                fullRecord.estimated_radius_relative,
                6,
                "R☉",
              )}
            />
            <DataRow
              label="Spectral visual proxy"
              value={starModel.spectralProxyLabel}
            />
            <DataRow
              label="Reconstruction confidence"
              value={starModel.confidenceLevel}
            />
          </DataSection>

          <DataSection
            title="Framework Metrics"
            subtitle="Internal candidate-prioritization indicators"
          >
            <DataRow
              label="Anomaly score"
              value={formatValue(fullRecord.anomaly_score, 6)}
              note="Internal anomaly prioritization proxy."
            />
            <DataRow
              label="Anomaly rank"
              value={safeText(fullRecord.anomaly_rank)}
            />
            <DataRow
              label="Structural rank"
              value={safeText(fullRecord.structural_rank)}
            />
            <DataRow
              label="Structural importance"
              value={formatValue(fullRecord.structural_importance_score, 6)}
            />
            <DataRow
              label="Dynamics index"
              value={formatValue(fullRecord.dynamics_index, 6)}
            />
            <DataRow
              label="Hidden companion index"
              value={formatValue(fullRecord.hidden_companion_index, 6)}
            />
            <DataRow
              label="Hidden companion classification"
              value={fullRecord.hidden_companion_classification}
            />
            <DataRow
              label="Coherence proxy"
              value={formatValue(fullRecord.coherence_proxy, 6)}
              note="Codex Alpha internal context only, not a direct physical measurement."
            />
          </DataSection>
        </div>
      )}

      {mode === "context" && (
        <div className="stellar-dossier-context">
          <DataSection
            title="Crossmatch Context"
            subtitle="Optional external catalogue information if available"
          >
            <DataRow
              label="Crossmatch status"
              value={crossmatch ? "Attached" : "N/A"}
            />
            <DataRow
              label="SIMBAD"
              value={getCrossmatchValue(crossmatch, [
                "simbad",
                "SIMBAD",
                "simbad_status",
                "simbad_main_id",
                "main_id",
              ])}
            />
            <DataRow
              label="VizieR"
              value={getCrossmatchValue(crossmatch, [
                "vizier",
                "VIZIER",
                "vizier_status",
                "vizier_catalogs",
                "catalogs",
              ])}
            />
            <DataRow
              label="Gaia NSS"
              value={getCrossmatchValue(crossmatch, [
                "nss",
                "NSS",
                "gaia_nss",
                "nss_status",
                "non_single_star",
              ])}
            />
            <DataRow
              label="Raw crossmatch object"
              value={crossmatch ? JSON.stringify(crossmatch) : "N/A"}
            />
          </DataSection>

          <div className="stellar-context-card">
            <div className="stellar-dossier-section-header">
              <h3>Possible Pair Involvement</h3>
              <span>candidate-level only</span>
            </div>

            {!possiblePairs.length && (
              <p>
                No possible binary or comoving-pair involvement is currently
                attached to this source.
              </p>
            )}

            {!!possiblePairs.length && (
              <div className="stellar-pair-list">
                {possiblePairs.map((pair, index) => (
                  <PairCard
                    key={pair?.pair_id ?? `${sourceId}-pair-${index}`}
                    pair={pair}
                    sourceId={sourceId}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="stellar-context-card">
            <div className="stellar-dossier-section-header">
              <h3>Scientific Interpretation</h3>
              <span>plain-language synthesis</span>
            </div>

            <p>{interpretation}</p>
          </div>
        </div>
      )}

      {mode === "validation" && (
        <div className="stellar-dossier-validation">
          <div className="stellar-context-card">
            <div className="stellar-dossier-section-header">
              <h3>Recommended Validation Steps</h3>
              <span>external validation required</span>
            </div>

            <ol className="stellar-validation-list">
              {validationSteps.map((step, index) => (
                <li key={`${sourceId}-validation-${index}`}>{step}</li>
              ))}
            </ol>
          </div>

          <div className="stellar-context-card">
            <div className="stellar-dossier-section-header">
              <h3>Scientific Caution</h3>
              <span>synthetic reconstruction</span>
            </div>

            <p>
              The 3D stellar visualization is a physically-informed synthetic
              reconstruction based on Gaia-derived observables and internal
              dashboard proxies. It is not a direct observation of the stellar
              surface and does not confirm stellar type, activity, binarity,
              hidden companions, planets, exotic objects or new physical
              mechanisms.
            </p>

            <p>
              All numerical indicators are intended for candidate prioritization,
              scientific triage and validation planning only.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}