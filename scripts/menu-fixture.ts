import { existsSync } from "node:fs";
import { db, settings } from "../lib/db";
const file = process.env.NVO_DB_PATH || "";
if (
  !/^data[\\/]menu-seo-[a-zA-Z0-9_-]+\.sqlite$/.test(file) ||
  existsSync(file)
)
  throw new Error("Choose a NEW data/menu-seo-*.sqlite test database.");
db()
  .prepare("UPDATE settings SET data=? WHERE id=1")
  .run(
    JSON.stringify({ ...settings(), previewContent: false, showPrices: true }),
  );
console.log(`Created isolated menu/SEO test database: ${file}`);
