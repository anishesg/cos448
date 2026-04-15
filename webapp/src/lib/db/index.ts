import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const isLocal = connectionString.includes("localhost");

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: isLocal ? false : "require",
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
