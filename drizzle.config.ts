import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
const sqlitePath =
  process.env.SQLITE_PATH?.trim() || "./data/latewiz.db";

export default defineConfig(
  tursoUrl
    ? {
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        dialect: "turso",
        dbCredentials: {
          url: tursoUrl,
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
