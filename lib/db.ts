import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { initialEntries, initialSettings } from "./seed";
import type { Entry, Settings } from "./types";

const globalDb = globalThis as unknown as { nvoDb?: DatabaseSync };
export function db() {
  if (globalDb.nvoDb) return globalDb.nvoDb;
  const file = process.env.NVO_DB_PATH || "data/nvo.sqlite";
  if (file !== ":memory:")
    mkdirSync(path.dirname(path.resolve(/* turbopackIgnore: true */ file)), {
      recursive: true,
    });
  const connection = new DatabaseSync(file);
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS entries(id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS entries_kind ON entries(kind);
    CREATE TABLE IF NOT EXISTS staff(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, staff_id TEXT NOT NULL REFERENCES staff(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, request_key TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS reservations(id TEXT PRIMARY KEY, data TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS analytics(id TEXT PRIMARY KEY, visitor TEXT NOT NULL, event TEXT NOT NULL, page TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS analytics_date ON analytics(created_at);
    CREATE TABLE IF NOT EXISTS referrals(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS referral_visits(referral_id TEXT NOT NULL REFERENCES referrals(id), customer_id TEXT NOT NULL, opened_at TEXT NOT NULL, PRIMARY KEY(referral_id,customer_id));
    CREATE TABLE IF NOT EXISTS rewards(id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, customer_id TEXT NOT NULL, campaign_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, claimed_at TEXT NOT NULL, active_at TEXT NOT NULL, expires_at TEXT NOT NULL, terms TEXT NOT NULL, order_id TEXT, referral_id TEXT);
    CREATE INDEX IF NOT EXISTS rewards_customer ON rewards(customer_id,campaign_id);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS social_accounts(id TEXT PRIMARY KEY, platform TEXT NOT NULL, remote_id TEXT NOT NULL, name TEXT NOT NULL, token TEXT NOT NULL, expires_at INTEGER, status TEXT NOT NULL, auto_publish INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(platform,remote_id));
    CREATE TABLE IF NOT EXISTS social_oauth(state TEXT PRIMARY KEY, cookie_hash TEXT NOT NULL, staff_id TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0, candidates TEXT);
    CREATE TABLE IF NOT EXISTS social_plans(entry_id TEXT PRIMARY KEY REFERENCES entries(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS social_jobs(id TEXT PRIMARY KEY, entry_id TEXT NOT NULL REFERENCES entries(id), account_id TEXT NOT NULL REFERENCES social_accounts(id), revision TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL, lease_until INTEGER, lease_owner TEXT, container_id TEXT, media_url TEXT, provider_id TEXT, permalink TEXT, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(entry_id,account_id));
    CREATE INDEX IF NOT EXISTS social_jobs_due ON social_jobs(status,next_attempt);
    CREATE TABLE IF NOT EXISTS social_attempts(id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES social_jobs(id), outcome TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS social_caption_cache(id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS social_media(id TEXT PRIMARY KEY, file TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS social_media_cache(fingerprint TEXT PRIMARY KEY,media_id TEXT NOT NULL REFERENCES social_media(id));
    CREATE TABLE IF NOT EXISTS social_worker(id INTEGER PRIMARY KEY CHECK(id=1), heartbeat INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS whatsapp_subscribers(phone TEXT PRIMARY KEY,name TEXT NOT NULL,status TEXT NOT NULL,consented_at TEXT NOT NULL,changed_at TEXT NOT NULL,source TEXT NOT NULL,last_timestamp INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS whatsapp_inbound(id TEXT PRIMARY KEY,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS whatsapp_deliveries(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES social_jobs(id),phone TEXT NOT NULL,status TEXT NOT NULL,provider_id TEXT,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL,last_error TEXT,updated_at TEXT NOT NULL,UNIQUE(job_id,phone));
    CREATE INDEX IF NOT EXISTS whatsapp_delivery_provider ON whatsapp_deliveries(provider_id);
    CREATE TABLE IF NOT EXISTS social_config(key TEXT PRIMARY KEY,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS security_config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS translation_cache(id TEXT PRIMARY KEY,text TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS counter_sales(id TEXT PRIMARY KEY,reward_id TEXT NOT NULL UNIQUE REFERENCES rewards(id),staff_id TEXT NOT NULL REFERENCES staff(id),data TEXT NOT NULL,created_at TEXT NOT NULL);
    INSERT OR IGNORE INTO migrations VALUES(3,datetime('now'));
    INSERT OR IGNORE INTO migrations VALUES(1,datetime('now'));
  `);
  const rewardColumns = connection
    .prepare("PRAGMA table_info(rewards)")
    .all() as { name: string }[];
  const analyticsColumns = connection
    .prepare("PRAGMA table_info(analytics)")
    .all() as { name: string }[];
  for (const [name, definition] of Object.entries({
    version: "INTEGER NOT NULL DEFAULT 1",
    session_id: "TEXT",
    item_id: "TEXT",
    quantity: "INTEGER NOT NULL DEFAULT 1",
  }))
    if (!analyticsColumns.some((c) => c.name === name))
      connection.exec(`ALTER TABLE analytics ADD COLUMN ${name} ${definition}`);
  connection.exec(`
    CREATE TABLE IF NOT EXISTS analytics_excluded_visitors(visitor TEXT PRIMARY KEY, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS analytics_visitor_date ON analytics(visitor,created_at);
    INSERT OR IGNORE INTO migrations VALUES(5,datetime('now'));
  `);
  for (const name of ["claimant_name", "network_hash", "saved_at"])
    if (!rewardColumns.some((c) => c.name === name))
      connection.exec(`ALTER TABLE rewards ADD COLUMN ${name} TEXT`);
  connection.exec(
    "CREATE INDEX IF NOT EXISTS rewards_network ON rewards(campaign_id,network_hash); INSERT OR IGNORE INTO migrations VALUES(4,datetime('now'));",
  );
  connection
    .prepare("INSERT OR IGNORE INTO settings VALUES(1,?)")
    .run(JSON.stringify(initialSettings));
  if (!connection.prepare("SELECT id FROM entries LIMIT 1").get()) {
    const insert = connection.prepare("INSERT INTO entries VALUES(?,?,?)");
    for (const e of initialEntries) insert.run(e.id, e.kind, JSON.stringify(e));
  }
  const password = process.env.ADMIN_PASSWORD;
  if (password && password.length >= 12) {
    const email = process.env.ADMIN_EMAIL || "owner@nvo.local";
    if (!connection.prepare("SELECT id FROM staff WHERE email=?").get(email)) {
      const salt = randomBytes(16).toString("hex");
      const hash = scryptSync(password, salt, 64).toString("hex");
      connection
        .prepare("INSERT INTO staff VALUES(?,?,?,?)")
        .run(randomUUID(), email, `${salt}:${hash}`, "owner");
    }
  }
  globalDb.nvoDb = connection;
  return connection;
}
export function settings(): Settings {
  return JSON.parse(
    (
      db().prepare("SELECT data FROM settings WHERE id=1").get() as {
        data: string;
      }
    ).data,
  );
}
export function entries(): Entry[] {
  return (db().prepare("SELECT data FROM entries").all() as { data: string }[])
    .map((r) => JSON.parse(r.data))
    .sort((a, b) => a.sort - b.sort);
}
export function entry(id: string): Entry | undefined {
  const row = db().prepare("SELECT data FROM entries WHERE id=?").get(id) as
    { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}
export function transaction<T>(fn: () => T): T {
  const c = db();
  c.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    c.exec("COMMIT");
    return result;
  } catch (e) {
    c.exec("ROLLBACK");
    throw e;
  }
}
export function audit(staff: string, action: string, entity: string) {
  db()
    .prepare("INSERT INTO audit VALUES(?,?,?,?,?)")
    .run(randomUUID(), staff, action, entity, new Date().toISOString());
}
