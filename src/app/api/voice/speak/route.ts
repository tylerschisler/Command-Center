import { z } from "zod";
import { readJson, workErrorResponse } from "@/app/api/work-response";
import { createJarvisRuntime } from "@/server/services/jarvis-runtime";
import { VoiceUnavailableError } from "@/server/services/voice-service";

export async function POST(request: Request) {
  try {
    const body = z.object({ text: z.string().trim().min(1).max(1_000) }).parse(await readJson(request));
    const speech = await createJarvisRuntime().voice.synthesize(body.text);
    return new Response(Buffer.from(speech.audio), { headers: { "content-type": speech.contentType, "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof VoiceUnavailableError) return Response.json({ error: error.message }, { status: 503 });
    return workErrorResponse(error);
  }
}
