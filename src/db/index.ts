import "server-only";

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

let _db: Db | null = null;
let _sqlite: Database.Database | null = null;

export function resolveSqlitePath(): string {
  const fromEnv = process.env.SQLITE_PATH?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(process.cwd(), fromEnv);
  }
  // Vercel’s filesystem is ephemeral/read-only except /tmp — data resets between deploys.
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "latewiz.db");
  }
  return path.join(process.cwd(), "data", "latewiz.db");
}

const INIT_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" integer DEFAULT false NOT NULL,
  "image" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" integer NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" integer,
  "refresh_token_expires_at" integer,
  "scope" text,
  "password" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" integer NOT NULL,
  "created_at" integer,
  "updated_at" integer
);

CREATE TABLE IF NOT EXISTS "user_secrets" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "ciphertext" text NOT NULL,
  "iv" text NOT NULL,
  "auth_tag" text NOT NULL,
  "key_hint" text NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_secrets_user_kind_idx"
  ON "user_secrets" ("user_id", "kind");

CREATE TABLE IF NOT EXISTS "user_profiles" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "niche" text NOT NULL,
  "content_prefs" text,
  "onboarding_completed" integer DEFAULT false NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "scheduled_campaigns" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "data" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "scheduled_campaigns_user_id_idx"
  ON "scheduled_campaigns" ("user_id");
`;

function ensureSchema(sqlite: Database.Database) {
  sqlite.exec(INIT_SQL);
}

export function getDb(): Db {
  if (_db) return _db;

  const dbPath = resolveSqlitePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  ensureSchema(sqlite);
  // Migrate older local DBs that lack content_prefs
  try {
    const cols = sqlite.pragma("table_info(user_profiles)") as Array<{
      name: string;
    }>;
    if (!cols.some((c) => c.name === "content_prefs")) {
      sqlite.exec(`ALTER TABLE user_profiles ADD COLUMN content_prefs text`);
    }
  } catch {
    /* table may not exist yet */
  }
  _sqlite = sqlite;
  _db = drizzle(sqlite, { schema });
  return _db;
}

/** Prefer getDb() — Proxy kept for Better Auth adapter import. */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export function closeDb() {
  _sqlite?.close();
  _sqlite = null;
  _db = null;
}
