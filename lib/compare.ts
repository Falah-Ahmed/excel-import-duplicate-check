import type { CompareResult, CompareSummary, ExcelRow, RecordStatus } from "./types";
import type { SystemRecord } from "./frappe";
import { FAMILY_DOCTYPE } from "./frappe";
import {
  namesMatch,
  normalizeArabic,
  normalizeId,
  normalizeLatin,
  normalizePassport,
  normalizePhone,
} from "./normalize";

type IndexedRecord = SystemRecord & {
  nPassport: string;
  nPhone: string;
  nId: string;
  nNameEn: string;
  nNameAr: string;
};

function indexRecords(records: SystemRecord[]): IndexedRecord[] {
  return records.map((r) => ({
    ...r,
    nPassport: normalizePassport(r.passport),
    nPhone: normalizePhone(r.phone),
    nId: normalizeId(r.id_number),
    nNameEn: normalizeLatin(r.display_name),
    nNameAr: normalizeArabic(r.display_name),
  }));
}

function isInvalid(row: ExcelRow): boolean {
  const hasId =
    normalizePassport(row.passport) ||
    normalizePhone(row.phone) ||
    normalizeId(row.id_number);
  const hasName = Boolean((row.name || row.name_ar || "").trim());
  return !hasId || !hasName;
}

function findMatches(row: ExcelRow, records: IndexedRecord[]): {
  matches: IndexedRecord[];
  matchedBy: string[];
} {
  const nPassport = normalizePassport(row.passport);
  const nPhone = normalizePhone(row.phone);
  const nId = normalizeId(row.id_number);
  const nNameEn = normalizeLatin(row.name);
  const nNameAr = normalizeArabic(row.name_ar || row.name);

  const matched = new Map<string, IndexedRecord>();
  const matchedBy: string[] = [];

  function add(record: IndexedRecord, reason: string) {
    if (!matched.has(record.name)) matched.set(record.name, record);
    if (!matchedBy.includes(reason)) matchedBy.push(reason);
  }

  for (const record of records) {
    if (nPassport && record.nPassport && nPassport === record.nPassport) {
      add(record, "Passport");
    }
    if (nId && record.nId && nId === record.nId) {
      add(record, "ID");
    }
    if (nPhone && record.nPhone && nPhone === record.nPhone) {
      add(record, "Phone Number");
    }
    const nameHit =
      (nNameEn && namesMatch(nNameEn, record.nNameEn)) ||
      (nNameAr && namesMatch(nNameAr, record.nNameAr)) ||
      (row.name && namesMatch(row.name, record.display_name)) ||
      (row.name_ar && namesMatch(row.name_ar, record.display_name));
    if (nameHit) add(record, "Name");
  }

  return { matches: [...matched.values()], matchedBy };
}

function classify(row: ExcelRow, matches: IndexedRecord[], matchedBy: string[]): RecordStatus {
  if (isInvalid(row)) return "invalid";
  if (!matches.length) return "new";

  const nPassport = normalizePassport(row.passport);
  const nPhone = normalizePhone(row.phone);
  const nId = normalizeId(row.id_number);

  for (const record of matches) {
    const passportHit = Boolean(nPassport && record.nPassport && nPassport === record.nPassport);
    const idHit = Boolean(nId && record.nId && nId === record.nId);
    const phoneHit = Boolean(nPhone && record.nPhone && nPhone === record.nPhone);
    const strongHits = [passportHit, idHit, phoneHit].filter(Boolean).length;

    if (strongHits >= 2) return "exact_duplicate";
    if (passportHit && idHit) return "exact_duplicate";
  }

  if (matchedBy.includes("Passport") && matchedBy.includes("ID")) return "exact_duplicate";
  if (matchedBy.filter((m) => m !== "Name").length >= 2) return "exact_duplicate";

  return "possible_duplicate";
}

export function compareRows(rows: ExcelRow[], systemRecords: SystemRecord[]): {
  results: CompareResult[];
  summary: CompareSummary;
} {
  const indexed = indexRecords(systemRecords);
  const results: CompareResult[] = rows.map((row) => {
    if (isInvalid(row)) {
      return {
        row: row.row,
        name: row.name || row.name_ar || "—",
        passport: row.passport || "—",
        phone: row.phone || "—",
        id_number: row.id_number || "—",
        status: "invalid",
        matched_by: "—",
        existing_record: "—",
      };
    }

    const { matches, matchedBy } = findMatches(row, indexed);
    const status = classify(row, matches, matchedBy);
    const primary =
      matches.find((m) => m.source === FAMILY_DOCTYPE || Boolean(m.parent)) || matches[0];

    return {
      row: row.row,
      name: row.name || row.name_ar || "—",
      passport: row.passport || "—",
      phone: row.phone || "—",
      id_number: row.id_number || "—",
      status,
      matched_by: matchedBy.length ? matchedBy.join(" + ") : "—",
      existing_record: primary?.display_name || "—",
      existing_id: primary?.name,
      existing_url: primary?.url,
      existing_source: primary?.source,
      existing_parent: primary?.parent,
    };
  });

  const summary: CompareSummary = {
    total: results.length,
    exact_duplicates: results.filter((r) => r.status === "exact_duplicate").length,
    possible_duplicates: results.filter((r) => r.status === "possible_duplicate").length,
    new_records: results.filter((r) => r.status === "new").length,
    invalid_records: results.filter((r) => r.status === "invalid").length,
  };

  return { results, summary };
}

export function demoSystemRecords(): SystemRecord[] {
  return [
    {
      name: "REG-00001",
      passport: "P458221",
      phone: "+966 50 123 4567",
      id_number: "1029384756",
      display_name: "Ahmed Ali",
      url: "#",
      source: "Registered People",
    },
    {
      name: "REG-00002",
      passport: "P991002",
      phone: "+966 55 888 2211",
      id_number: "8877665544",
      display_name: "Sara Hassan",
      url: "#",
      source: "Registered People",
    },
    {
      name: "FAM-00001",
      passport: "P112233",
      phone: "+966 54 000 7788",
      id_number: "5566778899",
      display_name: "محمد عبدالله (Family of REG-00002)",
      url: "#",
      source: "Family Member",
      parent: "REG-00002",
    },
  ];
}

export function demoCompare(rows: ExcelRow[]) {
  return compareRows(rows, demoSystemRecords());
}
