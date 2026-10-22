const base = () => (process.env.FRAPPE_BASE_URL || "").replace(/\/$/, "").trim();
const apiKey = () => (process.env.FRAPPE_API_KEY || "").trim();
const apiSecret = () => (process.env.FRAPPE_API_SECRET || "").trim();

function apiAuth(): string {
  const key = apiKey();
  const secret = apiSecret();
  if (!base() || !key || !secret) return "";
  return `token ${key}:${secret}`;
}

export function frappeReady(): boolean {
  return Boolean(apiAuth());
}

export async function fetchRolesForUser(user: string): Promise<string[]> {
  const auth = apiAuth();
  if (!auth || !user) return [];
  const url = `${base()}/api/method/frappe.core.doctype.user.user.get_roles?uid=${encodeURIComponent(user)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", Authorization: auth },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json.message) ? json.message.filter(Boolean) : [];
}

export function hasAllowedRole(userRoles: string[], allowed: string[]) {
  if (!allowed.length) return false;
  return userRoles.some((role) => allowed.includes(role));
}

/** Redeem the one-time token issued by v3. The token is not a Frappe sid. */
export async function userFromOneTimeToken(token: string): Promise<{
  user: string;
  full_name: string;
  roles: string[];
} | null> {
  const auth = apiAuth();
  if (!auth || !token || token.length > 80) return null;
  const res = await fetch(`${base()}/api/method/redeem_attendance_sso`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const data = json?.message || json;
  const user = typeof data?.user === "string" ? data.user : "";
  if (!user || user === "Guest") return null;
  let roles = await fetchRolesForUser(user);
  if (user === "Administrator" && !roles.includes("Administrator")) {
    roles = ["Administrator", "System Manager", ...roles];
  }
  return {
    user,
    full_name: typeof data.full_name === "string" && data.full_name ? data.full_name : user,
    roles,
  };
}
