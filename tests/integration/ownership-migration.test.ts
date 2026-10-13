import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/server/db/client";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));
function applySql(database: ReturnType<typeof createDatabase>, file: string) {
  for (const statement of fs.readFileSync(file, "utf8").split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) database.$client.exec(statement);
}

describe("Phase 3 ownership migration", () => {
  it("preserves anonymous delegated owner tokens without creating fake people", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "command-center-owner-migration-")); directories.push(directory);
    const database = createDatabase(path.join(directory, "migration.db"), new StaticDatabaseKeyProvider(Buffer.alloc(32, 91)));
    applySql(database, path.resolve("drizzle/0000_milky_dark_phoenix.sql")); applySql(database, path.resolve("drizzle/0001_daily_imperial_guard.sql"));
    const taskId = "11111111-1111-4111-8111-111111111111"; const ownerToken = "22222222-2222-4222-8222-222222222222";
    database.$client.prepare("insert into tasks (id,title,description,status,priority,owner_id,created_at,updated_at) values (?,?,?,?,?,?,?,?)").run(taskId, "Legacy delegated", "", "not_started", "medium", ownerToken, "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
    applySql(database, path.resolve("drizzle/0002_groovy_sugar_man.sql"));
    const migrated = database.$client.prepare("select owner_id, unresolved_owner_token from tasks where id = ?").get(taskId) as { owner_id: string | null; unresolved_owner_token: string | null };
    expect(migrated).toEqual({ owner_id: null, unresolved_owner_token: ownerToken });
    expect((database.$client.prepare("select count(*) as count from people").get() as { count: number }).count).toBe(0);
    expect(database.$client.pragma("integrity_check", { simple: true })).toBe("ok"); database.$client.close();
  });
});
