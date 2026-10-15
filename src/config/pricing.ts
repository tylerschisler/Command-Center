export const PRICING_VERSION = "2026-10-14.1";

type TextPrice = { inputPerMillionUsd: number; cachedInputPerMillionUsd?: number; outputPerMillionUsd: number };
type TranscriptionPrice = { perMinuteUsd: number };
type SpeechPrice = { perMillionCharactersUsd: number };

const TEXT_PRICING: Record<string, TextPrice> = {
  "gpt-5.6-terra": { inputPerMillionUsd: 2, cachedInputPerMillionUsd: 0.2, outputPerMillionUsd: 12 },
  "gpt-4o": { inputPerMillionUsd: 2.5, outputPerMillionUsd: 10 },
  "gpt-4o-mini": { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6 },
  "gpt-4.1": { inputPerMillionUsd: 2, outputPerMillionUsd: 8 },
  "gpt-4.1-mini": { inputPerMillionUsd: 0.4, outputPerMillionUsd: 1.6 },
};
const TRANSCRIPTION_PRICING: Record<string, TranscriptionPrice> = {
  "gpt-4o-mini-transcribe": { perMinuteUsd: 0.003 }, "gpt-4o-transcribe": { perMinuteUsd: 0.006 }, "whisper-1": { perMinuteUsd: 0.006 },
};
const SPEECH_PRICING: Record<string, SpeechPrice> = { "tts-1": { perMillionCharactersUsd: 15 }, "tts-1-hd": { perMillionCharactersUsd: 30 } };

function micros(usd: number) { return Math.max(0, Math.round(usd * 1_000_000)); }
export function estimateTextCostMicros(model: string, inputTokens: number, outputTokens: number, cachedInputTokens = 0) {
  const price = TEXT_PRICING[model]; if (!price) return null;
  const cached = Math.min(Math.max(0, cachedInputTokens), Math.max(0, inputTokens)); const uncached = Math.max(0, inputTokens - cached);
  return micros((uncached / 1_000_000) * price.inputPerMillionUsd + (cached / 1_000_000) * (price.cachedInputPerMillionUsd ?? price.inputPerMillionUsd) + (outputTokens / 1_000_000) * price.outputPerMillionUsd);
}
export function estimateTranscriptionCostMicros(model: string, durationMs: number) { const price = TRANSCRIPTION_PRICING[model]; return price ? micros((durationMs / 60_000) * price.perMinuteUsd) : null; }
export function estimateSpeechCostMicros(model: string, characters: number) { const price = SPEECH_PRICING[model]; return price ? micros((characters / 1_000_000) * price.perMillionCharactersUsd) : null; }
