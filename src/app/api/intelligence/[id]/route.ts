import { z } from "zod";
import { readJson, workErrorResponse } from "@/app/api/work-response";
import { createWorkServices } from "@/server/services/work-services";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const body = z.object({ action: z.literal("save_to_knowledge"), notes: z.string().max(4_000).optional() }).parse(await readJson(request));
    return Response.json(createWorkServices().intelligence.saveToKnowledge(id, body));
  } catch (error) { return workErrorResponse(error); }
}
