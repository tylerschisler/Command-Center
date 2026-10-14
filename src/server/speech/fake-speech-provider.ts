import type { SpeechAudioInput, SpeechResult, SpeechToTextProvider, TextToSpeechProvider, TranscriptionResult } from "./speech-provider";

export class DeterministicFakeSpeechToTextProvider implements SpeechToTextProvider {
  readonly name = "Fake";
  readonly model = "deterministic-test-transcription";
  async transcribe(input: SpeechAudioInput): Promise<TranscriptionResult> {
    const text = Buffer.from(input.bytes).toString("utf8").trim();
    return { text, provider: this.name, model: this.model, durationMs: input.durationMs };
  }
}

export class DeterministicFakeTextToSpeechProvider implements TextToSpeechProvider {
  readonly name = "Fake";
  readonly model = "deterministic-test-speech";
  async synthesize(text: string): Promise<SpeechResult> {
    return { audio: new TextEncoder().encode(`FAKE-MP3:${text}`), contentType: "audio/mpeg", provider: this.name, model: this.model, inputCharacters: text.length };
  }
}
