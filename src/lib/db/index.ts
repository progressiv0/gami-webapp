import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";

// ── Connection ────────────────────────────────────────────────────────────────
// To switch to PostgreSQL:
//   import { drizzle } from "drizzle-orm/node-postgres";
//   import { Pool } from "pg";
//   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
//   export const db = drizzle(pool, { schema });

const dbPath = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH ?? "./gami.db"
);

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
