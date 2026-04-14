/**
 * Seed the database with the default institution and admin user.
 * Run with: npm run db:seed
 */
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const dbPath = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH ?? "./gami.db"
);

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

async function seed() {
  // Insert default institution (skip if already exists)
  const existing = db
    .select()
    .from(schema.institutions)
    .all();

  if (existing.length === 0) {
    db.insert(schema.institutions)
      .values({
        name: "GAMI Default Institution",
        keyId: "did:web:localhost#key-1",
        publicKeyHex: "",
      })
      .run();
    console.log("✓ Created default institution");
  } else {
    console.log("  Institution already exists, skipping");
  }

  // Get institution id
  const institution = db
    .select()
    .from(schema.institutions)
    .limit(1)
    .all()[0];

  // Insert admin user (skip if already exists)
  const existingUser = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, "admin"))
    .all();

  if (existingUser.length === 0) {
    const passwordHash = await bcrypt.hash("admin", 10);
    db.insert(schema.users)
      .values({
        username: "admin",
        passwordHash,
        institutionId: institution.id,
        role: "admin",
      })
      .run();
    console.log("✓ Created admin user (username: admin, password: admin)");
  } else {
    console.log("  Admin user already exists, skipping");
  }

  console.log("\nDatabase seeded successfully.");
  sqlite.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
