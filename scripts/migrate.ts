import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDatabase } from "../src/server/db/client";
import { getEnvironment } from "../src/config/env";

const database = createDatabase(getEnvironment().DATABASE_PATH);
migrate(database, { migrationsFolder: path.resolve("drizzle") });
console.log("Database migrations applied.");
