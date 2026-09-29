import { readFile } from "node:fs/promises";
import path from "node:path";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(file))
    return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(
      path.join(process.cwd(), "data/uploads", file),
    );
    return new Response(bytes, {
      headers: {
        "Content-Type": file.endsWith(".png")
          ? "image/png"
          : file.endsWith(".webp")
            ? "image/webp"
            : "image/jpeg",
        "Cache-Control": "public,max-age=31536000,immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
