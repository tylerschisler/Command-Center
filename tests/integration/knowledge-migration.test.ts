import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/server/db/client";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));
function applySql(database: ReturnType<typeof createDatabase>, file: string) { for (const statement of fs.readFileSync(file, "utf8").split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) database.$client.exec(statement); }

describe("Phase 5 encrypted migration", () => {
  it("preserves every Phase 2–4 record and relationship while adding Knowledge FTS", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase5-migration-")); directories.push(directory); const database = createDatabase(path.join(directory, "migration.db"), new StaticDatabaseKeyProvider(Buffer.alloc(32, 95)));
    for (const name of ["0000_milky_dark_phoenix.sql", "0001_daily_imperial_guard.sql", "0002_groovy_sugar_man.sql", "0003_nervous_sleeper.sql"]) applySql(database, path.resolve("drizzle", name));
    const person = "11111111-1111-4111-8111-111111111111"; const project = "22222222-2222-4222-8222-222222222222"; const meeting = "33333333-3333-4333-8333-333333333333"; const task = "44444444-4444-4444-8444-444444444444"; const request = "55555555-5555-4555-8555-555555555555"; const now = "2026-10-13T00:00:00.000Z";
    database.$client.prepare("insert into people (id,first_name,last_name,display_name,created_at,updated_at) values (?,?,?,?,?,?)").run(person,"Prior","Person","Prior Person",now,now);
    database.$client.prepare("insert into projects (id,name,description,status,health,priority,created_at,updated_at) values (?,?,?,?,?,?,?,?)").run(project,"Prior Project","","active","on_track","medium",now,now);
    database.$client.prepare("insert into meetings (id,title,start_date_time,end_date_time,status,project_id,created_at,updated_at) values (?,?,?,?,?,?,?,?)").run(meeting,"Prior Meeting",now,"2026-10-13T01:00:00.000Z","completed",project,now,now);
    database.$client.prepare("insert into meeting_participants (meeting_id,person_id,created_at) values (?,?,?)").run(meeting,person,now); database.$client.prepare("insert into meeting_decisions (id,meeting_id,content,created_at) values (?,?,?,?)").run("66666666-6666-4666-8666-666666666666",meeting,"Prior decision",now);
    database.$client.prepare("insert into tasks (id,title,description,status,priority,owner_id,project_id,meeting_id,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?)").run(task,"Prior Task","","not_started","medium",person,project,meeting,now,now);
    database.$client.prepare("insert into requests (id,title,description,requested_from_person_id,status,priority,requested_date,due_date,project_id,related_task_id,meeting_id,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(request,"Prior Request","",person,"waiting","medium","2026-10-01","2026-10-15",project,task,meeting,now,now);
    database.$client.prepare("insert into activity_events (id,event_type,description,entity_type,entity_id,source,metadata,timestamp) values (?,?,?,?,?,?,?,?)").run("77777777-7777-4777-8777-777777777777","MEETING_COMPLETED","Prior activity","meeting",meeting,"manual","{}",now);
    applySql(database, path.resolve("drizzle/0004_silky_mojo.sql"));
    for (const table of ["projects","tasks","people","requests","meetings","meeting_participants","meeting_decisions","activity_events"]) expect((database.$client.prepare(`select count(*) as count from ${table}`).get() as { count: number }).count).toBe(1);
    expect(database.$client.prepare("select project_id, meeting_id from tasks where id = ?").get(task)).toEqual({ project_id: project, meeting_id: meeting }); expect(database.$client.prepare("select project_id, related_task_id, meeting_id from requests where id = ?").get(request)).toEqual({ project_id: project, related_task_id: task, meeting_id: meeting });
    database.$client.prepare("insert into knowledge_pages (id,title,content,created_at,updated_at) values (?,?,?,?,?)").run("88888888-8888-4888-8888-888888888888","Searchable Galileo","local full text",now,now); expect((database.$client.prepare("select count(*) as count from knowledge_pages_fts where knowledge_pages_fts match ?").get('"Galileo"*') as { count: number }).count).toBe(1);
    expect(database.$client.pragma("integrity_check", { simple: true })).toBe("ok"); expect(database.$client.pragma("foreign_key_check")).toEqual([]); database.$client.close();
  });
});
