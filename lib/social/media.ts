import sharp from "sharp";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, unlink, access } from "node:fs/promises";
import path from "node:path";
import { db, transaction } from "../db";
import { publicSite } from "./security";
export const mediaFolder = () =>
  path.resolve(
    /* turbopackIgnore: true */ process.env.SOCIAL_MEDIA_DIR ||
      "data/social-media",
  );
export async function prepareImage(source: string) {
  if (
    !/^\/(images|uploads)\/[a-zA-Z0-9._-]+$/.test(source) ||
    source.includes("..")
  )
    throw new Error("Choose a photo from the restaurant library.");
  const base = source.startsWith("/uploads/")
    ? path.resolve("data/uploads")
    : path.resolve("public/images");
  const bytes = await readFile(path.join(base, path.basename(source)));
  if (bytes.length > 8 * 1024 * 1024)
    throw new Error("The photo is too large for publishing.");
  const fingerprint = createHash("sha256")
    .update("nvo-social-jpeg-v1")
    .update(bytes)
    .digest("hex");
  const cached = db()
    .prepare(
      "SELECT m.id,m.file FROM social_media_cache c JOIN social_media m ON m.id=c.media_id WHERE c.fingerprint=? AND m.expires_at>?",
    )
    .get(fingerprint, Date.now() + 86400000) as
    { id: string; file: string } | undefined;
  if (
    cached &&
    /^[a-f0-9]{48}$/.test(cached.id) &&
    cached.file === `${cached.id}.jpg`
  ) {
    try {
      await access(path.join(mediaFolder(), cached.file));
      return `${publicSite()}/social-media/${cached.id}`;
    } catch {
      /* Rebuild a missing snapshot. */
    }
  }
  const image = await sharp(bytes, { limitInputPixels: 40000000 })
    .rotate()
    .flatten({ background: "#fffdf7" })
    .resize(1080, 1350, { fit: "contain", background: "#fffdf7" })
    .jpeg({ quality: 90 })
    .toBuffer();
  const id = randomBytes(24).toString("hex");
  await mkdir(mediaFolder(), { recursive: true });
  await writeFile(path.join(mediaFolder(), `${id}.jpg`), image);
  db()
    .prepare("INSERT INTO social_media VALUES(?,?,?)")
    .run(id, `${id}.jpg`, Date.now() + 7 * 86400000);
  db()
    .prepare("INSERT OR REPLACE INTO social_media_cache VALUES(?,?)")
    .run(fingerprint, id);
  return `${publicSite()}/social-media/${id}`;
}
export async function cleanExpiredMedia() {
  const expired = db()
    .prepare("SELECT id,file FROM social_media WHERE expires_at<? LIMIT 100")
    .all(Date.now()) as { id: string; file: string }[];
  for (const row of expired) {
    if (!/^[a-f0-9]{48}$/.test(row.id) || row.file !== `${row.id}.jpg`)
      continue;
    try {
      await unlink(path.join(mediaFolder(), row.file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") continue;
    }
    transaction(() => {
      db()
        .prepare("DELETE FROM social_media_cache WHERE media_id=?")
        .run(row.id);
      db().prepare("DELETE FROM social_media WHERE id=?").run(row.id);
    });
  }
}
