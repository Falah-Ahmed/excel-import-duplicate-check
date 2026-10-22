import { NextRequest, NextResponse } from "next/server";
import { accessDeniedResponse } from "@/lib/access-denied";
import { hasAllowedRole, userFromOneTimeToken } from "@/lib/frappe-login";
import { allowedRoles, authConfigured, sessionCookieOptions, signSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** sid in the address bar is refused. The one-time token arrives in the POST body only. */
export async function GET() {
  return accessDeniedResponse();
}

export async function POST(req: NextRequest) {
  if (!authConfigured()) return accessDeniedResponse();

  const contentType = req.headers.get("content-type") || "";
  let token = "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    token = String(body?.token || "").trim();
  } else {
    const form = await req.formData().catch(() => null);
    token = String(form?.get("token") || "").trim();
  }

  if (!token || token.length > 80 || /[^A-Za-z0-9]/.test(token)) {
    return accessDeniedResponse();
  }

  const fromToken = await userFromOneTimeToken(token);
  if (!fromToken) return accessDeniedResponse();
  if (!hasAllowedRole(fromToken.roles, allowedRoles())) return accessDeniedResponse();

  const session = await signSession({
    user: fromToken.user,
    full_name: fromToken.full_name,
  });
  const res = NextResponse.json({ ok: true });
  const cookie = sessionCookieOptions(session);
  res.cookies.set(cookie.name, cookie.value, cookie);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
