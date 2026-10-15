import { getEnvironment } from "@/config/env";
import { getDatabase } from "@/server/db/client";
import { getDefaultDatabaseKeyProvider, MacOsKeychainKeyProvider } from "@/server/security/database-key-provider";
import { BackupService } from "./backup-service";
import { BackupManagerService } from "./backup-manager-service";
import { DrizzleBackupRepository } from "@/server/repositories/backup-repository";
import { RecoveryService } from "./recovery-service";
import { createWorkServices } from "./work-services";

export function createServices() {
  const database = getDatabase();
  const environment = getEnvironment();
  const backup = new BackupService({
    databasePath: environment.DATABASE_PATH,
    backupDirectory: environment.BACKUP_DIRECTORY,
    keyProvider: getDefaultDatabaseKeyProvider(),
    recoveryMaterialPath: environment.RECOVERY_MATERIAL_PATH,
  });
  return {
    ...createWorkServices(database),
    backup,
    backupManager: new BackupManagerService(backup, new DrizzleBackupRepository(database), environment.BACKUP_DIRECTORY),
    recovery: new RecoveryService({
      databasePath: environment.DATABASE_PATH,
      backupDirectory: environment.BACKUP_DIRECTORY,
      recoveryMaterialPath: environment.RECOVERY_MATERIAL_PATH,
      keyStore: new MacOsKeychainKeyProvider(),
    }),
  };
}

export type ApplicationServices = ReturnType<typeof createServices>;
