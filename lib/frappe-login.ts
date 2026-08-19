const base = () => (process.env.FRAPPE_BASE_URL || "").replace(/\/$/, "").trim();
const apiKey = () => (process.env.FRAPPE_API_KEY || "").trim();
const apiSecret = () => (process.env.FRAPPE_API_SECRET || "").trim();

export function sessionCookieHeader(sid: string) {
  return `sid=${sid}; system_user=yes`;
}

export async function fetchRolesForUser(user: string): Promise<string[]> {
  const key = apiKey();
  const secret = apiSecret();
  if (!key || !secret || !user) return [];
  try {
    const url = `${base()}/api/method/frappe.core.doctype.user.user.get_roles?uid=${encodeURIComponent(user)}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `token ${key}:${secret}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (Array.isArray(json.message)) return json.message.filter(Boolean) as string[];
    return [];
  } catch {
    return [];
  }
}

export async function fetchRolesFromCookie(cookieHeader: string): Promise<string[]> {
  if (!cookieHeader) return [];
  try {
    const rolesRes = await fetch(`${base()}/api/method/frappe.core.doctype.user.user.get_roles`, {
      headers: { Accept: "application/json", Cookie: cookieHeader },
      cache: "no-store",
    });
    if (rolesRes.ok) {
      const rolesJson = await rolesRes.json();
      if (Array.isArray(rolesJson.message)) {
        return rolesJson.message.filter(Boolean) as string[];
      }
    }

    const whoRes = await fetch(`${base()}/api/method/frappe.auth.get_logged_user`, {
      headers: { Accept: "application/json", Cookie: cookieHeader },
      cache: "no-store",
    });
    if (!whoRes.ok) return [];
    const whoJson = await whoRes.json();
    const user = whoJson.message;
    if (!user || user === "Guest") return [];

    const listRes = await fetch(
      `${base()}/api/method/frappe.client.get_list?doctype=Has%20Role&fields=${encodeURIComponent(
        JSON.stringify(["role"])
      )}&filters=${encodeURIComponent(JSON.stringify([["parent", "=", user]]))}&limit_page_length=100`,
      { headers: { Accept: "application/json", Cookie: cookieHeader }, cache: "no-store" }
    );
    if (listRes.ok) {
      const listJson = await listRes.json();
      const rows = listJson.message || listJson.data || [];
      if (Array.isArray(rows)) {
        return rows.map((r: { role?: string }) => r.role).filter(Boolean) as string[];
      }
    }
    return [];
  } catch {
    return [];
  }
}

export async function frappeLogin(usr: string, pwd: string) {
  const url = `${base()}/api/method/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ usr, pwd }),
  });

  const text = await res.text();
  let json: { message?: string; full_name?: string; exc?: string } = {};
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }

  if (!res.ok) {
    throw new Error(json.message || json.exc || `Login failed (${res.status})`);
  }

  const cookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
  const roles = await fetchRolesFromCookie(cookieHeader);
  return {
    user: usr,
    full_name: json.full_name || usr,
    roles,
    cookieHeader,
  };
}

export function hasAllowedRole(userRoles: string[], allowed: string[]) {
  if (!allowed.length) return true;
  return userRoles.some((r) => allowed.includes(r));
}
