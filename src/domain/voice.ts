import type { JarvisResponse } from "./jarvis";

export const MAX_VOICE_AUDIO_BYTES = 5 * 1024 * 1024;
export const MAX_VOICE_DURATION_MS = 30_000;
export const MIN_VOICE_AUDIO_BYTES = 4;
export const SUPPORTED_VOICE_MIME_TYPES = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"] as const;

export function voiceAudioValidationError(input: { byteLength: number; durationMs: number; mimeType: string }): string | null {
  if (!Number.isInteger(input.durationMs) || input.durationMs <= 0 || input.durationMs > MAX_VOICE_DURATION_MS) return "Voice recordings must be between 1 and 30 seconds.";
  if (input.byteLength < MIN_VOICE_AUDIO_BYTES) return "The recording is empty. Try again or type the command.";
  if (input.byteLength > MAX_VOICE_AUDIO_BYTES) return "The recording exceeds the 5 MB voice limit.";
  const mime = input.mimeType.split(";")[0].toLowerCase();
  if (!(SUPPORTED_VOICE_MIME_TYPES as readonly string[]).includes(mime)) return "This audio format is not supported for voice commands.";
  return null;
}

export type SpokenResponseSettings = {
  voiceResponsesEnabled: boolean;
  speakConfirmations: boolean;
  speakBriefings: boolean;
  speakLongResponses: "ask" | "on" | "off";
  automaticSpeechCharacterLimit: number;
};

export type SpokenResponseDecision = { text: string | null; requiresApproval: boolean; reason: string };

function boundedSummary(value: string, limit: number) {
  const text = value.trim();
  if (text.length <= limit) return text;
  const clipped = text.slice(0, Math.max(1, limit - 1)).trimEnd();
  return `${clipped}…`;
}

export function selectSpokenResponse(response: JarvisResponse, settings: SpokenResponseSettings): SpokenResponseDecision {
  if (!settings.voiceResponsesEnabled) return { text: null, requiresApproval: false, reason: "voice_responses_disabled" };
  const isConfirmation = response.actions.length > 0;
  const isBriefing = response.blocks.some((block) => block.type === "briefing_section");
  if (isConfirmation && !settings.speakConfirmations) return { text: null, requiresApproval: false, reason: "confirmations_disabled" };
  if (isBriefing && !settings.speakBriefings) return { text: null, requiresApproval: false, reason: "briefings_disabled" };
  const isLong = response.mode === "workspace" || response.summary.length > settings.automaticSpeechCharacterLimit;
  if (isLong && settings.speakLongResponses === "off") return { text: null, requiresApproval: false, reason: "long_responses_disabled" };
  if (isLong && settings.speakLongResponses === "ask") return { text: boundedSummary(response.summary, settings.automaticSpeechCharacterLimit), requiresApproval: true, reason: "long_response_requires_approval" };
  return { text: boundedSummary(response.summary, settings.automaticSpeechCharacterLimit), requiresApproval: false, reason: isBriefing ? "briefing" : isConfirmation ? "confirmation" : "summary" };
}
