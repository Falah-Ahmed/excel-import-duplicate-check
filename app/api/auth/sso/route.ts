import { NextRequest, NextResponse } from "next/server";
import { accessDeniedResponse } from "@/lib/access-denied";
import {
  fetchRolesForUser,
  fetchRolesFromCookie,
  hasAllowedRole,
  sessionCookieHeader,
} from "@/lib/frappe-login";
import {
  allowedRoles,
  authConfigured,
  sessionCookieName,
  sessionCookieOptions,
  signSession,
  skipRoleCheck,
  verifyBridgeToken,
} from "@/lib/session";

export const dynamic = "force-dynamic";

function baseUrl() {
  return (process.env.FRAPPE_BASE_URL || "").replace(/\/$/, "").trim();
}

async function userFromSid(sid: string) {
  const cookie = sessionCookieHeader(sid);
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

  let roles = await fetchRolesFromCookie(cookie);
  if (!roles.length) roles = await fetchRolesForUser(user);
  return { user, full_name: fullName, roles };
}

function ssoBootstrapHtml(token: string, nextPath: string) {
  const key = sessionCookieName();
  const dest =
    nextPath +
    (nextPath.includes("?") ? "&" : "?") +
    "t=" +
    encodeURIComponent(token);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Signing in…</title>
  <script>
    try { sessionStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(token)}); } catch (e) {}
    location.replace(${JSON.stringify(dest)});
  </script>
</head>
<body></body>
</html>`;
}

/** SSO entry for Frappe iframe: /api/auth/sso?sid=FRAPPE_SID&next=/ */
export async function GET(req: NextRequest) {
  if (!authConfigured()) {
    return accessDeniedResponse();
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
      return accessDeniedResponse();
    }
    const fromSid = await userFromSid(sid);
    if (!fromSid) {
      return accessDeniedResponse();
    }
    user = fromSid.user;
    fullName = fromSid.full_name;
    roles = fromSid.roles;
  } else if (token) {
    const bridge = await verifyBridgeToken(token);
    if (!bridge) {
      return accessDeniedResponse();
    }
    user = bridge.user;
    fullName = bridge.full_name || bridge.user;
    roles = allowedRoles();
  } else {
    return accessDeniedResponse();
  }

  const allowed = allowedRoles();
  if (sid && !skipRoleCheck() && !hasAllowedRole(roles, allowed)) {
    return accessDeniedResponse();
  }

  const session = await signSession({ user, full_name: fullName, via: "sso" });
  const res = new NextResponse(ssoBootstrapHtml(session, safeNext), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  const cookie = sessionCookieOptions(session);
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
