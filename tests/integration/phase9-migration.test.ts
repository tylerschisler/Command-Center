import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/server/db/client";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });

describe("Phase 9 encrypted migration", () => {
  it("preserves Phase 8 AI and voice settings while adding safe cost defaults", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase9-migration-")); directories.push(directory);
    const database = createDatabase(path.join(directory, "migration.db"), new StaticDatabaseKeyProvider(Buffer.alloc(32, 92)));
    database.$client.exec("create table knowledge_pages (id text primary key not null)");
    database.$client.exec("create table ai_settings (id text primary key not null, cloud_ai_enabled integer default false not null, voice_enabled integer default false not null, stt_enabled integer default true not null, voice_responses_enabled integer default true not null, speak_confirmations integer default true not null, speak_briefings integer default false not null, speak_long_responses text default 'ask' not null, automatic_speech_character_limit integer default 280 not null, monthly_voice_warning_seconds integer, updated_at text not null)");
    database.$client.prepare("insert into ai_settings values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("default", 1, 1, 1, 0, 1, 0, "ask", 300, 600, "2026-10-14T00:00:00.000Z");
    const migration = fs.readFileSync(path.resolve("drizzle/0008_dashing_the_watchers.sql"), "utf8"); for (const statement of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) database.$client.exec(statement);
    const settings = database.$client.prepare("select * from ai_settings").get() as Record<string, unknown>; expect(settings).toMatchObject({ cloud_ai_enabled: 1, voice_enabled: 1, voice_responses_enabled: 0, monthly_voice_warning_seconds: 600, monthly_cost_warning_micros: null, monthly_cost_cutoff_micros: null, hard_cost_cutoff_enabled: 0 });
    expect(database.$client.pragma("integrity_check", { simple: true })).toBe("ok"); database.$client.close();
  });
});
