import { NextRequest, NextResponse } from "next/server";

const PASSWORD = process.env.SITE_PASSWORD || "brian2026";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};

export function middleware(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const pwd = decoded.slice(decoded.indexOf(":") + 1);
      if (pwd === PASSWORD) return NextResponse.next();
    } catch (e) {}
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Private preview", charset="UTF-8"' },
  });
}