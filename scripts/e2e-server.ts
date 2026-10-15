import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDatabase } from "../src/server/db/client";
import { getEnvironment } from "../src/config/env";

const environment = getEnvironment();
const databasePath = path.resolve(environment.DATABASE_PATH);
const temporaryRoot = fs.realpathSync(os.tmpdir());
const databaseDirectory = fs.realpathSync(path.dirname(databasePath));
const backupDirectory = path.resolve(environment.BACKUP_DIRECTORY);
const backupParent = fs.realpathSync(path.dirname(backupDirectory));
const recoveryParent = fs.realpathSync(path.dirname(path.resolve(environment.RECOVERY_MATERIAL_PATH)));
if ((databaseDirectory !== temporaryRoot && !databaseDirectory.startsWith(`${temporaryRoot}${path.sep}`)) || backupParent !== temporaryRoot || recoveryParent !== temporaryRoot || !process.env.COMMAND_CENTER_TEST_DATABASE_KEY_HEX) {
  throw new Error(`E2E startup refuses unsafe configuration (temporary=${databaseDirectory === temporaryRoot}, testKey=${Boolean(process.env.COMMAND_CENTER_TEST_DATABASE_KEY_HEX)}).`);
}
const database = createDatabase(databasePath);
migrate(database, { migrationsFolder: path.resolve("drizzle") });
database.$client.close();

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1"], {
  env: process.env,
  stdio: "inherit",
});
function cleanup() {
  for (const suffix of ["", "-wal", "-shm"]) if (fs.existsSync(`${databasePath}${suffix}`)) fs.rmSync(`${databasePath}${suffix}`);
  if (fs.existsSync(backupDirectory)) fs.rmSync(backupDirectory, { recursive: true });
  if (fs.existsSync(environment.RECOVERY_MATERIAL_PATH)) fs.rmSync(environment.RECOVERY_MATERIAL_PATH);
}
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  cleanup();
  server.kill(signal);
});
process.on("exit", cleanup);
server.on("exit", (code) => { cleanup(); process.exitCode = code ?? 0; });
