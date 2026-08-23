import { NextRequest, NextResponse } from "next/server";
import { compareRows, demoCompare } from "@/lib/compare";
import { describeColumnMapping } from "@/lib/excel-map";
import {
  fetchAllSystemRecords,
  frappeConfigured,
  getFrappeConfig,
} from "@/lib/frappe";
import type { ExcelRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function mappingFromRows(rows: ExcelRow[]) {
  const sample = rows[0]?.raw || {};
  const headers = Object.keys(sample);
  const columns = {
    name: headers.find((h) => /^name$/i.test(h) || /full.?name|family.?name/i.test(h)),
    passport: headers.find((h) => /passport/i.test(h)),
    phone: headers.find((h) => /phone|mobile/i.test(h)),
    id_number: headers.find((h) => /\bid\b/i.test(h) || /iqama|national/i.test(h)),
    name_ar: headers.find((h) => /arabic|الاسم/i.test(h)),
  };
  const cfg = getFrappeConfig();
  return describeColumnMapping(columns, {
    name_field: cfg.name_field,
    name_ar_field: cfg.name_ar_field,
    passport_field: cfg.passport_field,
    phone_field: cfg.phone_field,
    id_field: cfg.id_field,
  });
}

export async function POST(req: NextRequest) {
  let body: { rows?: ExcelRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "No rows to compare" }, { status: 400 });
  }

  const mapping = mappingFromRows(rows);
  const config = getFrappeConfig();

  if (!frappeConfigured()) {
    const { results, summary } = demoCompare(rows);
    return NextResponse.json({
      ok: true,
      demo: true,
      error: "Missing FRAPPE_BASE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET",
      summary,
      results,
      system_records_loaded: 3,
      mapping,
      config,
    });
  }

  try {
    const { records, warning } = await fetchAllSystemRecords();
    const { results, summary } = compareRows(rows, records);
    return NextResponse.json({
      ok: true,
      demo: false,
      warning,
      error: !records.length
        ? warning || "No system records loaded — duplicate check cannot match anything"
        : undefined,
      summary,
      results,
      system_records_loaded: records.length,
      mapping,
      config,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Compare failed";
    // Do NOT use demo data — that hides the real failure (Matched By / Source empty)
    const { results, summary } = compareRows(rows, []);
    return NextResponse.json({
      ok: false,
      demo: false,
      error: message,
      warning: message,
      summary,
      results,
      system_records_loaded: 0,
      mapping,
      config,
    });
  }
}
