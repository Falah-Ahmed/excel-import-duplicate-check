const base = () => (process.env.FRAPPE_BASE_URL || "").replace(/\/$/, "").trim();
const key = () => (process.env.FRAPPE_API_KEY || "").trim();
const secret = () => (process.env.FRAPPE_API_SECRET || "").trim();

export type CheckinRow = {
  employee: string;
  employee_name: string;
  log_type: string;
  time: string;
  shift_start: string;
};

export type LateAlert = {
  employee: string;
  employee_name: string;
  department: string;
  time: string;
  minutes: number;
};

const PAGE = 200;
const MAX_ROWS = 5000;

function authHeaders() {
  return {
    Authorization: `token ${key()}:${secret()}`,
    Accept: "application/json",
  };
}

export function frappeConfigured() {
  return Boolean(base() && key() && secret());
}

export function todayISO() {
  const tz = (process.env.FRAPPE_TZ || "Africa/Cairo").trim();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function assertDate(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return todayISO();
}

function graceMinutes() {
  const n = Number(process.env.LATE_GRACE_MINUTES || "0");
  if (!Number.isFinite(n) || n < 0 || n > 180) return 0;
  return Math.floor(n);
}

function parseStamp(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value || "");
  if (!m) return null;
  return Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] || 0)
  );
}

async function frappeGet(path: string, params: Record<string, string>) {
  const url = new URL(base() + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: authHeaders(),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Frappe ${res.status}`);
  }
  return JSON.parse(text) as { data?: unknown; message?: unknown };
}

async function listResource(doctype: string, fields: string[], filters: unknown[], orderBy?: string) {
  const rows: Record<string, unknown>[] = [];
  for (let start = 0; start < MAX_ROWS; start += PAGE) {
    const params: Record<string, string> = {
      fields: JSON.stringify(fields),
      filters: JSON.stringify(filters),
      limit_start: String(start),
      limit_page_length: String(PAGE),
    };
    if (orderBy) params.order_by = orderBy;
    const json = await frappeGet(`/api/resource/${encodeURIComponent(doctype)}`, params);
    const batch = Array.isArray(json.data) ? (json.data as Record<string, unknown>[]) : [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

async function countDoctype(doctype: string, filters: unknown[]) {
  const json = await frappeGet("/api/method/frappe.client.get_count", {
    doctype,
    filters: JSON.stringify(filters),
  });
  const message = json.message;
  return typeof message === "number" ? message : Number(message || 0) || 0;
}

function asText(value: unknown) {
  return value == null ? "" : String(value);
}

async function loadCheckins(date: string): Promise<CheckinRow[]> {
  const filters = [
    ["time", ">=", `${date} 00:00:00`],
    ["time", "<=", `${date} 23:59:59`],
  ];
  const full = ["employee", "employee_name", "log_type", "time", "shift_start"];
  let rows: Record<string, unknown>[];
  try {
    rows = await listResource("Employee Checkin", full, filters, "time asc");
  } catch {
    rows = await listResource(
      "Employee Checkin",
      ["employee", "employee_name", "log_type", "time"],
      filters,
      "time asc"
    );
  }
  return rows.map((row) => ({
    employee: asText(row.employee),
    employee_name: asText(row.employee_name),
    log_type: asText(row.log_type).toUpperCase(),
    time: asText(row.time),
    shift_start: asText(row.shift_start),
  }));
}

async function departmentsFor(ids: string[]) {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const rows = await listResource(
      "Employee",
      ["name", "department"],
      [["name", "in", chunk]],
    );
    for (const row of rows) {
      map.set(asText(row.name), asText(row.department));
    }
  }
  return map;
}

function firstInByEmployee(rows: CheckinRow[]) {
  const map = new Map<string, CheckinRow>();
  for (const row of rows) {
    if (row.log_type !== "IN" || !row.employee || map.has(row.employee)) continue;
    map.set(row.employee, row);
  }
  return map;
}

export async function attendanceSummary(date: string) {
  const [active, rows] = await Promise.all([
    countDoctype("Employee", [["status", "=", "Active"]]),
    loadCheckins(date),
  ]);

  const firstIn = firstInByEmployee(rows);
  const checkedOut = new Set(rows.filter((row) => row.log_type === "OUT" && row.employee).map((row) => row.employee));
  const grace = graceMinutes();
  const lateRows: { row: CheckinRow; minutes: number }[] = [];

  for (const row of firstIn.values()) {
    const start = parseStamp(row.shift_start);
    const punched = parseStamp(row.time);
    if (start == null || punched == null) continue;
    const minutes = Math.round((punched - start) / 60000) - grace;
    if (minutes > 0) lateRows.push({ row, minutes });
  }

  lateRows.sort((a, b) => b.minutes - a.minutes);
  const shown = lateRows.slice(0, 30);
  const departments = await departmentsFor(shown.map((item) => item.row.employee));

  const lateAlerts: LateAlert[] = shown.map((item) => ({
    employee: item.row.employee,
    employee_name: item.row.employee_name || item.row.employee,
    department: departments.get(item.row.employee) || "",
    time: item.row.time,
    minutes: item.minutes,
  }));

  const checkedIn = firstIn.size;
  return {
    date,
    active_employees: active,
    checked_in: checkedIn,
    checked_out: checkedOut.size,
    late: lateRows.length,
    on_time: Math.max(checkedIn - lateRows.length, 0),
    no_checkin: Math.max(active - checkedIn, 0),
    late_alerts: lateAlerts,
  };
}

export async function checkinsForExport(date: string) {
  const rows = await loadCheckins(date);
  const departments = await departmentsFor(rows.map((row) => row.employee));
  return rows
    .filter((row) => row.log_type === "IN" || row.log_type === "OUT")
    .map((row) => ({
      employee: row.employee,
      employee_name: row.employee_name,
      department: departments.get(row.employee) || "",
      log_type: row.log_type,
      time: row.time,
    }));
}

function csvCell(value: string) {
  let text = value.replace(/\r|\n/g, " ").trim();
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: { employee: string; employee_name: string; department: string; log_type: string; time: string }[]) {
  const header = ["Employee", "Name", "Department", "Type", "Time"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [row.employee, row.employee_name, row.department, row.log_type, row.time].map(csvCell).join(",")
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
