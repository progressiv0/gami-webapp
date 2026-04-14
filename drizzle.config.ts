import type { Config } from "drizzle-kit";

// To switch to PostgreSQL:
//   dialect: "postgresql"
//   dbCredentials: { url: process.env.DATABASE_URL! }
const config: Config = {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? "./gami.db",
  },
};

export default config;
