import { selectSpokenResponse, voiceAudioValidationError } from "@/domain/voice";
import type { JarvisPageContext } from "@/domain/jarvis";
import type { SpeechAudioInput, SpeechToTextProvider, TextToSpeechProvider } from "@/server/speech/speech-provider";
import type { AiSettingsService } from "./ai-settings-service";
import type { JarvisService } from "./jarvis-service";
import { ValidationError } from "./service-errors";

export class VoiceUnavailableError extends Error {}

export type VoiceCommandInput = SpeechAudioInput & {
  today: string;
  timeZone: string;
  pageContext: JarvisPageContext;
  priorSubject?: JarvisPageContext;
};

export class VoiceService {
  constructor(
    private readonly speechToText: SpeechToTextProvider | null,
    private readonly textToSpeech: TextToSpeechProvider | null,
    private readonly jarvis: JarvisService,
    private readonly settings: AiSettingsService,
  ) {}

  async run(input: VoiceCommandInput) {
    this.validateAudio(input);
    const status = this.settings.status();
    if (!status.cloudAiEnabled) throw new VoiceUnavailableError("Voice Jarvis is unavailable because Cloud AI is disabled. Typed and manual workflows remain available.");
    if (!status.voice.enabled) throw new VoiceUnavailableError("Voice input is disabled in Settings. Typed Jarvis remains available.");
    if (!status.voice.sttEnabled) throw new VoiceUnavailableError("Speech to text is disabled in Settings. Typed Jarvis remains available.");
    if (!this.speechToText) throw new VoiceUnavailableError("Speech to text is not configured. Typed Jarvis remains available.");

    const transcription = await this.speechToText.transcribe(input);
    if (!transcription.text.trim()) throw new ValidationError("No speech was detected. Try again or type the command.");
    if (transcription.text.length > 8_000) throw new ValidationError("The transcript is too long for a Jarvis command.");
    this.settings.recordVoiceUsage({ kind: "transcription", provider: transcription.provider, model: transcription.model, audioDurationMs: transcription.durationMs });

    const jarvis = await this.jarvis.run({ prompt: transcription.text, today: input.today, timeZone: input.timeZone, pageContext: input.pageContext, priorSubject: input.priorSubject }, "voice");
    const current = this.settings.status().voice;
    const speechDecision = selectSpokenResponse(jarvis.response, current);
    let speech = null;
    let speechError: string | null = null;
    if (speechDecision.text && !speechDecision.requiresApproval) {
      if (!this.textToSpeech) speechError = "Spoken responses are not configured; the visual result is complete.";
      else {
        try { speech = await this.synthesize(speechDecision.text); }
        catch { speechError = "The visual result is complete, but the spoken response could not be generated."; }
      }
    }
    return { transcript: transcription.text, ...jarvis, speech, speechDecision, speechError };
  }

  async synthesize(text: string) {
    const value = text.trim();
    if (!value || value.length > 1_000) throw new ValidationError("Spoken summaries must contain between 1 and 1,000 characters.");
    const status = this.settings.status();
    if (!status.voice.enabled || !status.voice.voiceResponsesEnabled) throw new VoiceUnavailableError("Spoken responses are disabled in Settings.");
    if (!this.textToSpeech) throw new VoiceUnavailableError("Text to speech is not configured.");
    const result = await this.textToSpeech.synthesize(value);
    this.settings.recordVoiceUsage({ kind: "speech", provider: result.provider, model: result.model, inputCharacters: result.inputCharacters, outputBytes: result.audio.byteLength });
    return result;
  }

  private validateAudio(input: SpeechAudioInput) {
    const error = voiceAudioValidationError({ byteLength: input.bytes.byteLength, durationMs: input.durationMs, mimeType: input.mimeType });
    if (error) throw new ValidationError(error);
  }
}
