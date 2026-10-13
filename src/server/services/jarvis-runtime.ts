import "server-only";
import { getEnvironment } from "@/config/env";
import { getDatabase } from "@/server/db/client";
import { OpenAiProvider } from "@/server/ai/openai-provider";
import { DeterministicFakeAiProvider } from "@/server/ai/fake-ai-provider";
import { JarvisToolController } from "@/server/jarvis/tool-controller";
import { DrizzleAiRepository } from "@/server/repositories/ai-repository";
import { AiSettingsService } from "./ai-settings-service";
import { JarvisService } from "./jarvis-service";
import { createWorkServices } from "./work-services";

export function createJarvisRuntime() {
  const environment = getEnvironment();
  const settings = new AiSettingsService(new DrizzleAiRepository(getDatabase()), environment);
  const tools = new JarvisToolController(createWorkServices());
  const provider = environment.COMMAND_CENTER_FAKE_AI && process.env.NODE_ENV !== "production"
    ? new DeterministicFakeAiProvider()
    : environment.OPENAI_API_KEY && environment.OPENAI_MODEL
      ? new OpenAiProvider(environment.OPENAI_API_KEY, environment.OPENAI_MODEL, environment.OPENAI_TIMEOUT_MS, environment.OPENAI_MAX_RETRIES)
      : null;
  return { settings, jarvis: new JarvisService(provider, tools, settings) };
}
