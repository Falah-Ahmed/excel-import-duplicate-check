import type { ExcelRow } from "./types";

type ColumnMap = {
  name?: string;
  name_ar?: string;
  passport?: string;
  phone?: string;
  id_number?: string;
};

const RULES: { key: keyof ColumnMap; patterns: RegExp[] }[] = [
  { key: "passport", patterns: [/passport/i, /جواز/i, /pass/i] },
  { key: "phone", patterns: [/phone/i, /mobile/i, /tel/i, /whatsapp/i, /جوال/i, /هاتف/i] },
  { key: "id_number", patterns: [/id/i, /national/i, /iqama/i, /civil/i, /هوية/i, /رقم.?الهوية/i] },
  { key: "name_ar", patterns: [/arabic/i, /name.?ar/i, /الاسم/i, /اسم.?عرب/i] },
  { key: "name", patterns: [/full.?name/i, /^name$/i, /english/i, /^full name$/i, /اسم.?ان/i] },
];

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  for (const header of headers) {
    const h = header.trim();
    if (!h) continue;
    for (const rule of RULES) {
      if (map[rule.key]) continue;
      if (rule.patterns.some((p) => p.test(h))) {
        map[rule.key] = h;
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
