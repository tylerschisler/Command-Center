export type JarvisVoiceStatus = {
  enabled: boolean;
  sttEnabled: boolean;
  voiceResponsesEnabled: boolean;
  sttConfigured: boolean;
  ttsConfigured: boolean;
};

export type JarvisSettingsStatus = { cloudAiEnabled: boolean; voice: JarvisVoiceStatus };

export const SAFE_JARVIS_SETTINGS: JarvisSettingsStatus = {
  cloudAiEnabled: false,
  voice: { enabled: false, sttEnabled: false, voiceResponsesEnabled: false, sttConfigured: false, ttsConfigured: false },
};

export function normalizeJarvisSettingsStatus(value: unknown): JarvisSettingsStatus {
  if (!value || typeof value !== "object") return SAFE_JARVIS_SETTINGS;
  const source = value as Record<string, unknown>; const voice = source.voice && typeof source.voice === "object" ? source.voice as Record<string, unknown> : {};
  return {
    cloudAiEnabled: source.cloudAiEnabled === true,
    voice: {
      enabled: voice.enabled === true,
      sttEnabled: voice.sttEnabled === true,
      voiceResponsesEnabled: voice.voiceResponsesEnabled === true,
      sttConfigured: voice.sttConfigured === true,
      ttsConfigured: voice.ttsConfigured === true,
    },
  };
}
