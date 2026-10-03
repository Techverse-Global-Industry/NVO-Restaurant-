import sharp from "sharp";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, unlink, access } from "node:fs/promises";
import path from "node:path";
import { db, transaction } from "../db";
import { publicSite } from "./security";
import {
  deleteMedia,
  isUploadedMediaUrl,
  mediaExists,
  publicMediaUrl,
  storageReady,
  uploadMedia,
} from "../storage";
export const mediaFolder = () =>
  path.resolve(
    /* turbopackIgnore: true */ process.env.SOCIAL_MEDIA_DIR ||
      "data/social-media",
  );
const socialMediaUrl = (id: string) => `${publicSite()}/social-media/${id}`;
async function sourceBytes(source: string) {
  if (!storageReady()) {
    if (!/^\/(images|uploads)\/[a-zA-Z0-9._-]+$/.test(source) || source.includes(".."))
      throw new Error("Choose a photo from the restaurant library.");
    const base = source.startsWith("/uploads/")
      ? path.resolve("data/uploads")
      : path.resolve("public/images");
    return readFile(path.join(base, path.basename(source)));
  }
  const url = source.startsWith("/images/")
    ? new URL(source, publicSite()).toString()
    : isUploadedMediaUrl(source)
      ? source
      : null;
  if (!url) throw new Error("Choose a photo from the restaurant library.");
  const response = await fetch(url, {
    headers: { accept: "image/jpeg,image/png,image/webp" },
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  const size = Number(response.headers.get("content-length") || 0);
  if (!response.ok || (size && size > 8 * 1024 * 1024))
    throw new Error("The photo could not be prepared for publishing.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024)
    throw new Error("The photo is too large for publishing.");
  return bytes;
}
export async function prepareImage(source: string) {
  const bytes = await sourceBytes(source);
  if (bytes.length > 8 * 1024 * 1024)
    throw new Error("The photo is too large for publishing.");
  const fingerprint = createHash("sha256")
    .update("nvo-social-jpeg-v1")
    .update(bytes)
    .digest("hex");
  const cached = await db()
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
      if (storageReady()) {
        if (await mediaExists(`social/${cached.file}`))
          return socialMediaUrl(cached.id);
      } else {
        await access(path.join(mediaFolder(), cached.file));
        return socialMediaUrl(cached.id);
      }
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
  if (storageReady())
    await uploadMedia(`social/${id}.jpg`, image, "image/jpeg");
  else {
    await mkdir(mediaFolder(), { recursive: true });
    await writeFile(path.join(mediaFolder(), `${id}.jpg`), image);
  }
  await db()
    .prepare("INSERT INTO social_media VALUES(?,?,?)")
    .run(id, `${id}.jpg`, Date.now() + 7 * 86400000);
  await db()
    .prepare("INSERT OR REPLACE INTO social_media_cache VALUES(?,?)")
    .run(fingerprint, id);
  return socialMediaUrl(id);
}
export async function cleanExpiredMedia() {
  const expired = await db()
    .prepare("SELECT id,file FROM social_media WHERE expires_at<? LIMIT 100")
    .all(Date.now()) as { id: string; file: string }[];
  for (const row of expired) {
    if (!/^[a-f0-9]{48}$/.test(row.id) || row.file !== `${row.id}.jpg`)
      continue;
    try {
      if (storageReady()) await deleteMedia(publicMediaUrl(`social/${row.file}`));
      else await unlink(path.join(mediaFolder(), row.file));
    } catch (error) {
      if (!storageReady() && (error as NodeJS.ErrnoException).code === "ENOENT") {
        // A stale local file can be cleaned from the database.
      } else continue;
    }
    await transaction(async () => {
      await db()
        .prepare("DELETE FROM social_media_cache WHERE media_id=?")
        .run(row.id);
      await db().prepare("DELETE FROM social_media WHERE id=?").run(row.id);
    });
  }
}
