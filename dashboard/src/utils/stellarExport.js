/*
  stellarExport.js

  Export utilities for:
  Stellar Reconstruction & Full Dossier

  Generates:
  - plain text report
  - Markdown report
  - LaTeX report
  - JSON export
  - downloadable local files

  Scientific caution:
  These exports describe candidate-level proxy information only.
  They do not constitute confirmed astrophysical classification.
*/

import {
  buildScientificInterpretation,
  buildValidationSteps,
  formatNumber,
  getSourceId,
} from "./stellarInference.js";

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

function latexEscape(value) {
  return safeText(value)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
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

function getCrossmatchSummary(crossmatch) {
  if (!crossmatch) {
    return "N/A";
  }

  const simbad =
    crossmatch.simbad ??
    crossmatch.SIMBAD ??
    crossmatch.simbad_status ??
    crossmatch.simbad_main_id ??
    crossmatch.main_id ??
    null;

  const vizier =
    crossmatch.vizier ??
    crossmatch.VIZIER ??
    crossmatch.vizier_status ??
    crossmatch.vizier_catalogs ??
    crossmatch.catalogs ??
    null;

  const nss =
    crossmatch.nss ??
    crossmatch.NSS ??
    crossmatch.gaia_nss ??
    crossmatch.nss_status ??
    crossmatch.non_single_star ??
    null;

  const parts = [];

  if (simbad) {
    parts.push(`SIMBAD: ${safeText(simbad)}`);
  }

  if (vizier) {
    parts.push(`VizieR: ${safeText(vizier)}`);
  }

  if (nss) {
    parts.push(`Gaia NSS: ${safeText(nss)}`);
  }

  return parts.length ? parts.join(" | ") : "Crossmatch attached";
}

function buildCoreRows(fullRecord, starModel) {
  return [
    ["SOURCE_ID", getSourceId(fullRecord) || "N/A"],
    ["RA", formatValue(fullRecord?.ra, 10, "deg")],
    ["DEC", formatValue(fullRecord?.dec, 10, "deg")],
    ["Parallax", formatValue(fullRecord?.parallax, 6, "mas")],
    ["Distance estimate", formatValue(fullRecord?.distance_pc, 4, "pc")],
    ["PMRA", formatValue(fullRecord?.pmra, 6, "mas/yr")],
    ["PMDEC", formatValue(fullRecord?.pmdec, 6, "mas/yr")],
    [
      "Proper motion total",
      formatValue(fullRecord?.proper_motion_total, 6, "mas/yr"),
    ],
    [
      "Tangential velocity",
      formatValue(fullRecord?.tangential_velocity, 6, "km/s"),
    ],
    [
      "Radial velocity",
      formatValue(fullRecord?.radial_velocity, 6, "km/s"),
    ],
    [
      "Approximate space velocity",
      formatValue(fullRecord?.approximate_space_velocity, 6, "km/s"),
    ],
    [
      "Phot G mean magnitude",
      formatValue(fullRecord?.phot_g_mean_mag, 6, "mag"),
    ],
    [
      "Phot BP mean magnitude",
      formatValue(fullRecord?.phot_bp_mean_mag, 6, "mag"),
    ],
    [
      "Phot RP mean magnitude",
      formatValue(fullRecord?.phot_rp_mean_mag, 6, "mag"),
    ],
    ["BP-RP", formatValue(fullRecord?.bp_rp, 6)],
    ["Gaia color index", formatValue(fullRecord?.gaia_color_index, 6)],
    [
      "Absolute Gaia-G magnitude",
      formatValue(fullRecord?.absolute_magnitude_g, 6, "mag"),
    ],
    [
      "Estimated effective temperature",
      formatValue(fullRecord?.estimated_effective_temperature_k, 0, "K"),
    ],
    [
      "Estimated luminosity",
      formatValue(fullRecord?.estimated_luminosity_relative, 6, "Lsun"),
    ],
    [
      "Estimated radius",
      formatValue(fullRecord?.estimated_radius_relative, 6, "Rsun"),
    ],
    ["Spectral visual proxy", safeText(starModel?.spectralProxyLabel)],
    ["Reconstruction confidence", safeText(starModel?.confidenceLevel)],
    ["Anomaly score", formatValue(fullRecord?.anomaly_score, 6)],
    ["Anomaly rank", safeText(fullRecord?.anomaly_rank)],
    ["Structural rank", safeText(fullRecord?.structural_rank)],
    [
      "Structural importance",
      formatValue(fullRecord?.structural_importance_score, 6),
    ],
    ["Dynamics index", formatValue(fullRecord?.dynamics_index, 6)],
    [
      "Hidden companion index",
      formatValue(fullRecord?.hidden_companion_index, 6),
    ],
    [
      "Hidden companion classification",
      safeText(fullRecord?.hidden_companion_classification),
    ],
    ["Coherence proxy", formatValue(fullRecord?.coherence_proxy, 6)],
    ["Crossmatch", getCrossmatchSummary(fullRecord?.crossmatch)],
    [
      "Possible pair involvement",
      Array.isArray(fullRecord?.possible_pairs)
        ? String(fullRecord.possible_pairs.length)
        : "0",
    ],
  ];
}

function buildPairRows(fullRecord) {
  const sourceId = getSourceId(fullRecord);
  const pairs = Array.isArray(fullRecord?.possible_pairs)
    ? fullRecord.possible_pairs
    : [];

  return pairs.map((pair, index) => {
    const score =
      pair?.binary_pair_score ??
      pair?.pair_score ??
      pair?.score ??
      pair?.pairScore ??
      null;

    return {
      index: index + 1,
      otherSourceId: getPairOtherSourceId(pair, sourceId),
      classification:
        pair?.pair_classification ??
        pair?.classification ??
        "Possible pair candidate, not confirmed",
      score: formatValue(score, 4),
      angularSeparation: formatValue(
        pair?.angular_arcsec ?? pair?.angular_separation_arcsec,
        3,
        "arcsec",
      ),
      properMotionDifference: formatValue(
        pair?.proper_motion_difference ?? pair?.pm_difference,
        3,
      ),
      parallaxRelativeDifference: formatValue(
        pair?.parallax_relative_difference ??
          pair?.relative_parallax_difference,
        4,
      ),
    };
  });
}

export function buildPlainTextReport(fullRecord, starModel) {
  if (!fullRecord || !starModel) {
    return "No selected Gaia source is available.";
  }

  const sourceId = getSourceId(fullRecord) || "N/A";
  const rows = buildCoreRows(fullRecord, starModel);
  const validationSteps = buildValidationSteps(fullRecord);
  const interpretation = buildScientificInterpretation(fullRecord, starModel);
  const pairRows = buildPairRows(fullRecord);

  const lines = [];

  lines.push("CODEX ALPHA COMPUTATIONAL FRAMEWORK");
  lines.push("STELLAR RECONSTRUCTION & FULL DOSSIER");
  lines.push("");
  lines.push(`SOURCE_ID: ${sourceId}`);
  lines.push("");
  lines.push("STATUS");
  lines.push(
    "Candidate-level proxy report. This document does not confirm stellar type, binarity, planets, hidden companions, exotic objects or new physical mechanisms.",
  );
  lines.push("");
  lines.push("SYNTHETIC STELLAR MODEL");
  lines.push(`Visual proxy: ${safeText(starModel.spectralProxyLabel)}`);
  lines.push(
    `Effective temperature proxy: ${formatValue(
      starModel.effectiveTemperatureK,
      0,
      "K",
    )}`,
  );
  lines.push(
    `Absolute Gaia-G magnitude proxy: ${formatValue(
      starModel.absoluteMagnitudeG,
      4,
      "mag",
    )}`,
  );
  lines.push(
    `Luminosity proxy: ${formatValue(
      starModel.luminosityRelative,
      6,
      "Lsun",
    )}`,
  );
  lines.push(
    `Radius proxy: ${formatValue(starModel.radiusRelative, 6, "Rsun")}`,
  );
  lines.push(`Confidence: ${safeText(starModel.confidenceLevel)}`);
  lines.push("");
  lines.push("FULL DATA TABLE");

  for (const [label, value] of rows) {
    lines.push(`${label}: ${value}`);
  }

  lines.push("");
  lines.push("SCIENTIFIC INTERPRETATION");
  lines.push(interpretation);
  lines.push("");
  lines.push("POSSIBLE PAIR INVOLVEMENT");

  if (!pairRows.length) {
    lines.push("No possible binary or comoving-pair involvement is attached.");
  } else {
    for (const pair of pairRows) {
      lines.push(
        `${pair.index}. Other source: ${pair.otherSourceId} | ${pair.classification} | score ${pair.score} | separation ${pair.angularSeparation} | PM diff ${pair.properMotionDifference} | parallax rel. diff ${pair.parallaxRelativeDifference}`,
      );
    }
  }

  lines.push("");
  lines.push("VALIDATION STEPS");

  validationSteps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });

  lines.push("");
  lines.push("SCIENTIFIC CAUTION");
  lines.push(
    "The 3D stellar reconstruction is a physically-informed synthetic visualization generated from Gaia-derived observables and internal dashboard proxies. It is not a direct image of the stellar surface.",
  );
  lines.push(
    "All values are candidate-level indicators intended for prioritization, scientific triage and validation planning only.",
  );

  return lines.join("\n");
}

export function buildMarkdownReport(fullRecord, starModel) {
  if (!fullRecord || !starModel) {
    return "# Stellar Reconstruction & Full Dossier\n\nNo selected Gaia source is available.\n";
  }

  const sourceId = getSourceId(fullRecord) || "N/A";
  const rows = buildCoreRows(fullRecord, starModel);
  const validationSteps = buildValidationSteps(fullRecord);
  const interpretation = buildScientificInterpretation(fullRecord, starModel);
  const pairRows = buildPairRows(fullRecord);

  const lines = [];

  lines.push("# Stellar Reconstruction & Full Dossier");
  lines.push("");
  lines.push("**Codex Alpha Computational Framework**");
  lines.push("");
  lines.push(`**SOURCE_ID:** \`${sourceId}\``);
  lines.push("");
  lines.push("## Status");
  lines.push("");
  lines.push(
    "This is a candidate-level proxy report. It does not confirm stellar type, binarity, planets, hidden companions, exotic objects or new physical mechanisms.",
  );
  lines.push("");
  lines.push("## Synthetic Stellar Model");
  lines.push("");
  lines.push(`- **Visual proxy:** ${safeText(starModel.spectralProxyLabel)}`);
  lines.push(
    `- **Effective temperature proxy:** ${formatValue(
      starModel.effectiveTemperatureK,
      0,
      "K",
    )}`,
  );
  lines.push(
    `- **Absolute Gaia-G magnitude proxy:** ${formatValue(
      starModel.absoluteMagnitudeG,
      4,
      "mag",
    )}`,
  );
  lines.push(
    `- **Luminosity proxy:** ${formatValue(
      starModel.luminosityRelative,
      6,
      "Lsun",
    )}`,
  );
  lines.push(
    `- **Radius proxy:** ${formatValue(starModel.radiusRelative, 6, "Rsun")}`,
  );
  lines.push(`- **Confidence:** ${safeText(starModel.confidenceLevel)}`);
  lines.push("");
  lines.push("## Full Data Table");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");

  for (const [label, value] of rows) {
    lines.push(`| ${label} | ${safeText(value)} |`);
  }

  lines.push("");
  lines.push("## Scientific Interpretation");
  lines.push("");
  lines.push(interpretation);
  lines.push("");
  lines.push("## Possible Pair Involvement");
  lines.push("");

  if (!pairRows.length) {
    lines.push("No possible binary or comoving-pair involvement is attached.");
  } else {
    for (const pair of pairRows) {
      lines.push(
        `- **Pair ${pair.index}:** other source \`${pair.otherSourceId}\`; ${pair.classification}; score ${pair.score}; separation ${pair.angularSeparation}; PM diff ${pair.properMotionDifference}; parallax relative difference ${pair.parallaxRelativeDifference}.`,
      );
    }
  }

  lines.push("");
  lines.push("## Validation Steps");
  lines.push("");

  validationSteps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });

  lines.push("");
  lines.push("## Scientific Caution");
  lines.push("");
  lines.push(
    "The 3D stellar reconstruction is a physically-informed synthetic visualization generated from Gaia-derived observables and internal dashboard proxies.",
  );
  lines.push("");
  lines.push(
    "It is not a direct image of the stellar surface and does not confirm stellar type, activity, binarity, hidden companions, planets, exotic objects or new physical mechanisms.",
  );
  lines.push("");
  lines.push(
    "All values are candidate-level indicators intended for prioritization, scientific triage and validation planning only.",
  );

  return lines.join("\n");
}

export function buildLatexReport(fullRecord, starModel) {
  if (!fullRecord || !starModel) {
    return "\\section*{Stellar Reconstruction \\& Full Dossier}\n\nNo selected Gaia source is available.\n";
  }

  const sourceId = getSourceId(fullRecord) || "N/A";
  const rows = buildCoreRows(fullRecord, starModel);
  const validationSteps = buildValidationSteps(fullRecord);
  const interpretation = buildScientificInterpretation(fullRecord, starModel);
  const pairRows = buildPairRows(fullRecord);

  const lines = [];

  lines.push("\\section*{Stellar Reconstruction \\& Full Dossier}");
  lines.push("");
  lines.push("\\subsection*{Codex Alpha Computational Framework}");
  lines.push("");
  lines.push(`\\textbf{SOURCE\\_ID:} \\texttt{${latexEscape(sourceId)}}`);
  lines.push("");
  lines.push("\\subsection*{Status}");
  lines.push("");
  lines.push(
    "This is a candidate-level proxy report. It does not confirm stellar type, binarity, planets, hidden companions, exotic objects, or new physical mechanisms.",
  );
  lines.push("");
  lines.push("\\subsection*{Synthetic Stellar Model}");
  lines.push("");
  lines.push("\\begin{itemize}");
  lines.push(
    `  \\item \\textbf{Visual proxy:} ${latexEscape(
      starModel.spectralProxyLabel,
    )}`,
  );
  lines.push(
    `  \\item \\textbf{Effective temperature proxy:} ${latexEscape(
      formatValue(starModel.effectiveTemperatureK, 0, "K"),
    )}`,
  );
  lines.push(
    `  \\item \\textbf{Absolute Gaia-G magnitude proxy:} ${latexEscape(
      formatValue(starModel.absoluteMagnitudeG, 4, "mag"),
    )}`,
  );
  lines.push(
    `  \\item \\textbf{Luminosity proxy:} ${latexEscape(
      formatValue(starModel.luminosityRelative, 6, "Lsun"),
    )}`,
  );
  lines.push(
    `  \\item \\textbf{Radius proxy:} ${latexEscape(
      formatValue(starModel.radiusRelative, 6, "Rsun"),
    )}`,
  );
  lines.push(
    `  \\item \\textbf{Confidence:} ${latexEscape(
      starModel.confidenceLevel,
    )}`,
  );
  lines.push("\\end{itemize}");
  lines.push("");
  lines.push("\\subsection*{Full Data Table}");
  lines.push("");
  lines.push("\\begin{tabular}{ll}");
  lines.push("\\textbf{Field} & \\textbf{Value} \\\\");
  lines.push("\\hline");

  for (const [label, value] of rows) {
    lines.push(`${latexEscape(label)} & ${latexEscape(value)} \\\\`);
  }

  lines.push("\\end{tabular}");
  lines.push("");
  lines.push("\\subsection*{Scientific Interpretation}");
  lines.push("");
  lines.push(latexEscape(interpretation));
  lines.push("");
  lines.push("\\subsection*{Possible Pair Involvement}");
  lines.push("");

  if (!pairRows.length) {
    lines.push("No possible binary or comoving-pair involvement is attached.");
  } else {
    lines.push("\\begin{itemize}");

    for (const pair of pairRows) {
      lines.push(
        `  \\item Pair ${pair.index}: other source \\texttt{${latexEscape(
          pair.otherSourceId,
        )}}; ${latexEscape(pair.classification)}; score ${latexEscape(
          pair.score,
        )}; separation ${latexEscape(
          pair.angularSeparation,
        )}; PM diff ${latexEscape(
          pair.properMotionDifference,
        )}; parallax relative difference ${latexEscape(
          pair.parallaxRelativeDifference,
        )}.`,
      );
    }

    lines.push("\\end{itemize}");
  }

  lines.push("");
  lines.push("\\subsection*{Validation Steps}");
  lines.push("");
  lines.push("\\begin{enumerate}");

  validationSteps.forEach((step) => {
    lines.push(`  \\item ${latexEscape(step)}`);
  });

  lines.push("\\end{enumerate}");
  lines.push("");
  lines.push("\\subsection*{Scientific Caution}");
  lines.push("");
  lines.push(
    "The 3D stellar reconstruction is a physically-informed synthetic visualization generated from Gaia-derived observables and internal dashboard proxies.",
  );
  lines.push("");
  lines.push(
    "It is not a direct image of the stellar surface and does not confirm stellar type, activity, binarity, hidden companions, planets, exotic objects, or new physical mechanisms.",
  );
  lines.push("");
  lines.push(
    "All values are candidate-level indicators intended for prioritization, scientific triage, and validation planning only. The notation $\\nabla\\mathcal{K}$, when used in the broader framework, is internal theoretical context and not a direct physical measurement.",
  );

  return lines.join("\n");
}

export function buildJsonExport(fullRecord, starModel) {
  if (!fullRecord || !starModel) {
    return {
      status: "no_selected_source",
      message: "No selected Gaia source is available.",
    };
  }

  return {
    framework: "Codex Alpha Computational Framework",
    module: "Stellar Reconstruction & Full Dossier",
    export_type: "candidate_level_proxy_report",
    source_id: getSourceId(fullRecord) || null,

    source: {
      ra: fullRecord.ra ?? null,
      dec: fullRecord.dec ?? null,
      parallax: fullRecord.parallax ?? null,
      distance_pc: fullRecord.distance_pc ?? null,
      pmra: fullRecord.pmra ?? null,
      pmdec: fullRecord.pmdec ?? null,
      proper_motion_total: fullRecord.proper_motion_total ?? null,
      tangential_velocity: fullRecord.tangential_velocity ?? null,
      radial_velocity: fullRecord.radial_velocity ?? null,
      approximate_space_velocity: fullRecord.approximate_space_velocity ?? null,
      phot_g_mean_mag: fullRecord.phot_g_mean_mag ?? null,
      phot_bp_mean_mag: fullRecord.phot_bp_mean_mag ?? null,
      phot_rp_mean_mag: fullRecord.phot_rp_mean_mag ?? null,
      bp_rp: fullRecord.bp_rp ?? null,
      gaia_color_index: fullRecord.gaia_color_index ?? null,
    },

    derived_stellar_proxies: {
      absolute_magnitude_g: fullRecord.absolute_magnitude_g ?? null,
      estimated_effective_temperature_k:
        fullRecord.estimated_effective_temperature_k ?? null,
      estimated_luminosity_relative:
        fullRecord.estimated_luminosity_relative ?? null,
      estimated_radius_relative: fullRecord.estimated_radius_relative ?? null,
      spectral_visual_proxy: starModel.spectralProxyLabel ?? null,
      spectral_visual_proxy_short: starModel.spectralProxyShortLabel ?? null,
      color_hex: starModel.colorHex ?? null,
      emissive_hex: starModel.emissiveHex ?? null,
      reconstruction_confidence: starModel.confidenceLevel ?? null,
      confidence_flags: Array.isArray(starModel.confidenceFlags)
        ? starModel.confidenceFlags
        : [],
    },

    framework_metrics: {
      anomaly_score: fullRecord.anomaly_score ?? null,
      anomaly_rank: fullRecord.anomaly_rank ?? null,
      structural_rank: fullRecord.structural_rank ?? null,
      structural_importance_score:
        fullRecord.structural_importance_score ?? null,
      dynamics_index: fullRecord.dynamics_index ?? null,
      hidden_companion_index: fullRecord.hidden_companion_index ?? null,
      hidden_companion_classification:
        fullRecord.hidden_companion_classification ?? null,
      coherence_proxy: fullRecord.coherence_proxy ?? null,
    },

    reconstruction_rendering_parameters: {
      activity_proxy: starModel.activityProxy ?? null,
      corona_intensity: starModel.coronaIntensity ?? null,
      surface_contrast: starModel.surfaceContrast ?? null,
      rotation_speed: starModel.rotationSpeed ?? null,
      visual_scale: starModel.visualScale ?? null,
    },

    external_context: {
      crossmatch: fullRecord.crossmatch ?? null,
      possible_pairs: Array.isArray(fullRecord.possible_pairs)
        ? fullRecord.possible_pairs
        : [],
    },

    interpretation: buildScientificInterpretation(fullRecord, starModel),
    validation_steps: buildValidationSteps(fullRecord),

    scientific_caution:
      "This export describes candidate-level proxy information only. It does not confirm stellar type, activity, binarity, hidden companions, planets, exotic objects or new physical mechanisms. The synthetic 3D reconstruction is not a direct observation of the stellar surface.",
  };
}

export function stringifyJsonExport(fullRecord, starModel) {
  return JSON.stringify(buildJsonExport(fullRecord, starModel), null, 2);
}

export function makeSafeFileName(value, fallback = "stellar-dossier") {
  const text = safeText(value === "N/A" ? fallback : value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return text || fallback;
}

export function downloadTextFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], {
    type: `${mimeType};charset=utf-8`,
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function downloadPlainTextReport(fullRecord, starModel) {
  const sourceId = getSourceId(fullRecord) || "selected-source";
  const filename = `${makeSafeFileName(sourceId)}-stellar-dossier.txt`;

  downloadTextFile(filename, buildPlainTextReport(fullRecord, starModel));
}

export function downloadMarkdownReport(fullRecord, starModel) {
  const sourceId = getSourceId(fullRecord) || "selected-source";
  const filename = `${makeSafeFileName(sourceId)}-stellar-dossier.md`;

  downloadTextFile(
    filename,
    buildMarkdownReport(fullRecord, starModel),
    "text/markdown",
  );
}

export function downloadLatexReport(fullRecord, starModel) {
  const sourceId = getSourceId(fullRecord) || "selected-source";
  const filename = `${makeSafeFileName(sourceId)}-stellar-dossier.tex`;

  downloadTextFile(
    filename,
    buildLatexReport(fullRecord, starModel),
    "text/x-tex",
  );
}

export function downloadJsonReport(fullRecord, starModel) {
  const sourceId = getSourceId(fullRecord) || "selected-source";
  const filename = `${makeSafeFileName(sourceId)}-stellar-dossier.json`;

  downloadTextFile(
    filename,
    stringifyJsonExport(fullRecord, starModel),
    "application/json",
  );
}