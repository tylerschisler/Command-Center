import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { getEnvironment } from "@/config/env";
import * as schema from "./schema";

export type AppDatabase = ReturnType<typeof createDatabase>;

export function createDatabase(databasePath = getEnvironment().DATABASE_PATH) {
  if (databasePath !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  return drizzle(sqlite, { schema });
}

let singleton: ReturnType<typeof createDatabase> | undefined;

export function getDatabase() {
  singleton ??= createDatabase();
  return singleton;
}
