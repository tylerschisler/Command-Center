import { workErrorResponse } from "@/app/api/work-response";
import { createWorkServices } from "@/server/services/work-services";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json({ briefing: createWorkServices().briefings.getBriefing((await params).id) }); }
  catch (error) { return workErrorResponse(error); }
}
