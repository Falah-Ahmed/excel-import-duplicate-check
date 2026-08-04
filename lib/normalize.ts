/** Strip spaces/dashes and keep digits for phone comparisons */
export function normalizePhone(value?: string): string {
  if (!value) return "";
  let digits = value.replace(/\D/g, "");
  while (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}

export function normalizePassport(value?: string): string {
  if (!value) return "";
  return value.replace(/\s+/g, "").toUpperCase();
}

export function normalizeId(value?: string): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

/** Normalize Arabic letters for loose name matching */
export function normalizeArabic(value?: string): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

export function normalizeLatin(value?: string): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function namesMatch(a?: string, b?: string): boolean {
  const left = normalizeArabic(a) || normalizeLatin(a);
  const right = normalizeArabic(b) || normalizeLatin(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftParts = left.split(" ").filter(Boolean);
  const rightParts = right.split(" ").filter(Boolean);
  if (leftParts.length >= 2 && rightParts.length >= 2) {
    const overlap = leftParts.filter((p) => rightParts.includes(p)).length;
    if (overlap >= Math.min(leftParts.length, rightParts.length) - 1) return true;
  }
  return false;
}

export function displayValue(value?: string): string {
  return (value || "").trim() || "—";
}
