import type { NextRequest } from "next/server";
import { sessionCookieName, verifySession } from "@/lib/session";

export async function sessionFromRequest(request: NextRequest) {
  const cookieToken = request.cookies.get(sessionCookieName())?.value;
  if (cookieToken) {
    const fromCookie = await verifySession(cookieToken);
    if (fromCookie) return fromCookie;
  }

  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer) return verifySession(bearer);
  return null;
}
