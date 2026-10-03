import { db } from "@/lib/db";
import { isUploadedMediaUrl } from "@/lib/storage";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(file))
    return new Response("Not found", { status: 404 });
  const row = await db()
    .prepare("SELECT url FROM media WHERE url LIKE ?")
    .get<{ url: string }>(`%/uploads/${file}`);
  if (!row || !isUploadedMediaUrl(row.url))
    return new Response("Not found", { status: 404 });
  return Response.redirect(row.url, 302);
}
