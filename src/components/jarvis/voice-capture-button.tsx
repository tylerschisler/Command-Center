"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_VOICE_DURATION_MS } from "@/domain/voice";

type CaptureState = "idle" | "requesting" | "listening";

function microphoneError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone permission was denied. You can continue by typing.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No microphone was found. You can continue by typing.";
  return "The microphone could not be started. You can continue by typing.";
}

export function VoiceCaptureButton({ disabled, onCapture, onError, onStateChange }: {
  disabled?: boolean;
  onCapture: (audio: Blob, durationMs: number) => void | Promise<void>;
  onError: (message: string) => void;
  onStateChange?: (state: CaptureState) => void;
}) {
  const [state, setState] = useState<CaptureState>("idle");
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), chunks = useRef<Blob[]>([]), startedAt = useRef(0), stopRequested = useRef(false), timer = useRef<number | null>(null);
  const update = (next: CaptureState) => { setState(next); onStateChange?.(next); };

  function cleanUp() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    recorder.current = null;
  }

  useEffect(() => () => cleanUp(), []);

  async function start() {
    if (disabled || state !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { onError("Voice recording is not supported in this browser. You can continue by typing."); return; }
    stopRequested.current = false; update("requesting");
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.current = nextStream;
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const nextRecorder = preferred ? new MediaRecorder(nextStream, { mimeType: preferred }) : new MediaRecorder(nextStream);
      recorder.current = nextRecorder; chunks.current = []; startedAt.current = performance.now();
      nextRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      nextRecorder.onerror = () => { cleanUp(); update("idle"); onError("Voice recording failed. You can continue by typing."); };
      nextRecorder.onstop = () => {
        const durationMs = Math.max(1, Math.min(MAX_VOICE_DURATION_MS, Math.round(performance.now() - startedAt.current)));
        const audio = new Blob(chunks.current, { type: nextRecorder.mimeType || "audio/webm" });
        cleanUp(); update("idle");
        if (!audio.size) onError("The recording was empty. Try again or type the command.");
        else void onCapture(audio, durationMs);
      };
      nextRecorder.start(); update("listening");
      timer.current = window.setTimeout(() => stop(), MAX_VOICE_DURATION_MS);
      if (stopRequested.current) stop();
    } catch (error) { cleanUp(); update("idle"); onError(microphoneError(error)); }
  }

  function stop() {
    stopRequested.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  return <button
    type="button"
    className={`voice-button ${state === "listening" ? "listening" : ""}`}
    disabled={disabled}
    aria-label={state === "listening" ? "Release to send voice command" : "Hold to talk to Jarvis"}
    aria-pressed={state === "listening"}
    onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); void start(); }}
    onPointerUp={stop}
    onPointerCancel={stop}
    onKeyDown={(event) => { if (!event.repeat && (event.key === " " || event.key === "Enter")) { event.preventDefault(); void start(); } }}
    onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); stop(); } }}
  ><span aria-hidden="true">●</span>{state === "requesting" ? "Starting…" : state === "listening" ? "Listening…" : "Hold to talk"}</button>;
}
