/** One line only — Vercel values sometimes get pasted with newlines */
function envOneLine(value: string | undefined, fallback = ""): string {
  return (value || fallback)
    .split(/[\r\n]+/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

const base = () => envOneLine(process.env.FRAPPE_BASE_URL).replace(/\/$/, "");
const key = () => envOneLine(process.env.FRAPPE_API_KEY);
const secret = () => envOneLine(process.env.FRAPPE_API_SECRET);

export const REGISTER_DOCTYPE = envOneLine(
  process.env.FRAPPE_REGISTER_DOCTYPE,
  "Registered People"
);

export const PASSPORT_FIELD = envOneLine(
  process.env.FRAPPE_PASSPORT_FIELD,
  "passport_number"
);
export const PHONE_FIELD = envOneLine(process.env.FRAPPE_PHONE_FIELD, "phone_number");
export const ID_FIELD = envOneLine(process.env.FRAPPE_ID_FIELD, "id_number");
export const NAME_FIELD = envOneLine(process.env.FRAPPE_NAME_FIELD, "full_name");
export const NAME_AR_FIELD = envOneLine(process.env.FRAPPE_NAME_AR_FIELD, "full_name_ar");

export function frappeBaseUrl() {
  return base();
}

export function frappeAuthHeaders(): Record<string, string> {
  return {
    Authorization: `token ${key()}:${secret()}`,
    Accept: "application/json",
  };
}

export function frappeConfigured(): boolean {
  return Boolean(base() && key() && secret());
}

/** Keep full Frappe body so the UI can show the real PermissionError / field error */
export function formatFrappeError(status: number, text: string, context: string): string {
  const trimmed = (text || "").trim();
  let detail = trimmed;

  try {
    const json = JSON.parse(trimmed) as {
      exception?: string;
      exc_type?: string;
      message?: string;
      _server_messages?: string;
    };

    const parts: string[] = [];
    if (json.exc_type) parts.push(`Type: ${json.exc_type}`);
    if (json.exception) parts.push(`Exception: ${json.exception}`);
    if (json.message) parts.push(`Message: ${json.message}`);

    if (json._server_messages) {
      try {
        const messages = JSON.parse(json._server_messages) as string[];
        for (const raw of messages) {
          try {
            const msg = JSON.parse(raw) as { message?: string; title?: string };
            if (msg.message) parts.push(`Server: ${msg.message}`);
            else if (msg.title) parts.push(`Server: ${msg.title}`);
          } catch {
            parts.push(`Server: ${raw}`);
          }
        }
      } catch {
        parts.push(`Server messages: ${json._server_messages}`);
      }
    }

    if (parts.length) {
      detail = parts.join("\n");
    } else {
      detail = JSON.stringify(json, null, 2);
    }
  } catch {
    // keep raw text
  }

  const config = getFrappeConfig();
  return [
    `${context} (HTTP ${status})`,
    detail,
    "",
    "Config:",
    `  doctype=${config.register_doctype}`,
    `  passport_field=${config.passport_field}`,
    `  phone_field=${config.phone_field}`,
    `  id_field=${config.id_field}`,
    `  name_field=${config.name_field}`,
    `  name_ar_field=${config.name_ar_field}`,
    `  base_url=${config.base_url}`,
  ].join("\n");
}

export function getFrappeConfig() {
  return {
    base_url: base(),
    register_doctype: REGISTER_DOCTYPE,
    passport_field: PASSPORT_FIELD,
    phone_field: PHONE_FIELD,
    id_field: ID_FIELD,
    name_field: NAME_FIELD,
    name_ar_field: NAME_AR_FIELD,
    configured: frappeConfigured(),
  };
}

export type SystemRecord = {
  name: string;
  passport: string;
  phone: string;
  id_number: string;
  display_name: string;
  url: string;
};

export async function fetchAllSystemRecords(): Promise<SystemRecord[]> {
  if (!frappeConfigured()) return [];

  const fields = ["name", PASSPORT_FIELD, PHONE_FIELD, ID_FIELD, NAME_FIELD, NAME_AR_FIELD];
  const out: SystemRecord[] = [];
  const pageSize = 500;
  let start = 0;

  while (true) {
    const url = new URL(`${base()}/api/resource/${encodeURIComponent(REGISTER_DOCTYPE)}`);
    url.searchParams.set("fields", JSON.stringify(fields));
    url.searchParams.set("limit_page_length", String(pageSize));
    url.searchParams.set("limit_start", String(start));
    url.searchParams.set("order_by", "modified desc");

    const res = await fetch(url.toString(), {
      headers: frappeAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(formatFrappeError(res.status, text, "Frappe list failed"));
    }

    const json = await res.json();
    const rows: Record<string, unknown>[] = json?.data || [];
    if (!rows.length) break;

    const slug = REGISTER_DOCTYPE.toLowerCase().replace(/\s+/g, "-");
    for (const row of rows) {
      const id = String(row.name ?? "");
      const en = String(row[NAME_FIELD] ?? "").trim();
      const ar = String(row[NAME_AR_FIELD] ?? "").trim();
      out.push({
        name: id,
        passport: String(row[PASSPORT_FIELD] ?? "").trim(),
        phone: String(row[PHONE_FIELD] ?? "").trim(),
        id_number: String(row[ID_FIELD] ?? "").trim(),
        display_name: en || ar || id,
        url: `${base()}/app/${slug}/${encodeURIComponent(id)}`,
      });
    }

    if (rows.length < pageSize) break;
    start += pageSize;
  }

  return out;
}

export async function insertRecord(payload: Record<string, string>): Promise<string> {
  const url = `${base()}/api/resource/${encodeURIComponent(REGISTER_DOCTYPE)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...frappeAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatFrappeError(res.status, text, "Frappe insert failed"));
  }
  const json = await res.json();
  return String(json?.data?.name ?? "");
}
