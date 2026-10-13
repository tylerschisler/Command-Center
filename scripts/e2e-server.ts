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
if ((databaseDirectory !== temporaryRoot && !databaseDirectory.startsWith(`${temporaryRoot}${path.sep}`)) || !process.env.COMMAND_CENTER_TEST_DATABASE_KEY_HEX) {
  throw new Error(`E2E startup refuses unsafe configuration (temporary=${databaseDirectory === temporaryRoot}, testKey=${Boolean(process.env.COMMAND_CENTER_TEST_DATABASE_KEY_HEX)}).`);
}
const database = createDatabase(databasePath);
migrate(database, { migrationsFolder: path.resolve("drizzle") });
database.$client.close();

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1"], {
  env: process.env,
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => { process.exitCode = code ?? 0; });
