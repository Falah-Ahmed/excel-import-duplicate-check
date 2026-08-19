import { NextRequest, NextResponse } from "next/server";
import { frappeLogin, hasAllowedRole } from "@/lib/frappe-login";
import {
  allowedRoles,
  authConfigured,
  sessionCookieOptions,
  signSession,
  ssoOnly,
} from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (ssoOnly()) {
    return NextResponse.json(
      { ok: false, error: "Direct login is disabled. Open this app from ERPNext." },
      { status: 403 }
    );
  }

  if (!authConfigured()) {
    return NextResponse.json(
      { ok: false, error: "AUTH_SECRET is not set on Vercel" },
      { status: 500 }
    );
  }

  let body: { usr?: string; pwd?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const usr = (body.usr || "").trim();
  const pwd = body.pwd || "";
  if (!usr || !pwd) {
    return NextResponse.json({ ok: false, error: "Username and password required" }, { status: 400 });
  }

  if (!(process.env.FRAPPE_BASE_URL || "").trim()) {
    return NextResponse.json(
      { ok: false, error: "FRAPPE_BASE_URL is not set" },
      { status: 500 }
    );
  }

  try {
    const result = await frappeLogin(usr, pwd);
    const allowed = allowedRoles();
    if (!hasAllowedRole(result.roles, allowed)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Access denied. Need one of: ${allowed.join(", ")}. Your roles: ${
            result.roles.join(", ") || "none"
          }`,
        },
        { status: 403 }
      );
    }

    const token = await signSession({
      user: result.user,
      full_name: result.full_name,
      via: "password",
    });
    const res = NextResponse.json({
      ok: true,
      user: result.user,
      full_name: result.full_name,
    });
    const cookie = sessionCookieOptions(token);
    res.cookies.set(cookie.name, cookie.value, cookie);
    return res;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Login failed" },
      { status: 401 }
    );
  }
}
