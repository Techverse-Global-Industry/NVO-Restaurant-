import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { initialEntries, initialSettings } from "./seed";
import type { Entry, Settings } from "./types";

// SQLite is intentionally synchronous locally; Postgres is async in Netlify.
// This shape permits legacy local tooling to inspect a value directly while all
// application code awaits it, which is required for the hosted path.
type Awaitable<T> = T & PromiseLike<T>;
export type Statement = {
  get<T extends QueryResultRow = QueryResultRow>(...values: unknown[]): Awaitable<T>;
  all<T extends QueryResultRow = QueryResultRow>(...values: unknown[]): Awaitable<T[]>;
  run(...values: unknown[]): Awaitable<{ changes: number }>;
};
export type Connection = { prepare(sql: string): Statement; exec(sql: string): Awaitable<void> };
type GlobalDatabase = { nvoSqlite?: DatabaseSync; nvoPool?: Pool };

const globalDb = globalThis as unknown as GlobalDatabase;
const transactionClient = new AsyncLocalStorage<PoolClient>();

// Make PostgreSQL rows match the old SQLite runtime representation.
types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(114, (value) => value);
types.setTypeParser(1184, (value) => value);
types.setTypeParser(3802, (value) => value);

const replacementKeys: Record<string, { conflict: string; updates: string[] }> = {
  entries: { conflict: "id", updates: ["kind", "data"] },
  rate_limits: { conflict: "key", updates: ["count", "reset"] },
  social_caption_cache: { conflict: "id", updates: ["data", "created_at"] },
  social_config: { conflict: "key", updates: ["data"] },
  social_media_cache: { conflict: "fingerprint", updates: ["media_id"] },
  social_plans: { conflict: "entry_id", updates: ["data"] },
  social_worker: { conflict: "id", updates: ["heartbeat"] },
  translation_cache: { conflict: "id", updates: ["text", "created_at"] },
};

function postgresUrl() {
  return process.env.NVO_DATABASE_URL?.trim() || null;
}
function usingPostgres() {
  return Boolean(postgresUrl());
}
function placeholders(sql: string) {
  let index = 0;
  let quote: "'" | '"' | null = null;
  let result = "";
  for (let position = 0; position < sql.length; position += 1) {
    const character = sql[position];
    if (quote) {
      result += character;
      if (character === quote) {
        if (sql[position + 1] === quote) {
          result += sql[position + 1];
          position += 1;
        } else quote = null;
      }
    } else if (character === "'" || character === '"') {
      quote = character;
      result += character;
    } else if (character === "?") result += `$${++index}`;
    else result += character;
  }
  return result;
}
function postgresSql(source: string) {
  let sql = source
    .replace(
      /json_extract\((\w+),'\$\.([\w]+)(?:\.([\w]+))?'\)/gi,
      (_match, column: string, first: string, second?: string) => `${column} #>> '{${[first, second].filter(Boolean).join(",")}}'`,
    )
    .replace(/date\(created_at,'\+1 hour'\)/gi, "to_char(created_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD')")
    .replace(/substr\(phone,-4\)/gi, "right(phone,4)");
  const replaceMatch = sql.match(/^\s*INSERT OR REPLACE INTO\s+([\w]+)\s+VALUES\s*/i);
  if (replaceMatch) {
    const rule = replacementKeys[replaceMatch[1].toLowerCase()];
    if (!rule) throw new Error(`PostgreSQL replacement rule is missing for ${replaceMatch[1]}.`);
    sql = sql.replace(/^\s*INSERT OR REPLACE\s+/i, "INSERT ").replace(/;?\s*$/, "");
    sql += ` ON CONFLICT (${rule.conflict}) DO UPDATE SET ${rule.updates.map((column) => `${column}=EXCLUDED.${column}`).join(",")}`;
  } else if (/^\s*INSERT OR IGNORE\s+/i.test(sql)) {
    sql = sql.replace(/^\s*INSERT OR IGNORE\s+/i, "INSERT ").replace(/;?\s*$/, "") + " ON CONFLICT DO NOTHING";
  }
  return placeholders(sql);
}

function sqlite(): DatabaseSync {
  if (globalDb.nvoSqlite) return globalDb.nvoSqlite;
  const file = process.env.NVO_DB_PATH || "data/nvo.sqlite";
  if (file !== ":memory:") mkdirSync(path.dirname(path.resolve(/* turbopackIgnore: true */ file)), { recursive: true });
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
    INSERT OR IGNORE INTO migrations VALUES(3,datetime('now')); INSERT OR IGNORE INTO migrations VALUES(1,datetime('now'));`);
  const rewardColumns = connection.prepare("PRAGMA table_info(rewards)").all() as { name: string }[];
  const analyticsColumns = connection.prepare("PRAGMA table_info(analytics)").all() as { name: string }[];
  for (const [name, definition] of Object.entries({ version: "INTEGER NOT NULL DEFAULT 1", session_id: "TEXT", item_id: "TEXT", quantity: "INTEGER NOT NULL DEFAULT 1" }))
    if (!analyticsColumns.some((column) => column.name === name)) connection.exec(`ALTER TABLE analytics ADD COLUMN ${name} ${definition}`);
  connection.exec(`CREATE TABLE IF NOT EXISTS analytics_excluded_visitors(visitor TEXT PRIMARY KEY, created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS analytics_visitor_date ON analytics(visitor,created_at); INSERT OR IGNORE INTO migrations VALUES(5,datetime('now'));`);
  for (const name of ["claimant_name", "network_hash", "saved_at"])
    if (!rewardColumns.some((column) => column.name === name)) connection.exec(`ALTER TABLE rewards ADD COLUMN ${name} TEXT`);
  connection.exec("CREATE INDEX IF NOT EXISTS rewards_network ON rewards(campaign_id,network_hash); INSERT OR IGNORE INTO migrations VALUES(4,datetime('now'));");
  connection.prepare("INSERT OR IGNORE INTO settings VALUES(1,?)").run(JSON.stringify(initialSettings));
  if (!connection.prepare("SELECT id FROM entries LIMIT 1").get()) {
    const insert = connection.prepare("INSERT INTO entries VALUES(?,?,?)");
    for (const value of initialEntries) insert.run(value.id, value.kind, JSON.stringify(value));
  }
  const password = process.env.ADMIN_PASSWORD;
  if (password && password.length >= 12) {
    const email = process.env.ADMIN_EMAIL || "owner@nvo.local";
    if (!connection.prepare("SELECT id FROM staff WHERE email=?").get(email)) {
      const salt = randomBytes(16).toString("hex");
      const hash = scryptSync(password, salt, 64).toString("hex");
      connection.prepare("INSERT INTO staff VALUES(?,?,?,?)").run(randomUUID(), email, `${salt}:${hash}`, "owner");
    }
  }
  globalDb.nvoSqlite = connection;
  return connection;
}

function pool() {
  if (globalDb.nvoPool) return globalDb.nvoPool;
  const url = postgresUrl();
  if (!url) throw new Error("NVO_DATABASE_URL is required for PostgreSQL access.");
  const parsed = new URL(url);
  const isSupabasePooler = parsed.hostname.endsWith(".pooler.supabase.com");
  if (process.env.NETLIFY && isSupabasePooler && parsed.port !== "6543")
    throw new Error("Netlify must use Supabase's transaction pooler URL on port 6543.");
  globalDb.nvoPool = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    // Supabase's transaction pooler requires TLS but its chain is not in Netlify's
    // default CA bundle. This is equivalent to sslmode=require: encrypted, without
    // client-side CA verification. All other PostgreSQL hosts retain strict checks.
    ssl: { rejectUnauthorized: !isSupabasePooler },
  });
  return globalDb.nvoPool;
}
function sqliteConnection(): Connection {
  const connection = sqlite();
  const valuesForSqlite = (values: unknown[]) =>
    values.map((value) => (typeof value === "boolean" ? Number(value) : value));
  return {
    prepare(sql) {
      const statement = connection.prepare(sql);
      return {
        get: <T extends QueryResultRow>(...values: unknown[]) => (statement.get as (...input: unknown[]) => unknown)(...valuesForSqlite(values)) as Awaitable<T>,
        all: <T extends QueryResultRow>(...values: unknown[]) => (statement.all as (...input: unknown[]) => unknown)(...valuesForSqlite(values)) as Awaitable<T[]>,
        run: (...values: unknown[]) => ({ changes: Number(((statement.run as (...input: unknown[]) => { changes: number })(...valuesForSqlite(values))).changes) }) as Awaitable<{ changes: number }>,
      };
    },
    exec: (sql) => { connection.exec(sql); return undefined as Awaitable<void>; },
  };
}
function postgresConnection(client?: PoolClient): Connection {
  const executor = client || transactionClient.getStore() || pool();
  return {
    prepare(source) {
      const text = postgresSql(source);
      const query = (values: unknown[]) => executor.query({ text, values });
      return {
        get: <T extends QueryResultRow>(...values: unknown[]) => query(values).then((result) => result.rows[0] as T) as unknown as Awaitable<T>,
        all: <T extends QueryResultRow>(...values: unknown[]) => query(values).then((result) => result.rows as T[]) as unknown as Awaitable<T[]>,
        run: (...values: unknown[]) => query(values).then((result) => ({ changes: result.rowCount || 0 })) as unknown as Awaitable<{ changes: number }>,
      };
    },
    exec: (sql) => executor.query(postgresSql(sql)).then(() => undefined) as unknown as Awaitable<void>,
  };
}
export function db(): Connection {
  return usingPostgres() ? postgresConnection() : sqliteConnection();
}
export function settings(): Awaitable<Settings> {
  if (!usingPostgres()) {
    const row = sqlite().prepare("SELECT data FROM settings WHERE id=1").get() as { data: string } | undefined;
    if (!row) throw new Error("Restaurant settings are missing.");
    return JSON.parse(row.data) as Awaitable<Settings>;
  }
  return (async () => {
    const row = await db().prepare("SELECT data FROM settings WHERE id=1").get<{ data: string }>();
    if (!row) throw new Error("Restaurant settings are missing.");
    return JSON.parse(row.data) as Settings;
  })() as unknown as Awaitable<Settings>;
}
export function entries(): Awaitable<Entry[]> {
  if (!usingPostgres())
    return (sqlite().prepare("SELECT data FROM entries").all() as { data: string }[])
      .map((row) => JSON.parse(row.data) as Entry)
      .sort((left, right) => left.sort - right.sort) as Awaitable<Entry[]>;
  return (async () => {
    const rows = await db().prepare("SELECT data FROM entries").all<{ data: string }>();
    return rows.map((row) => JSON.parse(row.data) as Entry).sort((left, right) => left.sort - right.sort);
  })() as unknown as Awaitable<Entry[]>;
}
export function entry(id: string): Awaitable<Entry | undefined> {
  if (!usingPostgres()) {
    const row = sqlite().prepare("SELECT data FROM entries WHERE id=?").get(id) as { data: string } | undefined;
    return (row ? JSON.parse(row.data) : undefined) as Awaitable<Entry | undefined>;
  }
  return (async () => {
    const row = await db().prepare("SELECT data FROM entries WHERE id=?").get<{ data: string }>(id);
    return row ? (JSON.parse(row.data) as Entry) : undefined;
  })() as unknown as Awaitable<Entry | undefined>;
}
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  if (!usingPostgres()) {
    const connection = sqlite();
    connection.exec("BEGIN IMMEDIATE");
    try {
      const result = await fn();
      connection.exec("COMMIT");
      return result;
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }
  const active = transactionClient.getStore();
  if (active) return fn();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await transactionClient.run(client, fn);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
export async function audit(staff: string, action: string, entity: string) {
  await db().prepare("INSERT INTO audit VALUES(?,?,?,?,?)").run(randomUUID(), staff, action, entity, new Date().toISOString());
}
