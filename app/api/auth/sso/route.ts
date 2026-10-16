import { NextRequest, NextResponse } from "next/server";
import { accessDeniedResponse } from "@/lib/access-denied";
import {
  fetchRolesForUser,
  fetchRolesFromCookie,
  hasAllowedRole,
  sessionCookieHeader,
  userFromOneTimeToken,
} from "@/lib/frappe-login";
import {
  allowSidSso,
  allowedRoles,
  authConfigured,
  sessionCookieName,
  sessionCookieOptions,
  signSession,
  skipRoleCheck,
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
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="referrer" content="no-referrer" />
  <title>Signing in…</title>
  <script>
    try { sessionStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(token)}); } catch (e) {}
    location.replace(${JSON.stringify(nextPath)});
  </script>
</head>
<body></body>
</html>`;
}

async function completeSso(opts: {
  sid: string;
  token: string;
  nextPath: string;
}) {
  if (!authConfigured()) {
    return accessDeniedResponse();
  }

  const safeNext = opts.nextPath.startsWith("/") ? opts.nextPath : "/";
  let user = "";
  let fullName = "";
  let roles: string[] = [];

  if (opts.token) {
    const fromToken = await userFromOneTimeToken(opts.token);
    if (!fromToken) {
      return accessDeniedResponse();
    }
    user = fromToken.user;
    fullName = fromToken.full_name;
    roles = fromToken.roles;
  } else if (opts.sid && allowSidSso()) {
    if (!baseUrl()) {
      return accessDeniedResponse();
    }
    const fromSid = await userFromSid(opts.sid);
    if (!fromSid) {
      return accessDeniedResponse();
    }
    user = fromSid.user;
    fullName = fromSid.full_name;
    roles = fromSid.roles;
  } else {
    return accessDeniedResponse();
  }

  const allowed = allowedRoles();
  if (!skipRoleCheck() && !hasAllowedRole(roles, allowed)) {
    return accessDeniedResponse();
  }

  const session = await signSession({ user, full_name: fullName, via: "sso" });
  const res = new NextResponse(ssoBootstrapHtml(session, safeNext), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
  const cookie = sessionCookieOptions(session);
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}

function readNext(req: NextRequest, formNext?: string) {
  const next = formNext || req.nextUrl.searchParams.get("next") || "/";
  return next.startsWith("/") ? next : "/";
}

export async function GET(req: NextRequest) {
  return completeSso({
    sid: (req.nextUrl.searchParams.get("sid") || "").trim(),
    token: (req.nextUrl.searchParams.get("token") || "").trim(),
    nextPath: readNext(req),
  });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  let token = "";
  let next = "/";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    token = String(body.token || "").trim();
    next = String(body.next || "/");
  } else {
    const form = await req.formData().catch(() => null);
    token = String(form?.get("token") || "").trim();
    next = String(form?.get("next") || "/");
  }
  return completeSso({
    sid: "",
    token,
    nextPath: readNext(req, next),
  });
}
