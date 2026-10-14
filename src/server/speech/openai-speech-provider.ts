import "server-only";
import OpenAI from "openai";
import { logger } from "@/server/logging/logger";
import type { SpeechAudioInput, SpeechResult, SpeechToTextProvider, TextToSpeechProvider, TranscriptionResult } from "./speech-provider";

function logFailure(stage: "transcription" | "speech", model: string, error: unknown) {
  const apiError = error instanceof OpenAI.APIError ? error : null;
  logger.error("OpenAI speech provider failure", {
    provider: "OpenAI",
    stage,
    model,
    httpStatus: apiError?.status ?? null,
    errorType: apiError?.type ?? (error instanceof Error ? error.constructor.name : "UnknownError"),
    errorCode: apiError?.code ?? null,
    requestId: apiError?.requestID ?? null,
  });
}

export class OpenAiSpeechToTextProvider implements SpeechToTextProvider {
  readonly name = "OpenAI";
  constructor(readonly model: string, private readonly client: OpenAI) {}

  async transcribe(input: SpeechAudioInput): Promise<TranscriptionResult> {
    try {
      const file = new File([Buffer.from(input.bytes)], input.fileName, { type: input.mimeType });
      const result = await this.client.audio.transcriptions.create({ file, model: this.model, response_format: "json" });
      return { text: result.text.trim(), provider: this.name, model: this.model, durationMs: input.durationMs };
    } catch (error) {
      logFailure("transcription", this.model, error);
      throw error;
    }
  }
}

export class OpenAiTextToSpeechProvider implements TextToSpeechProvider {
  readonly name = "OpenAI";
  constructor(readonly model: string, private readonly voice: string, private readonly client: OpenAI) {}

  async synthesize(text: string): Promise<SpeechResult> {
    try {
      const response = await this.client.audio.speech.create({ model: this.model, voice: this.voice, input: text, response_format: "mp3" });
      return { audio: new Uint8Array(await response.arrayBuffer()), contentType: "audio/mpeg", provider: this.name, model: this.model, inputCharacters: text.length };
    } catch (error) {
      logFailure("speech", this.model, error);
      throw error;
    }
  }
}
