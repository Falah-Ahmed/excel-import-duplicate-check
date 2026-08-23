"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { authFetch, bootSessionFromUrl, clearClientSessionToken } from "@/lib/client-session";
import { formatBytes, sheetToRows, type ColumnMap } from "@/lib/excel-map";
import type { CompareResponse, CompareResult, ExcelRow, RecordStatus } from "@/lib/types";
import styles from "./import-check.module.css";

type Tab = "all" | "exact_duplicate" | "possible_duplicate" | "new" | "invalid";

const TAB_LABELS: Record<Tab, string> = {
  all: "All Records",
  exact_duplicate: "Duplicates",
  possible_duplicate: "Possible Duplicates",
  new: "New Records",
  invalid: "Invalid Records",
};

const STATUS_LABEL: Record<RecordStatus, string> = {
  exact_duplicate: "Exact Duplicate",
  possible_duplicate: "Possible Duplicate",
  new: "New Record",
  invalid: "Invalid Data",
};

export default function ImportCheck() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [compare, setCompare] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [denied, setDenied] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    bootSessionFromUrl();
    authFetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: [] }),
    }).then((res) => {
      if (res.status === 403) setDenied(true);
    });
  }, []);

  const runCompare = useCallback(async (parsedRows: ExcelRow[]) => {
    setLoading(true);
    try {
      const res = await authFetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows }),
      });
      if (res.status === 403) {
        setDenied(true);
        return;
      }
      const json: CompareResponse = await res.json();
      setCompare(json);
    } catch {
      setCompare(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const parseFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setFileSize(file.size);
      setTab("all");
      setSearch("");
      setPage(1);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
      }) as unknown[][];

      const parsed = sheetToRows(matrix);
      setRows(parsed.rows);
      setColumnMap(parsed.columns);
      setHeaders(parsed.headers);
      await runCompare(parsed.rows);
    },
    [runCompare]
  );

  const onFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
        return;
      }
      void parseFile(file);
    },
    [parseFile]
  );

  const filtered = useMemo(() => {
    const list = compare?.results || [];
    const byTab = tab === "all" ? list : list.filter((r) => r.status === tab);
    const q = search.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.passport.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.id_number.toLowerCase().includes(q) ||
        r.existing_record.toLowerCase().includes(q)
    );
  }, [compare, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function importNewOnly() {
    if (!rows.length || !compare) return;
    setImporting(true);
    try {
      const res = await authFetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (res.status === 403) {
        setDenied(true);
        return;
      }
      const json = await res.json();
      if (json.ok) {
        await runCompare(rows);
      }
    } catch {
      // ignore — error details UI removed
    } finally {
      setImporting(false);
    }
  }

  function downloadReport() {
    if (!compare?.results.length) return;

    const header = [
      "Excel Row",
      "Name",
      "Passport",
      "Phone",
      "ID Number",
      "Status",
      "Matched By",
      "Existing Record",
      "Source",
    ];

    const escapeXml = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const rowsXml = compare.results
      .map((r) => {
        const isDup =
          r.status === "exact_duplicate" || r.status === "possible_duplicate";
        const style = isDup ? ' ss:StyleID="Yellow"' : "";
        const cells = [
          r.row,
          r.name,
          r.passport,
          r.phone,
          r.id_number,
          STATUS_LABEL[r.status],
          r.matched_by,
          r.existing_record,
          r.existing_source || "",
        ]
          .map((v) => `<Cell><Data ss:Type="String">${escapeXml(v)}</Data></Cell>`)
          .join("");
        return `<Row${style}>${cells}</Row>`;
      })
      .join("");

    const headerXml = header
      .map((h) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
      .join("");

    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/></Style>
  <Style ss:ID="Yellow"><Interior ss:Color="#FFFF66" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="Duplicate Report">
  <Table>
   <Row ss:StyleID="Header">${headerXml}</Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "duplicate-report.xls";
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setFileName("");
    setFileSize(0);
    setRows([]);
    setColumnMap({});
    setHeaders([]);
    setCompare(null);
    setTab("all");
    setSearch("");
    setPage(1);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (denied) {
    return (
      <div className={styles.denied}>
        <h1>403</h1>
        <p>Access Denied</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Excel Import &amp; Duplicate Check</h1>
          <p>Import an Excel file and compare its records with the existing system database.</p>
        </div>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => inputRef.current?.click()}
        >
          Import Excel File
        </button>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={async () => {
            clearClientSessionToken();
            await authFetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
        >
          Logout
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </header>

      <section className={styles.card}>
        <h2>1. Upload Excel File</h2>
        <div
          className={`${styles.dropzone} ${dragOver ? styles.dropActive : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <div className={styles.cloud}>☁</div>
          <div className={styles.dropTitle}>Drag and drop your file here or click to browse</div>
          <div className={styles.dropSub}>Supported formats: XLSX, XLS, CSV</div>
        </div>

        {fileName && (
          <div className={styles.fileBar}>
            <div>
              <strong>{fileName}</strong>
              <div className={styles.fileMeta}>
                {formatBytes(fileSize)} · {rows.length.toLocaleString()} rows
                {headers.length ? ` · headers: ${headers.join(", ")}` : ""}
              </div>
            </div>
            <div className={styles.fileActions}>
              <button type="button" onClick={() => inputRef.current?.click()}>
                Replace File
              </button>
              <button type="button" className={styles.dangerText} onClick={reset}>
                Remove
              </button>
            </div>
          </div>
        )}
      </section>

      {compare && (
        <section className={styles.card}>
          <div className={styles.resultsHead}>
            <h2>2. Duplicate Check Results</h2>
            <div className={styles.summary}>
              <span className={styles.pillRed}>{compare.summary.exact_duplicates} duplicates</span>
              <span className={styles.pillOrange}>
                {compare.summary.possible_duplicates} possible
              </span>
              <span className={styles.pillGreen}>{compare.summary.new_records} new</span>
              <span className={styles.pillGray}>{compare.summary.invalid_records} invalid</span>
              <span className={styles.muted}>
                {compare.system_records_loaded.toLocaleString()} system records loaded
              </span>
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.tabs}>
              {(Object.keys(TAB_LABELS) as Tab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={tab === key ? styles.tabActive : ""}
                  onClick={() => {
                    setTab(key);
                    setPage(1);
                  }}
                >
                  {TAB_LABELS[key]}
                </button>
              ))}
            </div>
            <div className={styles.toolbarRight}>
              <span className={styles.muted}>
                Showing {(filtered.length ? (page - 1) * pageSize + 1 : 0).toLocaleString()} to{" "}
                {Math.min(page * pageSize, filtered.length).toLocaleString()} of{" "}
                {filtered.length.toLocaleString()} records
              </span>
              <input
                className={styles.search}
                placeholder="Search in results…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Excel Row</th>
                  <th>Name</th>
                  <th>Passport No.</th>
                  <th>Phone Number</th>
                  <th>ID Number</th>
                  <th>Matched By</th>
                  <th>Existing System Record</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className={styles.empty}>
                      Comparing with system database…
                    </td>
                  </tr>
                )}
                {!loading && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className={styles.empty}>
                      No records in this tab
                    </td>
                  </tr>
                )}
                {!loading &&
                  pageRows.map((row) => (
                    <ResultRow
                      key={row.row}
                      row={row}
                      registerDoctype={compare.config?.register_doctype || "Registered People"}
                      baseUrl={compare.config?.base_url}
                    />
                  ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

      {compare && (
        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.btnSuccess}
            disabled={importing || compare.summary.new_records === 0 || compare.demo}
            onClick={() => void importNewOnly()}
          >
            {importing ? "Importing…" : "Import New Records Only"}
          </button>
          <button type="button" className={styles.btnGhost} onClick={downloadReport}>
            Download Duplicate Report
          </button>
          <button type="button" className={styles.btnCancel} onClick={reset}>
            Cancel Import
          </button>
        </footer>
      )}
    </div>
  );
}

function openExistingRecord(
  row: CompareResult,
  registerDoctype: string,
  baseUrl?: string
) {
  // Family Member → open parent Registered People form
  const formName = row.existing_parent || row.existing_id;
  if (!formName) return;

  try {
    // @ts-expect-error parent Desk
    if (window.parent?.frappe?.set_route) {
      // @ts-expect-error parent Desk
      window.parent.frappe.set_route("Form", registerDoctype, formName);
      return;
    }
  } catch {
    // cross-origin fallback below
  }

  const slug = registerDoctype.toLowerCase().replace(/\s+/g, "-");
  const url =
    row.existing_url && row.existing_url !== "#"
      ? row.existing_url
      : `${(baseUrl || "").replace(/\/$/, "")}/app/${slug}/${encodeURIComponent(formName)}`;
  if (url && url !== "#") window.open(url, "_blank", "noopener,noreferrer");
}

function ResultRow({
  row,
  registerDoctype,
  baseUrl,
}: {
  row: CompareResult;
  registerDoctype: string;
  baseUrl?: string;
}) {
  const canOpen = Boolean(row.existing_parent || row.existing_id);

  return (
    <tr>
      <td>{row.row}</td>
      <td>{row.name}</td>
      <td>{row.passport}</td>
      <td>{row.phone}</td>
      <td>{row.id_number}</td>
      <td>{row.matched_by}</td>
      <td>{row.existing_record}</td>
      <td>{row.existing_source || "—"}</td>
      <td>
        <span className={`${styles.badge} ${styles[row.status]}`}>{STATUS_LABEL[row.status]}</span>
      </td>
      <td>
        {canOpen ? (
          <button
            type="button"
            className={styles.iconBtn}
            title={
              row.existing_parent
                ? "Open family parent record"
                : "Open existing record"
            }
            onClick={() => openExistingRecord(row, registerDoctype, baseUrl)}
          >
            👁
          </button>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}
