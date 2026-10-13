import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/server/db/client";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));
function applySql(database: ReturnType<typeof createDatabase>, file: string) { for (const statement of fs.readFileSync(file, "utf8").split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) database.$client.exec(statement); }

describe("Phase 4 encrypted migration", () => {
  it("preserves Phase 2/3 records and activity while adding meeting relationships", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase4-migration-")); directories.push(directory); const database = createDatabase(path.join(directory, "migration.db"), new StaticDatabaseKeyProvider(Buffer.alloc(32, 94)));
    for (const name of ["0000_milky_dark_phoenix.sql", "0001_daily_imperial_guard.sql", "0002_groovy_sugar_man.sql"]) applySql(database, path.resolve("drizzle", name));
    const person = "11111111-1111-4111-8111-111111111111"; const project = "22222222-2222-4222-8222-222222222222"; const task = "33333333-3333-4333-8333-333333333333"; const request = "44444444-4444-4444-8444-444444444444"; const now = "2026-10-12T00:00:00.000Z";
    database.$client.prepare("insert into people (id,first_name,last_name,display_name,created_at,updated_at) values (?,?,?,?,?,?)").run(person,"Prior","Person","Prior Person",now,now);
    database.$client.prepare("insert into projects (id,name,description,status,health,priority,created_at,updated_at) values (?,?,?,?,?,?,?,?)").run(project,"Prior Project","","active","on_track","medium",now,now);
    database.$client.prepare("insert into tasks (id,title,description,status,priority,owner_id,project_id,created_at,updated_at) values (?,?,?,?,?,?,?,?,?)").run(task,"Prior Task","","not_started","medium",person,project,now,now);
    database.$client.prepare("insert into requests (id,title,description,requested_from_person_id,status,priority,requested_date,due_date,project_id,related_task_id,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?)").run(request,"Prior Request","",person,"waiting","medium","2026-10-01","2026-10-15",project,task,now,now);
    database.$client.prepare("insert into activity_events (id,event_type,description,entity_type,entity_id,source,metadata,timestamp) values (?,?,?,?,?,?,?,?)").run("55555555-5555-4555-8555-555555555555","TASK_CREATED","Prior activity","task",task,"manual","{}",now);
    applySql(database, path.resolve("drizzle/0003_nervous_sleeper.sql"));
    expect((database.$client.prepare("select count(*) as count from tasks").get() as { count: number }).count).toBe(1); expect((database.$client.prepare("select count(*) as count from requests").get() as { count: number }).count).toBe(1); expect((database.$client.prepare("select count(*) as count from people").get() as { count: number }).count).toBe(1); expect((database.$client.prepare("select count(*) as count from projects").get() as { count: number }).count).toBe(1); expect((database.$client.prepare("select count(*) as count from activity_events").get() as { count: number }).count).toBe(1);
    expect(database.$client.prepare("select meeting_id from tasks where id = ?").get(task)).toEqual({ meeting_id: null }); expect(database.$client.prepare("select meeting_id from requests where id = ?").get(request)).toEqual({ meeting_id: null }); expect(database.$client.pragma("integrity_check", { simple: true })).toBe("ok"); expect(database.$client.pragma("foreign_key_check")).toEqual([]); database.$client.close();
  });
});
