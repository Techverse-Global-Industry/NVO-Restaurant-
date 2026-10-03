declare const Netlify: {
  env: { get(name: string): string | undefined };
};
type EdgeContext = {
  ip: string;
  next(request?: Request): Promise<Response>;
};

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

// The App Router cannot safely trust a client-supplied forwarding header.
// Netlify supplies context.ip at the edge, then this function signs it for the
// origin handler and overwrites any spoofed header values.
export default async function signClientIp(request: Request, context: EdgeContext) {
  const key = Netlify.env.get("NVO_INTERNAL_IP_KEY");
  if (!key || !context.ip) return context.next();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = hex(
    await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(context.ip)),
  );
  const headers = new Headers(request.headers);
  headers.set("x-nvo-client-ip", context.ip);
  headers.set("x-nvo-ip-signature", signature);
  return context.next(new Request(request, { headers }));
}

export const config = { path: "/api/*" };
