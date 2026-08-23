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
export const NAME_FIELD = envOneLine(process.env.FRAPPE_NAME_FIELD, "main_parent_name");
/** Optional — leave empty in Vercel if you have no Arabic name field */
export const NAME_AR_FIELD = envOneLine(process.env.FRAPPE_NAME_AR_FIELD, "");

/** Family Member child table — use Customize Form fieldnames on Family Member (not parent) */
export const INCLUDE_FAMILY = envFlag(process.env.FRAPPE_INCLUDE_FAMILY_MEMBERS, true);
export const FAMILY_DOCTYPE = envOneLine(
  process.env.FRAPPE_FAMILY_DOCTYPE,
  "Family Member"
);
/** Child table fieldname on Registered People (e.g. family_member) */
export const FAMILY_TABLE_FIELD = envOneLine(
  process.env.FRAPPE_FAMILY_TABLE_FIELD,
  "family_member"
);
export const FAMILY_NAME_FIELD = envOneLine(
  process.env.FRAPPE_FAMILY_NAME_FIELD,
  "name_3"
);
export const FAMILY_PASSPORT_FIELD = envOneLine(
  process.env.FRAPPE_FAMILY_PASSPORT_FIELD,
  "passport_number"
);
export const FAMILY_PHONE_FIELD = envOneLine(
  process.env.FRAPPE_FAMILY_PHONE_FIELD,
  "phone_number"
);
export const FAMILY_ID_FIELD = envOneLine(
  process.env.FRAPPE_FAMILY_ID_FIELD,
  "id_number"
);

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
    family_table_field: FAMILY_TABLE_FIELD,
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
      "Family Member → name": FAMILY_NAME_FIELD,
      "Family Member → passport": FAMILY_PASSPORT_FIELD,
      "Family Member → phone": FAMILY_PHONE_FIELD,
      "Family Member → ID": FAMILY_ID_FIELD,
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
    `  family_table_field=${config.family_table_field}`,
    `  family_name_field=${config.family_name_field}`,
    `  family_passport_field=${config.family_passport_field}`,
    `  family_phone_field=${config.family_phone_field}`,
    `  family_id_field=${config.family_id_field}`,
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

function extractBadField(text: string): string | null {
  const match = text.match(/Field not permitted in query:\s*([a-zA-Z0-9_]+)/i);
  return match?.[1] || null;
}

async function listDoctype(
  doctype: string,
  fields: string[],
  filters?: unknown[]
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const pageSize = 500;
  let start = 0;
  let select = uniqueFields(["name", ...fields]);
  const dropped: string[] = [];

  while (true) {
    // Prefer Resource API — reliably returns document `name`
    const url = new URL(`${base()}/api/resource/${encodeURIComponent(doctype)}`);
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
      const bad = extractBadField(text);
      if (bad && select.includes(bad)) {
        select = select.filter((f) => f !== bad);
        dropped.push(bad);
        start = 0;
        out.length = 0;
        continue;
      }
      // Fallback to whitelisted method
      const methodUrl = new URL(`${base()}/api/method/frappe.client.get_list`);
      methodUrl.searchParams.set("doctype", doctype);
      methodUrl.searchParams.set("fields", JSON.stringify(select));
      methodUrl.searchParams.set("limit_page_length", String(pageSize));
      methodUrl.searchParams.set("limit_start", String(start));
      methodUrl.searchParams.set("order_by", "modified desc");
      if (filters?.length) {
        methodUrl.searchParams.set("filters", JSON.stringify(filters));
      }
      const methodRes = await fetch(methodUrl.toString(), {
        headers: frappeAuthHeaders(),
        cache: "no-store",
      });
      if (!methodRes.ok) {
        throw new Error(
          formatFrappeError(methodRes.status, await methodRes.text(), `Frappe list failed for ${doctype}`)
        );
      }
      const methodJson = await methodRes.json();
      const methodRows: Record<string, unknown>[] = Array.isArray(methodJson.message)
        ? methodJson.message
        : [];
      if (!methodRows.length) break;
      out.push(...methodRows);
      if (methodRows.length < pageSize) break;
      start += pageSize;
      continue;
    }

    const json = await res.json();
    const rows: Record<string, unknown>[] = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.message)
        ? json.message
        : [];
    if (!rows.length) break;
    out.push(...rows);
    if (rows.length < pageSize) break;
    start += pageSize;
  }

  if (dropped.length) {
    console.warn(`[frappe] dropped fields for ${doctype}: ${dropped.join(", ")}`);
  }

  return out;
}

function parentUrl(parentId: string) {
  const slug = REGISTER_DOCTYPE.toLowerCase().replace(/\s+/g, "-");
  return `${base()}/app/${slug}/${encodeURIComponent(parentId)}`;
}

function familyUrl(familyId: string) {
  const slug = FAMILY_DOCTYPE.toLowerCase().replace(/\s+/g, "-");
  return `${base()}/app/${slug}/${encodeURIComponent(familyId)}`;
}

function recordDocName(row: Record<string, unknown>): string {
  const raw = row.name ?? row.Name ?? row.ID ?? "";
  return String(raw).trim();
}

async function fetchParentRecords(): Promise<SystemRecord[]> {
  const rows = await listDoctype(REGISTER_DOCTYPE, [
    PASSPORT_FIELD,
    PHONE_FIELD,
    ID_FIELD,
    NAME_FIELD,
    NAME_AR_FIELD,
  ]);

  return rows
    .map((row) => {
      const id = recordDocName(row);
      const en = String(row[NAME_FIELD] ?? "").trim();
      const ar = String(row[NAME_AR_FIELD] ?? "").trim();
      return {
        name: id,
        passport: String(row[PASSPORT_FIELD] ?? "").trim(),
        phone: String(row[PHONE_FIELD] ?? "").trim(),
        id_number: String(row[ID_FIELD] ?? "").trim(),
        display_name: en || ar || id,
        url: id ? parentUrl(id) : "#",
        source: REGISTER_DOCTYPE,
      };
    })
    .filter((r) => Boolean(r.name));
}

function mapFamilyRow(row: Record<string, unknown>, parentHint?: string): SystemRecord {
  const id = recordDocName(row);
  const parent = String(row.parent ?? parentHint ?? "").trim();
  const familyName = String(row[FAMILY_NAME_FIELD] ?? "").trim();
  const openParent = parent || "";
  return {
    name: id || (openParent ? `${openParent}-${familyName || "member"}` : ""),
    passport: String(row[FAMILY_PASSPORT_FIELD] ?? "").trim(),
    phone: String(row[FAMILY_PHONE_FIELD] ?? "").trim(),
    id_number: String(row[FAMILY_ID_FIELD] ?? "").trim(),
    display_name: familyName
      ? `${familyName} (Family of ${openParent || "—"})`
      : `Family Member ${id || openParent}`,
    url: openParent ? parentUrl(openParent) : id ? familyUrl(id) : "#",
    source: FAMILY_DOCTYPE,
    parent: openParent || undefined,
  };
}

export async function fetchParentDoc(parentId: string): Promise<Record<string, unknown> | null> {
  const url = `${base()}/api/resource/${encodeURIComponent(REGISTER_DOCTYPE)}/${encodeURIComponent(parentId)}`;
  const res = await fetch(url, {
    headers: frappeAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.data as Record<string, unknown>) || null;
}

export function extractChildRows(
  parentDoc: Record<string, unknown>,
  parentId: string
): Record<string, unknown>[] {
  const preferred = FAMILY_TABLE_FIELD;
  const candidates = preferred
    ? [preferred]
    : Object.keys(parentDoc).filter((k) => /family/i.test(k));

  for (const field of candidates) {
    const value = parentDoc[field];
    if (Array.isArray(value) && value.length) {
      return value as Record<string, unknown>[];
    }
  }

  // Auto-detect first array of objects that looks like family rows
  for (const [key, value] of Object.entries(parentDoc)) {
    if (!Array.isArray(value) || !value.length) continue;
    const first = value[0];
    if (!first || typeof first !== "object") continue;
    const obj = first as Record<string, unknown>;
    if (
      FAMILY_NAME_FIELD in obj ||
      FAMILY_PASSPORT_FIELD in obj ||
      FAMILY_ID_FIELD in obj ||
      FAMILY_PHONE_FIELD in obj
    ) {
      void key;
      return value as Record<string, unknown>[];
    }
  }

  void parentId;
  return [];
}

/** Fallback when listing Family Member is forbidden (403) — read child rows from each parent */
async function fetchFamilyViaParents(parentIds: string[]): Promise<{
  records: SystemRecord[];
  warning?: string;
}> {
  const records: SystemRecord[] = [];
  const limit = Math.min(parentIds.length, 300);
  let loaded = 0;
  let failed = 0;

  for (let i = 0; i < limit; i += 15) {
    const batch = parentIds.slice(i, i + 15);
    const docs = await Promise.all(batch.map((id) => fetchParentDoc(id)));
    for (let j = 0; j < batch.length; j++) {
      const doc = docs[j];
      if (!doc) {
        failed += 1;
        continue;
      }
      loaded += 1;
      const children = extractChildRows(doc, batch[j]);
      for (const child of children) {
        records.push(mapFamilyRow(child, batch[j]));
      }
    }
  }

  const notes: string[] = [];
  notes.push(
    `Family Member loaded via parent documents (${records.length} members from ${loaded} parents).`
  );
  if (parentIds.length > limit) {
    notes.push(`Only first ${limit} parents were scanned (of ${parentIds.length}).`);
  }
  if (failed) notes.push(`${failed} parent docs failed to load.`);
  notes.push(
    "Tip: give Admin Read permission on Family Member to load all members faster via list API."
  );

  return { records, warning: notes.join(" ") };
}

async function fetchFamilyMembers(parentIds: string[]): Promise<{
  records: SystemRecord[];
  warning?: string;
}> {
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

    return { records: rows.map((row) => mapFamilyRow(row)) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Family Member list failed";
    // Child tables often block get_list with 403 — fall back to parent docs
    if (/403|PermissionError/i.test(message) && parentIds.length) {
      const viaParents = await fetchFamilyViaParents(parentIds);
      return {
        records: viaParents.records,
        warning: `Direct Family Member list blocked (403). ${viaParents.warning || ""}`,
      };
    }
    return {
      records: [],
      warning: `Family Member child table skipped: ${message}`,
    };
  }
}

export async function fetchAllSystemRecords(): Promise<{
  records: SystemRecord[];
  warning?: string;
}> {
  if (!frappeConfigured()) return { records: [] };

  const parents = await fetchParentRecords();
  const family = await fetchFamilyMembers(parents.map((p) => p.name));

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
