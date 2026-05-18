/*
  stellarInference.js

  Utility scientifiche per la quinta pagina:
  Stellar Reconstruction & Full Dossier.

  Scopo:
  - raccogliere i dati disponibili della sorgente Gaia selezionata;
  - derivare parametri stellari proxy;
  - costruire un modello sintetico fisicamente informato per il viewer 3D.

  Nota scientifica:
  Tutte le grandezze derivate sono stime/proxy. Non rappresentano una
  classificazione astrofisica confermata. La ricostruzione 3D deve essere
  interpretata come synthetic stellar reconstruction, non come osservazione
  diretta della superficie stellare.
*/

const SOLAR_ABSOLUTE_G_MAG = 4.67;
const SOLAR_EFFECTIVE_TEMPERATURE_K = 5772;

export function normalizeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clamp(value, min, max) {
  const number = normalizeNumber(value, min);
  return Math.max(min, Math.min(max, number));
}

export function clamp01(value) {
  return clamp(value, 0, 1);
}

export function formatNumber(value, digits = 4) {
  const number = normalizeNumber(value, null);

  if (number === null) {
    return "N/A";
  }

  if (Math.abs(number) >= 10000) {
    return number.toExponential(3);
  }

  return number.toFixed(digits);
}

export function getSourceId(source) {
  return String(
    source?.SOURCE_ID ??
      source?.source_id ??
      source?.sourceId ??
      source?.id ??
      "",
  );
}

export function firstAvailable(source, keys, fallback = null) {
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

export function computeDistancePcFromParallax(parallaxMas) {
  const parallax = normalizeNumber(parallaxMas, null);

  if (parallax === null || parallax <= 0) {
    return null;
  }

  return 1000 / parallax;
}

export function computeProperMotionTotal(pmra, pmdec) {
  const pmraValue = normalizeNumber(pmra, null);
  const pmdecValue = normalizeNumber(pmdec, null);

  if (pmraValue === null || pmdecValue === null) {
    return null;
  }

  return Math.sqrt(pmraValue * pmraValue + pmdecValue * pmdecValue);
}

export function computeTangentialVelocityKmS(properMotionTotalMasYr, parallaxMas) {
  const properMotion = normalizeNumber(properMotionTotalMasYr, null);
  const parallax = normalizeNumber(parallaxMas, null);

  if (properMotion === null || parallax === null || parallax <= 0) {
    return null;
  }

  /*
    v_t = 4.74047 * μ / π

    μ in mas/yr
    π in mas
    v_t in km/s
  */
  return 4.74047 * (properMotion / parallax);
}

export function computeApproximateSpaceVelocityKmS(
  tangentialVelocityKmS,
  radialVelocityKmS,
) {
  const vt = normalizeNumber(tangentialVelocityKmS, null);
  const rv = normalizeNumber(radialVelocityKmS, null);

  if (vt === null && rv === null) {
    return null;
  }

  if (vt === null) {
    return Math.abs(rv);
  }

  if (rv === null) {
    return Math.abs(vt);
  }

  return Math.sqrt(vt * vt + rv * rv);
}

export function estimateColorIndex(source) {
  const direct = normalizeNumber(
    firstAvailable(source, ["gaia_color_index", "bp_rp", "BP_RP"]),
    null,
  );

  if (direct !== null) {
    return direct;
  }

  const bp = normalizeNumber(
    firstAvailable(source, ["phot_bp_mean_mag", "PHOT_BP_MEAN_MAG"]),
    null,
  );

  const rp = normalizeNumber(
    firstAvailable(source, ["phot_rp_mean_mag", "PHOT_RP_MEAN_MAG"]),
    null,
  );

  if (bp !== null && rp !== null) {
    return bp - rp;
  }

  return null;
}

export function computeAbsoluteMagnitude(apparentMagnitude, distancePc) {
  const apparent = normalizeNumber(apparentMagnitude, null);
  const distance = normalizeNumber(distancePc, null);

  if (apparent === null || distance === null || distance <= 0) {
    return null;
  }

  /*
    M = m - 5 log10(d / 10)
  */
  return apparent - 5 * Math.log10(distance / 10);
}

export function estimateEffectiveTemperatureFromBpRp(bpRp) {
  const color = normalizeNumber(bpRp, null);

  if (color === null) {
    return null;
  }

  /*
    Ballesteros-like color-temperature approximation adapted as a visual proxy.

    This is not a substitute for spectroscopic effective temperature.
    It is used only to build a physically plausible color/texture model.
  */
  const safeColor = clamp(color, -0.4, 4.2);

  const temperature =
    4600 *
    (1 / (0.92 * safeColor + 1.7) + 1 / (0.92 * safeColor + 0.62));

  return clamp(temperature, 2400, 45000);
}

export function estimateLuminosityRelative(absoluteMagnitudeG) {
  const absoluteMag = normalizeNumber(absoluteMagnitudeG, null);

  if (absoluteMag === null) {
    return null;
  }

  /*
    L/Lsun ≈ 10^((M_sun - M) / 2.5)

    Uses solar Gaia-G absolute magnitude as a broad proxy.
  */
  const luminosity = Math.pow(10, (SOLAR_ABSOLUTE_G_MAG - absoluteMag) / 2.5);

  if (!Number.isFinite(luminosity) || luminosity <= 0) {
    return null;
  }

  return luminosity;
}

export function estimateRadiusRelative(luminosityRelative, effectiveTemperatureK) {
  const luminosity = normalizeNumber(luminosityRelative, null);
  const temperature = normalizeNumber(effectiveTemperatureK, null);

  if (luminosity === null || temperature === null || temperature <= 0) {
    return null;
  }

  /*
    L = 4πR²σT⁴
    R/Rsun = sqrt(L/Lsun) * (Tsun/T)^2
  */
  const radius =
    Math.sqrt(Math.max(luminosity, 0)) *
    Math.pow(SOLAR_EFFECTIVE_TEMPERATURE_K / temperature, 2);

  if (!Number.isFinite(radius) || radius <= 0) {
    return null;
  }

  return radius;
}

export function estimateSpectralProxy(bpRp, absoluteMagnitudeG = null) {
  const color = normalizeNumber(bpRp, null);
  const absMag = normalizeNumber(absoluteMagnitudeG, null);

  if (color === null) {
    return {
      label: "Unknown stellar proxy",
      shortLabel: "Unknown",
      family: "unknown",
      colorHex: "#9aa8b8",
      emissiveHex: "#6f7f90",
      temperatureHintK: null,
      description:
        "Insufficient Gaia color information for a reliable visual proxy.",
    };
  }

  let base;

  if (color < 0.3) {
    base = {
      label: "Hot blue stellar proxy",
      shortLabel: "O/B-type proxy",
      family: "hot-blue",
      colorHex: "#9bb8ff",
      emissiveHex: "#5f8cff",
      temperatureHintK: 25000,
      description:
        "Very blue Gaia color proxy, visually rendered as a hot blue-white star.",
    };
  } else if (color < 0.6) {
    base = {
      label: "Blue-white stellar proxy",
      shortLabel: "B-type proxy",
      family: "blue-white",
      colorHex: "#aac8ff",
      emissiveHex: "#6fa2ff",
      temperatureHintK: 15000,
      description:
        "Blue-white Gaia color proxy, visually rendered as a hot luminous source.",
    };
  } else if (color < 0.9) {
    base = {
      label: "White stellar proxy",
      shortLabel: "A-type proxy",
      family: "white",
      colorHex: "#dbe8ff",
      emissiveHex: "#9bbcff",
      temperatureHintK: 9000,
      description:
        "White Gaia color proxy, visually rendered as a bright white-blue source.",
    };
  } else if (color < 1.2) {
    base = {
      label: "Yellow-white stellar proxy",
      shortLabel: "F-type proxy",
      family: "yellow-white",
      colorHex: "#fff4d6",
      emissiveHex: "#ffd37a",
      temperatureHintK: 7000,
      description:
        "Yellow-white Gaia color proxy, visually rendered as a warm bright star.",
    };
  } else if (color < 1.6) {
    base = {
      label: "Solar-like yellow stellar proxy",
      shortLabel: "G-type proxy",
      family: "solar-like",
      colorHex: "#ffe484",
      emissiveHex: "#ffb347",
      temperatureHintK: 5800,
      description:
        "Solar-like Gaia color proxy, visually rendered as a yellow star.",
    };
  } else if (color < 2.2) {
    base = {
      label: "Orange stellar proxy",
      shortLabel: "K-type proxy",
      family: "orange",
      colorHex: "#ffb347",
      emissiveHex: "#ff7a2c",
      temperatureHintK: 4500,
      description:
        "Orange Gaia color proxy, visually rendered as a cooler orange star.",
    };
  } else if (color < 3.0) {
    base = {
      label: "Red stellar proxy",
      shortLabel: "M-type proxy",
      family: "red",
      colorHex: "#ff6b35",
      emissiveHex: "#ff3a1a",
      temperatureHintK: 3500,
      description:
        "Red Gaia color proxy, visually rendered as a cool red star.",
    };
  } else {
    base = {
      label: "Ultra-cool red stellar proxy",
      shortLabel: "Late M-type proxy",
      family: "deep-red",
      colorHex: "#d83a1a",
      emissiveHex: "#ff2200",
      temperatureHintK: 2800,
      description:
        "Very red Gaia color proxy, visually rendered as an ultra-cool red source.",
    };
  }

  /*
    Very rough luminosity class visual hint:
    If the source is intrinsically bright for its color, label it as giant-like.
    This is only a proxy and must not be interpreted as confirmed luminosity class.
  */
  if (absMag !== null && absMag < 1.5 && color > 0.8) {
    return {
      ...base,
      label: `${base.label} · giant-like luminosity proxy`,
      shortLabel: `${base.shortLabel} / giant-like proxy`,
      description:
        `${base.description} Absolute magnitude suggests a possible giant-like luminosity proxy, requiring catalogue validation.`,
    };
  }

  if (absMag !== null && absMag > 8.5 && color > 1.5) {
    return {
      ...base,
      label: `${base.label} · dwarf-like luminosity proxy`,
      shortLabel: `${base.shortLabel} / dwarf-like proxy`,
      description:
        `${base.description} Absolute magnitude suggests a possible dwarf-like luminosity proxy, requiring catalogue validation.`,
    };
  }

  return base;
}

export function estimateActivityProxy(source, derived = {}) {
  const anomaly = clamp01(
    firstAvailable(source, ["anomaly_score", "anomalyScore"], 0),
  );

  const dynamics = clamp01(
    firstAvailable(source, ["dynamics_index", "dynamicsIndex"], 0),
  );

  const hidden = clamp01(
    firstAvailable(
      source,
      [
        "hidden_companion_index",
        "hiddenCompanionIndex",
        "hidden_companion_suspicion_index",
      ],
      0,
    ),
  );

  const structural = clamp01(
    firstAvailable(
      source,
      [
        "structural_importance_score",
        "structural_importance",
        "structuralImportance",
      ],
      0,
    ),
  );

  const temperature = normalizeNumber(derived.effectiveTemperatureK, null);
  const color = normalizeNumber(derived.colorIndex, null);

  /*
    This is not stellar magnetic activity.
    It is only a visual rendering intensity proxy.
  */
  let visualActivity =
    0.25 * anomaly + 0.25 * dynamics + 0.25 * hidden + 0.25 * structural;

  if (temperature !== null && temperature < 4200) {
    visualActivity += 0.12;
  }

  if (color !== null && color > 2.2) {
    visualActivity += 0.08;
  }

  return clamp01(visualActivity);
}

export function estimateCoronaIntensity(source, derived = {}) {
  const temperature = normalizeNumber(derived.effectiveTemperatureK, null);
  const luminosity = normalizeNumber(derived.luminosityRelative, null);
  const activity = normalizeNumber(derived.activityProxy, 0.25);

  let intensity = 0.22 + 0.45 * activity;

  if (temperature !== null && temperature > 8000) {
    intensity += 0.18;
  }

  if (luminosity !== null && luminosity > 10) {
    intensity += 0.12;
  }

  return clamp(intensity, 0.12, 0.95);
}

export function estimateSurfaceContrast(source, derived = {}) {
  const color = normalizeNumber(derived.colorIndex, null);
  const temperature = normalizeNumber(derived.effectiveTemperatureK, null);
  const activity = normalizeNumber(derived.activityProxy, 0.25);

  let contrast = 0.24 + activity * 0.38;

  if (temperature !== null && temperature < 4500) {
    contrast += 0.14;
  }

  if (color !== null && color > 2.0) {
    contrast += 0.12;
  }

  return clamp(contrast, 0.18, 0.82);
}

export function estimateRotationSpeed(source, derived = {}) {
  const properMotion = normalizeNumber(derived.properMotionTotal, null);
  const velocity = normalizeNumber(derived.approximateSpaceVelocity, null);
  const radius = normalizeNumber(derived.radiusRelative, null);

  /*
    This is only a visual rotation speed, not measured stellar spin.
  */
  let speed = 0.0024;

  if (velocity !== null) {
    speed += Math.min(0.003, Math.abs(velocity) / 90000);
  }

  if (properMotion !== null) {
    speed += Math.min(0.002, properMotion / 100000);
  }

  if (radius !== null && radius > 3) {
    speed *= 0.65;
  }

  return clamp(speed, 0.0012, 0.008);
}

export function estimateVisualScale(radiusRelative) {
  const radius = normalizeNumber(radiusRelative, null);

  if (radius === null) {
    return 1;
  }

  /*
    Visual scale compressed to avoid giant stars dominating the canvas.
  */
  return clamp(Math.pow(radius, 0.28), 0.65, 2.4);
}

export function buildFullStellarRecord(
  selectedSource,
  {
    graphCentrality = [],
    featureContributions = [],
    emergentStructures = [],
    candidateCrossmatchResults = [],
    possibleBinaryPairs = [],
  } = {},
) {
  if (!selectedSource) {
    return null;
  }

  const sourceId = getSourceId(selectedSource);

  const centralityMatch =
    graphCentrality.find((item) => getSourceId(item) === sourceId) ?? {};

  const featureMatch =
    featureContributions.find((item) => getSourceId(item) === sourceId) ?? {};

  const emergentMatch =
    emergentStructures.find((item) => getSourceId(item) === sourceId) ?? {};

  const crossmatch =
    candidateCrossmatchResults.find((item) => getSourceId(item) === sourceId) ??
    null;

  const possiblePairs = Array.isArray(possibleBinaryPairs)
    ? possibleBinaryPairs.filter((pair) => {
        const a = String(
          pair?.source_a ??
            pair?.source_id_a ??
            pair?.SOURCE_ID_A ??
            pair?.sourceA ??
            pair?.a ??
            "",
        );

        const b = String(
          pair?.source_b ??
            pair?.source_id_b ??
            pair?.SOURCE_ID_B ??
            pair?.sourceB ??
            pair?.b ??
            "",
        );

        return a === sourceId || b === sourceId;
      })
    : [];

  const merged = {
    ...selectedSource,
    ...centralityMatch,
    ...featureMatch,
    ...emergentMatch,
  };

  const parallax = firstAvailable(merged, ["parallax", "PARALLAX"]);
  const pmra = firstAvailable(merged, ["pmra", "PMRA"]);
  const pmdec = firstAvailable(merged, ["pmdec", "PMDEC"]);
  const radialVelocity = firstAvailable(merged, [
    "radial_velocity",
    "RADIAL_VELOCITY",
    "rv",
  ]);

  const distancePc =
    normalizeNumber(
      firstAvailable(merged, ["distance_pc", "distancePc", "distance_estimate"]),
      null,
    ) ?? computeDistancePcFromParallax(parallax);

  const properMotionTotal =
    normalizeNumber(
      firstAvailable(merged, ["proper_motion_total", "properMotionTotal"]),
      null,
    ) ?? computeProperMotionTotal(pmra, pmdec);

  const tangentialVelocity =
    normalizeNumber(
      firstAvailable(merged, ["tangential_velocity", "tangentialVelocity"]),
      null,
    ) ?? computeTangentialVelocityKmS(properMotionTotal, parallax);

  const approximateSpaceVelocity =
    normalizeNumber(
      firstAvailable(merged, [
        "approximate_space_velocity",
        "approximateSpaceVelocity",
      ]),
      null,
    ) ?? computeApproximateSpaceVelocityKmS(tangentialVelocity, radialVelocity);

  const colorIndex = estimateColorIndex(merged);

  const photG = firstAvailable(merged, [
    "phot_g_mean_mag",
    "PHOT_G_MEAN_MAG",
  ]);

  const absoluteMagnitudeG = computeAbsoluteMagnitude(photG, distancePc);
  const effectiveTemperatureK = estimateEffectiveTemperatureFromBpRp(colorIndex);
  const luminosityRelative = estimateLuminosityRelative(absoluteMagnitudeG);
  const radiusRelative = estimateRadiusRelative(
    luminosityRelative,
    effectiveTemperatureK,
  );

  return {
    ...merged,

    SOURCE_ID: sourceId,

    ra: firstAvailable(merged, ["ra", "RA"]),
    dec: firstAvailable(merged, ["dec", "DEC"]),
    parallax,
    pmra,
    pmdec,
    radial_velocity: radialVelocity,

    phot_g_mean_mag: photG,
    phot_bp_mean_mag: firstAvailable(merged, [
      "phot_bp_mean_mag",
      "PHOT_BP_MEAN_MAG",
    ]),
    phot_rp_mean_mag: firstAvailable(merged, [
      "phot_rp_mean_mag",
      "PHOT_RP_MEAN_MAG",
    ]),
    bp_rp: firstAvailable(merged, ["bp_rp", "BP_RP"]),

    distance_pc: distancePc,
    proper_motion_total: properMotionTotal,
    tangential_velocity: tangentialVelocity,
    approximate_space_velocity: approximateSpaceVelocity,

    gaia_color_index: colorIndex,
    absolute_magnitude_g: absoluteMagnitudeG,
    estimated_effective_temperature_k: effectiveTemperatureK,
    estimated_luminosity_relative: luminosityRelative,
    estimated_radius_relative: radiusRelative,

    anomaly_score: normalizeNumber(
      firstAvailable(merged, ["anomaly_score", "anomalyScore"]),
      null,
    ),

    anomaly_rank: firstAvailable(merged, ["anomaly_rank", "anomalyRank"]),

    structural_rank: firstAvailable(merged, [
      "structural_rank",
      "structuralRank",
      "rank",
    ]),

    structural_importance_score: normalizeNumber(
      firstAvailable(merged, [
        "structural_importance_score",
        "structural_importance",
        "structuralImportance",
      ]),
      null,
    ),

    dynamics_index: normalizeNumber(
      firstAvailable(merged, ["dynamics_index", "dynamicsIndex"]),
      null,
    ),

    hidden_companion_index: normalizeNumber(
      firstAvailable(merged, [
        "hidden_companion_index",
        "hiddenCompanionIndex",
        "hidden_companion_suspicion_index",
      ]),
      null,
    ),

    hidden_companion_classification: firstAvailable(
      merged,
      ["hidden_companion_classification", "hiddenCompanionClassification"],
      "N/A",
    ),

    coherence_proxy: normalizeNumber(
      firstAvailable(merged, [
        "coherence_proxy",
        "coherence",
        "k_proxy",
        "gradient_proxy",
      ]),
      null,
    ),

    crossmatch,
    possible_pairs: possiblePairs,
  };
}

export function buildStarModel(fullRecord) {
  if (!fullRecord) {
    return null;
  }

  const colorIndex = normalizeNumber(fullRecord.gaia_color_index, null);
  const absoluteMagnitudeG = normalizeNumber(
    fullRecord.absolute_magnitude_g,
    null,
  );

  const effectiveTemperatureK =
    normalizeNumber(fullRecord.estimated_effective_temperature_k, null) ??
    estimateEffectiveTemperatureFromBpRp(colorIndex);

  const luminosityRelative =
    normalizeNumber(fullRecord.estimated_luminosity_relative, null) ??
    estimateLuminosityRelative(absoluteMagnitudeG);

  const radiusRelative =
    normalizeNumber(fullRecord.estimated_radius_relative, null) ??
    estimateRadiusRelative(luminosityRelative, effectiveTemperatureK);

  const spectralProxy = estimateSpectralProxy(colorIndex, absoluteMagnitudeG);

  const derived = {
    colorIndex,
    effectiveTemperatureK,
    luminosityRelative,
    radiusRelative,
    properMotionTotal: fullRecord.proper_motion_total,
    approximateSpaceVelocity: fullRecord.approximate_space_velocity,
  };

  const activityProxy = estimateActivityProxy(fullRecord, derived);
  const coronaIntensity = estimateCoronaIntensity(fullRecord, {
    ...derived,
    activityProxy,
  });
  const surfaceContrast = estimateSurfaceContrast(fullRecord, {
    ...derived,
    activityProxy,
  });
  const rotationSpeed = estimateRotationSpeed(fullRecord, derived);
  const visualScale = estimateVisualScale(radiusRelative);

  const confidenceFlags = [];

  if (colorIndex === null) {
    confidenceFlags.push("missing Gaia BP-RP color proxy");
  }

  if (fullRecord.distance_pc === null) {
    confidenceFlags.push("missing reliable distance estimate");
  }

  if (absoluteMagnitudeG === null) {
    confidenceFlags.push("missing absolute magnitude estimate");
  }

  if (effectiveTemperatureK === null) {
    confidenceFlags.push("missing effective temperature estimate");
  }

  return {
    sourceId: getSourceId(fullRecord),

    colorIndex,
    effectiveTemperatureK,
    absoluteMagnitudeG,
    luminosityRelative,
    radiusRelative,

    spectralProxyLabel: spectralProxy.label,
    spectralProxyShortLabel: spectralProxy.shortLabel,
    spectralProxyFamily: spectralProxy.family,
    spectralProxyDescription: spectralProxy.description,

    colorHex: spectralProxy.colorHex,
    emissiveHex: spectralProxy.emissiveHex,

    activityProxy,
    coronaIntensity,
    surfaceContrast,
    rotationSpeed,
    visualScale,

    anomalyScore: fullRecord.anomaly_score,
    dynamicsIndex: fullRecord.dynamics_index,
    hiddenCompanionIndex: fullRecord.hidden_companion_index,
    structuralImportanceScore: fullRecord.structural_importance_score,

    confidenceLevel:
      confidenceFlags.length === 0
        ? "medium"
        : confidenceFlags.length <= 2
          ? "limited"
          : "low",

    confidenceFlags,

    cautionNote:
      "Synthetic stellar reconstruction based on Gaia-derived observable proxies. This is not a direct observation of the stellar surface.",

    scientificLabel:
      "Physically-informed synthetic stellar reconstruction, not a confirmed astrophysical classification.",
  };
}

export function buildValidationSteps(fullRecord) {
  if (!fullRecord) {
    return [];
  }

  const steps = [
    "Verify the Gaia DR3 source directly in Gaia Archive.",
    "Check SIMBAD and VizieR object context.",
    "Inspect Gaia NSS if available.",
    "Review RUWE, astrometric excess noise and radial velocity when available.",
    "Compare parallax and proper motion with nearby sources before any comoving-pair interpretation.",
    "Treat the 3D reconstruction as a synthetic visual proxy, not as a direct observation.",
  ];

  if (fullRecord.possible_pairs?.length) {
    steps.push(
      "Validate possible pair involvement using parallax consistency, proper motion similarity, angular separation and chance-alignment analysis.",
    );
  }

  if (fullRecord.hidden_companion_index !== null) {
    steps.push(
      "Use the hidden companion index only as a prioritization proxy; confirm with Gaia NSS, spectroscopy, imaging or external catalogues where available.",
    );
  }

  return steps;
}

export function buildScientificInterpretation(fullRecord, starModel) {
  if (!fullRecord || !starModel) {
    return "No selected Gaia source is available for interpretation.";
  }

  const sourceId = getSourceId(fullRecord);
  const parts = [];

  parts.push(
    `Gaia source ${sourceId || "N/A"} is represented here as a candidate-level stellar reconstruction derived from available Gaia observables and internal dashboard proxies.`,
  );

  if (starModel.spectralProxyLabel) {
    parts.push(
      `The visual stellar model is rendered as a ${starModel.spectralProxyLabel}.`,
    );
  }

  if (starModel.effectiveTemperatureK !== null) {
    parts.push(
      `The estimated effective temperature proxy is approximately ${formatNumber(
        starModel.effectiveTemperatureK,
        0,
      )} K.`,
    );
  }

  if (starModel.absoluteMagnitudeG !== null) {
    parts.push(
      `The estimated absolute Gaia-G magnitude proxy is ${formatNumber(
        starModel.absoluteMagnitudeG,
        3,
      )}.`,
    );
  }

  if (starModel.radiusRelative !== null) {
    parts.push(
      `The estimated visual radius proxy is ${formatNumber(
        starModel.radiusRelative,
        3,
      )} solar radii.`,
    );
  }

  parts.push(
    "These values are intended for prioritization and visualization only and require independent astrophysical validation before physical interpretation.",
  );

  return parts.join(" ");
}