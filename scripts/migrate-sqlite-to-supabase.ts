import { DatabaseSync } from "node:sqlite";
import postgres from "postgres";

const tables = [
  "migrations",
  "settings",
  "entries",
  "staff",
  "sessions",
  "orders",
  "reservations",
  "analytics",
  "analytics_excluded_visitors",
  "referrals",
  "referral_visits",
  "rewards",
  "audit",
  "rate_limits",
  "media",
  "social_accounts",
  "social_oauth",
  "social_plans",
  "social_jobs",
  "social_attempts",
  "social_caption_cache",
  "social_media",
  "social_media_cache",
  "social_worker",
  "whatsapp_subscribers",
  "whatsapp_inbound",
  "whatsapp_deliveries",
  "social_config",
  "security_config",
  "translation_cache",
  "counter_sales",
] as const;

const jsonColumns = new Set([
  "settings.data",
  "entries.data",
  "rewards.terms",
  "social_plans.data",
  "social_jobs.payload",
  "social_caption_cache.data",
  "social_config.data",
  "counter_sales.data",
]);
const booleanColumns = new Set([
  "social_accounts.auto_publish",
  "social_oauth.consumed",
]);
type Table = (typeof tables)[number];
type Row = Record<string, unknown>;

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function sourceRows(db: DatabaseSync, table: Table) {
  return db
    .prepare(`SELECT * FROM ${quoteIdentifier(table)}`)
    .all() as Row[];
}

function normalise(table: Table, row: Row) {
  return Object.fromEntries(
    Object.entries(row).map(([column, value]) => {
      const key = `${table}.${column}`;
      if (value === null) return [column, null];
      if (jsonColumns.has(key)) return [column, JSON.parse(String(value))];
      if (booleanColumns.has(key)) return [column, Boolean(value)];
      return [column, value];
    }),
  );
}

async function targetCounts(
  sql: ReturnType<typeof postgres>,
  schema: string,
) {
  const counts = {} as Record<Table, number>;
  for (const table of tables) {
    const rows = await sql.unsafe(
      `SELECT count(*)::integer AS count FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`,
    );
    counts[table] = rows[0].count as number;
  }
  return counts;
}

async function main() {
  const sourcePath = process.env.NVO_DB_PATH || "data/nvo.sqlite";
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const sourceData = Object.fromEntries(
    tables.map((table) => [table, sourceRows(source, table)]),
  ) as Record<Table, Row[]>;
  const sourceCounts = Object.fromEntries(
    tables.map((table) => [table, sourceData[table].length]),
  ) as Record<Table, number>;
  const apply = process.argv.includes("--apply");
  const url = process.env.NVO_MIGRATION_DATABASE_URL;

  console.log(
    JSON.stringify(
      {
        source: sourcePath,
        sourceCounts,
        apply,
        targetConfigured: Boolean(url),
      },
      null,
      2,
    ),
  );
  if (!url) {
    source.close();
    console.log(
      "Dry run only. Set NVO_MIGRATION_DATABASE_URL to a direct or Session Pooler connection before copying data.",
    );
    return;
  }

  const sql = postgres(url, { max: 1, prepare: false, ssl: "require" });
  try {
    const targetTables = await sql<{
      table_name: string;
    }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const missing = tables.filter(
      (table) => !targetTables.some(({ table_name }) => table_name === table),
    );
    if (missing.length)
      throw new Error(`Supabase is missing required tables: ${missing.join(", ")}`);

    const before = await targetCounts(sql, "public");
    const nonEmpty = tables.filter((table) => before[table] !== 0);
    if (nonEmpty.length)
      throw new Error(
        `Supabase target is not empty (${nonEmpty.join(", ")}). It was not modified.`,
      );
    if (!apply) {
      console.log("Dry run passed. Re-run with --apply to copy the verified data.");
      return;
    }

    await sql.begin(async (transaction) => {
      for (const table of tables) {
        for (const row of sourceData[table]) {
          const values = normalise(table, row);
          const columns = Object.keys(values);
          const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
          await transaction.unsafe(
            `INSERT INTO public.${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${placeholders})`,
            columns.map((column) => values[column]),
          );
        }
      }
    });

    const after = await targetCounts(sql, "public");
    const mismatched = tables.filter(
      (table) => after[table] !== sourceCounts[table],
    );
    if (mismatched.length)
      throw new Error(
        `Copy verification failed for: ${mismatched.join(", ")}. Do not switch the application database.`,
      );
    console.log("SQLite data copied and verified. Keep the SQLite backup until production acceptance is complete.");
  } finally {
    source.close();
    await sql.end({ timeout: 5 });
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
