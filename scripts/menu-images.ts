import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";
import { menuPhotos } from "../lib/menu-photos";

async function main() {
  await mkdir("artifacts/menu-source", { recursive: true });
  for (const photo of menuPhotos) {
    if (existsSync(`public${photo.image}`)) continue;
    const hash = createHash("md5").update(photo.file).digest("hex");
    const url = `https://upload.wikimedia.org/wikipedia/commons/${hash[0]}/${hash.slice(0, 2)}/${encodeURIComponent(photo.file)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "NVORestaurantMenu/1.0 (licensed menu illustration download)",
      },
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok)
      throw new Error(
        `Photo download failed: ${photo.file}, HTTP ${response.status}`,
      );
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(`artifacts/menu-source/${photo.file}`, bytes);
    const result = await sharp(bytes)
      .rotate()
      .resize({
        width: 1000,
        height: 1000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toFile(`public${photo.image}`);
    console.log(`${photo.image}: ${result.size} bytes; ${photo.license}`);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
