import { NextRequest, NextResponse } from "next/server";
import { frappeConfigured } from "@/lib/frappe";
import { getRegisteredRecord, recordConfig } from "@/lib/record";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("name") || req.nextUrl.searchParams.get("id") || "").trim();
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing record name. Use /pdf?name=RECORD-ID" },
      { status: 400 }
    );
  }

  if (!frappeConfigured()) {
    return NextResponse.json({
      ok: false,
      demo: true,
      error: "Missing FRAPPE_BASE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET",
      config: recordConfig(),
    });
  }

  try {
    const record = await getRegisteredRecord(id);
    return NextResponse.json({ ok: true, record, config: recordConfig() });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to load record",
        config: recordConfig(),
      },
      { status: 200 }
    );
  }
}
