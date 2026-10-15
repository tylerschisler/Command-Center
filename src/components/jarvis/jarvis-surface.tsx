"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  navigationHref,
  type JarvisPageContext,
  type JarvisResponse,
} from "@/domain/jarvis";
import { JARVIS_CONTEXT_EVENT, JARVIS_OPEN_EVENT } from "./jarvis-context";
import { VoiceCaptureButton } from "./voice-capture-button";
import {
  normalizeJarvisSettingsStatus,
  SAFE_JARVIS_SETTINGS,
  type JarvisSettingsStatus,
} from "@/domain/ai-settings";

type SpeechDecision = {
  text: string | null;
  requiresApproval: boolean;
  reason: string;
};
type SpeechPayload = {
  audioBase64: string;
  contentType: string;
  model: string;
};
type Result = {
  response: JarvisResponse;
  subject: JarvisPageContext;
  transcript?: string;
  speech?: SpeechPayload | null;
  speechDecision?: SpeechDecision;
  speechError?: string | null;
};
type VoiceState =
  "idle" | "listening" | "processing" | "thinking" | "speaking" | "error";

const entityHref = (type: string, id: string) =>
  type === "project"
    ? `/projects?project=${id}`
    : type === "knowledge_page"
      ? `/knowledge?page=${id}`
      : type === "person"
        ? `/people?person=${id}`
        : type === "meeting"
          ? `/calendar?meeting=${id}`
          : type === "request"
            ? `/waiting-on?request=${id}`
            : `/my-work?task=${id}`;
const voiceLabels: Record<VoiceState, string> = {
  idle: "Idle",
  listening: "Listening",
  processing: "Processing speech",
  thinking: "Thinking / executing",
  speaking: "Speaking",
  error: "Error",
};

function decodeSpeech(payload: SpeechPayload) {
  const binary = atob(payload.audioBase64),
    bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: payload.contentType });
}

export function JarvisSurface() {
  const [open, setOpen] = useState(false),
    [prompt, setPrompt] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [voiceWarning, setVoiceWarning] = useState(""),
    [result, setResult] = useState<Result | null>(null),
    [context, setContext] = useState<JarvisPageContext>(null),
    [subject, setSubject] = useState<JarvisPageContext>(null),
    [settings, setSettings] =
      useState<JarvisSettingsStatus>(SAFE_JARVIS_SETTINGS),
    [settingsWarning, setSettingsWarning] = useState(""),
    [voiceState, setVoiceState] = useState<VoiceState>("idle"),
    [transcript, setTranscript] = useState("");
  const router = useRouter();

  function openJarvis() {
    setSettingsWarning("");
    setOpen(true);
  }

  useEffect(() => {
    const contextListener = (event: Event) =>
      setContext((event as CustomEvent<JarvisPageContext>).detail);
    const openListener = () => openJarvis();
    window.addEventListener(JARVIS_CONTEXT_EVENT, contextListener);
    window.addEventListener(JARVIS_OPEN_EVENT, openListener);
    return () => {
      window.removeEventListener(JARVIS_CONTEXT_EVENT, contextListener);
      window.removeEventListener(JARVIS_OPEN_EVENT, openListener);
    };
  }, []);
  useEffect(() => {
    if (open) {
      void fetch("/api/ai/settings")
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error("settings unavailable");
          setSettings(normalizeJarvisSettingsStatus(body));
        })
        .catch(() => {
          setSettings(SAFE_JARVIS_SETTINGS);
          setSettingsWarning(
            "Voice settings could not be loaded. Typed Jarvis remains available.",
          );
        });
    }
  }, [open]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        openJarvis();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setVoiceWarning("");
    try {
      const response = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          today: new Date().toLocaleDateString("en-CA"),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          pageContext: context,
          priorSubject: subject,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setResult(body);
      setSubject(body.subject);
      setPrompt("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Jarvis is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function playAudio(blob: Blob) {
    const url = URL.createObjectURL(blob),
      audio = new Audio(url);
    setVoiceState("speaking");
    try {
      await audio.play();
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("playback"));
      });
      setVoiceState("idle");
    } catch {
      setVoiceState("error");
      setVoiceWarning(
        "The visual result is complete, but audio playback failed.",
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function runVoice(audio: Blob, durationMs: number) {
    setError("");
    setVoiceWarning("");
    setTranscript("");
    setVoiceState("processing");
    const thinkingTimer = window.setTimeout(
      () => setVoiceState("thinking"),
      350,
    );
    try {
      const form = new FormData();
      form.set("audio", audio, "voice-command.webm");
      form.set("durationMs", String(durationMs));
      form.set("today", new Date().toLocaleDateString("en-CA"));
      form.set("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      form.set("pageContext", JSON.stringify(context));
      form.set("priorSubject", JSON.stringify(subject));
      const response = await fetch("/api/voice/command", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as Result & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "Voice Jarvis is unavailable.");
      setResult(body);
      setSubject(body.subject);
      setTranscript(body.transcript ?? "");
      setVoiceWarning(body.speechError ?? "");
      if (body.speech) await playAudio(decodeSpeech(body.speech));
      else setVoiceState("idle");
    } catch (caught) {
      setVoiceState("error");
      setError(
        caught instanceof Error
          ? caught.message
          : "Voice Jarvis is unavailable. You can continue by typing.",
      );
    } finally {
      window.clearTimeout(thinkingTimer);
    }
  }

  async function speakSuggested() {
    const text = result?.speechDecision?.text;
    if (!text) return;
    setVoiceWarning("");
    setVoiceState("speaking");
    try {
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error);
      }
      await playAudio(await response.blob());
    } catch {
      setVoiceState("error");
      setVoiceWarning(
        "The visual result remains available, but the spoken summary could not be played.",
      );
    }
  }

  function navigate() {
    if (!result?.response.navigation) return;
    router.push(navigationHref(result.response.navigation));
    setOpen(false);
  }
  function close() {
    setOpen(false);
    setTranscript("");
    setVoiceState("idle");
    setVoiceWarning("");
  }
  const voiceDisabled =
    !settings.cloudAiEnabled ||
    !settings.voice.enabled ||
    !settings.voice.sttEnabled ||
    !settings.voice.sttConfigured ||
    loading;

  return (
    <>
      <button className="jarvis-trigger" onClick={openJarvis}>
        Ask Jarvis… <kbd>⌘ J</kbd>
      </button>
      {open && (
        <div
          className="jarvis-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && close()
          }
        >
          <section
            className="jarvis-surface"
            role="dialog"
            aria-modal="true"
            aria-label="Jarvis workspace"
          >
            <header>
              <div>
                <span className="eyebrow">Command workspace</span>
                <h2>Jarvis</h2>
              </div>
              <button
                className="button-secondary compact"
                onClick={close}
                aria-label="Close Jarvis"
              >
                Close
              </button>
            </header>
            {context && (
              <p className="jarvis-context">
                Working with:{" "}
                <strong>{context.label ?? context.entityType}</strong>
              </p>
            )}
            <form onSubmit={submit}>
              <label>
                <span className="sr-only">Ask Jarvis</span>
                <textarea
                  autoFocus
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Ask about your work, or describe one safe action…"
                />
              </label>
              <button disabled={loading}>{loading ? "Working…" : "Run"}</button>
            </form>
            <div className="voice-control">
              <VoiceCaptureButton
                disabled={voiceDisabled}
                onCapture={runVoice}
                onError={(message) => {
                  setVoiceState("error");
                  setError(message);
                }}
                onStateChange={(state) =>
                  setVoiceState(
                    state === "listening"
                      ? "listening"
                      : state === "requesting"
                        ? "processing"
                        : "idle",
                  )
                }
              />
              <span className={`voice-state ${voiceState}`}>
                {voiceLabels[voiceState]}
              </span>
            </div>
            {(!settings.voice.enabled || !settings.voice.sttEnabled) && (
              <p className="field-help">
                Voice input is off. Enable it in Settings; typed Jarvis remains
                available.
              </p>
            )}
            {settings.voice.enabled &&
              settings.voice.sttEnabled &&
              !settings.voice.sttConfigured && (
                <p className="field-help">
                  Configure `OPENAI_STT_MODEL` server-side to use voice input.
                </p>
              )}
            {settingsWarning && (
              <p className="form-warning" role="status">
                {settingsWarning}
              </p>
            )}
            {transcript && (
              <p className="voice-transcript">
                <span>Heard</span> “{transcript}”
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {voiceWarning && (
              <p className="form-warning" role="status">
                {voiceWarning}
              </p>
            )}
            {result && (
              <div className="jarvis-result" aria-live="polite">
                <span className="status-pill">
                  {result.response.mode.replace("_", " ")}
                </span>
                <h3>{result.response.title}</h3>
                <p>{result.response.summary}</p>
                {result.speechDecision?.requiresApproval &&
                  result.speechDecision.text && (
                    <button
                      className="button-secondary"
                      onClick={() => void speakSuggested()}
                    >
                      Speak summary
                    </button>
                  )}
                {result.response.actions.length > 0 && (
                  <section>
                    <h4>Completed actions</h4>
                    <ul>
                      {result.response.actions.map((item, index) => (
                        <li key={`${item.action}-${index}`}>
                          <a
                            href={entityHref(
                              item.reference.entityType,
                              item.reference.entityId,
                            )}
                          >
                            {item.reference.label}
                          </a>{" "}
                          · {item.action.replaceAll("_", " ")}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {result.response.blocks.map((block, index) => (
                  <section key={`${block.type}-${index}`}>
                    <h4>{block.heading}</h4>
                    {block.text && <p className="jarvis-text">{block.text}</p>}
                    {block.items.length > 0 && (
                      <ul>
                        {block.items.map((item) => (
                          <li key={item.entityId}>
                            <a
                              href={entityHref(item.entityType, item.entityId)}
                            >
                              {item.label}
                            </a>
                            {item.detail && <span>{item.detail}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
                {result.response.navigation && (
                  <button className="button-secondary" onClick={navigate}>
                    Open{" "}
                    {result.response.navigation.destination.replace("_", " ")}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
