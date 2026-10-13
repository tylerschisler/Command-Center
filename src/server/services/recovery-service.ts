import fs from "node:fs";
import path from "node:path";
import { openEncryptedSqlite } from "@/server/db/client";
import { StaticDatabaseKeyProvider, type DatabaseKeyStore } from "@/server/security/database-key-provider";
import {
  createRecoveryMaterial,
  DEFAULT_RECOVERY_KDF,
  generateRecoveryCredential,
  readRecoveryMaterial,
  unwrapRecoveryMaterial,
  writeRecoveryMaterial,
  type RecoveryKdfParameters,
} from "@/server/security/recovery-material";
import { BackupService, extractRecoveryMaterialFromBackup, type BackupMetadata } from "./backup-service";

export interface RecoveryServiceOptions {
  databasePath: string;
  backupDirectory: string;
  recoveryMaterialPath: string;
  keyStore: DatabaseKeyStore;
  kdfParameters?: RecoveryKdfParameters;
}

export interface RecoveryCredentialResult {
  credential: string;
  recoveryMaterialPath: string;
}

export class RecoveryService {
  constructor(private readonly options: RecoveryServiceOptions) {}

  initializeRecovery(): RecoveryCredentialResult {
    if (fs.existsSync(this.options.recoveryMaterialPath)) {
      throw new Error("Recovery is already initialized. Rotate the recovery credential instead.");
    }
    const databaseKey = this.options.keyStore.getKey();
    if (!databaseKey) throw new Error("The database key is unavailable from macOS Keychain.");
    try {
      this.verifyDatabaseKey(databaseKey);
      return this.writeNewCredential(databaseKey);
    } finally {
      databaseKey.fill(0);
    }
  }

  verifyCredential(credential: string): boolean {
    const databaseKey = unwrapRecoveryMaterial(readRecoveryMaterial(this.options.recoveryMaterialPath), credential);
    try {
      this.verifyDatabaseKey(databaseKey);
      return true;
    } finally {
      databaseKey.fill(0);
    }
  }

  restoreKeychain(credential: string): void {
    const databaseKey = unwrapRecoveryMaterial(readRecoveryMaterial(this.options.recoveryMaterialPath), credential);
    try {
      this.verifyDatabaseKey(databaseKey);
      this.options.keyStore.setKey(databaseKey);
    } finally {
      databaseKey.fill(0);
    }
  }

  restoreKeychainFromBackup(backupPath: string, credential: string): BackupMetadata {
    const material = extractRecoveryMaterialFromBackup(backupPath);
    if (!material) throw new Error("This backup predates portable recovery and cannot recreate the Keychain entry.");
    const databaseKey = unwrapRecoveryMaterial(material, credential);
    try {
      const metadata = new BackupService({
        databasePath: this.options.databasePath,
        backupDirectory: this.options.backupDirectory,
        keyProvider: new StaticDatabaseKeyProvider(databaseKey),
      }).validateBackup(backupPath);
      writeRecoveryMaterial(this.options.recoveryMaterialPath, material);
      this.options.keyStore.setKey(databaseKey);
      return metadata;
    } finally {
      material.fill(0);
      databaseKey.fill(0);
    }
  }

  rotateCredential(currentCredential: string): RecoveryCredentialResult {
    const databaseKey = unwrapRecoveryMaterial(readRecoveryMaterial(this.options.recoveryMaterialPath), currentCredential);
    try {
      this.verifyDatabaseKey(databaseKey);
      return this.writeNewCredential(databaseKey);
    } finally {
      databaseKey.fill(0);
    }
  }

  private writeNewCredential(databaseKey: Buffer): RecoveryCredentialResult {
    const credential = generateRecoveryCredential();
    const material = createRecoveryMaterial(
      databaseKey,
      credential,
      this.options.kdfParameters ?? DEFAULT_RECOVERY_KDF,
    );
    try {
      writeRecoveryMaterial(this.options.recoveryMaterialPath, material);
      return { credential, recoveryMaterialPath: path.resolve(this.options.recoveryMaterialPath) };
    } finally {
      material.fill(0);
    }
  }

  private verifyDatabaseKey(databaseKey: Buffer): void {
    const database = openEncryptedSqlite(this.options.databasePath, databaseKey);
    try {
      if (database.pragma("integrity_check", { simple: true }) !== "ok") {
        throw new Error("The encrypted database failed its integrity check.");
      }
    } finally {
      database.close();
    }
  }
}
