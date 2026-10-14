import { expect, test, type Page } from "@playwright/test";

async function installAudioFakes(page: Page) {
  await page.addInitScript(() => {
    const state = window as unknown as { __voiceTranscript: string };
    state.__voiceTranscript = "Create a task to review the SOC report tomorrow.";
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }) } });
    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
      state = "inactive"; mimeType = "audio/webm"; ondataavailable: ((event: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor(_stream: unknown, options?: { mimeType?: string }) { if (options?.mimeType) this.mimeType = options.mimeType; }
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob([state.__voiceTranscript], { type: this.mimeType }) }); this.onstop?.(); }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
    HTMLMediaElement.prototype.play = function () { window.setTimeout(() => this.onended?.(new Event("ended")), 10); return Promise.resolve(); };
  });
}

async function setTranscript(page: Page, value: string) { await page.evaluate((text) => { (window as unknown as { __voiceTranscript: string }).__voiceTranscript = text; }, value); }
async function holdToTalk(page: Page) {
  const microphone = page.getByRole("button", { name: "Hold to talk to Jarvis" });
  await expect(microphone).toBeEnabled(); await microphone.dispatchEvent("pointerdown", { pointerId: 1 }); await expect(page.getByText("Listening", { exact: true })).toBeVisible(); await microphone.dispatchEvent("pointerup", { pointerId: 1 });
}

test("push-to-talk uses controlled Jarvis, Meeting context, and independent voice settings", async ({ page }) => {
  test.setTimeout(90_000); await installAudioFakes(page); await page.goto("/settings");
  await page.getByRole("checkbox", { name: "Cloud AI Enabled" }).check(); await page.getByRole("checkbox", { name: "Voice Enabled" }).check();

  await page.getByRole("button", { name: /Ask Jarvis/ }).click(); await holdToTalk(page);
  await expect(page.getByRole("heading", { name: "Task created" })).toBeVisible(); await expect(page.getByText(/Heard.*Create a task/s)).toBeVisible(); await expect(page.getByRole("link", { name: "Review the SOC report" })).toBeVisible();
  let status = await (await page.request.get("/api/ai/settings")).json(); expect(status.voice.usage.transcriptionRequests).toBe(1); expect(status.voice.usage.speechRequests).toBe(1);

  await page.getByRole("button", { name: "Close Jarvis" }).click(); await page.getByRole("checkbox", { name: "Speak Confirmations" }).uncheck(); await page.getByRole("checkbox", { name: "Voice Enabled" }).uncheck();
  await page.getByRole("button", { name: /Ask Jarvis/ }).click(); await expect(page.getByRole("button", { name: "Hold to talk to Jarvis" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Ask Jarvis" }).fill("What should I focus on today?"); await page.getByRole("button", { name: "Run" }).click(); await expect(page.getByRole("heading", { name: "Today’s Focus" })).toBeVisible();

  await page.getByRole("button", { name: "Close Jarvis" }).click(); await page.getByRole("checkbox", { name: "Voice Enabled" }).check();
  const now = new Date(), later = new Date(now.valueOf() + 3_600_000);
  const meetingResponse = await page.request.post("/api/meetings", { data: { title: "Voice UAR review", startDateTime: now.toISOString(), endDateTime: later.toISOString(), status: "in_progress" } }); const meeting = (await meetingResponse.json()).meeting;
  await page.goto("/calendar"); await page.getByRole("button", { name: /Voice UAR review/ }).first().click(); await page.getByRole("button", { name: "Voice command" }).click(); await setTranscript(page, "Add a note that Sarah will send the user list Friday."); await holdToTalk(page);
  await expect(page.getByRole("heading", { name: "Meeting note added" })).toBeVisible(); const detail = await (await page.request.get(`/api/meetings/${meeting.id}`)).json(); expect(detail.meeting.notes).toContain("Sarah will send the user list Friday");
  status = await (await page.request.get("/api/ai/settings")).json(); expect(status.voice.usage.transcriptionRequests).toBe(2); expect(status.voice.usage.speechRequests).toBe(1);

  await page.getByRole("button", { name: "Close Jarvis" }).click(); await page.goto("/settings"); await page.getByRole("checkbox", { name: "Cloud AI Enabled" }).uncheck(); await page.getByRole("button", { name: /Ask Jarvis/ }).click(); await expect(page.getByRole("button", { name: "Hold to talk to Jarvis" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Ask Jarvis" }).fill("What should I focus on today?"); await page.getByRole("button", { name: "Run" }).click(); await expect(page.getByText(/Jarvis is unavailable because Cloud AI is disabled/)).toBeVisible();
});
