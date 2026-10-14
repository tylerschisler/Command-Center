export type SpeechAudioInput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  durationMs: number;
};

export type TranscriptionResult = {
  text: string;
  provider: string;
  model: string;
  durationMs: number;
};

export type SpeechResult = {
  audio: Uint8Array;
  contentType: string;
  provider: string;
  model: string;
  inputCharacters: number;
};

export interface SpeechToTextProvider {
  readonly name: string;
  readonly model: string;
  transcribe(input: SpeechAudioInput): Promise<TranscriptionResult>;
}

export interface TextToSpeechProvider {
  readonly name: string;
  readonly model: string;
  synthesize(text: string): Promise<SpeechResult>;
}
