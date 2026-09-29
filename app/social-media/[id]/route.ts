import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { mediaFolder } from "@/lib/social/media";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9]{48}$/.test(id)) return new Response(null, { status: 404 });
  const row = db()
    .prepare("SELECT file FROM social_media WHERE id=? AND expires_at>?")
    .get(id, Date.now()) as { file: string } | undefined;
  if (!row || row.file !== `${id}.jpg`)
    return new Response(null, { status: 404 });
  try {
    return new Response(await readFile(path.join(mediaFolder(), row.file)), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
