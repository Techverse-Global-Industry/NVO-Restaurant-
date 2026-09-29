import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const french = url.pathname === "/fr" || url.pathname.startsWith("/fr/");
  const englishAlias =
    url.pathname === "/en" || url.pathname.startsWith("/en/");
  const path =
    french || englishAlias ? url.pathname.slice(3) || "/" : url.pathname;
  if (englishAlias || path === "/promotions") {
    url.pathname =
      (french ? "/fr" : "") + (path === "/promotions" ? "/offers" : path);
    return NextResponse.redirect(
      new URL(url.pathname + url.search, process.env.SITE_URL || request.url),
      308,
    );
  }
  // Localised aliases are for public pages only, never API/authentication routes.
  if (
    french &&
    /^\/(admin|api|_next|images|uploads|videos|fonts|social-media)(\/|$)/.test(
      path,
    )
  ) {
    url.pathname = path;
    return NextResponse.redirect(
      new URL(url.pathname + url.search, process.env.SITE_URL || request.url),
      308,
    );
  }
  const headers = new Headers(request.headers);
  headers.set("x-nvo-language", french ? "fr" : "en");
  if (french) {
    url.pathname = path;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/((?!api/|_next/|images/|uploads/|videos/|fonts/|social-media/|favicon.ico|opengraph-image|robots.txt|sitemap.xml).*)",
  ],
};
