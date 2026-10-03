const bucket = process.env.NVO_MEDIA_BUCKET || "nvo-media";

function origin() {
  const value = process.env.NVO_SUPABASE_URL?.trim();
  if (!value) throw new Error("Supabase Storage is not configured. Add NVO_SUPABASE_URL in Netlify.");
  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co"))
    throw new Error("NVO_SUPABASE_URL must be your HTTPS Supabase project URL.");
  return url.origin;
}
function secret() {
  const value = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value)
    throw new Error("Supabase Storage is not configured. Add SUPABASE_SECRET_KEY in Netlify.");
  return value;
}
function safeKey(key: string) {
  if (!/^(uploads\/[a-f0-9-]+\.(?:jpg|png|webp)|social\/[a-f0-9]{48}\.jpg)$/.test(key))
    throw new Error("Invalid media storage path.");
  return key;
}
function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}
export function storageReady() {
  return Boolean(process.env.NVO_SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}
export function publicMediaUrl(key: string) {
  return `${origin()}/storage/v1/object/public/${bucket}/${encodeKey(safeKey(key))}`;
}
export function storageKeyForUrl(url: string) {
  try {
    const parsed = new URL(url);
    const prefix = `/storage/v1/object/public/${bucket}/`;
    if (parsed.origin !== origin() || !parsed.pathname.startsWith(prefix)) return null;
    const key = decodeURIComponent(parsed.pathname.slice(prefix.length));
    return safeKey(key);
  } catch {
    return null;
  }
}
export function isUploadedMediaUrl(url: string) {
  const key = storageKeyForUrl(url);
  return !!key?.startsWith("uploads/");
}
async function storageRequest(key: string, init: RequestInit) {
  const token = secret();
  const response = await fetch(
    `${origin()}/storage/v1/object/${bucket}/${encodeKey(safeKey(key))}`,
    {
      ...init,
      headers: {
        apikey: token,
        authorization: `Bearer ${token}`,
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    },
  );
  if (!response.ok) throw new Error("Supabase Storage could not save this image.");
}
export async function uploadMedia(key: string, bytes: Uint8Array, contentType: string) {
  await storageRequest(key, {
    method: "POST",
    body: bytes as unknown as BodyInit,
    headers: { "content-type": contentType, "cache-control": "public, max-age=31536000", "x-upsert": "false" },
  });
  return publicMediaUrl(key);
}
export async function deleteMedia(url: string) {
  const key = storageKeyForUrl(url);
  if (!key) throw new Error("Invalid media storage path.");
  await storageRequest(key, { method: "DELETE" });
}
export async function mediaExists(key: string) {
  const response = await fetch(publicMediaUrl(key), {
    method: "HEAD",
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  return response.ok;
}

// Social providers, especially TikTok PULL_FROM_URL, need an NVO-owned URL
// that returns the image directly rather than redirecting to Supabase Storage.
export async function fetchPublicMedia(key: string) {
  const response = await fetch(publicMediaUrl(key), {
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  if (!response.ok || !response.body)
    throw new Error("Supabase Storage could not read this image.");
  return response;
}
