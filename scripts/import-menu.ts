import { mkdirSync, writeFileSync } from "node:fs";
import { DatabaseSync, backup } from "node:sqlite";
import path from "node:path";
import { planMenuImport } from "../lib/menu-import";
import { currentMenu, menuSource } from "../lib/current-menu";
import type { Entry } from "../lib/types";

async function main() {
  const database = process.env.NVO_DB_PATH || "data/nvo.sqlite";
  const db = new DatabaseSync(database, { readOnly: true });
  const existing = db
    .prepare("SELECT data FROM entries")
    .all()
    .map((row) => JSON.parse(String(row.data)) as Entry);
  const protectedIds = db
    .prepare("SELECT terms FROM rewards WHERE status IN ('claimed','held')")
    .all()
    .map((row) => (JSON.parse(String(row.terms)) as Entry).rewardItem)
    .filter((id): id is string => !!id);
  const plan = planMenuImport(existing, protectedIds);
  console.log(
    JSON.stringify(
      {
        source: menuSource,
        dishes: currentMenu.filter((e) => e.kind === "meals").length,
        categories: currentMenu.filter((e) => e.kind === "categories").length,
        changes: plan.write.length,
        preservedStaffEdits: plan.preserved,
        unchanged: plan.unchanged.length,
        apply: process.argv.includes("--apply"),
      },
      null,
      2,
    ),
  );
  if (!process.argv.includes("--apply") || !plan.write.length) {
    db.close();
    return;
  }
  const base = process.env.MENU_IMPORT_BASE_URL || "http://127.0.0.1:3000";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base))
    throw new Error("Use this import on the local application only.");
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)
    throw new Error(
      "Local staff credentials are required; load .env.local without printing its values.",
    );
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync("data/backups", { recursive: true });
  const destination = path.resolve(`data/backups/menu-${stamp}.sqlite`);
  await backup(db, destination);
  db.close();
  const login = await fetch(`${base}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }),
  });
  if (!login.ok)
    throw new Error(
      `Staff login failed (${login.status}). No menu records changed.`,
    );
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Staff login returned no session.");
  const changes: string[] = [];
  for (const item of plan.write) {
    const response = await fetch(`${base}/api/admin/entry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: base,
        Cookie: cookie,
      },
      body: JSON.stringify(item),
    });
    if (!response.ok)
      throw new Error(
        `Import stopped at ${item.id} (HTTP ${response.status}). Backup: ${destination}`,
      );
    changes.push(item.id);
  }
  await fetch(`${base}/api/admin/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      Cookie: cookie,
    },
    body: "{}",
  });
  writeFileSync(
    `data/backups/menu-${stamp}.json`,
    JSON.stringify(
      {
        source: menuSource,
        changed: changes,
        preserved: plan.preserved,
        backup: destination,
      },
      null,
      2,
    ),
  );
  console.log(
    `Imported ${changes.length} menu/category changes through the staff API. Backup: ${destination}`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
