"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { formatBytes, sheetToRows } from "@/lib/excel-map";
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
  const [columns, setColumns] = useState<string[]>([]);
  const [compare, setCompare] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const pageSize = 10;

  const runCompare = useCallback(async (parsedRows: ExcelRow[]) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const json: CompareResponse = await res.json();
      setCompare(json);
      if (json.error) {
        setMessage(json.demo ? `Demo mode — full error:\n\n${json.error}` : json.error);
      }
    } catch {
      setMessage("Compare request failed");
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
      setColumns(Object.values(parsed.columns).filter(Boolean) as string[]);
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
        setMessage("Please upload XLSX, XLS, or CSV");
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
    setMessage(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!json.ok) {
        const detail =
          Array.isArray(json.errors) && json.errors.length
            ? json.errors.map((e: { row: number; message: string }) => `Row ${e.row}: ${e.message}`).join("\n")
            : json.error || "Import failed";
        setMessage(detail);
        return;
      }
      const failDetail =
        Array.isArray(json.errors) && json.errors.length
          ? `\n${json.errors.map((e: { row: number; message: string }) => `Row ${e.row}: ${e.message}`).join("\n")}`
          : "";
      setMessage(`Imported ${json.imported} new record(s). Failed: ${json.failed}.${failDetail}`);
      await runCompare(rows);
    } catch {
      setMessage("Import request failed");
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
    ];
    const lines = compare.results.map((r) =>
      [
        r.row,
        r.name,
        r.passport,
        r.phone,
        r.id_number,
        STATUS_LABEL[r.status],
        r.matched_by,
        r.existing_record,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "duplicate-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setFileName("");
    setFileSize(0);
    setRows([]);
    setColumns([]);
    setCompare(null);
    setTab("all");
    setSearch("");
    setPage(1);
    setMessage(null);
    if (inputRef.current) inputRef.current.value = "";
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
                {columns.length ? ` · columns: ${columns.join(", ")}` : ""}
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
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className={styles.empty}>
                      Comparing with system database…
                    </td>
                  </tr>
                )}
                {!loading && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className={styles.empty}>
                      No records in this tab
                    </td>
                  </tr>
                )}
                {!loading &&
                  pageRows.map((row) => (
                    <ResultRow key={row.row} row={row} />
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

      {message && (
        <div className={styles.hint}>
          <div className={styles.hintTitle}>Error details</div>
          <pre className={styles.hintBody}>{message}</pre>
        </div>
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

function ResultRow({ row }: { row: CompareResult }) {
  return (
    <tr>
      <td>{row.row}</td>
      <td>{row.name}</td>
      <td>{row.passport}</td>
      <td>{row.phone}</td>
      <td>{row.id_number}</td>
      <td>{row.matched_by}</td>
      <td>{row.existing_record}</td>
      <td>
        <span className={`${styles.badge} ${styles[row.status]}`}>{STATUS_LABEL[row.status]}</span>
      </td>
      <td>
        {row.existing_url && row.existing_url !== "#" ? (
          <a href={row.existing_url} target="_blank" rel="noopener noreferrer" title="View record">
            👁
          </a>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}
