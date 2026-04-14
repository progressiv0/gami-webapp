import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ── Institutions ──────────────────────────────────────────────────────────────
// Multi-tenancy: every GPR and user belongs to an institution.
// Currently seeded with one default institution.
export const institutions = sqliteTable("institutions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  keyId: text("key_id").default(""),          // did:web:...#key-1
  publicKeyHex: text("public_key_hex").default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  institutionId: integer("institution_id")
    .notNull()
    .references(() => institutions.id),
  role: text("role").notNull().default("admin"), // 'admin' | 'viewer'
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── GPRs ──────────────────────────────────────────────────────────────────────
export type GprStatus = "unsigned" | "signed" | "stamped" | "upgraded";

export const gprs = sqliteTable("gprs", {
  id: text("id").primaryKey(),               // urn:uuid:... from GPR
  institutionId: integer("institution_id")
    .notNull()
    .references(() => institutions.id),
  data: text("data").notNull(),              // full GPR JSON — switch to jsonb in PostgreSQL
  status: text("status").notNull().$type<GprStatus>(),
  filename: text("filename").default(""),
  fileHash: text("file_hash").default(""),
  collection: text("collection").default(""), // from subject.metadata.collection
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Institution = typeof institutions.$inferSelect;
export type User = typeof users.$inferSelect;
export type Gpr = typeof gprs.$inferSelect;
