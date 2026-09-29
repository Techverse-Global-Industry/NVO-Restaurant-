import { createServer } from "node:http";
import { randomBytes, createHmac } from "node:crypto";
import { isIP } from "node:net";
import next from "next";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const dev = process.argv.includes("--dev");
const portFlag = process.argv.findIndex((v) => v === "--port" || v === "-p");
const port = Number(
  portFlag >= 0 ? process.argv[portFlag + 1] : process.env.PORT || 3000,
);
const hostname = process.env.HOSTNAME_BIND || "127.0.0.1";
// A fresh internal key prevents clients from spoofing the verified socket address.
process.env.NVO_INTERNAL_IP_KEY = randomBytes(32).toString("hex");
const normalize = (ip) => (ip?.startsWith("::ffff:") ? ip.slice(7) : ip);
const trusted = (process.env.TRUSTED_PROXY_IPS || "")
  .split(",")
  .map((v) => normalize(v.trim()))
  .filter(Boolean);
// NextURL normalises loopback IPs to localhost. Use the same internal origin
// so language rewrites stay inside Next instead of making a second HTTP request.
const nextHostname = ["127.0.0.1", "::1"].includes(hostname)
  ? "localhost"
  : hostname;
const app = next({ dev, hostname: nextHostname, port });
await app.prepare();
const handle = app.getRequestHandler();
createServer((req, res) => {
  let ip = normalize(req.socket.remoteAddress);
  if (trusted.includes(ip)) {
    // Configure the proxy to overwrite this single-valued header; never accept arbitrary X-Forwarded-For.
    const forwarded =
      req.headers[(process.env.TRUSTED_IP_HEADER || "x-real-ip").toLowerCase()];
    if (typeof forwarded === "string" && isIP(forwarded.trim()))
      ip = normalize(forwarded.trim());
    else ip = undefined;
  }
  delete req.headers["x-nvo-client-ip"];
  delete req.headers["x-nvo-ip-signature"];
  if (ip && isIP(ip)) {
    req.headers["x-nvo-client-ip"] = ip;
    req.headers["x-nvo-ip-signature"] = createHmac(
      "sha256",
      process.env.NVO_INTERNAL_IP_KEY,
    )
      .update(ip)
      .digest("hex");
  }
  handle(req, res);
}).listen(port, hostname, () =>
  console.log(`NVO ready at http://${hostname}:${port}`),
);
