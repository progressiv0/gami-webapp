# GAMI Webapp

Browser-based dashboard for managing GAMI Proof Records (GPRs) — create, sign, stamp with OpenTimestamps, and verify Bitcoin-anchored archival proofs.

## Architecture

```
Browser  →  Next.js (auth, GPR storage, UI)  →  gami-api (Go, stateless ops)  →  OTS calendars
                          ↓
                      SQLite (Drizzle ORM)
```

The webapp is the **persistence and auth layer**. The [gami-api](../gami/gami-api) (Go) handles all GAMI cryptographic operations (stamp, upgrade, verify) and stays stateless. Ed25519 signing happens **entirely in the browser** — private keys never leave the client.

## Prerequisites

- Node.js ≥ 20
- A running `gami-api` instance (default: `http://localhost:8080`)

## Getting Started

```bash
cd gami-webapp

# 1. Copy and configure environment
cp .env.local.example .env.local
# Edit .env.local — set SESSION_SECRET to a random 32-char string

# 2. Install dependencies
npm install

# 3. Create database tables and seed default admin user
npm run db:setup

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `admin` / `admin`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_PATH` | `./gami.db` | SQLite database file path |
| `SESSION_SECRET` | *(required)* | Random 32+ char string for cookie encryption |
| `GAMI_API_URL` | `http://localhost:8080` | URL of the running gami-api Go server |
| `GPR_STORE_DIR` | `./gpr-store` | Folder where GPR JSON files are synced to disk |

Generate a session secret:
```bash
openssl rand -hex 32
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Sync Drizzle schema to SQLite (creates/updates tables) |
| `npm run db:seed` | Insert default institution and `admin`/`admin` user |
| `npm run db:setup` | `db:push` + `db:seed` (run once on first install) |

## Features

### Dashboard
Overview with live counts per status (unsigned, signed, stamped, Bitcoin confirmed) and quick-action links.

### GPR Archive
The central view. A tabbed interface shows GPRs filtered by lifecycle status:

| Tab | Bulk action |
|---|---|
| Unsigned | **Sign selected** — opens Sign Dialog |
| Signed | **Stamp selected** — submits to OTS calendars via gami-api |
| Stamped | **Upgrade selected** — fetches Bitcoin confirmation via gami-api |
| Confirmed | Read-only |
| All | Browse all records |

Filters: free-text search (filename, hash, collection), collection dropdown, date range.

### Sign Dialog
- Select one or multiple unsigned GPRs and click **Sign selected**
- Paste or load your Ed25519 private key (64 hex chars)
- The public key is derived and shown for confirmation
- Each GPR is signed sequentially in the browser (JCS → SHA-256 → Ed25519)
- Only the signature is sent to the server — **the private key never leaves the browser**
- Per-GPR progress is shown (✓ / ✗)

### Import
- Drag-and-drop one or more files — hashed client-side with SubtleCrypto SHA-256 (no file content sent to server)
- Or paste a hash manually (`sha256:…`)
- Metadata form per file: title, collection, language, rights, classification code
- Creates unsigned GPRs and redirects to the Unsigned tab

### Verify
Verify any file against a stored GPR: hash the file in the browser, enter the GPR ID, see a breakdown of file hash match / signature validity / OTS timestamp status.

### Settings
- Configure institution name, DID key ID, and public key hex
- Generate a new Ed25519 key pair entirely in the browser — download the private key, public key is filled in automatically

## GPR File Sync

Every time a GPR is created or updated, it is also written to `GPR_STORE_DIR` as a JSON file:

```
{filename}_{first12hashchars}.gpr.json
# e.g. declaration_of_intent_cc48f9e72fcf.gpr.json
```

This keeps the filesystem in sync with the database and allows the CLI tools to work directly with the same files.

## GPR Lifecycle

```
Import (unsigned) → Sign → Stamp (OTS pending) → Upgrade (Bitcoin confirmed)
```

1. **Import** — provide file hash + metadata → unsigned GPR created
2. **Sign** — Ed25519 sign in browser → `proof.signature` set
3. **Stamp** — gami-api computes `document_hash`, submits to OTS calendar → `proof.timestamp` set
4. **Upgrade** — gami-api queries OTS calendar for Bitcoin proof → `proof.timestamp.upgraded = true`

## Multi-tenancy

The schema is designed for future multi-tenancy. Every table has an `institution_id` foreign key and all queries are already scoped by institution. Currently seeded with one default institution and one admin user.

To add a new institution later:
1. Insert a row in the `institutions` table
2. Insert users with the new `institution_id`
3. No schema changes required

## Switching to PostgreSQL

Change **two files only** — all queries remain unchanged:

**`drizzle.config.ts`**
```diff
-  dialect: "sqlite",
-  dbCredentials: { url: process.env.DATABASE_PATH ?? "./gami.db" },
+  dialect: "postgresql",
+  dbCredentials: { url: process.env.DATABASE_URL! },
```

**`src/lib/db/index.ts`**
```diff
-import Database from "better-sqlite3";
-import { drizzle } from "drizzle-orm/better-sqlite3";
-const sqlite = new Database(dbPath);
-export const db = drizzle(sqlite, { schema });
+import { Pool } from "pg";
+import { drizzle } from "drizzle-orm/node-postgres";
+const pool = new Pool({ connectionString: process.env.DATABASE_URL });
+export const db = drizzle(pool, { schema });
```

Also change `data text` → `data jsonb` in the `gprs` table schema for native JSON querying in PostgreSQL.

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| ORM | Drizzle ORM + `better-sqlite3` |
| Auth | iron-session (encrypted cookies) |
| UI | shadcn-style components + Tailwind CSS |
| Client crypto | `@noble/ed25519` + `json-canonicalize` (RFC 8785 JCS) |
| Password hashing | bcryptjs |
