import { workErrorResponse } from "@/app/api/work-response";
import { createWorkServices } from "@/server/services/work-services";

export async function GET(request: Request) {
  try { const url = new URL(request.url); return Response.json({ events: createWorkServices().calendar.listEvents(url.searchParams.get("start") ?? undefined, url.searchParams.get("end") ?? undefined) }); }
  catch (error) { return workErrorResponse(error); }
}
