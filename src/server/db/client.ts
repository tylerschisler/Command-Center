import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { getEnvironment } from "@/config/env";
import { getDefaultDatabaseKeyProvider, type DatabaseKeyProvider } from "@/server/security/database-key-provider";
import * as schema from "./schema";

const SQLITE_HEADER = Buffer.from("SQLite format 3\0", "binary");

export type NativeDatabase = Database.Database & {
  key(key: Buffer): number;
  rekey(key: Buffer): number;
};
export type AppDatabase = ReturnType<typeof createDatabase>;

export function isPlaintextSqliteDatabase(databasePath: string): boolean {
  if (!fs.existsSync(databasePath) || fs.statSync(databasePath).size < SQLITE_HEADER.length) return false;
  const descriptor = fs.openSync(databasePath, "r");
  try {
    const header = Buffer.alloc(SQLITE_HEADER.length);
    fs.readSync(descriptor, header, 0, header.length, 0);
    return header.equals(SQLITE_HEADER);
  } finally {
    fs.closeSync(descriptor);
  }
}

export function openEncryptedSqlite(databasePath: string, key: Buffer): NativeDatabase {
  if (key.length !== 32) throw new Error("The database encryption key is invalid.");
  if (databasePath !== ":memory:" && isPlaintextSqliteDatabase(databasePath)) {
    throw new Error("Refusing to open a plaintext database. Run npm run db:encrypt first.");
  }
  const resolvedPath = databasePath === ":memory:" ? databasePath : path.resolve(databasePath);
  if (resolvedPath !== ":memory:") fs.mkdirSync(path.dirname(resolvedPath), { recursive: true, mode: 0o700 });

  const sqlite = new Database(resolvedPath) as NativeDatabase;
  try {
    sqlite.pragma("cipher = 'chacha20'");
    sqlite.key(key);
    sqlite.prepare("select count(*) as count from sqlite_schema").get();
    sqlite.pragma("temp_store = MEMORY");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("journal_mode = WAL");
    if (resolvedPath !== ":memory:") fs.chmodSync(resolvedPath, 0o600);
    return sqlite;
  } catch {
    sqlite.close();
    throw new Error("Unable to open the encrypted database.");
  }
}

export function createDatabase(
  databasePath = getEnvironment().DATABASE_PATH,
  keyProvider: DatabaseKeyProvider = getDefaultDatabaseKeyProvider(),
) {
  const key = keyProvider.getOrCreateKey();
  try {
    return drizzle(openEncryptedSqlite(databasePath, key), { schema });
  } finally {
    key.fill(0);
  }
}

let singleton: ReturnType<typeof createDatabase> | undefined;

export function getDatabase() {
  singleton ??= createDatabase();
  return singleton;
}

export function closeDatabase() {
  singleton?.$client.close();
  singleton = undefined;
}
