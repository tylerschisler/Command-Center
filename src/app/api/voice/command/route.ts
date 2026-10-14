import { z } from "zod";
import { MAX_VOICE_AUDIO_BYTES } from "@/domain/voice";
import { workErrorResponse } from "@/app/api/work-response";
import { createJarvisRuntime } from "@/server/services/jarvis-runtime";
import { ValidationError } from "@/server/services/service-errors";
import { VoiceUnavailableError } from "@/server/services/voice-service";

const contextSchema = z.object({
  entityType: z.enum(["task", "project", "request", "person", "meeting", "knowledge_page", "briefing"]),
  entityId: z.string().uuid(),
  label: z.string().max(200).optional(),
}).nullable();
const metadataSchema = z.object({
  durationMs: z.coerce.number().int().positive(),
  today: z.string(),
  timeZone: z.string(),
  pageContext: contextSchema,
  priorSubject: contextSchema.optional(),
});
const allowedFields = new Set(["audio", "durationMs", "today", "timeZone", "pageContext", "priorSubject"]);
const extensions: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg" };

function parseContext(value: FormDataEntryValue | null) {
  if (!value || value === "null") return null;
  if (typeof value !== "string") throw new ValidationError("Invalid voice context.");
  try { return JSON.parse(value); }
  catch { throw new ValidationError("Invalid voice context."); }
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) throw new ValidationError("Voice commands require multipart audio input.");
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_VOICE_AUDIO_BYTES + 128 * 1024) throw new ValidationError("The recording exceeds the 5 MB voice limit.");
    const form = await request.formData();
    for (const key of form.keys()) if (!allowedFields.has(key)) throw new ValidationError("Unexpected voice command field.");
    const audio = form.get("audio");
    if (!(audio instanceof File)) throw new ValidationError("A voice recording is required.");
    const mimeType = audio.type.split(";")[0].toLowerCase();
    const metadata = metadataSchema.parse({ durationMs: form.get("durationMs"), today: form.get("today"), timeZone: form.get("timeZone"), pageContext: parseContext(form.get("pageContext")), priorSubject: parseContext(form.get("priorSubject")) });
    const result = await createJarvisRuntime().voice.run({ bytes: new Uint8Array(await audio.arrayBuffer()), fileName: `voice-command.${extensions[mimeType] ?? "bin"}`, mimeType, ...metadata });
    return Response.json({ ...result, speech: result.speech ? { audioBase64: Buffer.from(result.speech.audio).toString("base64"), contentType: result.speech.contentType, model: result.speech.model } : null });
  } catch (error) {
    if (error instanceof VoiceUnavailableError) return Response.json({ error: error.message }, { status: 503 });
    return workErrorResponse(error);
  }
}
