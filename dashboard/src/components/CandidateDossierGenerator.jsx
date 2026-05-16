import React, { useMemo, useState } from "react";

function normalizeNumber(value, fallback = null) {
  const number = Number(value);

  return Number.isNaN(number) || value === null || value === undefined
    ? fallback
    : number;
}

function getSourceId(source) {
  return String(source?.SOURCE_ID ?? source?.source_id ?? source?.id ?? "");
}

function firstAvailable(source, keys, fallback = null) {
  if (!source) {
    return fallback;
  }

  for (const key of keys) {
    const value = source[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
}

function formatValue(value, digits = null, fallback = "N/A") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);

  if (!Number.isNaN(number) && digits !== null) {
    return number.toFixed(digits);
  }

  return String(value);
}

function escapeLatex(value) {
  return String(value ?? "N/A")
    .replaceAll("\\", "\\textbackslash{}")
    .replaceAll("_", "\\_")
    .replaceAll("&", "\\&")
    .replaceAll("%", "\\%")
    .replaceAll("$", "\\$")
    .replaceAll("#", "\\#")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}");
}

function findCrossmatchForSource(source, crossmatchResults = []) {
  const sourceId = getSourceId(source);

  if (!sourceId) {
    return null;
  }

  return (
    crossmatchResults.find((item) => {
      const itemId = String(
        item?.SOURCE_ID ??
          item?.source_id ??
          item?.gaia_source_id ??
          item?.id ??
          "",
      );

      return itemId === sourceId;
    }) ?? null
  );
}

function findPairInvolvement(source, possiblePairs = []) {
  const sourceId = getSourceId(source);

  if (!sourceId || sourceId === "N/A") {
    return [];
  }

  return possiblePairs.filter((pair) => {
    const firstId = String(
      pair?.source_a ??
        pair?.source_id_a ??
        pair?.SOURCE_ID_A ??
        pair?.primary_source_id ??
        pair?.sourceA ??
        pair?.a ??
        "",
    );

    const secondId = String(
      pair?.source_b ??
        pair?.source_id_b ??
        pair?.SOURCE_ID_B ??
        pair?.secondary_source_id ??
        pair?.sourceB ??
        pair?.b ??
        "",
    );

    return firstId === sourceId || secondId === sourceId;
  });
}

function buildPairSummary(pairInvolvement) {
  if (!pairInvolvement.length) {
    return "No local pair candidate attached";
  }

  const strongCount = pairInvolvement.filter(
    (pair) => pair.pair_classification === "Strong comoving-pair candidate",
  ).length;

  const possibleCount = pairInvolvement.filter(
    (pair) => pair.pair_classification === "Possible wide-binary candidate",
  ).length;

  const weakCount = pairInvolvement.filter(
    (pair) => pair.pair_classification === "Weak proximity-pair candidate",
  ).length;

  const parts = [];

  if (strongCount > 0) {
    parts.push(`${strongCount} strong`);
  }

  if (possibleCount > 0) {
    parts.push(`${possibleCount} possible wide`);
  }

  if (weakCount > 0) {
    parts.push(`${weakCount} weak proximity`);
  }

  if (!parts.length) {
    return `${pairInvolvement.length} possible pair/comoving candidate(s), not confirmed`;
  }

  return `${pairInvolvement.length} candidate relation(s): ${parts.join(
    ", ",
  )}. Not confirmed.`;
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
    encodeURIComponent(`${ra.toFixed(10)} ${dec.toFixed(10)}`) +
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
    encodeURIComponent(`${ra.toFixed(10)} ${dec.toFixed(10)}`) +
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

function buildGaiaNssAdqlQuery(source) {
  const sourceId = getSourceId(source);

  if (!sourceId) {
    return "";
  }

  return `SELECT TOP 20
  source_id,
  nss_solution_type
FROM gaiadr3.nss_two_body_orbit
WHERE source_id = ${sourceId}`;
}

function buildPairDetails(pairInvolvement, sourceId) {
  if (!pairInvolvement.length) {
    return "No local pair candidates are currently attached to this selected source.";
  }

  return pairInvolvement
    .map((pair, index) => {
      const sourceA = String(pair.source_a ?? pair.source_id_a ?? "");
      const sourceB = String(pair.source_b ?? pair.source_id_b ?? "");
      const otherSource = sourceA === sourceId ? sourceB : sourceA;

      return `${index + 1}. ${pair.pair_classification ?? "Pair candidate"} with SOURCE_ID ${otherSource}. Pair score: ${formatValue(
        pair.binary_pair_score,
        6,
      )}; angular separation: ${formatValue(
        pair.angular_arcsec,
        6,
      )} arcsec; parallax relative difference: ${formatValue(
        pair.parallax_relative_difference,
        6,
      )}; proper-motion difference: ${formatValue(
        pair.proper_motion_difference,
        6,
      )} mas/yr.`;
    })
    .join("\n");
}

function buildScientificInterpretation(data) {
  const paragraphs = [];

  paragraphs.push(
    "This dossier is an internal candidate-level report generated inside the Codex Alpha Computational Framework. It does not assign an official astronomical classification and does not confirm planets, binaries, exotic matter, or non-standard physics.",
  );

  if (data.dynamicsIndexRaw !== null) {
    paragraphs.push(
      "The dynamics index indicates whether the source deserves additional kinematic inspection based on available Gaia astrometric and velocity proxies. It is a prioritization score, not a physical proof of orbital structure.",
    );
  }

  if (data.hiddenCompanionIndexRaw !== null) {
    paragraphs.push(
      "The hidden companion suspicion index is a conservative unresolved-multiplicity triage indicator. It is stronger when direct Gaia astrometric-quality fields such as RUWE, astrometric excess noise, visibility periods, or IPD fields are available. Without those fields, it remains only an indirect proxy.",
    );
  }

  if (data.pairCount > 0) {
    paragraphs.push(
      "The source appears in at least one possible pair or comoving-candidate relation. This is not sufficient to identify a bound binary system. A real claim would require consistency checks on angular separation, parallax, proper motion, radial velocity, and external catalogue status.",
    );
  } else {
    paragraphs.push(
      "No local pair-candidate relation is currently attached to this selected source. This does not exclude binarity; it only means that the current internal pair-scoring layer did not attach a candidate relation to this object under the active thresholds.",
    );
  }

  if (data.crossmatchAvailable) {
    paragraphs.push(
      "External crossmatch information is available and should be treated as the first validation layer. SIMBAD, VizieR and Gaia NSS results must still be inspected conservatively before assigning any physical interpretation.",
    );
  } else {
    paragraphs.push(
      "No automatic crossmatch record is currently attached to this selected source. External links and ADQL queries are therefore provided to support manual validation.",
    );
  }

  paragraphs.push(
    "The coherence proxy is used only as an internal informational-analysis indicator inspired by ∇𝒦. It is not a direct physical measurement of the Codex Alpha coherence gradient.",
  );

  return paragraphs;
}

function buildValidationSteps(data) {
  const steps = [
    "Open the Gaia Archive source page and verify the Gaia DR3 source identity.",
    "Inspect RA, DEC, parallax, proper motion, radial velocity, photometry and available quality flags.",
    "Check SIMBAD for known object type, aliases, bibliography and angular separation from the Gaia position.",
    "Check VizieR for catalogue associations, photometric surveys, variability indicators and possible known classifications.",
    "Run the Gaia NSS query to verify whether Gaia already reports a non-single-star or binary-system solution.",
    "Compare parallax, proper motion and radial velocity against nearby sources before interpreting any possible pair relation.",
  ];

  if (data.pairCount > 0) {
    steps.push(
      "For each possible pair candidate, compute angular separation, projected separation, parallax consistency, proper-motion consistency and radial-velocity consistency when available.",
    );
  }

  steps.push(
    "Do not classify the source as a planet host, binary system, exotic object or confirmed Codex Alpha object without independent astrophysical validation.",
  );

  return steps;
}

function buildPlainTextDossier(data) {
  return `CODEX ALPHA COMPUTATIONAL FRAMEWORK
Candidate Dossier

SOURCE_ID: ${data.sourceId}

Gaia astrometry:
RA: ${data.ra}
DEC: ${data.dec}
Parallax: ${data.parallax}
Distance estimate: ${data.distancePc}
PMRA: ${data.pmra}
PMDEC: ${data.pmdec}
Total proper motion: ${data.properMotionTotal}
Tangential velocity: ${data.tangentialVelocity}
Radial velocity: ${data.radialVelocity}
Approximate space velocity: ${data.approximateSpaceVelocity}

Photometry:
G magnitude: ${data.gMagnitude}
BP-RP colour index: ${data.gaiaColorIndex}
BP magnitude: ${data.bpMagnitude}
RP magnitude: ${data.rpMagnitude}

Ranking and computational indicators:
Anomaly score: ${data.anomalyScore}
Anomaly rank: ${data.anomalyRank}
Structural rank: ${data.structuralRank}
Structural importance: ${data.structuralImportance}
Local density score: ${data.localDensity}
Dominant feature: ${data.dominantFeature}
Dominant feature z-score: ${data.dominantFeatureZscore}
Coherence proxy: ${data.coherenceProxy}

Dynamics:
Dynamics index: ${data.dynamicsIndex}
Dynamics classification: ${data.dynamicsClassification}
Hidden companion index: ${data.hiddenCompanionIndex}
Hidden companion classification: ${data.hiddenCompanionClassification}
Hidden companion status: ${data.hiddenCompanionStatus}
Possible pair involvement: ${data.pairSummary}

Pair details:
${data.pairDetails}

External crossmatch:
SIMBAD status: ${data.simbadStatus}
SIMBAD main ID: ${data.simbadMainId}
SIMBAD object type: ${data.simbadObjectType}
VizieR status: ${data.vizierStatus}
VizieR rows: ${data.vizierRows}
Gaia NSS status: ${data.nssStatus}
External classification hint: ${data.classificationHint}

External links:
Gaia Archive: ${data.gaiaArchiveUrl}
ESASky: ${data.esaSkyUrl}
SIMBAD: ${data.simbadUrl}
VizieR: ${data.vizierUrl}

ADQL:
${data.sourceAdqlQuery}

Gaia NSS ADQL:
${data.gaiaNssAdqlQuery}

Scientific interpretation:
${data.interpretation.join("\n\n")}

Validation steps:
${data.validationSteps.map((step, index) => `${index + 1}. ${step}`).join("\n")}
`;
}

function buildLatexDossier(data) {
  return `\\section*{Candidate Dossier: Gaia DR3 Source ${escapeLatex(data.sourceId)}}

\\subsection*{Gaia Astrometric Parameters}

\\begin{itemize}
  \\item \\textbf{SOURCE\\_ID}: ${escapeLatex(data.sourceId)}
  \\item \\textbf{Right Ascension}: ${escapeLatex(data.ra)}
  \\item \\textbf{Declination}: ${escapeLatex(data.dec)}
  \\item \\textbf{Parallax}: ${escapeLatex(data.parallax)}
  \\item \\textbf{Distance estimate}: ${escapeLatex(data.distancePc)}
  \\item \\textbf{Proper motion in RA}: ${escapeLatex(data.pmra)}
  \\item \\textbf{Proper motion in DEC}: ${escapeLatex(data.pmdec)}
  \\item \\textbf{Total proper motion}: ${escapeLatex(data.properMotionTotal)}
  \\item \\textbf{Tangential velocity}: ${escapeLatex(data.tangentialVelocity)}
  \\item \\textbf{Radial velocity}: ${escapeLatex(data.radialVelocity)}
  \\item \\textbf{Approximate space velocity}: ${escapeLatex(data.approximateSpaceVelocity)}
\\end{itemize}

\\subsection*{Photometric Parameters}

\\begin{itemize}
  \\item \\textbf{G magnitude}: ${escapeLatex(data.gMagnitude)}
  \\item \\textbf{BP--RP colour index}: ${escapeLatex(data.gaiaColorIndex)}
  \\item \\textbf{BP magnitude}: ${escapeLatex(data.bpMagnitude)}
  \\item \\textbf{RP magnitude}: ${escapeLatex(data.rpMagnitude)}
\\end{itemize}

\\subsection*{Computational Indicators}

\\begin{itemize}
  \\item \\textbf{Anomaly score}: ${escapeLatex(data.anomalyScore)}
  \\item \\textbf{Anomaly rank}: ${escapeLatex(data.anomalyRank)}
  \\item \\textbf{Structural rank}: ${escapeLatex(data.structuralRank)}
  \\item \\textbf{Structural importance}: ${escapeLatex(data.structuralImportance)}
  \\item \\textbf{Local density score}: ${escapeLatex(data.localDensity)}
  \\item \\textbf{Dominant feature}: ${escapeLatex(data.dominantFeature)}
  \\item \\textbf{Dominant feature z-score}: ${escapeLatex(data.dominantFeatureZscore)}
  \\item \\textbf{Coherence proxy}: ${escapeLatex(data.coherenceProxy)}
\\end{itemize}

The coherence proxy is used only as an internal informational-analysis indicator inspired by $\\nabla\\mathcal{K}$. It must not be interpreted as a direct physical measurement of the Codex Alpha coherence gradient.

\\subsection*{Astrometric Dynamics}

\\begin{itemize}
  \\item \\textbf{Dynamics index}: ${escapeLatex(data.dynamicsIndex)}
  \\item \\textbf{Dynamics classification}: ${escapeLatex(data.dynamicsClassification)}
  \\item \\textbf{Hidden companion index}: ${escapeLatex(data.hiddenCompanionIndex)}
  \\item \\textbf{Hidden companion classification}: ${escapeLatex(data.hiddenCompanionClassification)}
  \\item \\textbf{Hidden companion status}: ${escapeLatex(data.hiddenCompanionStatus)}
  \\item \\textbf{Possible pair involvement}: ${escapeLatex(data.pairSummary)}
\\end{itemize}

\\subsection*{Possible Pair Details}

\\begin{verbatim}
${data.pairDetails}
\\end{verbatim}

\\subsection*{External Crossmatch Status}

\\begin{itemize}
  \\item \\textbf{SIMBAD status}: ${escapeLatex(data.simbadStatus)}
  \\item \\textbf{SIMBAD main ID}: ${escapeLatex(data.simbadMainId)}
  \\item \\textbf{SIMBAD object type}: ${escapeLatex(data.simbadObjectType)}
  \\item \\textbf{VizieR status}: ${escapeLatex(data.vizierStatus)}
  \\item \\textbf{VizieR rows}: ${escapeLatex(data.vizierRows)}
  \\item \\textbf{Gaia NSS status}: ${escapeLatex(data.nssStatus)}
  \\item \\textbf{External classification hint}: ${escapeLatex(data.classificationHint)}
\\end{itemize}

\\subsection*{Scientific Interpretation}

${data.interpretation.map((paragraph) => escapeLatex(paragraph)).join("\n\n")}

\\subsection*{Validation Steps}

\\begin{enumerate}
${data.validationSteps.map((step) => `  \\item ${escapeLatex(step)}`).join("\n")}
\\end{enumerate}
`;
}

function buildGitHubIssue(data) {
  return `## Candidate Dossier: Gaia DR3 ${data.sourceId}

### Gaia astrometry

| Field | Value |
|---|---|
| SOURCE_ID | ${data.sourceId} |
| RA | ${data.ra} |
| DEC | ${data.dec} |
| Parallax | ${data.parallax} |
| Distance estimate | ${data.distancePc} |
| PMRA | ${data.pmra} |
| PMDEC | ${data.pmdec} |
| Total proper motion | ${data.properMotionTotal} |
| Tangential velocity | ${data.tangentialVelocity} |
| Radial velocity | ${data.radialVelocity} |
| Approximate space velocity | ${data.approximateSpaceVelocity} |

### Photometry

| Field | Value |
|---|---|
| G magnitude | ${data.gMagnitude} |
| BP-RP colour index | ${data.gaiaColorIndex} |
| BP magnitude | ${data.bpMagnitude} |
| RP magnitude | ${data.rpMagnitude} |

### Computational indicators

| Field | Value |
|---|---|
| Anomaly score | ${data.anomalyScore} |
| Anomaly rank | ${data.anomalyRank} |
| Structural rank | ${data.structuralRank} |
| Structural importance | ${data.structuralImportance} |
| Local density | ${data.localDensity} |
| Dominant feature | ${data.dominantFeature} |
| Dominant feature z-score | ${data.dominantFeatureZscore} |
| Coherence proxy | ${data.coherenceProxy} |

### Dynamics

| Field | Value |
|---|---|
| Dynamics index | ${data.dynamicsIndex} |
| Dynamics classification | ${data.dynamicsClassification} |
| Hidden companion index | ${data.hiddenCompanionIndex} |
| Hidden companion classification | ${data.hiddenCompanionClassification} |
| Hidden companion status | ${data.hiddenCompanionStatus} |
| Possible pair involvement | ${data.pairSummary} |

### Pair details

\`\`\`
${data.pairDetails}
\`\`\`

### External crossmatch

| Field | Value |
|---|---|
| SIMBAD status | ${data.simbadStatus} |
| SIMBAD main ID | ${data.simbadMainId} |
| SIMBAD object type | ${data.simbadObjectType} |
| VizieR status | ${data.vizierStatus} |
| VizieR rows | ${data.vizierRows} |
| Gaia NSS status | ${data.nssStatus} |
| Classification hint | ${data.classificationHint} |

### Scientific interpretation

${data.interpretation.join("\n\n")}

### Validation checklist

${data.validationSteps.map((step) => `- [ ] ${step}`).join("\n")}

### Scientific caution

This is a candidate-level report. No planet, binary system, exotic object, or new physical mechanism is confirmed by this dossier alone.
`;
}

function buildDossierData({
  selectedSource,
  crossmatchResults,
  possiblePairs,
  dynamicsMetrics,
}) {
  const sourceId = getSourceId(selectedSource);
  const dynamicSource =
    dynamicsMetrics?.[sourceId] ??
    dynamicsMetrics?.[String(sourceId)] ??
    selectedSource ??
    {};

  const source = {
    ...selectedSource,
    ...dynamicSource,
  };

  const crossmatch = findCrossmatchForSource(source, crossmatchResults);
  const pairInvolvement = findPairInvolvement(source, possiblePairs);

  const parallax = firstAvailable(source, ["parallax", "PARALLAX"]);

  const distancePc = firstAvailable(source, [
    "distance_pc",
    "distance",
    "distance_estimate",
    "photogeometric_distance",
    "r_med_geo",
    "r_med_photogeo",
  ]);

  const computedDistance =
    distancePc ??
    (normalizeNumber(parallax, null) > 0
      ? 1000 / normalizeNumber(parallax, null)
      : null);

  const dynamicsIndexRaw = normalizeNumber(
    firstAvailable(source, [
      "dynamics_index",
      "dynamicsIndex",
      "DYNAMICS_INDEX",
    ]),
    null,
  );

  const hiddenCompanionIndexRaw = normalizeNumber(
    firstAvailable(source, [
      "hidden_companion_index",
      "hidden_companion_suspicion_index",
      "hiddenCompanionSuspicionIndex",
      "companion_index",
      "HIDDEN_COMPANION_SUSPICION_INDEX",
    ]),
    null,
  );

  const data = {
    sourceId,

    ra: formatValue(firstAvailable(source, ["ra", "RA"]), 10),
    dec: formatValue(firstAvailable(source, ["dec", "DEC"]), 10),
    parallax: formatValue(parallax, 10),
    distancePc: formatValue(computedDistance, 6),
    pmra: formatValue(firstAvailable(source, ["pmra", "PMRA"]), 10),
    pmdec: formatValue(firstAvailable(source, ["pmdec", "PMDEC"]), 10),
    properMotionTotal: formatValue(
      firstAvailable(source, [
        "proper_motion_total",
        "pm_total",
        "properMotionTotal",
      ]),
      6,
    ),
    tangentialVelocity: formatValue(
      firstAvailable(source, [
        "tangential_velocity",
        "tangentialVelocity",
      ]),
      6,
    ),
    radialVelocity: formatValue(
      firstAvailable(source, [
        "radial_velocity",
        "radialVelocity",
        "RADIAL_VELOCITY",
        "rv",
      ]),
      10,
    ),
    approximateSpaceVelocity: formatValue(
      firstAvailable(source, [
        "approximate_space_velocity",
        "space_velocity",
        "approximateSpaceVelocity",
      ]),
      6,
    ),

    gMagnitude: formatValue(
      firstAvailable(source, ["phot_g_mean_mag", "g_mag", "G"]),
      6,
    ),
    gaiaColorIndex: formatValue(
      firstAvailable(source, [
        "gaia_color_index",
        "bp_rp",
        "BP_RP",
        "colour_index",
        "color_index",
      ]),
      6,
    ),
    bpMagnitude: formatValue(
      firstAvailable(source, ["phot_bp_mean_mag", "bp_mag"]),
      6,
    ),
    rpMagnitude: formatValue(
      firstAvailable(source, ["phot_rp_mean_mag", "rp_mag"]),
      6,
    ),

    anomalyScore: formatValue(
      firstAvailable(source, [
        "anomaly_score",
        "anomalyScore",
        "ANOMALY_SCORE",
      ]),
      6,
    ),
    anomalyRank: formatValue(
      firstAvailable(source, [
        "anomaly_rank",
        "anomalyRank",
        "ANOMALY_RANK",
      ]),
    ),
    structuralRank: formatValue(
      firstAvailable(source, [
        "structural_rank",
        "structuralRank",
        "STRUCTURAL_RANK",
      ]),
    ),
    structuralImportance: formatValue(
      firstAvailable(source, [
        "structural_importance_score",
        "structural_importance",
        "structuralImportance",
        "STRUCTURAL_IMPORTANCE",
      ]),
      6,
    ),
    localDensity: formatValue(
      firstAvailable(source, [
        "local_density_score",
        "local_density",
        "localDensityScore",
        "localDensity",
        "LOCAL_DENSITY_SCORE",
      ]),
      6,
    ),
    dominantFeature: formatValue(
      firstAvailable(source, [
        "dominant_anomaly_feature",
        "dominant_feature",
        "dominantFeature",
      ]),
    ),
    dominantFeatureZscore: formatValue(
      firstAvailable(source, [
        "dominant_feature_zscore",
        "dominantFeatureZscore",
        "feature_zscore",
      ]),
      6,
    ),
    coherenceProxy: formatValue(
      firstAvailable(source, [
        "coherence_proxy",
        "coherenceProxy",
        "K_proxy",
        "k_proxy",
        "k_coherence",
      ]),
      6,
    ),

    dynamicsIndexRaw,
    hiddenCompanionIndexRaw,

    dynamicsIndex: formatValue(dynamicsIndexRaw, 6),
    dynamicsClassification: formatValue(
      firstAvailable(source, [
        "dynamics_classification",
        "dynamics_class",
        "dynamicsClassification",
      ]),
    ),
    hiddenCompanionIndex: formatValue(hiddenCompanionIndexRaw, 6),
    hiddenCompanionClassification: formatValue(
      firstAvailable(source, [
        "hidden_companion_classification",
        "hiddenCompanionClassification",
      ]),
    ),
    hiddenCompanionStatus: formatValue(
      firstAvailable(source, [
        "hidden_companion_status",
        "hiddenCompanionStatus",
      ]),
    ),

    crossmatchAvailable: Boolean(crossmatch),

    simbadStatus: formatValue(
      firstAvailable(crossmatch ?? {}, [
        "simbad_status",
        "simbad_match",
        "simbad",
        "SIMBAD",
      ]),
    ),
    simbadMainId: formatValue(
      firstAvailable(crossmatch ?? {}, [
        "simbad_main_id",
        "main_id",
        "simbad_id",
      ]),
    ),
    simbadObjectType: formatValue(
      firstAvailable(crossmatch ?? {}, [
        "simbad_object_type",
        "object_type",
        "otype",
      ]),
    ),
    vizierStatus: formatValue(
      firstAvailable(crossmatch ?? {}, [
        "vizier_status",
        "vizier_match",
        "vizier",
        "VIZIER",
      ]),
    ),
    vizierRows: formatValue(
      firstAvailable(crossmatch ?? {}, [
        "vizier_rows",
        "vizier_match_count",
        "vizier_count",
      ]),
    ),
    nssStatus: formatValue(
      firstAvailable(crossmatch ?? {}, [
        "nss_status",
        "nss_match",
        "gaia_nss",
        "nss",
        "NSS",
      ]),
    ),
    classificationHint: formatValue(
      firstAvailable(crossmatch ?? {}, [
        "classification_hint",
        "classification",
        "external_classification",
      ]),
    ),

    pairCount: pairInvolvement.length,
    pairSummary: buildPairSummary(pairInvolvement),
    pairDetails: buildPairDetails(pairInvolvement, sourceId),

    gaiaArchiveUrl: buildGaiaArchiveUrl(source),
    esaSkyUrl: buildEsaSkyUrl(source),
    simbadUrl: buildSimbadUrl(source),
    vizierUrl: buildVizierUrl(source),
    sourceAdqlQuery: buildSourceAdqlQuery(source),
    gaiaNssAdqlQuery: buildGaiaNssAdqlQuery(source),
  };

  data.interpretation = buildScientificInterpretation(data);
  data.validationSteps = buildValidationSteps(data);
  data.plainText = buildPlainTextDossier(data);
  data.latex = buildLatexDossier(data);
  data.githubIssue = buildGitHubIssue(data);

  return data;
}

function DossierMetric({ label, value }) {
  return (
    <p>
      <span>{label}</span>
      <strong>{value}</strong>
    </p>
  );
}

function DossierCard({ title, children }) {
  return (
    <div className="candidate-explanation-card dossier-card">
      <span>{title}</span>
      <div className="details-list dossier-details">{children}</div>
    </div>
  );
}

function CandidateDossierGenerator({
  selectedSource,
  crossmatchResults = [],
  possiblePairs = [],
  dynamicsMetrics = {},
}) {
  const [copied, setCopied] = useState(null);

  const dossier = useMemo(() => {
    if (!selectedSource) {
      return null;
    }

    return buildDossierData({
      selectedSource,
      crossmatchResults,
      possiblePairs,
      dynamicsMetrics,
    });
  }, [selectedSource, crossmatchResults, possiblePairs, dynamicsMetrics]);

  async function copyText(label, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied("Copy failed");
      window.setTimeout(() => setCopied(null), 1600);
    }
  }

  if (!dossier) {
    return (
      <section className="panel candidate-dossier-panel">
        <div className="panel-header">
          <div>
            <h2>Candidate Dossier Generator</h2>
            <span>Candidate-level export module</span>
          </div>
        </div>

        <div className="empty-selection">
          Select a source to generate a candidate dossier.
        </div>
      </section>
    );
  }

  return (
    <section className="panel candidate-dossier-panel">
      <div className="panel-header">
        <div>
          <h2>Candidate Dossier Generator</h2>
          <span>Candidate-level scientific report export</span>
        </div>

        <div className="source-table-count">SOURCE_ID {dossier.sourceId}</div>
      </div>

      <div className="coherence-warning">
        <strong>Scientific note:</strong> this dossier is a structured candidate
        report. It does not confirm planets, binaries, exotic objects or
        non-standard physics. It collects the current computational evidence and
        the next validation steps.
      </div>

      <div className="candidate-primary-card dossier-primary-card">
        <div className="candidate-primary-header">
          <div>
            <span className="candidate-id">DOSSIER</span>

            <h3>{dossier.dynamicsClassification}</h3>

            <p>
              SOURCE_ID <strong>{dossier.sourceId}</strong>
            </p>
          </div>

          <div className="candidate-score-orb">
            <span>Dynamics index</span>
            <strong>{dossier.dynamicsIndex}</strong>
          </div>
        </div>

        <div className="candidate-explanation-grid">
          <DossierCard title="Gaia astrometry">
            <DossierMetric label="RA (deg)" value={dossier.ra} />
            <DossierMetric label="DEC (deg)" value={dossier.dec} />
            <DossierMetric label="Parallax (mas)" value={dossier.parallax} />
            <DossierMetric label="Distance (pc)" value={dossier.distancePc} />
            <DossierMetric label="PMRA (mas/yr)" value={dossier.pmra} />
            <DossierMetric label="PMDEC (mas/yr)" value={dossier.pmdec} />
          </DossierCard>

          <DossierCard title="Kinematics">
            <DossierMetric
              label="Proper motion total"
              value={dossier.properMotionTotal}
            />
            <DossierMetric
              label="Tangential velocity"
              value={dossier.tangentialVelocity}
            />
            <DossierMetric
              label="Radial velocity"
              value={dossier.radialVelocity}
            />
            <DossierMetric
              label="Approx. space velocity"
              value={dossier.approximateSpaceVelocity}
            />
          </DossierCard>

          <DossierCard title="Computational ranking">
            <DossierMetric label="Anomaly score" value={dossier.anomalyScore} />
            <DossierMetric label="Anomaly rank" value={dossier.anomalyRank} />
            <DossierMetric
              label="Structural rank"
              value={dossier.structuralRank}
            />
            <DossierMetric
              label="Structural importance"
              value={dossier.structuralImportance}
            />
            <DossierMetric label="Local density" value={dossier.localDensity} />
            <DossierMetric
              label="Coherence proxy"
              value={dossier.coherenceProxy}
            />
          </DossierCard>

          <DossierCard title="Photometry and colour">
            <DossierMetric label="G magnitude" value={dossier.gMagnitude} />
            <DossierMetric
              label="BP-RP / colour index"
              value={dossier.gaiaColorIndex}
            />
            <DossierMetric label="BP magnitude" value={dossier.bpMagnitude} />
            <DossierMetric label="RP magnitude" value={dossier.rpMagnitude} />
            <DossierMetric
              label="Dominant feature"
              value={dossier.dominantFeature}
            />
            <DossierMetric
              label="Feature z-score"
              value={dossier.dominantFeatureZscore}
            />
          </DossierCard>

          <DossierCard title="Hidden companion triage">
            <DossierMetric
              label="Hidden companion index"
              value={dossier.hiddenCompanionIndex}
            />
            <DossierMetric
              label="Hidden companion class"
              value={dossier.hiddenCompanionClassification}
            />
            <DossierMetric
              label="Hidden companion status"
              value={dossier.hiddenCompanionStatus}
            />
            <DossierMetric
              label="Possible pair involvement"
              value={dossier.pairSummary}
            />
          </DossierCard>

          <DossierCard title="External crossmatch">
            <DossierMetric label="SIMBAD status" value={dossier.simbadStatus} />
            <DossierMetric label="SIMBAD main ID" value={dossier.simbadMainId} />
            <DossierMetric
              label="SIMBAD object type"
              value={dossier.simbadObjectType}
            />
            <DossierMetric label="VizieR status" value={dossier.vizierStatus} />
            <DossierMetric label="VizieR rows" value={dossier.vizierRows} />
            <DossierMetric label="Gaia NSS" value={dossier.nssStatus} />
          </DossierCard>
        </div>

        <div className="candidate-detailed-note">
          <h3>Possible pair details</h3>

          <pre className="dossier-pair-details">{dossier.pairDetails}</pre>
        </div>

        <div className="candidate-detailed-note">
          <h3>Scientific interpretation</h3>

          {dossier.interpretation.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        <div className="candidate-detailed-note">
          <h3>Validation checklist</h3>

          <ol className="dossier-validation-list">
            {dossier.validationSteps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="candidate-action-row">
          <a
            className="dashboard-nav-button dashboard-nav-button-accent"
            href={dossier.gaiaArchiveUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open Gaia Archive
          </a>

          <a
            className="dashboard-nav-button"
            href={dossier.esaSkyUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open ESASky
          </a>

          <a
            className="dashboard-nav-button"
            href={dossier.simbadUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open SIMBAD
          </a>

          <a
            className="dashboard-nav-button"
            href={dossier.vizierUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open VizieR
          </a>
        </div>

        <div className="candidate-action-row">
          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => copyText("plain text", dossier.plainText)}
          >
            Copy plain text dossier
          </button>

          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => copyText("LaTeX", dossier.latex)}
          >
            Copy LaTeX dossier
          </button>

          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => copyText("GitHub issue", dossier.githubIssue)}
          >
            Copy GitHub issue
          </button>

          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => copyText("Gaia ADQL", dossier.sourceAdqlQuery)}
          >
            Copy Gaia ADQL
          </button>

          <button
            type="button"
            className="dashboard-nav-button"
            onClick={() => copyText("Gaia NSS ADQL", dossier.gaiaNssAdqlQuery)}
          >
            Copy Gaia NSS ADQL
          </button>

          {copied && <span className="copy-status">Copied: {copied}</span>}
        </div>
      </div>
    </section>
  );
}

export default CandidateDossierGenerator;