import { getEnvironment } from "@/config/env";
import { getDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { getDefaultDatabaseKeyProvider, MacOsKeychainKeyProvider } from "@/server/security/database-key-provider";
import { ActivityService } from "./activity-service";
import { BackupService } from "./backup-service";
import { RecoveryService } from "./recovery-service";

export function createServices() {
  const database = getDatabase();
  const environment = getEnvironment();
  return {
    activity: new ActivityService(new DrizzleActivityEventRepository(database)),
    backup: new BackupService({
      databasePath: environment.DATABASE_PATH,
      backupDirectory: environment.BACKUP_DIRECTORY,
      keyProvider: getDefaultDatabaseKeyProvider(),
      recoveryMaterialPath: environment.RECOVERY_MATERIAL_PATH,
    }),
    recovery: new RecoveryService({
      databasePath: environment.DATABASE_PATH,
      backupDirectory: environment.BACKUP_DIRECTORY,
      recoveryMaterialPath: environment.RECOVERY_MATERIAL_PATH,
      keyStore: new MacOsKeychainKeyProvider(),
    }),
  };
}

export type ApplicationServices = ReturnType<typeof createServices>;
