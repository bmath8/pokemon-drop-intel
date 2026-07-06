import { NextRequest, NextResponse } from "next/server";

const CODE = process.env.SITE_PASSWORD || "brian2026";
const COOKIE_NAME = "bm_access";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};

// Recruiter-friendly gate (2026-07-06): the portfolio links here with ?code=,
// which sets a cookie and clean-redirects - no second password popup in the
// resume->portfolio->demo chain. Direct visitors get a branded code page.
export function middleware(req: NextRequest) {
  if (req.cookies.get(COOKIE_NAME)?.value === "granted") return NextResponse.next();

  const url = req.nextUrl.clone();
  if (url.searchParams.get("code") === CODE) {
    url.searchParams.delete("code");
    const res = NextResponse.redirect(url, 302);
    res.cookies.set(COOKIE_NAME, "granted", { path: "/", maxAge: 2592000, sameSite: "lax" });
    return res;
  }

  const page = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Pokemon Drop Intel - private preview</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=JetBrains+Mono&display=swap" rel="stylesheet">
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0c0e;color:#ece9e2;font-family:"JetBrains Mono",monospace}
.card{text-align:center;padding:40px;max-width:420px}h1{font-family:"Instrument Serif",serif;font-weight:400;font-size:2rem;margin:0 0 8px}
h1 i{color:#c6f432}p{color:#9aa0aa;font-size:.85rem;line-height:1.6;margin:0 0 26px}
input{background:#111317;border:1px solid #23262d;color:#ece9e2;font-family:inherit;font-size:1rem;padding:13px 16px;border-radius:3px;width:200px;text-align:center;letter-spacing:.1em}
input:focus{outline:none;border-color:#c6f432}button{background:#c6f432;color:#0b0c0e;border:none;font-family:inherit;font-size:.85rem;font-weight:500;padding:14px 20px;border-radius:3px;cursor:pointer;margin-left:8px}
button:hover{opacity:.85}</style></head><body><div class="card">
<h1>Pokemon Drop <i>Intel</i></h1>
<p>Private demo by Brian Mathew. Enter the access code from his resume or portfolio.</p>
<form onsubmit="location.href='/?code='+encodeURIComponent(document.getElementById('c').value);return false">
<input id="c" placeholder="access code" autofocus autocomplete="off"><button>Enter →</button></form>
</div></body></html>`;
  return new NextResponse(page, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
