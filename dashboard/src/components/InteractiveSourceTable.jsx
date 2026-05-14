import React, { useMemo, useState } from "react";

function getSourceId(source) {
  return String(source?.SOURCE_ID ?? source?.source_id ?? source?.id ?? "");
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function formatValue(value, digits = 6) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  const number = Number(value);

  if (!Number.isNaN(number)) {
    return number.toFixed(digits);
  }

  return String(value);
}

function formatInteger(value) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  const number = Number(value);

  if (!Number.isNaN(number)) {
    return String(Math.trunc(number));
  }

  return String(value);
}

function formatTableCell(value, column) {
  if (column.type === "id") {
    return String(value ?? "");
  }

  if (column.type === "integer") {
    return formatInteger(value);
  }

  if (column.type === "gaia") {
    return formatValue(value, 10);
  }

  if (column.type === "score") {
    return formatValue(value, 6);
  }

  return formatValue(value, column.digits ?? 6);
}

function compareValues(a, b, column, direction) {
  const aValue = a[column];
  const bValue = b[column];

  const aNumber = normalizeNumber(aValue);
  const bNumber = normalizeNumber(bValue);

  let result = 0;

  if (aNumber !== null && bNumber !== null) {
    result = aNumber - bNumber;
  } else {
    result = String(aValue ?? "").localeCompare(String(bValue ?? ""));
  }

  return direction === "asc" ? result : -result;
}

function InteractiveSourceTable({
  sources = [],
  selectedNode = null,
  onSourceSelect,
}) {
  const [search, setSearch] = useState("");
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [sortColumn, setSortColumn] = useState("anomaly_score");
  const [sortDirection, setSortDirection] = useState("desc");

  const selectedSourceId = selectedNode ? getSourceId(selectedNode) : null;

  const columns = [
    {
      key: "SOURCE_ID",
      label: "SOURCE_ID",
      type: "id",
    },
    {
      key: "anomaly_rank",
      label: "Rank",
      type: "integer",
    },
    {
      key: "anomaly_score",
      label: "Anomaly score",
      type: "score",
    },
    {
      key: "anomaly_label",
      label: "Label",
      type: "integer",
    },
    {
      key: "ra",
      label: "RA (deg)",
      type: "gaia",
    },
    {
      key: "dec",
      label: "DEC (deg)",
      type: "gaia",
    },
    {
      key: "parallax",
      label: "Parallax (mas)",
      type: "gaia",
    },
    {
      key: "pmra",
      label: "PMRA (mas/yr)",
      type: "gaia",
    },
    {
      key: "pmdec",
      label: "PMDEC (mas/yr)",
      type: "gaia",
    },
    {
      key: "radial_velocity",
      label: "Radial velocity (km/s)",
      type: "gaia",
    },
  ];

  const tableRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return sources
      .filter((source) => {
        if (anomaliesOnly && Number(source.anomaly_label) !== -1) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return getSourceId(source).toLowerCase().includes(normalizedSearch);
      })
      .slice()
      .sort((a, b) => compareValues(a, b, sortColumn, sortDirection));
  }, [sources, search, anomaliesOnly, sortColumn, sortDirection]);

  function handleSort(column) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  }

  function handleSelectSource(source) {
    if (onSourceSelect) {
      onSourceSelect(source);
    }
  }

  return (
    <section className="panel interactive-source-panel">
      <div className="panel-header">
        <div>
          <h2>Interactive Source Table</h2>
          <span>
            Click a source to highlight it in the 3D graph. Click a column to
            sort.
          </span>
        </div>

        <div className="source-table-count">
          {tableRows.length} / {sources.length} sources
        </div>
      </div>

      <div className="source-table-toolbar">
        <input
          type="search"
          value={search}
          placeholder="Search SOURCE_ID..."
          onChange={(event) => setSearch(event.target.value)}
        />

        <label>
          <input
            type="checkbox"
            checked={anomaliesOnly}
            onChange={(event) => setAnomaliesOnly(event.target.checked)}
          />
          Anomalies only
        </label>

        <button
          type="button"
          onClick={() => {
            setSearch("");
            setAnomaliesOnly(false);
            setSortColumn("anomaly_score");
            setSortDirection("desc");
          }}
        >
          Reset table
        </button>
      </div>

      <div className="interactive-source-table-wrapper">
        <table className="interactive-source-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>
                  <button
                    type="button"
                    onClick={() => handleSort(column.key)}
                    className={sortColumn === column.key ? "active-sort" : ""}
                  >
                    {column.label}
                    {sortColumn === column.key && (
                      <span>{sortDirection === "asc" ? " ↑" : " ↓"}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {tableRows.map((source) => {
              const sourceId = getSourceId(source);
              const isSelected = selectedSourceId === sourceId;

              return (
                <tr
                  key={sourceId}
                  className={isSelected ? "selected-source-row" : ""}
                  onClick={() => handleSelectSource(source)}
                >
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.key === "SOURCE_ID"
                        ? sourceId
                        : formatTableCell(source[column.key], column)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default InteractiveSourceTable;