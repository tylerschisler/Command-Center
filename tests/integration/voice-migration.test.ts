import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/server/db/client";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });

describe("Phase 8 encrypted migration", () => {
  it("preserves an existing Phase 7 AI setting and applies voice defaults", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "voice-migration-")); directories.push(directory);
    const database = createDatabase(path.join(directory, "migration.db"), new StaticDatabaseKeyProvider(Buffer.alloc(32, 86)));
    database.$client.exec("create table ai_settings (id text primary key not null, cloud_ai_enabled integer default false not null, updated_at text not null)");
    database.$client.prepare("insert into ai_settings (id, cloud_ai_enabled, updated_at) values (?, ?, ?)").run("default", 1, "2026-10-13T12:00:00.000Z");
    const migration = fs.readFileSync(path.resolve("drizzle/0007_large_blindfold.sql"), "utf8");
    for (const statement of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) database.$client.exec(statement);
    const settings = database.$client.prepare("select * from ai_settings where id = 'default'").get() as Record<string, unknown>;
    expect(settings).toMatchObject({ cloud_ai_enabled: 1, voice_enabled: 0, stt_enabled: 1, voice_responses_enabled: 1, speak_long_responses: "ask", automatic_speech_character_limit: 280 });
    expect(database.$client.pragma("integrity_check", { simple: true })).toBe("ok"); database.$client.close();
  });
});
