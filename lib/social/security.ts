import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
export const sha = (v: string) => createHash("sha256").update(v).digest("hex");
function key() {
  const value = Buffer.from(process.env.SOCIAL_TOKEN_KEY || "", "base64");
  if (value.length !== 32)
    throw new Error(
      "Social account protection is not configured. Ask the owner to finish setup.",
    );
  return value;
}
export function seal(value: string, context: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function unseal(value: string, context: string) {
  try {
    const [iv, tag, data] = value
      .split(".")
      .map((v) => Buffer.from(v, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw new Error("This account needs to be reconnected before publishing.");
  }
}
export function publicSite() {
  try {
    const u = new URL(process.env.SITE_URL || "");
    const host = u.hostname.toLowerCase();
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      u.pathname !== "/" ||
      u.search ||
      u.hash ||
      !host.includes(".") ||
      host.endsWith(".local") ||
      host.endsWith(".localhost") ||
      host === "localhost" ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      host.includes(":")
    )
      throw 0;
    return u.origin;
  } catch {
    throw new Error(
      "Connect a public HTTPS website before connecting social accounts.",
    );
  }
}
export function metaVersion() {
  const value = process.env.META_API_VERSION || "";
  if (!/^v\d{2}\.0$/.test(value))
    throw new Error("Meta app setup needs an API version.");
  return value;
}
export function connectionReadiness() {
  const reasons: string[] = [];
  try {
    publicSite();
  } catch (e) {
    reasons.push((e as Error).message);
  }
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET)
    reasons.push("The owner's Meta app has not been configured.");
  try {
    key();
  } catch {
    reasons.push("Social account protection has not been configured.");
  }
  try {
    metaVersion();
  } catch {
    reasons.push("Choose the Meta API version in server setup.");
  }
  return { ready: !reasons.length, reasons };
}
