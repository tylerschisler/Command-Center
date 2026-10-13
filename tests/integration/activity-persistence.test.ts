import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { sql } from "drizzle-orm";
import { createDatabase } from "@/server/db/client";
import { DrizzleActivityEventRepository } from "@/server/repositories/activity-event-repository";
import { ActivityService } from "@/server/services/activity-service";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";

const tempDirectories: string[] = [];
afterEach(() => tempDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive:true, force:true })));

describe("SQLite persistence", () => {
  it("applies migrations and reloads an ActivityEvent from disk", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "command-center-")); tempDirectories.push(directory);
    const databasePath = path.join(directory, "test.db");
    const keyProvider = new StaticDatabaseKeyProvider(Buffer.alloc(32, 1));
    const first = createDatabase(databasePath, keyProvider); migrate(first, { migrationsFolder:path.resolve("drizzle") });
    new ActivityService(new DrizzleActivityEventRepository(first)).record({ eventType:"APP_STARTED", description:"App started", entityType:"system", entityId:"app", source:"system", metadata:{ phase:1 } });
    first.$client.close();
    const reloaded = new ActivityService(new DrizzleActivityEventRepository(createDatabase(databasePath, keyProvider))).forEntity("system", "app");
    expect(reloaded).toHaveLength(1); expect(reloaded[0].source).toBe("system"); expect(reloaded[0].timestamp).toBeTruthy();
    expect(() => createDatabase(databasePath, keyProvider).run(sql`delete from activity_events`)).toThrow();
    expect(new ActivityService(new DrizzleActivityEventRepository(createDatabase(databasePath, keyProvider))).forEntity("system", "app")).toHaveLength(1);
  });
});
