/** One line only — Vercel values sometimes get pasted with newlines */
function envOneLine(value: string | undefined, fallback = ""): string {
  return (value || fallback)
    .split(/[\r\n]+/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

function envFlag(value: string | undefined, fallback = true): boolean {
  const v = envOneLine(value);
  if (!v) return fallback;
  return !["0", "false", "no", "off"].includes(v.toLowerCase());
}

const base = () => envOneLine(process.env.FRAPPE_BASE_URL).replace(/\/$/, "");
const key = () => envOneLine(process.env.FRAPPE_API_KEY);
const secret = () => envOneLine(process.env.FRAPPE_API_SECRET);

export const REGISTER_DOCTYPE = envOneLine(
  process.env.FRAPPE_REGISTER_DOCTYPE,
  "Registered People"
);

/** Parent DocType fieldnames (Customize Form → Name) */
export const PASSPORT_FIELD = envOneLine(
  process.env.FRAPPE_PASSPORT_FIELD,
  "passport_number"
);
export const PHONE_FIELD = envOneLine(process.env.FRAPPE_PHONE_FIELD, "phone_number");
export const ID_FIELD = envOneLine(process.env.FRAPPE_ID_FIELD, "id_number");
export const NAME_FIELD = envOneLine(process.env.FRAPPE_NAME_FIELD, "full_name");
export const NAME_AR_FIELD = envOneLine(process.env.FRAPPE_NAME_AR_FIELD, "full_name_ar");

/** Family Member child table */
export const INCLUDE_FAMILY = envFlag(process.env.FRAPPE_INCLUDE_FAMILY_MEMBERS, true);
export const FAMILY_DOCTYPE = envOneLine(
  process.env.FRAPPE_FAMILY_DOCTYPE,
  "Family Member"
);
export const FAMILY_NAME_FIELD = envOneLine(
  process.env.FRAPPE_FAMILY_NAME_FIELD,
  "family_name"
);
export const FAMILY_PASSPORT_FIELD = envOneLine(
  process.env.FRAPPE_FAMILY_PASSPORT_FIELD,
  PASSPORT_FIELD
);
export const FAMILY_PHONE_FIELD = envOneLine(
  process.env.FRAPPE_FAMILY_PHONE_FIELD,
  PHONE_FIELD
);
export const FAMILY_ID_FIELD = envOneLine(process.env.FRAPPE_FAMILY_ID_FIELD, ID_FIELD);

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

export function getFrappeConfig() {
  return {
    base_url: base(),
    register_doctype: REGISTER_DOCTYPE,
    passport_field: PASSPORT_FIELD,
    phone_field: PHONE_FIELD,
    id_field: ID_FIELD,
    name_field: NAME_FIELD,
    name_ar_field: NAME_AR_FIELD,
    include_family: INCLUDE_FAMILY,
    family_doctype: FAMILY_DOCTYPE,
    family_name_field: FAMILY_NAME_FIELD,
    family_passport_field: FAMILY_PASSPORT_FIELD,
    family_phone_field: FAMILY_PHONE_FIELD,
    family_id_field: FAMILY_ID_FIELD,
    configured: frappeConfigured(),
    /** Excel column → Frappe field (key / value) */
    column_mapping: {
      "Name": NAME_FIELD,
      "Passport No.": PASSPORT_FIELD,
      "Phone Number": PHONE_FIELD,
      "ID Number": ID_FIELD,
      "Family Member → family name": FAMILY_NAME_FIELD,
    },
  };
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

    if (parts.length) detail = parts.join("\n");
    else detail = JSON.stringify(json, null, 2);
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
    `  family_doctype=${config.family_doctype}`,
    `  family_name_field=${config.family_name_field}`,
    `  include_family=${config.include_family}`,
    `  base_url=${config.base_url}`,
  ].join("\n");
}

export type SystemRecord = {
  name: string;
  passport: string;
  phone: string;
  id_number: string;
  display_name: string;
  url: string;
  source: string;
  parent?: string;
};

function uniqueFields(fields: string[]): string[] {
  return Array.from(new Set(fields.filter((f) => f && f !== "name")));
}

async function listDoctype(
  doctype: string,
  fields: string[],
  filters?: unknown[]
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const pageSize = 500;
  let start = 0;
  const select = uniqueFields(["name", ...fields]);

  while (true) {
    const url = new URL(`${base()}/api/method/frappe.client.get_list`);
    url.searchParams.set("doctype", doctype);
    url.searchParams.set("fields", JSON.stringify(select));
    url.searchParams.set("limit_page_length", String(pageSize));
    url.searchParams.set("limit_start", String(start));
    url.searchParams.set("order_by", "modified desc");
    if (filters?.length) {
      url.searchParams.set("filters", JSON.stringify(filters));
    }

    const res = await fetch(url.toString(), {
      headers: frappeAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(formatFrappeError(res.status, text, `Frappe list failed for ${doctype}`));
    }

    const json = await res.json();
    const rows: Record<string, unknown>[] = Array.isArray(json.message)
      ? json.message
      : Array.isArray(json.data)
        ? json.data
        : [];
    if (!rows.length) break;
    out.push(...rows);
    if (rows.length < pageSize) break;
    start += pageSize;
  }

  return out;
}

function parentUrl(parentId: string) {
  const slug = REGISTER_DOCTYPE.toLowerCase().replace(/\s+/g, "-");
  return `${base()}/app/${slug}/${encodeURIComponent(parentId)}`;
}

async function fetchParentRecords(): Promise<SystemRecord[]> {
  const rows = await listDoctype(REGISTER_DOCTYPE, [
    PASSPORT_FIELD,
    PHONE_FIELD,
    ID_FIELD,
    NAME_FIELD,
    NAME_AR_FIELD,
  ]);

  return rows.map((row) => {
    const id = String(row.name ?? "");
    const en = String(row[NAME_FIELD] ?? "").trim();
    const ar = String(row[NAME_AR_FIELD] ?? "").trim();
    return {
      name: id,
      passport: String(row[PASSPORT_FIELD] ?? "").trim(),
      phone: String(row[PHONE_FIELD] ?? "").trim(),
      id_number: String(row[ID_FIELD] ?? "").trim(),
      display_name: en || ar || id,
      url: parentUrl(id),
      source: REGISTER_DOCTYPE,
    };
  });
}

async function fetchFamilyMembers(): Promise<{ records: SystemRecord[]; warning?: string }> {
  if (!INCLUDE_FAMILY || !FAMILY_DOCTYPE) return { records: [] };

  try {
    const rows = await listDoctype(
      FAMILY_DOCTYPE,
      [
        "parent",
        "parenttype",
        FAMILY_NAME_FIELD,
        FAMILY_PASSPORT_FIELD,
        FAMILY_PHONE_FIELD,
        FAMILY_ID_FIELD,
      ],
      [["parenttype", "=", REGISTER_DOCTYPE]]
    );

    const records = rows.map((row) => {
      const id = String(row.name ?? "");
      const parent = String(row.parent ?? "").trim();
      const familyName = String(row[FAMILY_NAME_FIELD] ?? "").trim();
      return {
        name: id,
        passport: String(row[FAMILY_PASSPORT_FIELD] ?? "").trim(),
        phone: String(row[FAMILY_PHONE_FIELD] ?? "").trim(),
        id_number: String(row[FAMILY_ID_FIELD] ?? "").trim(),
        display_name: familyName
          ? `${familyName} (Family of ${parent || "—"})`
          : `Family Member ${id}`,
        url: parent ? parentUrl(parent) : "#",
        source: FAMILY_DOCTYPE,
        parent: parent || undefined,
      };
    });

    return { records };
  } catch (err) {
    return {
      records: [],
      warning:
        err instanceof Error
          ? `Family Member child table skipped: ${err.message}`
          : "Family Member child table skipped",
    };
  }
}

export async function fetchAllSystemRecords(): Promise<{
  records: SystemRecord[];
  warning?: string;
}> {
  if (!frappeConfigured()) return { records: [] };

  const parents = await fetchParentRecords();
  const family = await fetchFamilyMembers();

  return {
    records: [...parents, ...family.records],
    warning: family.warning,
  };
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
