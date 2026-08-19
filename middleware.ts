import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { accessDeniedResponse } from "@/lib/access-denied";
import { sessionCookieName, ssoOnly, verifySession } from "@/lib/session";

const PUBLIC = ["/login", "/api/auth/login", "/api/auth/sso"];

function withFrameHeaders(response: NextResponse) {
  response.headers.set("Content-Security-Policy", "frame-ancestors *");
  response.headers.delete("X-Frame-Options");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if ((process.env.AUTH_DISABLED || "").trim() === "1") {
    return withFrameHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return withFrameHeaders(NextResponse.next());
  }

  if (ssoOnly()) {
    if (pathname === "/api/auth/sso" || pathname.startsWith("/api/auth/sso/")) {
      return withFrameHeaders(NextResponse.next());
    }

    const token = request.cookies.get(sessionCookieName())?.value;
    const session = await verifySession(token);
    if (session) return withFrameHeaders(NextResponse.next());

    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    return accessDeniedResponse();
  }

  const response = withFrameHeaders(NextResponse.next());

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return response;
  }

  const token = request.cookies.get(sessionCookieName())?.value;
  const session = await verifySession(token);
  if (session) return response;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
