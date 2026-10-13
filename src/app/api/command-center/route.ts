import { workErrorResponse } from "@/app/api/work-response";
import { createWorkServices } from "@/server/services/work-services";

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    return Response.json({ dashboard: createWorkServices().commandCenter.getHome({ today: search.get("today") ?? "", timeZone: search.get("timeZone") ?? "" }) });
  } catch (error) { return workErrorResponse(error); }
}
