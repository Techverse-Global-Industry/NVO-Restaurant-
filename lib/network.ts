import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { db } from "./db";
export async function networkHash(headers: Headers): Promise<string> {
  const ip = headers.get("x-nvo-client-ip") || "";
  const signature = headers.get("x-nvo-ip-signature") || "";
  const key = process.env.NVO_INTERNAL_IP_KEY;
  if (!key || !isIP(ip) || !/^[a-f0-9]{64}$/.test(signature))
    throw new Error(
      "Coupon claims are temporarily unavailable. Please ask NVO to check the website connection.",
    );
  const expected = createHmac("sha256", key).update(ip).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
    throw new Error("Invalid network verification.");
  await db()
    .prepare("INSERT OR IGNORE INTO security_config VALUES('coupon_ip_key',?)")
    .run(randomBytes(32).toString("hex"));
  const secret = await db()
    .prepare("SELECT value FROM security_config WHERE key='coupon_ip_key'")
    .get() as { value: string };
  return createHmac("sha256", secret.value).update(ip).digest("hex");
}
