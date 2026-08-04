import { NextRequest, NextResponse } from "next/server";
import { compareRows, demoCompare } from "@/lib/compare";
import { fetchAllSystemRecords, frappeConfigured, getFrappeConfig } from "@/lib/frappe";
import type { ExcelRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  if (!frappeConfigured()) {
    const { results, summary } = demoCompare(rows);
    return NextResponse.json({
      ok: true,
      demo: true,
      error: "Missing FRAPPE_BASE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET",
      summary,
      results,
      system_records_loaded: 3,
      config: getFrappeConfig(),
    });
  }

  try {
    const systemRecords = await fetchAllSystemRecords();
    const { results, summary } = compareRows(rows, systemRecords);
    return NextResponse.json({
      ok: true,
      demo: false,
      summary,
      results,
      system_records_loaded: systemRecords.length,
      config: getFrappeConfig(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Compare failed";
    const { results, summary } = demoCompare(rows);
    return NextResponse.json({
      ok: false,
      demo: true,
      error: message,
      summary,
      results,
      system_records_loaded: 0,
      config: getFrappeConfig(),
    });
  }
}
