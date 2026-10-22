import { NextRequest, NextResponse } from "next/server";
import { assertDate, attendanceSummary, frappeConfigured, todayISO } from "@/lib/attendance";
import { previewMode } from "@/lib/preview";
import { sessionFromRequest } from "@/lib/request-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await sessionFromRequest(req);
  if (!session && previewMode()) {
    return NextResponse.json({
      ok: true,
      preview: true,
      user: "Preview",
      date: assertDate(req.nextUrl.searchParams.get("date") || todayISO()),
      active_employees: 0,
      checked_in: 0,
      checked_out: 0,
      late: 0,
      on_time: 0,
      no_checkin: 0,
      late_alerts: [],
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
    const summary = await attendanceSummary(date);
    return NextResponse.json({
      ok: true,
      user: session.full_name || session.user,
      ...summary,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not load attendance" }, { status: 502 });
  }
}
