import { z } from "zod";
import { readJson, workErrorResponse } from "@/app/api/work-response";
import { createJarvisRuntime } from "@/server/services/jarvis-runtime";

export async function GET() { try { return Response.json(createJarvisRuntime().settings.status()); } catch (error) { return workErrorResponse(error); } }
export async function PATCH(request: Request) {
  try {
    const body = z.object({
      cloudAiEnabled: z.boolean().optional(),
      voiceEnabled: z.boolean().optional(),
      sttEnabled: z.boolean().optional(),
      voiceResponsesEnabled: z.boolean().optional(),
      speakConfirmations: z.boolean().optional(),
      speakBriefings: z.boolean().optional(),
      speakLongResponses: z.enum(["ask", "on", "off"]).optional(),
      automaticSpeechCharacterLimit: z.number().int().min(80).max(1_000).optional(),
      monthlyVoiceWarningSeconds: z.number().int().positive().nullable().optional(),
      monthlyCostWarningMicros: z.number().int().positive().nullable().optional(),
      monthlyCostCutoffMicros: z.number().int().positive().nullable().optional(),
      hardCostCutoffEnabled: z.boolean().optional(),
    }).refine((value) => Object.keys(value).length > 0, "At least one setting is required.").parse(await readJson(request));
    const runtime = createJarvisRuntime();
    if (body.cloudAiEnabled !== undefined) runtime.settings.setCloudAiEnabled(body.cloudAiEnabled);
    const voice = { ...body }; delete voice.cloudAiEnabled;
    return Response.json(Object.keys(voice).length ? runtime.settings.updateVoiceSettings(voice) : runtime.settings.status());
  }
  catch (error) { return workErrorResponse(error); }
}
