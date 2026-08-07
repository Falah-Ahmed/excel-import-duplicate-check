import type { ExcelRow } from "./types";

export type ColumnMap = {
  name?: string;
  name_ar?: string;
  passport?: string;
  phone?: string;
  id_number?: string;
};

/** Preferred Excel headers for your sheet (exact match first) */
const PREFERRED: Record<keyof ColumnMap, string[]> = {
  name: ["Name", "Full Name", "English Name", "Family Name"],
  name_ar: ["Arabic Name", "Name AR", "الاسم", "اسم عربي"],
  passport: ["Passport No.", "Passport No", "Passport Number", "Passport", "جواز"],
  phone: ["Phone Number", "Phone", "Mobile", "Mobile Number", "جوال", "هاتف"],
  id_number: ["ID Number", "ID No.", "ID No", "National ID", "Iqama", "ID", "هوية"],
};

const RULES: { key: keyof ColumnMap; patterns: RegExp[] }[] = [
  { key: "passport", patterns: [/passport/i, /جواز/i] },
  { key: "phone", patterns: [/phone/i, /mobile/i, /tel/i, /whatsapp/i, /جوال/i, /هاتف/i] },
  {
    key: "id_number",
    patterns: [/\bid\b/i, /national/i, /iqama/i, /civil/i, /هوية/i, /رقم.?الهوية/i],
  },
  { key: "name_ar", patterns: [/arabic/i, /name.?ar/i, /الاسم/i, /اسم.?عرب/i] },
  {
    key: "name",
    patterns: [/^name$/i, /full.?name/i, /family.?name/i, /english/i, /اسم/i],
  },
];

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function findHeader(headers: string[], candidates: string[]): string | undefined {
  const lower = headers.map((h) => h.toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate.toLowerCase());
    if (idx >= 0) return headers[idx];
  }
  return undefined;
}

export function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const clean = headers.map((h) => h.trim()).filter(Boolean);

  for (const key of Object.keys(PREFERRED) as (keyof ColumnMap)[]) {
    const hit = findHeader(clean, PREFERRED[key]);
    if (hit) map[key] = hit;
  }

  for (const header of clean) {
    for (const rule of RULES) {
      if (map[rule.key]) continue;
      if (rule.patterns.some((p) => p.test(header))) {
        map[rule.key] = header;
      }
    }
  }

  return map;
}

export function sheetToRows(
  matrix: unknown[][],
  columnMap?: Partial<ColumnMap>
): { rows: ExcelRow[]; columns: ColumnMap; headers: string[] } {
  if (!matrix.length) {
    return { rows: [], columns: {}, headers: [] };
  }

  const headerRow = matrix[0].map((h) => cellText(h));
  const auto = detectColumns(headerRow);
  const columns: ColumnMap = { ...auto, ...columnMap };

  const pick = (row: unknown[], header?: string) => {
    if (!header) return "";
    const idx = headerRow.findIndex((h) => h === header);
    if (idx < 0) return "";
    return cellText(row[idx]);
  };

  const rows: ExcelRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.every((c) => !cellText(c))) continue;

    const raw: Record<string, string> = {};
    headerRow.forEach((h, idx) => {
      if (h) raw[h] = cellText(row[idx]);
    });

    rows.push({
      row: i + 1,
      name: pick(row, columns.name),
      name_ar: pick(row, columns.name_ar),
      passport: pick(row, columns.passport),
      phone: pick(row, columns.phone),
      id_number: pick(row, columns.id_number),
      raw,
    });
  }

  return { rows, columns, headers: headerRow.filter(Boolean) };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human-readable Excel → Frappe field mapping */
export function describeColumnMapping(
  columns: ColumnMap,
  frappeFields: {
    name_field: string;
    name_ar_field: string;
    passport_field: string;
    phone_field: string;
    id_field: string;
  }
) {
  return [
    {
      excel: columns.name || "(not found)",
      key: "name",
      frappe: frappeFields.name_field,
    },
    {
      excel: columns.name_ar || "(optional)",
      key: "name_ar",
      frappe: frappeFields.name_ar_field,
    },
    {
      excel: columns.passport || "(not found)",
      key: "passport",
      frappe: frappeFields.passport_field,
    },
    {
      excel: columns.phone || "(not found)",
      key: "phone",
      frappe: frappeFields.phone_field,
    },
    {
      excel: columns.id_number || "(not found)",
      key: "id_number",
      frappe: frappeFields.id_field,
    },
  ];
}
