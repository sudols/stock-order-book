import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDbConnection, getDatabaseUrl } from "./index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(databaseUrl?: string): Promise<void> {
  const url = databaseUrl || getDatabaseUrl();
  const maskedUrl = url.replace(/:[^:@]*@/, ":***@");
  console.log(`🚀 Running database migrations against: ${maskedUrl}`);
  
  const { client, db } = createDbConnection(url);
  try {
    const migrationsFolder = path.resolve(__dirname, "../../drizzle");
    await migrate(db, { migrationsFolder });
    console.log("✅ Database migrations applied successfully!");
  } finally {
    await client.end({ timeout: 5 });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      console.log("🎉 Migration process finished successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Migration process failed:", err);
      process.exit(1);
    });
}
