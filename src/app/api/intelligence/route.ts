import { z } from "zod";
import { readJson, workErrorResponse } from "@/app/api/work-response";
import { createWorkServices } from "@/server/services/work-services";

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    return Response.json({ items: createWorkServices().intelligence.list({ topic: search.get("topic") || undefined, since: search.get("since") || undefined, minimumRelevance: search.has("minimumRelevance") ? Number(search.get("minimumRelevance")) : undefined }) });
  } catch (error) { return workErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = z.object({ action: z.literal("refresh") }).parse(await readJson(request));
    void body;
    return Response.json(await createWorkServices().intelligence.refresh("manual"));
  } catch (error) { return workErrorResponse(error); }
}
