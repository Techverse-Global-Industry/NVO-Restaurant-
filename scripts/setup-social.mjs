import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
const file = ".env.local";
if (!existsSync(file)) {
  console.error("Run npm run setup first.");
  process.exit(1);
}
let text = readFileSync(file, "utf8");
for (const name of ["SOCIAL_TOKEN_KEY", "WHATSAPP_WEBHOOK_VERIFY_TOKEN"]) {
  if (!new RegExp(`^${name}=.+$`, "m").test(text)) {
    text = text.replace(new RegExp(`^${name}=.*(?:\\r?\\n|$)`, "m"), "");
    text += `\n${name}=${randomBytes(32).toString(name === "SOCIAL_TOKEN_KEY" ? "base64" : "hex")}\n`;
  }
}
writeFileSync(file, text, { mode: 0o600 });
console.log(
  "Social encryption and webhook verification keys are ready in .env.local. Keep this file private and back it up securely.",
);
