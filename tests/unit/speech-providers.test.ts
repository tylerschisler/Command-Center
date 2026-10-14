import { afterEach, describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { OpenAiSpeechToTextProvider, OpenAiTextToSpeechProvider } from "@/server/speech/openai-speech-provider";

vi.mock("server-only", () => ({}));
afterEach(() => vi.restoreAllMocks());

describe("OpenAI speech providers", () => {
  it("sends bounded audio to transcription and returns trimmed text", async () => {
    const create = vi.fn().mockResolvedValue({ text: "  Create a task tomorrow.  ", usage: { type: "tokens", total_tokens: 12 } });
    const client = { audio: { transcriptions: { create }, speech: { create: vi.fn() } } } as unknown as OpenAI;
    const provider = new OpenAiSpeechToTextProvider("test-stt", client);
    const result = await provider.transcribe({ bytes: new Uint8Array([1, 2, 3, 4]), fileName: "voice.webm", mimeType: "audio/webm", durationMs: 1_250 });
    expect(result).toEqual({ text: "Create a task tomorrow.", provider: "OpenAI", model: "test-stt", durationMs: 1_250 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: "test-stt", response_format: "json" }));
    expect(create.mock.calls[0][0].file).toBeInstanceOf(File);
  });

  it("returns in-memory speech bytes without writing a file", async () => {
    const audio = new Uint8Array([73, 68, 51]);
    const create = vi.fn().mockResolvedValue(new Response(audio));
    const client = { audio: { transcriptions: { create: vi.fn() }, speech: { create } } } as unknown as OpenAI;
    const result = await new OpenAiTextToSpeechProvider("test-tts", "alloy", client).synthesize("Done.");
    expect(result.audio).toEqual(audio); expect(result.contentType).toBe("audio/mpeg"); expect(result.inputCharacters).toBe(5);
    expect(create).toHaveBeenCalledWith({ model: "test-tts", voice: "alloy", input: "Done.", response_format: "mp3" });
  });

  it("logs only sanitized metadata when speech providers fail", async () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = OpenAI.APIError.generate(429, { error: { type: "rate_limit_error", code: "rate_limit_exceeded", message: "SENSITIVE TRANSCRIPT" } }, undefined, new Headers({ "x-request-id": "req_voice_1" }));
    const client = { audio: { transcriptions: { create: vi.fn().mockRejectedValue(failure) }, speech: { create: vi.fn() } } } as unknown as OpenAI;
    await expect(new OpenAiSpeechToTextProvider("test-stt", client).transcribe({ bytes: new Uint8Array([1, 2, 3, 4]), fileName: "voice.webm", mimeType: "audio/webm", durationMs: 500 })).rejects.toBe(failure);
    const logged = output.mock.calls.flat().join(" ");
    expect(logged).toContain("rate_limit_exceeded"); expect(logged).toContain("req_voice_1"); expect(logged).not.toContain("SENSITIVE TRANSCRIPT");
  });
});
