import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { getEnvironment } from "../src/config/env";
import { isPlaintextSqliteDatabase, openEncryptedSqlite, type NativeDatabase } from "../src/server/db/client";
import { getDefaultDatabaseKeyProvider } from "../src/server/security/database-key-provider";
import { pruneProtectedCopies } from "../src/server/security/protected-copy-policy";

const databasePath = path.resolve(getEnvironment().DATABASE_PATH);
const key = getDefaultDatabaseKeyProvider().getOrCreateKey();
let temporaryPath: string | undefined;

try {
  if (!fs.existsSync(databasePath) || fs.statSync(databasePath).size === 0) {
    const database = openEncryptedSqlite(databasePath, key);
    database.close();
    console.log("Encrypted database initialized.");
    process.exitCode = 0;
  } else if (!isPlaintextSqliteDatabase(databasePath)) {
    const database = openEncryptedSqlite(databasePath, key);
    database.close();
    console.log("Database is already encrypted and the key is valid.");
  } else {
    const plaintext = new Database(databasePath);
    try {
      if (plaintext.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("Plaintext database integrity check failed.");
      plaintext.pragma("wal_checkpoint(TRUNCATE)");
    } finally {
      plaintext.close();
    }

    temporaryPath = `${databasePath}.${randomUUID()}.encrypting`;
    fs.copyFileSync(databasePath, temporaryPath, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(temporaryPath, 0o600);
    const copy = new Database(temporaryPath) as NativeDatabase;
    try {
      copy.pragma("cipher = 'chacha20'");
      copy.rekey(key);
    } finally {
      copy.close();
    }
    const verified = openEncryptedSqlite(temporaryPath, key);
    try {
      if (verified.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("Encrypted database integrity check failed.");
    } finally {
      verified.close();
    }

    const source = new Database(databasePath) as NativeDatabase;
    try {
      source.pragma("cipher = 'chacha20'");
      source.rekey(key);
    } finally {
      source.close();
    }
    const verifiedSource = openEncryptedSqlite(databasePath, key);
    verifiedSource.close();

    const protectedPath = `${databasePath}.pre-encryption-${Date.now()}-${randomUUID()}.db`;
    fs.renameSync(databasePath, protectedPath);
    fs.renameSync(temporaryPath, databasePath);
    temporaryPath = undefined;
    pruneProtectedCopies(databasePath, "pre-encryption");
    console.log(`Database encrypted. An encrypted pre-conversion copy remains at ${protectedPath}`);
  }
} finally {
  if (temporaryPath && fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath);
  key.fill(0);
}
