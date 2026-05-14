"""
Codex Alpha Computational Framework
Automatic Candidate Crossmatch Backend

This module performs an external validation pre-screening for Gaia candidate
sources produced by the Codex Alpha pipeline.

It reads local pipeline outputs, rebuilds the same candidate ranking logic used
by the dashboard, and attempts external crossmatch checks against:

- SIMBAD cone search through SIMBAD TAP
- VizieR cone search through VizieR tabular endpoint
- Gaia DR3 NSS / binary-system tables through Gaia TAP

Outputs:
- results/candidate_crossmatch_results.csv
- results/candidate_crossmatch_results.json

The module is intentionally conservative:
it never claims astrophysical discovery, and it never invents missing catalogue
matches. If an external service fails, the corresponding status is marked as
"service_error" or "not_checked" with a diagnostic note.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import csv
import io
import json
import math
import time

import pandas as pd


RESULTS_DIR = Path("results")

ANOMALY_RESULTS = RESULTS_DIR / "gaia_dr3_anomaly_results.csv"
FEATURE_CONTRIBUTIONS = RESULTS_DIR / "gaia_dr3_feature_contributions.csv"
EMERGENT_STRUCTURES = RESULTS_DIR / "gaia_dr3_emergent_structures.csv"
GRAPH_CENTRALITY = RESULTS_DIR / "gaia_dr3_graph_centrality.csv"

CROSSMATCH_CSV_OUTPUT = RESULTS_DIR / "candidate_crossmatch_results.csv"
CROSSMATCH_JSON_OUTPUT = RESULTS_DIR / "candidate_crossmatch_results.json"

DEFAULT_MAX_CANDIDATES = 50
DEFAULT_RADIUS_ARCSEC = 5.0
REQUEST_TIMEOUT_SECONDS = 25
REQUEST_SLEEP_SECONDS = 0.35

SIMBAD_TAP_URL = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"
GAIA_TAP_URL = "https://gea.esac.esa.int/tap-server/tap/sync"
VIZIER_ASU_URL = "https://vizier.cds.unistra.fr/viz-bin/asu-tsv"


def normalize_number(value: Any, fallback: float | None = 0.0) -> float | None:
    try:
        if value is None:
            return fallback

        number = float(value)

        if math.isnan(number):
            return fallback

        return number
    except (TypeError, ValueError):
        return fallback


def normalize_array_value(value: Any, minimum: float, maximum: float) -> float:
    number = normalize_number(value, 0.0)

    if number is None:
        number = 0.0

    if maximum == minimum:
        return 0.5

    return (number - minimum) / (maximum - minimum)


def get_min_max(values: list[Any]) -> tuple[float, float]:
    valid_values = [
        float(value)
        for value in (normalize_number(item, None) for item in values)
        if value is not None
    ]

    if not valid_values:
        return 0.0, 1.0

    return min(valid_values), max(valid_values)


def get_source_id(row: pd.Series | dict[str, Any]) -> str:
    for key in ("SOURCE_ID", "source_id", "id"):
        value = row.get(key)

        if value is not None and str(value).strip():
            return str(value).strip()

    return ""


def angular_separation_arcsec(
    ra1_deg: float,
    dec1_deg: float,
    ra2_deg: float,
    dec2_deg: float,
) -> float:
    ra1 = math.radians(ra1_deg)
    dec1 = math.radians(dec1_deg)
    ra2 = math.radians(ra2_deg)
    dec2 = math.radians(dec2_deg)

    sin_d_dec = math.sin((dec2 - dec1) / 2.0)
    sin_d_ra = math.sin((ra2 - ra1) / 2.0)

    a = (
        sin_d_dec * sin_d_dec
        + math.cos(dec1) * math.cos(dec2) * sin_d_ra * sin_d_ra
    )

    c = 2.0 * math.asin(min(1.0, math.sqrt(a)))

    return math.degrees(c) * 3600.0


def http_get_text(url: str, params: dict[str, str], timeout: int) -> str:
    full_url = url + "?" + urlencode(params)

    request = Request(
        full_url,
        headers={
            "User-Agent": "CodexAlphaComputationalFramework/1.0",
            "Accept": "application/json,text/plain,text/tab-separated-values,*/*",
        },
    )

    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def tap_json_query(url: str, query: str, timeout: int) -> dict[str, Any]:
    response_text = http_get_text(
        url,
        {
            "REQUEST": "doQuery",
            "LANG": "ADQL",
            "FORMAT": "json",
            "QUERY": query,
        },
        timeout,
    )

    return json.loads(response_text)


def load_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Required file not found: {path}")

    df = pd.read_csv(path)

    for column in ("SOURCE_ID", "source_id", "target_id"):
        if column in df.columns:
            df[column] = df[column].astype(str)

    return df


def dataframe_to_map(df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    records = df.where(pd.notnull(df), None).to_dict(orient="records")
    mapped: dict[str, dict[str, Any]] = {}

    for record in records:
        source_id = get_source_id(record)

        if source_id:
            mapped[source_id] = record

    return mapped


def merge_pipeline_context(
    anomalies: pd.DataFrame,
    feature_contributions: pd.DataFrame,
    emergent_structures: pd.DataFrame,
    graph_centrality: pd.DataFrame,
) -> list[dict[str, Any]]:
    feature_map = dataframe_to_map(feature_contributions)
    emergent_map = dataframe_to_map(emergent_structures)
    centrality_map = dataframe_to_map(graph_centrality)

    records = anomalies.where(pd.notnull(anomalies), None).to_dict(orient="records")

    merged: list[dict[str, Any]] = []

    for record in records:
        source_id = get_source_id(record)

        merged_record = {
            **record,
            **feature_map.get(source_id, {}),
            **emergent_map.get(source_id, {}),
            **centrality_map.get(source_id, {}),
            "SOURCE_ID": source_id,
            "source_id": source_id,
        }

        merged.append(merged_record)

    return merged


def compute_coherence_proxy(source: dict[str, Any], ranges: dict[str, tuple[float, float]]) -> float:
    anomaly = normalize_array_value(
        source.get("anomaly_score"),
        ranges["anomaly_score"][0],
        ranges["anomaly_score"][1],
    )

    structural = normalize_array_value(
        source.get("structural_importance_score"),
        ranges["structural_importance_score"][0],
        ranges["structural_importance_score"][1],
    )

    density = normalize_array_value(
        source.get("local_density_score"),
        ranges["local_density_score"][0],
        ranges["local_density_score"][1],
    )

    feature_deviation = normalize_array_value(
        abs(normalize_number(source.get("dominant_feature_zscore"), 0.0) or 0.0),
        ranges["dominant_feature_zscore"][0],
        ranges["dominant_feature_zscore"][1],
    )

    neighbor_distance = normalize_array_value(
        source.get("mean_neighbor_distance"),
        ranges["mean_neighbor_distance"][0],
        ranges["mean_neighbor_distance"][1],
    )

    numerator = (
        0.34 * anomaly
        + 0.26 * structural
        + 0.20 * density
        + 0.20 * feature_deviation
    )

    penalty = 1.0 + 0.55 * neighbor_distance

    return numerator / penalty


def build_ranked_candidates(
    merged_sources: list[dict[str, Any]],
    max_candidates: int,
) -> list[dict[str, Any]]:
    ranges = {
        "anomaly_score": get_min_max([source.get("anomaly_score") for source in merged_sources]),
        "structural_importance_score": get_min_max(
            [source.get("structural_importance_score") for source in merged_sources]
        ),
        "local_density_score": get_min_max(
            [source.get("local_density_score") for source in merged_sources]
        ),
        "dominant_feature_zscore": get_min_max(
            [
                abs(normalize_number(source.get("dominant_feature_zscore"), 0.0) or 0.0)
                for source in merged_sources
            ]
        ),
        "mean_neighbor_distance": get_min_max(
            [source.get("mean_neighbor_distance") for source in merged_sources]
        ),
    }

    enriched = []

    for source in merged_sources:
        coherence_proxy = compute_coherence_proxy(source, ranges)

        enriched.append(
            {
                **source,
                "coherence_proxy": coherence_proxy,
            }
        )

    candidates = [
        source
        for source in enriched
        if int(normalize_number(source.get("anomaly_label"), 0) or 0) == -1
    ]

    candidates.sort(
        key=lambda item: normalize_number(item.get("coherence_proxy"), 0.0) or 0.0,
        reverse=True,
    )

    ranked = []

    for index, source in enumerate(candidates[:max_candidates]):
        ranked.append(
            {
                **source,
                "candidate_id": "CAC-" + str(index + 1).zfill(3),
                "candidate_rank": index + 1,
            }
        )

    return ranked


def build_simbad_query(ra: float, dec: float, radius_arcsec: float) -> str:
    radius_deg = radius_arcsec / 3600.0

    return f"""
SELECT TOP 5
  basic.main_id,
  basic.otype,
  basic.ra,
  basic.dec
FROM basic
WHERE 1 = CONTAINS(
  POINT('ICRS', basic.ra, basic.dec),
  CIRCLE('ICRS', {ra:.10f}, {dec:.10f}, {radius_deg:.10f})
)
""".strip()


def query_simbad(source: dict[str, Any], radius_arcsec: float) -> dict[str, Any]:
    ra = normalize_number(source.get("ra"), None)
    dec = normalize_number(source.get("dec"), None)

    if ra is None or dec is None:
        return {
            "simbad_match": False,
            "simbad_status": "not_checked",
            "simbad_object_type": None,
            "simbad_main_id": None,
            "simbad_angular_separation_arcsec": None,
            "simbad_note": "Missing RA/DEC.",
        }

    query = build_simbad_query(ra, dec, radius_arcsec)

    try:
        data = tap_json_query(SIMBAD_TAP_URL, query, REQUEST_TIMEOUT_SECONDS)
        rows = data.get("data", [])

        if not rows:
            return {
                "simbad_match": False,
                "simbad_status": "no_match",
                "simbad_object_type": None,
                "simbad_main_id": None,
                "simbad_angular_separation_arcsec": None,
                "simbad_note": "No SIMBAD object found within radius.",
            }

        first = rows[0]

        main_id = first[0] if len(first) > 0 else None
        object_type = first[1] if len(first) > 1 else None
        match_ra = normalize_number(first[2] if len(first) > 2 else None, None)
        match_dec = normalize_number(first[3] if len(first) > 3 else None, None)

        separation = None

        if match_ra is not None and match_dec is not None:
            separation = angular_separation_arcsec(ra, dec, match_ra, match_dec)

        return {
            "simbad_match": True,
            "simbad_status": "match",
            "simbad_object_type": object_type,
            "simbad_main_id": str(main_id) if main_id is not None else None,
            "simbad_angular_separation_arcsec": separation,
            "simbad_note": f"{len(rows)} SIMBAD row(s) returned.",
        }

    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        return {
            "simbad_match": False,
            "simbad_status": "service_error",
            "simbad_object_type": None,
            "simbad_main_id": None,
            "simbad_angular_separation_arcsec": None,
            "simbad_note": f"SIMBAD query failed: {exc}",
        }


def parse_vizier_tsv(response_text: str) -> tuple[int, list[str]]:
    lines = response_text.splitlines()
    catalog_names: set[str] = set()
    data_count = 0

    for line in lines:
        stripped = line.strip()

        if not stripped:
            continue

        if stripped.startswith("#"):
            if "Title:" in stripped or "Source:" in stripped or "Catalogue:" in stripped:
                catalog_names.add(stripped.lstrip("#").strip())
            continue

        if stripped.startswith("---"):
            continue

        if "\t" in stripped:
            data_count += 1

    return data_count, sorted(catalog_names)[:10]


def query_vizier(source: dict[str, Any], radius_arcsec: float) -> dict[str, Any]:
    ra = normalize_number(source.get("ra"), None)
    dec = normalize_number(source.get("dec"), None)

    if ra is None or dec is None:
        return {
            "vizier_match_count": 0,
            "vizier_status": "not_checked",
            "vizier_catalogues": [],
            "vizier_note": "Missing RA/DEC.",
        }

    params = {
        "-c": f"{ra:.10f} {dec:.10f}",
        "-c.rs": f"{radius_arcsec:.3f}",
        "-c.u": "arcsec",
        "-out.max": "50",
        "-out.all": "1",
    }

    try:
        response_text = http_get_text(VIZIER_ASU_URL, params, REQUEST_TIMEOUT_SECONDS)
        match_count, catalogues = parse_vizier_tsv(response_text)

        return {
            "vizier_match_count": match_count,
            "vizier_status": "match" if match_count > 0 else "no_match",
            "vizier_catalogues": catalogues,
            "vizier_note": f"{match_count} VizieR row-like result(s) parsed.",
        }

    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        return {
            "vizier_match_count": 0,
            "vizier_status": "service_error",
            "vizier_catalogues": [],
            "vizier_note": f"VizieR query failed: {exc}",
        }


def build_gaia_nss_query(source_id: str) -> str:
    return f"""
SELECT TOP 20
  source_id,
  nss_solution_type
FROM gaiadr3.nss_two_body_orbit
WHERE source_id = {source_id}
""".strip()


def query_gaia_nss(source: dict[str, Any]) -> dict[str, Any]:
    source_id = get_source_id(source)

    if not source_id:
        return {
            "nss_match": False,
            "nss_status": "not_checked",
            "nss_solution_type": None,
            "nss_note": "Missing SOURCE_ID.",
        }

    query = build_gaia_nss_query(source_id)

    try:
        data = tap_json_query(GAIA_TAP_URL, query, REQUEST_TIMEOUT_SECONDS)
        rows = data.get("data", [])

        if not rows:
            return {
                "nss_match": False,
                "nss_status": "no_match",
                "nss_solution_type": None,
                "nss_note": "No Gaia NSS two-body orbit match.",
            }

        first = rows[0]
        solution_type = first[1] if len(first) > 1 else None

        return {
            "nss_match": True,
            "nss_status": "match",
            "nss_solution_type": str(solution_type) if solution_type is not None else None,
            "nss_note": f"{len(rows)} Gaia NSS row(s) returned.",
        }

    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        return {
            "nss_match": False,
            "nss_status": "service_error",
            "nss_solution_type": None,
            "nss_note": f"Gaia NSS query failed: {exc}",
        }


def classify_candidate(
    candidate: dict[str, Any],
    simbad_result: dict[str, Any],
    vizier_result: dict[str, Any],
    nss_result: dict[str, Any],
) -> tuple[str, str]:
    simbad_match = bool(simbad_result.get("simbad_match"))
    vizier_count = int(vizier_result.get("vizier_match_count") or 0)
    nss_match = bool(nss_result.get("nss_match"))

    object_type = simbad_result.get("simbad_object_type")
    nss_solution_type = nss_result.get("nss_solution_type")

    if nss_match:
        return (
            "possible_binary_or_non_single_star",
            f"Gaia NSS match detected: {nss_solution_type or 'unknown NSS solution type'}.",
        )

    if simbad_match:
        return (
            "known_simbad_object",
            f"SIMBAD match detected: {object_type or 'unknown object type'}.",
        )

    if vizier_count > 0:
        return (
            "catalogued_source_requires_review",
            f"VizieR returned {vizier_count} row-like match(es).",
        )

    service_errors = [
        simbad_result.get("simbad_status") == "service_error",
        vizier_result.get("vizier_status") == "service_error",
        nss_result.get("nss_status") == "service_error",
    ]

    if any(service_errors):
        return (
            "validation_incomplete_service_error",
            "At least one external service failed. Manual validation is required.",
        )

    anomaly_score = normalize_number(candidate.get("anomaly_score"), 0.0) or 0.0
    structural = normalize_number(candidate.get("structural_importance_score"), 0.0) or 0.0
    coherence_proxy = normalize_number(candidate.get("coherence_proxy"), 0.0) or 0.0

    if anomaly_score >= 0.6 and structural >= 0.35 and coherence_proxy >= 0.3:
        return (
            "unresolved_high_priority_candidate",
            "No external match found within radius; internal anomaly indicators remain high.",
        )

    return (
        "unresolved_candidate_requires_followup",
        "No external match found within radius; further catalogue checks are required.",
    )


def determine_validation_status(classification_hint: str) -> str:
    if classification_hint in {
        "possible_binary_or_non_single_star",
        "known_simbad_object",
        "catalogued_source_requires_review",
    }:
        return "externally_contextualized"

    if classification_hint == "unresolved_high_priority_candidate":
        return "high_priority_followup"

    if classification_hint == "validation_incomplete_service_error":
        return "incomplete_external_validation"

    return "pending_followup"


def build_external_urls(source: dict[str, Any], radius_arcsec: float) -> dict[str, str]:
    source_id = get_source_id(source)
    ra = normalize_number(source.get("ra"), None)
    dec = normalize_number(source.get("dec"), None)

    gaia_archive_url = (
        "https://gea.esac.esa.int/archive/?target="
        + urlencode({"": "Gaia DR3 " + source_id})[1:]
        if source_id
        else "https://gea.esac.esa.int/archive/"
    )

    if ra is None or dec is None:
        return {
            "gaia_archive_url": gaia_archive_url,
            "esasky_url": "https://sky.esa.int/esasky/",
            "simbad_url": "https://simbad.cds.unistra.fr/simbad/",
            "vizier_url": "https://vizier.cds.unistra.fr/viz-bin/VizieR",
        }

    esasky_url = (
        "https://sky.esa.int/esasky/?target="
        + urlencode({"": f"{ra:.10f} {dec:.10f}"})[1:]
        + "&hips=Digitized%20Sky%20Survey%202%20color"
    )

    simbad_url = (
        "https://simbad.cds.unistra.fr/simbad/sim-coo?Coord="
        + urlencode({"": f"{ra:.10f} {dec:.10f}"})[1:]
        + f"&CooFrame=ICRS&CooEpoch=2000&CooEqui=2000&Radius={radius_arcsec:.3f}&Radius.unit=arcsec"
    )

    vizier_url = (
        "https://vizier.cds.unistra.fr/viz-bin/VizieR?-c="
        + urlencode({"": f"{ra:.10f} {dec:.10f}"})[1:]
        + f"&-c.rs={radius_arcsec:.3f}&-c.u=arcsec"
    )

    return {
        "gaia_archive_url": gaia_archive_url,
        "esasky_url": esasky_url,
        "simbad_url": simbad_url,
        "vizier_url": vizier_url,
    }


@dataclass
class CrossmatchRecord:
    candidate_id: str
    candidate_rank: int
    SOURCE_ID: str

    ra: float | None
    dec: float | None
    parallax: float | None
    radial_velocity: float | None

    anomaly_score: float | None
    anomaly_rank: Any
    structural_rank: Any
    structural_importance_score: float | None
    local_density_score: float | None
    mean_neighbor_distance: float | None
    dominant_anomaly_feature: Any
    dominant_feature_zscore: float | None
    coherence_proxy: float | None

    simbad_match: bool
    simbad_status: str
    simbad_main_id: str | None
    simbad_object_type: str | None
    simbad_angular_separation_arcsec: float | None
    simbad_note: str

    vizier_match_count: int
    vizier_status: str
    vizier_catalogues: list[str]
    vizier_note: str

    nss_match: bool
    nss_status: str
    nss_solution_type: str | None
    nss_note: str

    classification_hint: str
    validation_status: str
    validation_note: str

    gaia_archive_url: str
    esasky_url: str
    simbad_url: str
    vizier_url: str

    gaia_source_adql: str
    gaia_cone_search_adql: str
    gaia_nss_adql: str


def build_crossmatch_record(
    candidate: dict[str, Any],
    radius_arcsec: float,
    perform_online_queries: bool,
) -> CrossmatchRecord:
    if perform_online_queries:
        simbad_result = query_simbad(candidate, radius_arcsec)
        time.sleep(REQUEST_SLEEP_SECONDS)

        vizier_result = query_vizier(candidate, radius_arcsec)
        time.sleep(REQUEST_SLEEP_SECONDS)

        nss_result = query_gaia_nss(candidate)
        time.sleep(REQUEST_SLEEP_SECONDS)
    else:
        simbad_result = {
            "simbad_match": False,
            "simbad_status": "not_checked",
            "simbad_object_type": None,
            "simbad_main_id": None,
            "simbad_angular_separation_arcsec": None,
            "simbad_note": "Online query disabled.",
        }

        vizier_result = {
            "vizier_match_count": 0,
            "vizier_status": "not_checked",
            "vizier_catalogues": [],
            "vizier_note": "Online query disabled.",
        }

        nss_result = {
            "nss_match": False,
            "nss_status": "not_checked",
            "nss_solution_type": None,
            "nss_note": "Online query disabled.",
        }

    classification_hint, validation_note = classify_candidate(
        candidate,
        simbad_result,
        vizier_result,
        nss_result,
    )

    validation_status = determine_validation_status(classification_hint)
    urls = build_external_urls(candidate, radius_arcsec)

    return CrossmatchRecord(
        candidate_id=str(candidate.get("candidate_id")),
        candidate_rank=int(candidate.get("candidate_rank")),
        SOURCE_ID=get_source_id(candidate),

        ra=normalize_number(candidate.get("ra"), None),
        dec=normalize_number(candidate.get("dec"), None),
        parallax=normalize_number(candidate.get("parallax"), None),
        radial_velocity=normalize_number(candidate.get("radial_velocity"), None),

        anomaly_score=normalize_number(candidate.get("anomaly_score"), None),
        anomaly_rank=candidate.get("anomaly_rank"),
        structural_rank=candidate.get("structural_rank"),
        structural_importance_score=normalize_number(
            candidate.get("structural_importance_score"),
            None,
        ),
        local_density_score=normalize_number(candidate.get("local_density_score"), None),
        mean_neighbor_distance=normalize_number(candidate.get("mean_neighbor_distance"), None),
        dominant_anomaly_feature=candidate.get("dominant_anomaly_feature"),
        dominant_feature_zscore=normalize_number(
            candidate.get("dominant_feature_zscore"),
            None,
        ),
        coherence_proxy=normalize_number(candidate.get("coherence_proxy"), None),

        simbad_match=bool(simbad_result.get("simbad_match")),
        simbad_status=str(simbad_result.get("simbad_status")),
        simbad_main_id=simbad_result.get("simbad_main_id"),
        simbad_object_type=simbad_result.get("simbad_object_type"),
        simbad_angular_separation_arcsec=normalize_number(
            simbad_result.get("simbad_angular_separation_arcsec"),
            None,
        ),
        simbad_note=str(simbad_result.get("simbad_note")),

        vizier_match_count=int(vizier_result.get("vizier_match_count") or 0),
        vizier_status=str(vizier_result.get("vizier_status")),
        vizier_catalogues=list(vizier_result.get("vizier_catalogues") or []),
        vizier_note=str(vizier_result.get("vizier_note")),

        nss_match=bool(nss_result.get("nss_match")),
        nss_status=str(nss_result.get("nss_status")),
        nss_solution_type=nss_result.get("nss_solution_type"),
        nss_note=str(nss_result.get("nss_note")),

        classification_hint=classification_hint,
        validation_status=validation_status,
        validation_note=validation_note,

        gaia_archive_url=urls["gaia_archive_url"],
        esasky_url=urls["esasky_url"],
        simbad_url=urls["simbad_url"],
        vizier_url=urls["vizier_url"],

        gaia_source_adql=build_gaia_source_adql(candidate),
        gaia_cone_search_adql=build_gaia_cone_search_adql(candidate, radius_arcsec),
        gaia_nss_adql=build_gaia_nss_query(get_source_id(candidate)),
    )


def build_gaia_source_adql(source: dict[str, Any]) -> str:
    source_id = get_source_id(source)

    if not source_id:
        return ""

    return f"""SELECT *
FROM gaiadr3.gaia_source
WHERE source_id = {source_id}"""


def build_gaia_cone_search_adql(source: dict[str, Any], radius_arcsec: float) -> str:
    ra = normalize_number(source.get("ra"), None)
    dec = normalize_number(source.get("dec"), None)

    if ra is None or dec is None:
        return ""

    radius_deg = radius_arcsec / 3600.0

    return f"""SELECT TOP 100 *
FROM gaiadr3.gaia_source
WHERE 1 = CONTAINS(
  POINT('ICRS', ra, dec),
  CIRCLE('ICRS', {ra:.10f}, {dec:.10f}, {radius_deg:.10f})
)"""


def write_json(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(records, file, indent=2, ensure_ascii=False)


def write_csv(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    if not records:
        path.write_text("", encoding="utf-8")
        return

    flattened_records = []

    for record in records:
        flattened = dict(record)
        flattened["vizier_catalogues"] = json.dumps(
            flattened.get("vizier_catalogues", []),
            ensure_ascii=False,
        )
        flattened_records.append(flattened)

    df = pd.DataFrame(flattened_records)
    df.to_csv(path, index=False)


def export_candidate_crossmatch(
    max_candidates: int = DEFAULT_MAX_CANDIDATES,
    radius_arcsec: float = DEFAULT_RADIUS_ARCSEC,
    perform_online_queries: bool = True,
) -> list[dict[str, Any]]:
    anomalies = load_csv(ANOMALY_RESULTS)
    feature_contributions = load_csv(FEATURE_CONTRIBUTIONS)
    emergent_structures = load_csv(EMERGENT_STRUCTURES)
    graph_centrality = load_csv(GRAPH_CENTRALITY)

    merged_sources = merge_pipeline_context(
        anomalies=anomalies,
        feature_contributions=feature_contributions,
        emergent_structures=emergent_structures,
        graph_centrality=graph_centrality,
    )

    candidates = build_ranked_candidates(
        merged_sources=merged_sources,
        max_candidates=max_candidates,
    )

    records: list[dict[str, Any]] = []

    print("Codex Alpha automatic candidate crossmatch")
    print(f"Candidates: {len(candidates)}")
    print(f"Radius: {radius_arcsec} arcsec")
    print(f"Online queries: {perform_online_queries}")
    print()

    for index, candidate in enumerate(candidates, start=1):
        source_id = get_source_id(candidate)

        print(
            f"[{index:02d}/{len(candidates):02d}] "
            f"{candidate.get('candidate_id')} SOURCE_ID={source_id}"
        )

        record = build_crossmatch_record(
            candidate=candidate,
            radius_arcsec=radius_arcsec,
            perform_online_queries=perform_online_queries,
        )

        record_dict = asdict(record)
        records.append(record_dict)

        print(
            "  "
            f"SIMBAD={record.simbad_status} | "
            f"VizieR={record.vizier_status} | "
            f"NSS={record.nss_status} | "
            f"classification={record.classification_hint}"
        )

    write_json(CROSSMATCH_JSON_OUTPUT, records)
    write_csv(CROSSMATCH_CSV_OUTPUT, records)

    print()
    print("Crossmatch export completed.")
    print(f"JSON: {CROSSMATCH_JSON_OUTPUT}")
    print(f"CSV:  {CROSSMATCH_CSV_OUTPUT}")

    return records


def parse_cli_args() -> tuple[int, float, bool]:
    import argparse

    parser = argparse.ArgumentParser(
        description="Run Codex Alpha Gaia candidate crossmatch backend."
    )

    parser.add_argument(
        "--max-candidates",
        type=int,
        default=DEFAULT_MAX_CANDIDATES,
        help="Maximum number of ranked candidates to crossmatch.",
    )

    parser.add_argument(
        "--radius-arcsec",
        type=float,
        default=DEFAULT_RADIUS_ARCSEC,
        help="Cone-search radius in arcseconds.",
    )

    parser.add_argument(
        "--offline",
        action="store_true",
        help="Disable online external catalogue queries and only generate prepared validation records.",
    )

    args = parser.parse_args()

    return args.max_candidates, args.radius_arcsec, not args.offline


if __name__ == "__main__":
    max_candidates_arg, radius_arcsec_arg, online_arg = parse_cli_args()

    export_candidate_crossmatch(
        max_candidates=max_candidates_arg,
        radius_arcsec=radius_arcsec_arg,
        perform_online_queries=online_arg,
    )