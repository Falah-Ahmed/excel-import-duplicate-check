const COOKIE = "nfp_hr_attendance";
const MAX_AGE_SEC = 60 * 60 * 8;

export type SessionPayload = {
  user: string;
  full_name?: string;
  via: "sso";
  exp: number;
};

function secret() {
  return (process.env.AUTH_SECRET || "").trim();
}

export function allowedRoles(): string[] {
  return (process.env.AUTH_ALLOWED_ROLES || "HR Manager,HR User,System Manager,Administrator")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function authConfigured(): boolean {
  return Boolean(secret());
}

export function sessionCookieName() {
  return COOKIE;
}

function b64urlFromBytes(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlFromString(input: string) {
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function stringFromB64url(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return decodeURIComponent(escape(atob(b64)));
}

async function hmacSign(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64urlFromBytes(sig);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function signSession(payload: { user: string; full_name?: string }) {
  const body: SessionPayload = {
    user: payload.user,
    full_name: payload.full_name,
    via: "sso",
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  };
  const data = b64urlFromString(JSON.stringify(body));
  const sig = await hmacSign(data);
  return `${data}.${sig}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token || !secret()) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = await hmacSign(data);
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(stringFromB64url(data)) as SessionPayload;
    if (!payload.user || payload.via !== "sso") return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    path: "/",
    maxAge: MAX_AGE_SEC,
    partitioned: true,
  };
}
