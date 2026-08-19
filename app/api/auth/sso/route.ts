import { NextRequest, NextResponse } from "next/server";
import { hasAllowedRole } from "@/lib/frappe-login";
import {
  allowedRoles,
  authConfigured,
  sessionCookieOptions,
  signSession,
  verifyBridgeToken,
} from "@/lib/session";

export const dynamic = "force-dynamic";

function baseUrl() {
  return (process.env.FRAPPE_BASE_URL || "").replace(/\/$/, "").trim();
}

async function userFromSid(sid: string) {
  const cookie = `sid=${sid}`;
  const whoRes = await fetch(`${baseUrl()}/api/method/frappe.auth.get_logged_user`, {
    headers: { Accept: "application/json", Cookie: cookie },
    cache: "no-store",
  });
  if (!whoRes.ok) return null;
  const whoJson = await whoRes.json();
  const user = whoJson.message;
  if (!user || user === "Guest") return null;

  let fullName = user;
  try {
    const nameRes = await fetch(
      `${baseUrl()}/api/method/frappe.client.get_value?doctype=User&filters=${encodeURIComponent(
        JSON.stringify({ name: user })
      )}&fieldname=${encodeURIComponent(JSON.stringify(["full_name"]))}`,
      { headers: { Accept: "application/json", Cookie: cookie }, cache: "no-store" }
    );
    if (nameRes.ok) {
      const nameJson = await nameRes.json();
      fullName = nameJson.message?.full_name || user;
    }
  } catch {
    // ignore
  }

  let roles: string[] = [];
  try {
    const rolesRes = await fetch(
      `${baseUrl()}/api/method/frappe.client.get_list?doctype=Has%20Role&fields=${encodeURIComponent(
        JSON.stringify(["role"])
      )}&filters=${encodeURIComponent(JSON.stringify([["parent", "=", user]]))}&limit_page_length=100`,
      { headers: { Accept: "application/json", Cookie: cookie }, cache: "no-store" }
    );
    if (rolesRes.ok) {
      const rolesJson = await rolesRes.json();
      const rows = rolesJson.message || [];
      if (Array.isArray(rows)) roles = rows.map((r: { role?: string }) => r.role).filter(Boolean);
    }
  } catch {
    // ignore
  }

  return { user, full_name: fullName, roles };
}

/**
 * SSO entry for Frappe iframe:
 * /api/auth/sso?sid=FRAPPE_SID&next=/
 * or /api/auth/sso?token=HMAC_BRIDGE&next=/
 */
export async function GET(req: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.redirect(new URL(`/login?error=auth_not_configured`, req.url));
  }

  const next = req.nextUrl.searchParams.get("next") || "/";
  const safeNext = next.startsWith("/") ? next : "/";
  const sid = (req.nextUrl.searchParams.get("sid") || "").trim();
  const token = (req.nextUrl.searchParams.get("token") || "").trim();

  let user = "";
  let fullName = "";
  let roles: string[] = [];

  if (sid) {
    if (!baseUrl()) {
      return NextResponse.redirect(new URL(`/login?error=missing_frappe_url`, req.url));
    }
    const fromSid = await userFromSid(sid);
    if (!fromSid) {
      return NextResponse.redirect(new URL(`/login?error=invalid_frappe_session`, req.url));
    }
    user = fromSid.user;
    fullName = fromSid.full_name;
    roles = fromSid.roles;
  } else if (token) {
    const bridge = await verifyBridgeToken(token);
    if (!bridge) {
      return NextResponse.redirect(new URL(`/login?error=invalid_sso`, req.url));
    }
    user = bridge.user;
    fullName = bridge.full_name || bridge.user;
    roles = allowedRoles(); // bridge token already minted for allowed desk users
  } else {
    return NextResponse.redirect(new URL(`/login?error=missing_sso`, req.url));
  }

  const allowed = allowedRoles();
  if (sid && !hasAllowedRole(roles, allowed)) {
    return NextResponse.redirect(new URL(`/login?error=forbidden_role`, req.url));
  }

  const session = await signSession({ user, full_name: fullName });
  const res = NextResponse.redirect(new URL(safeNext, req.url));
  const cookie = sessionCookieOptions(session);
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
