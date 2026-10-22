import { NextRequest, NextResponse } from "next/server";
import { assertDate, checkinsForExport, frappeConfigured, toCsv } from "@/lib/attendance";
import { previewMode } from "@/lib/preview";
import { sessionFromRequest } from "@/lib/request-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await sessionFromRequest(req);
  if (!session && previewMode()) {
    const date = assertDate(req.nextUrl.searchParams.get("date"));
    const csv = toCsv([]);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="employee-checkins-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (!session) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }
  if (!frappeConfigured()) {
    return NextResponse.json({ ok: false, error: "Attendance source is not configured" }, { status: 503 });
  }

  const date = assertDate(req.nextUrl.searchParams.get("date"));
  try {
    const rows = await checkinsForExport(date);
    const csv = toCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="employee-checkins-${date}.csv"`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not export logs" }, { status: 502 });
  }
}
