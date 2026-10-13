import { getEnvironment } from "../src/config/env";
import { getDefaultDatabaseKeyProvider } from "../src/server/security/database-key-provider";
import { BackupService } from "../src/server/services/backup-service";

const [operation, backupPath, confirmation] = process.argv.slice(2);
const environment = getEnvironment();
const service = new BackupService({
  databasePath: environment.DATABASE_PATH,
  backupDirectory: environment.BACKUP_DIRECTORY,
  keyProvider: getDefaultDatabaseKeyProvider(),
  recoveryMaterialPath: environment.RECOVERY_MATERIAL_PATH,
});

if (operation === "create") {
  const result = service.createManualBackup(backupPath);
  console.log(`Encrypted backup created: ${result.backupPath}`);
} else if (operation === "validate" && backupPath) {
  const metadata = service.validateBackup(backupPath);
  console.log(`Backup is valid: ${metadata.backupId} (${metadata.createdAt})`);
} else if (operation === "restore" && backupPath) {
  if (confirmation !== "--confirm") throw new Error("Restore requires explicit confirmation: append --confirm");
  const result = service.restoreBackup(backupPath);
  console.log(`Backup restored. Protected prior database: ${result.protectedDatabasePath ?? "none"}`);
} else {
  throw new Error("Usage: backup.ts create [path] | validate <path> | restore <path> --confirm");
}
