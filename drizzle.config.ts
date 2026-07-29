import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
const useTurso =
  Boolean(tursoUrl) &&
  (process.env.USE_TURSO === "true" || process.env.VERCEL === "1");
const sqlitePath =
  process.env.SQLITE_PATH?.trim() || "./data/latewiz.db";

export default defineConfig(
  useTurso
    ? {
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        dialect: "turso",
        dbCredentials: {
          url: tursoUrl!,
          authToken: process.env.TURSO_AUTH_TOKEN,
        },
      }
    : {
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        dialect: "sqlite",
        dbCredentials: {
          url: sqlitePath,
        },
      }
);
