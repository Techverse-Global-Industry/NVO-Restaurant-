import { db } from "../lib/db";
import { showcaseEntries } from "../lib/showcase";
const connection = db();
connection.exec("BEGIN IMMEDIATE");
try {
  const existing = connection
    .prepare("SELECT version FROM migrations WHERE version=2")
    .get();
  if (!existing) {
    const insert = connection.prepare(
      "INSERT OR IGNORE INTO entries VALUES(?,?,?)",
    );
    for (const e of showcaseEntries)
      insert.run(e.id, e.kind, JSON.stringify(e));
    const row = connection
      .prepare("SELECT data FROM settings WHERE id=1")
      .get() as { data: string };
    connection
      .prepare("UPDATE settings SET data=? WHERE id=1")
      .run(JSON.stringify({ ...JSON.parse(row.data), previewContent: true }));
    connection
      .prepare("INSERT INTO migrations VALUES(2,datetime('now'))")
      .run();
  }
  connection.exec("COMMIT");
  console.log(
    "Sample editorial pack installed. Existing restaurant content preserved.",
  );
} catch (e) {
  connection.exec("ROLLBACK");
  throw e;
}
