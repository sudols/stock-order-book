import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

export const DEFAULT_DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/glassbox";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/glassbox_test";

export function getDatabaseUrl(): string {
  if (process.env.NODE_ENV === "test" && process.env.USE_MAIN_DB !== "true") {
    return process.env.TEST_DATABASE_URL || TEST_DATABASE_URL;
  }
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

export function createDbConnection(url: string = getDatabaseUrl()) {
  const client = postgres(url, {
    max: Number(process.env.DB_POOL_MAX) || 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  const db = drizzle(client, { schema });
  return { client, db };
}

// Default singleton instances
const defaultConnection = createDbConnection();
export const queryClient = defaultConnection.client;
export const db = defaultConnection.db;

export type Database = typeof db;
export * from "./schema.js";
