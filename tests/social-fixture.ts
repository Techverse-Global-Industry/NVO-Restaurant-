import { db } from "../lib/db";
import { seal } from "../lib/social/security";
if (!process.env.NVO_DB_PATH?.includes("social-browser-"))
  throw new Error("Use a dedicated social-browser test database.");
const now = new Date().toISOString();
for (const p of ["facebook", "instagram", "tiktok", "whatsapp"]) {
  db()
    .prepare(
      "INSERT OR IGNORE INTO social_accounts VALUES(?,?,?,?,?,?,'connected',?,?,?)",
    )
    .run(
      `test-${p}`,
      p,
      `fixture-${p}`,
      `NVO test ${p}`,
      seal("fixture-only-not-a-real-credential", `test-${p}`),
      Date.now() + 86400000,
      p === "tiktok" ? 0 : 1,
      now,
      now,
    );
}
db()
  .prepare("INSERT OR REPLACE INTO social_config VALUES('whatsapp',?)")
  .run(
    JSON.stringify({
      phone: "22950924184",
      templates: {
        fr: { name: "fixture_fr", language: "fr" },
        en: { name: "fixture_en", language: "en" },
      },
    }),
  );
db()
  .prepare(
    "INSERT OR REPLACE INTO whatsapp_subscribers VALUES('22912345678','Test subscriber','subscribed',?,?,?,?)",
  )
  .run(now, now, "fixture", Math.floor(Date.now() / 1000));
console.log(
  "Created isolated publishing test fixtures. No real credentials or social requests.",
);
