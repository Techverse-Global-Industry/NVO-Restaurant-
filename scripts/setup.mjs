import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env.local")) {
  console.log("Existing .env.local preserved.");
} else {
  const password = randomBytes(18).toString("base64url");
  writeFileSync(
    ".env.local",
    `NVO_DB_PATH=data/nvo.sqlite\nADMIN_EMAIL=owner@nvo.local\nADMIN_PASSWORD=${password}\nSECURE_COOKIES=false\nSITE_URL=http://localhost:3000\n`,
    { mode: 0o600 },
  );
  mkdirSync("private", { recursive: true });
  writeFileSync(
    "private/LOCAL-ADMIN.txt",
    `NVO local development login\n\nAddress: http://localhost:3000/admin\nEmail: owner@nvo.local\nPassword: ${password}\n\nKeep this file private. Do not upload it or share screenshots of it.\nThis account is created when the database is first initialized.\n`,
    { mode: 0o600 },
  );
  console.log("Private local login created in private/LOCAL-ADMIN.txt.");
}
