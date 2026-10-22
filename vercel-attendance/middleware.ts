import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { accessDeniedResponse } from "@/lib/access-denied";
import { previewMode } from "@/lib/preview";
import { sessionFromRequest } from "@/lib/request-session";

function frameAncestors() {
  return (process.env.FRAME_ANCESTORS || "https://v3.the-nfp.org").trim();
}

function withSecurity(response: NextResponse) {
  response.headers.set("Content-Security-Policy", `frame-ancestors ${frameAncestors()}`);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Cache-Control", "no-store");
  response.headers.delete("X-Frame-Options");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return withSecurity(NextResponse.next());
  }

  if (pathname === "/sso" || pathname === "/api/auth/sso") {
    return withSecurity(NextResponse.next());
  }

  if (previewMode() && (pathname === "/" || pathname === "/api/summary" || pathname === "/api/export")) {
    return withSecurity(NextResponse.next());
  }

  const session = await sessionFromRequest(request);
  if (session) return withSecurity(NextResponse.next());

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  return accessDeniedResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
