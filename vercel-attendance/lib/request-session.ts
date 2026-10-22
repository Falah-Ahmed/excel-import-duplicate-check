import type { NextRequest } from "next/server";
import { sessionCookieName, verifySession } from "@/lib/session";

export async function sessionFromRequest(request: NextRequest) {
  const cookieToken = request.cookies.get(sessionCookieName())?.value;
  if (!cookieToken) return null;
  return verifySession(cookieToken);
}
