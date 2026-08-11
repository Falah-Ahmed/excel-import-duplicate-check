import {
  FAMILY_ID_FIELD,
  FAMILY_NAME_FIELD,
  FAMILY_PASSPORT_FIELD,
  FAMILY_PHONE_FIELD,
  ID_FIELD,
  NAME_AR_FIELD,
  NAME_FIELD,
  PASSPORT_FIELD,
  PHONE_FIELD,
  REGISTER_DOCTYPE,
  extractChildRows,
  fetchParentDoc,
  formatFrappeError,
  frappeAuthHeaders,
  frappeBaseUrl,
  frappeConfigured,
  getFrappeConfig,
} from "./frappe";

export type FieldItem = {
  key: string;
  value: string;
};

export type FamilyMemberView = {
  id: string;
  fields: FieldItem[];
};

export type RecordPayload = {
  id: string;
  title: string;
  identity: FieldItem[];
  extra: FieldItem[];
  family: FamilyMemberView[];
  url: string;
};

const SKIP = new Set([
  "name",
  "owner",
  "creation",
  "modified",
  "modified_by",
  "docstatus",
  "idx",
  "doctype",
  "parent",
  "parentfield",
  "parenttype",
  "naming_series",
  "amended_from",
]);

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value) || typeof value === "object") return "";
  return String(value).trim();
}

function pick(doc: Record<string, unknown>, field: string): string {
  if (!field) return "";
  return text(doc[field]);
}

export async function getRegisteredRecord(id: string): Promise<RecordPayload> {
  if (!frappeConfigured()) {
    throw new Error("Missing FRAPPE_BASE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET");
  }

  const doc = await fetchParentDoc(id);
  if (!doc) {
    const res = await fetch(
      `${frappeBaseUrl()}/api/resource/${encodeURIComponent(REGISTER_DOCTYPE)}/${encodeURIComponent(id)}`,
      { headers: frappeAuthHeaders(), cache: "no-store" }
    );
    const body = await res.text();
    throw new Error(formatFrappeError(res.status, body, `Record ${id} not found`));
  }

  const title =
    pick(doc, NAME_FIELD) || pick(doc, NAME_AR_FIELD) || String(doc.name ?? id);

  const identityKeys = [NAME_FIELD, NAME_AR_FIELD, PASSPORT_FIELD, PHONE_FIELD, ID_FIELD].filter(
    Boolean
  );

  const identity: FieldItem[] = [
    { key: NAME_FIELD || "name", value: pick(doc, NAME_FIELD) || String(doc.name ?? "") },
  ];
  if (NAME_AR_FIELD) identity.push({ key: NAME_AR_FIELD, value: pick(doc, NAME_AR_FIELD) });
  identity.push(
    { key: PASSPORT_FIELD, value: pick(doc, PASSPORT_FIELD) },
    { key: PHONE_FIELD, value: pick(doc, PHONE_FIELD) },
    { key: ID_FIELD, value: pick(doc, ID_FIELD) }
  );

  const extra: FieldItem[] = [];
  for (const [key, value] of Object.entries(doc)) {
    if (SKIP.has(key) || key.startsWith("_") || identityKeys.includes(key)) continue;
    if (Array.isArray(value)) continue;
    const asText = text(value);
    if (!asText) continue;
    extra.push({ key, value: asText });
  }

  const children = extractChildRows(doc, id);
  const family: FamilyMemberView[] = children.map((row, index) => {
    const fields: FieldItem[] = [
      { key: FAMILY_NAME_FIELD || "name", value: pick(row, FAMILY_NAME_FIELD) },
      { key: FAMILY_PASSPORT_FIELD, value: pick(row, FAMILY_PASSPORT_FIELD) },
      { key: FAMILY_PHONE_FIELD, value: pick(row, FAMILY_PHONE_FIELD) },
      { key: FAMILY_ID_FIELD, value: pick(row, FAMILY_ID_FIELD) },
    ];
    for (const [key, value] of Object.entries(row)) {
      if (SKIP.has(key) || key.startsWith("_")) continue;
      if (fields.some((f) => f.key === key)) continue;
      const asText = text(value);
      if (!asText) continue;
      fields.push({ key, value: asText });
    }
    return {
      id: String(row.name ?? index + 1),
      fields,
    };
  });

  const slug = REGISTER_DOCTYPE.toLowerCase().replace(/\s+/g, "-");
  return {
    id: String(doc.name ?? id),
    title,
    identity,
    extra,
    family,
    url: `${frappeBaseUrl()}/app/${slug}/${encodeURIComponent(String(doc.name ?? id))}`,
  };
}

export function recordConfig() {
  return getFrappeConfig();
}
