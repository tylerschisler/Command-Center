import path from "node:path";
import fs from "node:fs";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDatabase } from "../src/server/db/client";
import { getEnvironment } from "../src/config/env";
import { getDefaultDatabaseKeyProvider } from "../src/server/security/database-key-provider";
import { BackupService } from "../src/server/services/backup-service";

const environment = getEnvironment();
if (fs.existsSync(environment.DATABASE_PATH) && fs.statSync(environment.DATABASE_PATH).size > 0) {
  const service = new BackupService({ databasePath: environment.DATABASE_PATH, backupDirectory: environment.BACKUP_DIRECTORY, keyProvider: getDefaultDatabaseKeyProvider(), recoveryMaterialPath: environment.RECOVERY_MATERIAL_PATH });
  const restorePointPath = path.join(environment.BACKUP_DIRECTORY, `command-center-migration-restore-point-${new Date().toISOString().replaceAll(":", "-")}.ccbackup`);
  const restorePoint = service.createManualBackup(restorePointPath); service.validateBackup(restorePoint.backupPath);
  console.log("Validated encrypted migration restore point created.");
}
const database = createDatabase(environment.DATABASE_PATH);
migrate(database, { migrationsFolder: path.resolve("drizzle") });
console.log("Database migrations applied.");
