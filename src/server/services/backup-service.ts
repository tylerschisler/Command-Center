import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { closeDatabase, createDatabase, openEncryptedSqlite } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { StaticDatabaseKeyProvider, type DatabaseKeyProvider } from "@/server/security/database-key-provider";
import { pruneProtectedCopies } from "@/server/security/protected-copy-policy";
import { readRecoveryMaterial } from "@/server/security/recovery-material";
import { ActivityService } from "./activity-service";

const MAGIC = Buffer.from("CCBACKUP1", "ascii");
const TAG_LENGTH = 16;
const BACKUP_INFO = Buffer.from("command-center-backup-v1", "utf8");

const metadataSchema = z.object({
  formatVersion: z.literal(1),
  backupId: z.string().uuid(),
  createdAt: z.string().datetime(),
  databaseCipher: z.literal("chacha20-poly1305"),
  backupCipher: z.literal("aes-256-gcm"),
  keyDerivation: z.literal("hkdf-sha256"),
  salt: z.string().base64(),
  nonce: z.string().base64(),
  databaseSha256: z.string().regex(/^[a-f0-9]{64}$/),
  databaseBytes: z.number().int().nonnegative(),
  schemaVersion: z.number().int().nonnegative(),
  recoveryMaterial: z.string().base64().optional(),
});

export type BackupMetadata = z.infer<typeof metadataSchema>;

export interface BackupServiceOptions {
  databasePath: string;
  backupDirectory: string;
  keyProvider: DatabaseKeyProvider;
  closeActiveDatabase?: () => void;
  recoveryMaterialPath?: string;
}

export interface BackupResult {
  backupPath: string;
  metadata: BackupMetadata;
}

export interface RestoreResult {
  metadata: BackupMetadata;
  protectedDatabasePath: string | null;
}

function deriveBackupKey(databaseKey: Buffer, salt: Buffer): Buffer {
  return Buffer.from(hkdfSync("sha256", databaseKey, salt, BACKUP_INFO, 32));
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function readSchemaVersion(databasePath: string, key: Buffer): number {
  const database = openEncryptedSqlite(databasePath, key);
  try {
    const table = database.prepare("select 1 from sqlite_schema where type = 'table' and name = '__drizzle_migrations'").get();
    if (!table) return 0;
    const result = database.prepare("select count(*) as count from __drizzle_migrations").get() as { count: number };
    return result.count;
  } finally {
    database.close();
  }
}

function encodeBackup(metadata: BackupMetadata, ciphertext: Buffer, authenticationTag: Buffer): Buffer {
  const metadataBytes = Buffer.from(JSON.stringify(metadata), "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(metadataBytes.length);
  return Buffer.concat([MAGIC, length, metadataBytes, authenticationTag, ciphertext]);
}

function decodeBackup(contents: Buffer) {
  if (contents.length < MAGIC.length + 4 + TAG_LENGTH || !contents.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("The backup format is invalid.");
  }
  const metadataLength = contents.readUInt32BE(MAGIC.length);
  const metadataStart = MAGIC.length + 4;
  const metadataEnd = metadataStart + metadataLength;
  if (metadataLength > 64 * 1024 || metadataEnd + TAG_LENGTH > contents.length) throw new Error("The backup format is invalid.");
  const metadataBytes = contents.subarray(metadataStart, metadataEnd);
  const metadata = metadataSchema.parse(JSON.parse(metadataBytes.toString("utf8")));
  return {
    metadata,
    metadataBytes,
    authenticationTag: contents.subarray(metadataEnd, metadataEnd + TAG_LENGTH),
    ciphertext: contents.subarray(metadataEnd + TAG_LENGTH),
  };
}

export function extractRecoveryMaterialFromBackup(backupPath: string): Buffer | null {
  try {
    const encoded = decodeBackup(fs.readFileSync(backupPath)).metadata.recoveryMaterial;
    return encoded ? Buffer.from(encoded, "base64") : null;
  } catch {
    throw new Error("The backup format is invalid or does not contain usable recovery material.");
  }
}

export class BackupService {
  private readonly closeActiveDatabase: () => void;

  constructor(private readonly options: BackupServiceOptions) {
    this.closeActiveDatabase = options.closeActiveDatabase ?? closeDatabase;
  }

  createManualBackup(destinationPath?: string): BackupResult {
    const databaseKey = this.options.keyProvider.getOrCreateKey();
    try {
      const database = openEncryptedSqlite(this.options.databasePath, databaseKey);
      try {
        if (database.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("The active database failed its integrity check.");
        database.pragma("wal_checkpoint(TRUNCATE)");
      } finally {
        database.close();
      }

      const databaseBytes = fs.readFileSync(this.options.databasePath);
      const salt = randomBytes(32);
      const nonce = randomBytes(12);
      const backupKey = deriveBackupKey(databaseKey, salt);
      const metadata: BackupMetadata = {
        formatVersion: 1,
        backupId: randomUUID(),
        createdAt: new Date().toISOString(),
        databaseCipher: "chacha20-poly1305",
        backupCipher: "aes-256-gcm",
        keyDerivation: "hkdf-sha256",
        salt: salt.toString("base64"),
        nonce: nonce.toString("base64"),
        databaseSha256: sha256(databaseBytes),
        databaseBytes: databaseBytes.length,
        schemaVersion: readSchemaVersion(this.options.databasePath, databaseKey),
        ...(this.options.recoveryMaterialPath && fs.existsSync(this.options.recoveryMaterialPath)
          ? { recoveryMaterial: readRecoveryMaterial(this.options.recoveryMaterialPath).toString("base64") }
          : {}),
      };
      const metadataBytes = Buffer.from(JSON.stringify(metadata), "utf8");
      const cipher = createCipheriv("aes-256-gcm", backupKey, nonce);
      cipher.setAAD(metadataBytes);
      const ciphertext = Buffer.concat([cipher.update(databaseBytes), cipher.final()]);
      const encoded = encodeBackup(metadata, ciphertext, cipher.getAuthTag());
      const backupPath = destinationPath ?? path.join(
        this.options.backupDirectory,
        `command-center-${metadata.createdAt.replaceAll(":", "-")}-${metadata.backupId}.ccbackup`,
      );
      fs.mkdirSync(path.dirname(path.resolve(backupPath)), { recursive: true, mode: 0o700 });
      const temporaryPath = `${backupPath}.${randomUUID()}.tmp`;
      try {
        fs.writeFileSync(temporaryPath, encoded, { mode: 0o600, flag: "wx" });
        fs.renameSync(temporaryPath, backupPath);
      } finally {
        if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath);
        backupKey.fill(0);
        databaseBytes.fill(0);
      }
      return { backupPath, metadata };
    } finally {
      databaseKey.fill(0);
    }
  }

  validateBackup(backupPath: string): BackupMetadata {
    const databaseKey = this.options.keyProvider.getOrCreateKey();
    try {
      const { metadata, databaseBytes } = this.decryptBackup(backupPath, databaseKey);
      try {
        this.validateDatabaseBytes(databaseBytes, databaseKey);
        return metadata;
      } finally {
        databaseBytes.fill(0);
      }
    } finally {
      databaseKey.fill(0);
    }
  }

  restoreBackup(backupPath: string): RestoreResult {
    const databaseKey = this.options.keyProvider.getOrCreateKey();
    let restoredTemporaryPath: string | undefined;
    let decryptedDatabaseBytes: Buffer | undefined;
    try {
      const { metadata, databaseBytes } = this.decryptBackup(backupPath, databaseKey);
      decryptedDatabaseBytes = databaseBytes;
      this.validateDatabaseBytes(databaseBytes, databaseKey);
      this.closeActiveDatabase();

      const activePath = path.resolve(this.options.databasePath);
      fs.mkdirSync(path.dirname(activePath), { recursive: true, mode: 0o700 });
      restoredTemporaryPath = `${activePath}.${randomUUID()}.restore`;
      fs.writeFileSync(restoredTemporaryPath, databaseBytes, { mode: 0o600, flag: "wx" });
      databaseBytes.fill(0);

      let protectedDatabasePath: string | null = null;
      if (fs.existsSync(activePath)) {
        const current = openEncryptedSqlite(activePath, databaseKey);
        try {
          current.pragma("wal_checkpoint(TRUNCATE)");
        } finally {
          current.close();
        }
        protectedDatabasePath = `${activePath}.pre-restore-${Date.now()}-${randomUUID()}.db`;
        fs.renameSync(activePath, protectedDatabasePath);
        for (const suffix of ["-wal", "-shm"]) {
          if (fs.existsSync(`${activePath}${suffix}`)) fs.renameSync(`${activePath}${suffix}`, `${protectedDatabasePath}${suffix}`);
        }
      }

      try {
        fs.renameSync(restoredTemporaryPath, activePath);
        restoredTemporaryPath = undefined;
        const restored = openEncryptedSqlite(activePath, databaseKey);
        try {
          if (restored.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("Restored database integrity check failed.");
        } finally {
          restored.close();
        }
        const restoredDatabase = createDatabase(activePath, new StaticDatabaseKeyProvider(databaseKey));
        try {
          new ActivityService(new DrizzleActivityEventRepository(restoredDatabase)).record({
            eventType: "BACKUP_RESTORED",
            description: "An encrypted backup was restored.",
            entityType: "backup",
            entityId: metadata.backupId,
            source: "system",
            metadata: { formatVersion: metadata.formatVersion, createdAt: metadata.createdAt },
          });
        } finally {
          restoredDatabase.$client.close();
        }
        pruneProtectedCopies(activePath, "pre-restore");
      } catch (error) {
        if (fs.existsSync(activePath)) fs.rmSync(activePath);
        if (protectedDatabasePath) {
          fs.renameSync(protectedDatabasePath, activePath);
          for (const suffix of ["-wal", "-shm"]) {
            if (fs.existsSync(`${protectedDatabasePath}${suffix}`)) fs.renameSync(`${protectedDatabasePath}${suffix}`, `${activePath}${suffix}`);
          }
        }
        throw error;
      }

      return { metadata, protectedDatabasePath };
    } finally {
      if (restoredTemporaryPath && fs.existsSync(restoredTemporaryPath)) fs.rmSync(restoredTemporaryPath);
      decryptedDatabaseBytes?.fill(0);
      databaseKey.fill(0);
    }
  }

  private decryptBackup(backupPath: string, databaseKey: Buffer) {
    try {
      const decoded = decodeBackup(fs.readFileSync(backupPath));
      const backupKey = deriveBackupKey(databaseKey, Buffer.from(decoded.metadata.salt, "base64"));
      try {
        const decipher = createDecipheriv("aes-256-gcm", backupKey, Buffer.from(decoded.metadata.nonce, "base64"));
        decipher.setAAD(decoded.metadataBytes);
        decipher.setAuthTag(decoded.authenticationTag);
        const databaseBytes = Buffer.concat([decipher.update(decoded.ciphertext), decipher.final()]);
        if (databaseBytes.length !== decoded.metadata.databaseBytes || sha256(databaseBytes) !== decoded.metadata.databaseSha256) {
          databaseBytes.fill(0);
          throw new Error("Backup integrity validation failed.");
        }
        return { metadata: decoded.metadata, databaseBytes };
      } finally {
        backupKey.fill(0);
      }
    } catch {
      throw new Error("The backup could not be authenticated or decrypted.");
    }
  }

  private validateDatabaseBytes(databaseBytes: Buffer, databaseKey: Buffer) {
    const validationPath = path.join(path.dirname(path.resolve(this.options.databasePath)), `.backup-validation-${randomUUID()}.db`);
    try {
      fs.mkdirSync(path.dirname(validationPath), { recursive: true, mode: 0o700 });
      fs.writeFileSync(validationPath, databaseBytes, { mode: 0o600, flag: "wx" });
      const database = openEncryptedSqlite(validationPath, databaseKey);
      try {
        if (database.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("Backup database integrity check failed.");
      } finally {
        database.close();
      }
    } finally {
      for (const suffix of ["", "-wal", "-shm"]) if (fs.existsSync(`${validationPath}${suffix}`)) fs.rmSync(`${validationPath}${suffix}`);
    }
  }
}
