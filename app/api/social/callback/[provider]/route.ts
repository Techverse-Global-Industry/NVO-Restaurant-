import { NextRequest, NextResponse } from "next/server";
import { finishConnection } from "@/lib/social/accounts";
import { publicSite } from "@/lib/social/security";
export const runtime = "nodejs";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  let site: string;
  try {
    site = publicSite();
  } catch {
    return new Response("Social connection is not configured.", {
      status: 503,
    });
  }
  const url = new URL("/admin", site);
  try {
    if (
      !["meta", "tiktok"].includes(provider) ||
      req.nextUrl.searchParams.has("error")
    )
      throw new Error(
        "Connection was not completed. You can try again from Publish everywhere.",
      );
    const code = req.nextUrl.searchParams.get("code"),
      state = req.nextUrl.searchParams.get("state"),
      cookie = req.cookies.get("nvo_social_oauth")?.value;
    if (!code || !state || !cookie)
      throw new Error(
        "Connection expired. Start again from Publish everywhere.",
      );
    await finishConnection(state, cookie, provider as "meta" | "tiktok", code);
    url.searchParams.set("social", "choose");
  } catch {
    url.searchParams.set("social", "error");
  }
  const response = NextResponse.redirect(url);
  response.cookies.set("nvo_social_oauth", "", {
    path: "/api/social/callback",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
