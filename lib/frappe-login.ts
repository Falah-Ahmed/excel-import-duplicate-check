const base = () => (process.env.FRAPPE_BASE_URL || "").replace(/\/$/, "").trim();

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

  // Frappe returns message: "Logged In" on success
  const cookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");

  const roles = await fetchRoles(cookieHeader);
  return {
    user: usr,
    full_name: json.full_name || usr,
    roles,
    cookieHeader,
  };
}

async function fetchRoles(cookieHeader: string): Promise<string[]> {
  if (!cookieHeader) return [];
  const url = `${base()}/api/method/frappe.auth.get_logged_user`;
  // get roles via client
  const rolesUrl = `${base()}/api/method/frappe.core.doctype.user.user.get_roles`;
  try {
    const who = await fetch(url, {
      headers: { Accept: "application/json", Cookie: cookieHeader },
      cache: "no-store",
    });
    const whoJson = await who.json();
    const user = whoJson.message;
    if (!user || user === "Guest") return [];

    const rolesRes = await fetch(
      `${base()}/api/method/frappe.client.get_list?doctype=Has%20Role&fields=${encodeURIComponent(
        JSON.stringify(["role"])
      )}&filters=${encodeURIComponent(JSON.stringify([["parent", "=", user]]))}&limit_page_length=100`,
      {
        headers: { Accept: "application/json", Cookie: cookieHeader },
        cache: "no-store",
      }
    );
    if (rolesRes.ok) {
      const rolesJson = await rolesRes.json();
      const rows = rolesJson.message || rolesJson.data || [];
      if (Array.isArray(rows)) {
        return rows.map((r: { role?: string }) => r.role).filter(Boolean) as string[];
      }
    }

    // Fallback method
    const alt = await fetch(`${rolesUrl}?uid=${encodeURIComponent(user)}`, {
      headers: { Accept: "application/json", Cookie: cookieHeader },
      cache: "no-store",
    });
    if (alt.ok) {
      const altJson = await alt.json();
      if (Array.isArray(altJson.message)) return altJson.message as string[];
    }
    void rolesUrl;
    return [];
  } catch {
    return [];
  }
}

export function hasAllowedRole(userRoles: string[], allowed: string[]) {
  if (!allowed.length) return true;
  return userRoles.some((r) => allowed.includes(r));
}
