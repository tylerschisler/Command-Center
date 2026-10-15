import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  webServer: {
    command: "node --import tsx scripts/e2e-server.ts",
    env: {
      COMMAND_CENTER_TEST_DATABASE_KEY_HEX: "11".repeat(32),
      DATABASE_PATH: path.join(os.tmpdir(), `command-center-playwright-${process.pid}.db`),
      BACKUP_DIRECTORY: path.join(os.tmpdir(), `command-center-playwright-backups-${process.pid}`),
      RECOVERY_MATERIAL_PATH: path.join(os.tmpdir(), `command-center-playwright-recovery-${process.pid}.ccrecovery`),
      COMMAND_CENTER_FAKE_AI: "true",
      OPENAI_API_KEY: "test-only-not-a-real-key",
      OPENAI_MODEL: "deterministic-test-provider",
      OPENAI_STT_MODEL: "deterministic-test-transcription",
      OPENAI_TTS_MODEL: "deterministic-test-speech",
    },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
