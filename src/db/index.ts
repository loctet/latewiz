import "server-only";

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { createClient, type Client } from "@libsql/client";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "./schema";

// Shared SQLite surface for better-sqlite3 (local) and libSQL/Turso (Vercel).
export type Db = BaseSQLiteDatabase<"sync" | "async", unknown, typeof schema>;

let _db: Db | null = null;
let _sqlite: Database.Database | null = null;
let _libsql: Client | null = null;
let _schemaReady: Promise<void> | null = null;

export function resolveSqlitePath(): string {
  const fromEnv = process.env.SQLITE_PATH?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(process.cwd(), fromEnv);
  }
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "latewiz.db");
  }
  return path.join(process.cwd(), "data", "latewiz.db");
}

export function isTursoConfigured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL?.trim());
}

export function isEphemeralVercelDb(): boolean {
  return process.env.VERCEL === "1" && !isTursoConfigured();
}

const INIT_STATEMENTS = [
  `PRAGMA foreign_keys = ON`,
  `CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" integer DEFAULT false NOT NULL,
  "image" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" integer NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
)`,
  `CREATE TABLE IF NOT EXISTS "account" (
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
)`,
  `CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" integer NOT NULL,
  "created_at" integer,
  "updated_at" integer
)`,
  `CREATE TABLE IF NOT EXISTS "user_secrets" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "ciphertext" text NOT NULL,
  "iv" text NOT NULL,
  "auth_tag" text NOT NULL,
  "key_hint" text NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "user_secrets_user_kind_idx"
  ON "user_secrets" ("user_id", "kind")`,
  `CREATE TABLE IF NOT EXISTS "user_profiles" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "niche" text NOT NULL,
  "content_prefs" text,
  "onboarding_completed" integer DEFAULT false NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "scheduled_campaigns" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "data" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "scheduled_campaigns_user_id_idx"
  ON "scheduled_campaigns" ("user_id")`,
];

async function ensureLibsqlSchema(client: Client) {
  for (const sql of INIT_STATEMENTS) {
    await client.execute(sql);
  }
  try {
    const cols = await client.execute(`PRAGMA table_info(user_profiles)`);
    const hasPrefs = cols.rows.some((row) => {
      const name = (row as Record<string, unknown>).name ?? row[1];
      return name === "content_prefs";
    });
    if (!hasPrefs) {
      await client.execute(
        `ALTER TABLE user_profiles ADD COLUMN content_prefs text`
      );
    }
  } catch {
    /* ignore */
  }
}

function ensureSqliteSchema(sqlite: Database.Database) {
  sqlite.exec("PRAGMA journal_mode = WAL;");
  for (const sql of INIT_STATEMENTS) {
    sqlite.exec(sql);
  }
  try {
    const cols = sqlite.pragma("table_info(user_profiles)") as Array<{
      name: string;
    }>;
    if (!cols.some((c) => c.name === "content_prefs")) {
      sqlite.exec(`ALTER TABLE user_profiles ADD COLUMN content_prefs text`);
    }
  } catch {
    /* ignore */
  }
}

function createDb(): Db {
  if (isEphemeralVercelDb()) {
    console.error(
      "[latewiz] Vercel without TURSO_DATABASE_URL — auth DB is ephemeral (/tmp). " +
        "Signup can succeed then login fails. Set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN."
    );
  }

  if (isTursoConfigured()) {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!.trim(),
      authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
    });
    _libsql = client;
    _schemaReady = ensureLibsqlSchema(client);
    return drizzleLibsql(client, { schema }) as unknown as Db;
  }

  const dbPath = resolveSqlitePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  ensureSqliteSchema(sqlite);
  _sqlite = sqlite;
  _schemaReady = Promise.resolve();
  return drizzleSqlite(sqlite, { schema }) as unknown as Db;
}

export function getDb(): Db {
  if (!_db) _db = createDb();
  return _db;
}

/** Prefer getDb() — Proxy kept for Better Auth adapter import. */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

/** Await before handling auth/API requests (ensures Turso schema exists). */
export async function ensureDbReady(): Promise<Db> {
  const database = getDb();
  if (_schemaReady) await _schemaReady;
  return database;
}

/** Async DB accessor — prefer this in server routes/services. */
export async function dbReady(): Promise<Db> {
  return ensureDbReady();
}

export function closeDb() {
  _sqlite?.close();
  _sqlite = null;
  _libsql?.close();
  _libsql = null;
  _db = null;
  _schemaReady = null;
}
