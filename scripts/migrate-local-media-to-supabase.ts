import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, entries, transaction } from "../lib/db";
import { uploadMedia } from "../lib/storage";

if (!process.env.NVO_DATABASE_URL)
  throw new Error("Set NVO_DATABASE_URL to Supabase's Transaction pooler before migrating media.");

const mime = (name: string) =>
  name.endsWith(".jpg") ? "image/jpeg" : name.endsWith(".png") ? "image/png" : "image/webp";
const rows = await db()
  .prepare("SELECT id,url FROM media WHERE url LIKE '/uploads/%'")
  .all<{ id: string; url: string }>();
let moved = 0;

for (const row of rows) {
  const file = row.url.slice("/uploads/".length);
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(file))
    throw new Error(`Invalid legacy upload path for media ${row.id}.`);
  const bytes = await readFile(path.resolve("data/uploads", file));
  if (bytes.length > 8 * 1024 * 1024)
    throw new Error(`Legacy upload ${file} is larger than 8 MB.`);
  const url = await uploadMedia(`uploads/${file}`, bytes, mime(file));
  await transaction(async () => {
    await db().prepare("UPDATE media SET url=? WHERE id=?").run(url, row.id);
    for (const current of await entries()) {
      if (current.image === row.url)
        await db()
          .prepare("UPDATE entries SET data=? WHERE id=?")
          .run(JSON.stringify({ ...current, image: url }), current.id);
    }
  });
  moved += 1;
}

console.log(`Migrated ${moved} uploaded image${moved === 1 ? "" : "s"} to Supabase Storage.`);
