"use client";

import { useEffect, useState } from "react";

type VoiceStatus = {
  enabled: boolean; sttEnabled: boolean; voiceResponsesEnabled: boolean; speakConfirmations: boolean; speakBriefings: boolean;
  speakLongResponses: "ask" | "on" | "off"; automaticSpeechCharacterLimit: number; monthlyVoiceWarningSeconds: number | null;
  sttModel: string | null; ttsModel: string | null; sttConfigured: boolean; ttsConfigured: boolean; monthlyWarningReached: boolean;
  usage: { transcriptionRequests: number; speechRequests: number; transcriptionDurationMs: number; speechCharacters: number };
};
type Status = { cloudAiEnabled: boolean; provider: string; model: string | null; apiKeyConfigured: boolean; available: boolean; voice: VoiceStatus; usage: { requests: number; inputTokens: number; outputTokens: number } };

export function AiSettingsWorkspace() {
  const [status, setStatus] = useState<Status | null>(null), [error, setError] = useState("");
  useEffect(() => { fetch("/api/ai/settings").then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; }).then(setStatus).catch((caught: Error) => setError(caught.message)); }, []);

  async function update(patch: Record<string, unknown>) {
    const previous = status; setError("");
    const response = await fetch("/api/ai/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }); const body = await response.json();
    if (!response.ok) { setStatus(previous); setError(body.error); } else setStatus(body);
  }
  const setVoice = (patch: Partial<VoiceStatus>) => {
    if (status) setStatus({ ...status, voice: { ...status.voice, ...patch } });
    const apiPatch: Record<string, unknown> = { ...patch };
    if (patch.enabled !== undefined) { apiPatch.voiceEnabled = patch.enabled; delete apiPatch.enabled; }
    void update(apiPatch);
  };

  return <div className="page"><div className="eyebrow">Privacy and providers</div><h1>Settings</h1><p className="lede">Command Center remains fully usable locally when cloud AI and voice are off.</p>{error && <p className="form-error" role="alert">{error}</p>}{status && <>
    <section className="settings-card"><h2>Jarvis</h2><label className="settings-toggle"><input type="checkbox" aria-label="Cloud AI Enabled" checked={status.cloudAiEnabled} onChange={(event) => { setStatus({ ...status, cloudAiEnabled: event.target.checked }); void update({ cloudAiEnabled: event.target.checked }); }} /><span><strong>Cloud AI Enabled</strong><small>Only your prompt and tool-selected context may leave this device for {status.provider}. Database keys, recovery credentials, and backup material are never sent.</small></span></label><dl><div><dt>Provider</dt><dd>{status.provider}</dd></div><div><dt>Model</dt><dd>{status.model ?? "Not configured"}</dd></div><div><dt>API key</dt><dd>{status.apiKeyConfigured ? "Configured server-side" : "Not configured"}</dd></div><div><dt>Local usage</dt><dd>{status.usage.requests} requests · {status.usage.inputTokens + status.usage.outputTokens} tokens</dd></div></dl><p className="field-help">Prompts and responses are short-lived in the browser and are not stored in the database. Usage records contain counts and timestamps only.</p></section>
    <section className="settings-card voice-settings"><h2>Voice Jarvis</h2><p>Short push-to-talk recordings use speech-to-text, the existing controlled Jarvis pipeline, and optional spoken summaries. There is no always-on or realtime session.</p>
      <label className="settings-toggle"><input type="checkbox" aria-label="Voice Enabled" checked={status.voice.enabled} onChange={(event) => setVoice({ enabled: event.target.checked })} /><span><strong>Voice Enabled</strong><small>Shows push-to-talk controls. The microphone still starts only after an explicit press.</small></span></label>
      <label className="settings-toggle"><input type="checkbox" aria-label="Speech to Text Enabled" checked={status.voice.sttEnabled} onChange={(event) => setVoice({ sttEnabled: event.target.checked })} /><span><strong>Speech to Text</strong><small>Turn off voice input while keeping typed Jarvis available.</small></span></label>
      <label className="settings-toggle"><input type="checkbox" aria-label="Voice Responses" checked={status.voice.voiceResponsesEnabled} onChange={(event) => setVoice({ voiceResponsesEnabled: event.target.checked })} /><span><strong>Voice Responses</strong><small>Turn off TTS while continuing to use speech input.</small></span></label>
      <label className="settings-toggle"><input type="checkbox" aria-label="Speak Confirmations" checked={status.voice.speakConfirmations} onChange={(event) => setVoice({ speakConfirmations: event.target.checked })} /><span><strong>Speak Confirmations</strong><small>Read short confirmations after successful actions.</small></span></label>
      <label className="settings-toggle"><input type="checkbox" aria-label="Speak Briefings" checked={status.voice.speakBriefings} onChange={(event) => setVoice({ speakBriefings: event.target.checked })} /><span><strong>Speak Briefings</strong><small>Allow a concise briefing summary; the visual briefing remains authoritative.</small></span></label>
      <div className="settings-fields"><label>Speak long responses<select aria-label="Speak Long Responses" value={status.voice.speakLongResponses} onChange={(event) => setVoice({ speakLongResponses: event.target.value as VoiceStatus["speakLongResponses"] })}><option value="ask">Ask</option><option value="on">On</option><option value="off">Off</option></select></label><label>Automatic speech limit<input aria-label="Automatic Spoken Response Limit" type="number" min={80} max={1000} value={status.voice.automaticSpeechCharacterLimit} onChange={(event) => setStatus({ ...status, voice: { ...status.voice, automaticSpeechCharacterLimit: Number(event.target.value) } })} onBlur={(event) => void update({ automaticSpeechCharacterLimit: Number(event.target.value) })} /></label><label>Monthly warning (minutes)<input aria-label="Monthly Voice Usage Warning" type="number" min={1} value={status.voice.monthlyVoiceWarningSeconds ? Math.round(status.voice.monthlyVoiceWarningSeconds / 60) : ""} placeholder="Off" onChange={(event) => setVoice({ monthlyVoiceWarningSeconds: event.target.value ? Number(event.target.value) * 60 : null })} /></label></div>
      {status.voice.monthlyWarningReached && <p className="form-warning" role="status">The optional monthly transcription warning threshold has been reached. Voice remains available until you disable it.</p>}
      <dl><div><dt>STT model</dt><dd>{status.voice.sttModel ?? "Not configured"}</dd></div><div><dt>TTS model</dt><dd>{status.voice.ttsModel ?? "Not configured"}</dd></div><div><dt>Transcription this month</dt><dd>{(status.voice.usage.transcriptionDurationMs / 60_000).toFixed(1)} min · {status.voice.usage.transcriptionRequests} requests</dd></div><div><dt>Speech this month</dt><dd>{status.voice.usage.speechRequests} requests · {status.voice.usage.speechCharacters} characters</dd></div></dl>
      <p className="field-help">Raw audio and transcripts are not stored in SQLite, backups, or usage records. Focus the Hold to talk button and hold Space or Enter for keyboard push-to-talk.</p>
    </section>
  </>}</div>;
}
