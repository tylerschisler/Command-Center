import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getEnvironment } from "@/config/env";
import { DeterministicFakeAiProvider } from "@/server/ai/fake-ai-provider";
import { createDatabase } from "@/server/db/client";
import { JarvisToolController } from "@/server/jarvis/tool-controller";
import { DrizzleAiRepository } from "@/server/repositories/ai-repository";
import { StaticDatabaseKeyProvider } from "@/server/security/database-key-provider";
import { AiSettingsService } from "@/server/services/ai-settings-service";
import { JarvisService } from "@/server/services/jarvis-service";
import { VoiceService } from "@/server/services/voice-service";
import { createWorkServices } from "@/server/services/work-services";
import { DeterministicFakeSpeechToTextProvider, DeterministicFakeTextToSpeechProvider } from "@/server/speech/fake-speech-provider";
import type { TextToSpeechProvider } from "@/server/speech/speech-provider";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });

function setup(textToSpeech: TextToSpeechProvider = new DeterministicFakeTextToSpeechProvider()) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "voice-jarvis-integration-")); directories.push(directory);
  const database = createDatabase(path.join(directory, "voice.db"), new StaticDatabaseKeyProvider(Buffer.alloc(32, 85)));
  migrate(database, { migrationsFolder: path.resolve("drizzle") });
  const environment = getEnvironment({ ...process.env, OPENAI_API_KEY: "test-only", OPENAI_MODEL: "test-ai", OPENAI_STT_MODEL: "test-stt", OPENAI_TTS_MODEL: "test-tts" });
  const settings = new AiSettingsService(new DrizzleAiRepository(database), environment, () => new Date("2026-10-13T12:00:00.000Z"));
  settings.setCloudAiEnabled(true); settings.updateVoiceSettings({ voiceEnabled: true });
  const services = createWorkServices(database), tools = new JarvisToolController(services), jarvis = new JarvisService(new DeterministicFakeAiProvider(), tools, settings);
  const voice = new VoiceService(new DeterministicFakeSpeechToTextProvider(), textToSpeech, jarvis, settings);
  return { database, settings, services, voice };
}

const audio = (text: string) => ({ bytes: new TextEncoder().encode(text), fileName: "voice.webm", mimeType: "audio/webm", durationMs: 1_200, today: "2026-10-13", timeZone: "America/Chicago", pageContext: null });

describe("Voice Jarvis on encrypted SQLite", () => {
  it("transcribes into the existing Jarvis pipeline, speaks, and tracks metadata only", async () => {
    const app = setup(); const result = await app.voice.run(audio("Create a task to review the SOC report tomorrow."));
    const task = app.services.tasks.listTasks()[0];
    expect(result.transcript).toContain("SOC report"); expect(task).toMatchObject({ title: "Review the SOC report", dueDate: "2026-10-14" });
    expect(app.services.activity.forEntity("task", task.id)[0].source).toBe("voice"); expect(result.speech?.audio.byteLength).toBeGreaterThan(0);
    const usage = app.settings.status().voice.usage; expect(usage).toMatchObject({ transcriptionRequests: 1, speechRequests: 1, transcriptionDurationMs: 1_200 });
    const stored = JSON.stringify(app.database.$client.prepare("select * from voice_usage_records").all()); expect(stored).not.toContain(result.transcript); expect(stored).not.toContain("FAKE-MP3");
    app.database.$client.close();
  });

  it("uses explicit Meeting context for voice notes through MeetingService", async () => {
    const app = setup(); const person = app.services.people.createPerson({ firstName: "Sarah", lastName: "Jones" }); const meeting = app.services.meetings.createMeeting({ title: "UAR review", startDateTime: "2026-10-13T14:00:00.000Z", endDateTime: "2026-10-13T15:00:00.000Z" }); const context = { entityType: "meeting" as const, entityId: meeting.id, label: meeting.title };
    const result = await app.voice.run({ ...audio("Add a note that Sarah will send the user list Friday."), pageContext: context });
    expect(result.response.title).toBe("Meeting note added"); expect(app.services.meetings.getMeeting(meeting.id).notes).toContain("Sarah will send");
    await app.voice.run({ ...audio("Create a task for me to review it Monday."), pageContext: context });
    await app.voice.run({ ...audio("Create a request for Sarah to send the user list tomorrow."), pageContext: context });
    await app.voice.run({ ...audio("Add a decision that we are moving the target date to Friday."), pageContext: context });
    const detail = app.services.meetings.getMeeting(meeting.id); expect(detail.tasks[0]).toMatchObject({ title: "Review it", meetingId: meeting.id }); expect(detail.requests[0]).toMatchObject({ title: "Send the user list", requestedFromPersonId: person.id, meetingId: meeting.id }); expect(detail.decisions[0].content).toContain("moving the target date");
    expect(app.services.activity.forEntity("meeting", meeting.id)[0].source).toBe("voice"); app.database.$client.close();
  });

  it("keeps a completed Jarvis action when TTS fails", async () => {
    const failing: TextToSpeechProvider = { name: "Failing", model: "fail-tts", synthesize: async () => { throw new Error("provider unavailable"); } };
    const app = setup(failing); const result = await app.voice.run(audio("Create a task to review the SOC report tomorrow."));
    expect(app.services.tasks.listTasks()).toHaveLength(1); expect(result.response.title).toBe("Task created"); expect(result.speech).toBeNull(); expect(result.speechError).toContain("visual result is complete");
    app.database.$client.close();
  });
});
