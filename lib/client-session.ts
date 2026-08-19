import { sessionCookieName } from "@/lib/session";

export function getClientSessionToken() {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(sessionCookieName()) || "";
  } catch {
    return "";
  }
}

export function setClientSessionToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(sessionCookieName(), token);
  } catch {
    // ignore
  }
}

export function clearClientSessionToken() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(sessionCookieName());
  } catch {
    // ignore
  }
}

export function bootSessionFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const token = (params.get("t") || "").trim();
    if (!token) return;
    setClientSessionToken(token);
    params.delete("t");
    const qs = params.toString();
    const next = window.location.pathname + (qs ? `?${qs}` : "");
    window.history.replaceState({}, "", next);
  } catch {
    // ignore
  }
}

export function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = getClientSessionToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers, credentials: "include" });
}
