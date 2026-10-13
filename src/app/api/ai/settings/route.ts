import { z } from "zod";
import { readJson, workErrorResponse } from "@/app/api/work-response";
import { createJarvisRuntime } from "@/server/services/jarvis-runtime";

export async function GET() { try { return Response.json(createJarvisRuntime().settings.status()); } catch (error) { return workErrorResponse(error); } }
export async function PATCH(request: Request) {
  try { const body = z.object({ cloudAiEnabled: z.boolean() }).parse(await readJson(request)); return Response.json(createJarvisRuntime().settings.setCloudAiEnabled(body.cloudAiEnabled)); }
  catch (error) { return workErrorResponse(error); }
}
