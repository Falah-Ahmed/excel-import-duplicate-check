import { NextRequest, NextResponse } from "next/server";
import { compareRows } from "@/lib/compare";
import {
  NAME_AR_FIELD,
  NAME_FIELD,
  PASSPORT_FIELD,
  PHONE_FIELD,
  ID_FIELD,
  fetchAllSystemRecords,
  frappeConfigured,
  insertRecord,
} from "@/lib/frappe";
import type { ExcelRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!frappeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Frappe is not configured — cannot import" },
      { status: 400 }
    );
  }

  let body: { rows?: ExcelRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "No rows to import" }, { status: 400 });
  }

  try {
    const { records } = await fetchAllSystemRecords();
    const { results } = compareRows(rows, records);
    const toImport = results.filter((r) => r.status === "new");
    const rowByNumber = new Map(rows.map((r) => [r.row, r]));

    let imported = 0;
    let failed = 0;
    const errors: { row: number; message: string }[] = [];

    for (const result of toImport) {
      const source = rowByNumber.get(result.row);
      if (!source) continue;

      const payload: Record<string, string> = {};
      if (source.name) payload[NAME_FIELD] = source.name;
      if (source.name_ar) payload[NAME_AR_FIELD] = source.name_ar;
      if (source.passport) payload[PASSPORT_FIELD] = source.passport;
      if (source.phone) payload[PHONE_FIELD] = source.phone;
      if (source.id_number) payload[ID_FIELD] = source.id_number;

      try {
        await insertRecord(payload);
        imported += 1;
      } catch (err) {
        failed += 1;
        errors.push({
          row: result.row,
          message: err instanceof Error ? err.message : "Import failed",
        });
      }
    }

    return NextResponse.json({ ok: true, imported, failed, errors });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        imported: 0,
        failed: 0,
        errors: [{ row: 0, message: err instanceof Error ? err.message : "Import failed" }],
      },
      { status: 500 }
    );
  }
}
