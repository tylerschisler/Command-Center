import "server-only";
import OpenAI from "openai";
import { getEnvironment } from "@/config/env";
import { getDatabase } from "@/server/db/client";
import { OpenAiProvider } from "@/server/ai/openai-provider";
import { DeterministicFakeAiProvider } from "@/server/ai/fake-ai-provider";
import { JarvisToolController } from "@/server/jarvis/tool-controller";
import { DrizzleAiRepository } from "@/server/repositories/ai-repository";
import { AiSettingsService } from "./ai-settings-service";
import { JarvisService } from "./jarvis-service";
import { VoiceService } from "./voice-service";
import { createWorkServices } from "./work-services";
import { DeterministicFakeSpeechToTextProvider, DeterministicFakeTextToSpeechProvider } from "@/server/speech/fake-speech-provider";
import { OpenAiSpeechToTextProvider, OpenAiTextToSpeechProvider } from "@/server/speech/openai-speech-provider";

export function createJarvisRuntime() {
  const environment = getEnvironment();
  const settings = new AiSettingsService(new DrizzleAiRepository(getDatabase()), environment);
  const tools = new JarvisToolController(createWorkServices());
  const fake = environment.COMMAND_CENTER_FAKE_AI && process.env.NODE_ENV !== "production";
  const client = environment.OPENAI_API_KEY ? new OpenAI({ apiKey: environment.OPENAI_API_KEY, timeout: environment.OPENAI_TIMEOUT_MS, maxRetries: environment.OPENAI_MAX_RETRIES }) : null;
  const provider = fake ? new DeterministicFakeAiProvider() : client && environment.OPENAI_MODEL ? new OpenAiProvider(environment.OPENAI_API_KEY!, environment.OPENAI_MODEL, environment.OPENAI_TIMEOUT_MS, environment.OPENAI_MAX_RETRIES, client) : null;
  const speechToText = fake ? new DeterministicFakeSpeechToTextProvider() : client && environment.OPENAI_STT_MODEL ? new OpenAiSpeechToTextProvider(environment.OPENAI_STT_MODEL, client) : null;
  const textToSpeech = fake ? new DeterministicFakeTextToSpeechProvider() : client && environment.OPENAI_TTS_MODEL ? new OpenAiTextToSpeechProvider(environment.OPENAI_TTS_MODEL, environment.OPENAI_TTS_VOICE, client) : null;
  const jarvis = new JarvisService(provider, tools, settings);
  return { settings, jarvis, voice: new VoiceService(speechToText, textToSpeech, jarvis, settings) };
}
