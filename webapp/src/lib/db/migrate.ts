import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });

  try {
    // Run the init migration
    const migrationPath = resolve(__dirname, "../../../drizzle/0000_init.sql");
    const migrationSql = readFileSync(migrationPath, "utf-8");

    console.log("Running migration: 0000_init.sql");
    await sql.unsafe(migrationSql);
    console.log("Migration complete.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
