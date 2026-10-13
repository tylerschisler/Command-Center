import { readJson, workErrorResponse } from "@/app/api/work-response";
import { createWorkServices } from "@/server/services/work-services";
import { ValidationError } from "@/server/services/service-errors";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return Response.json({ request: createWorkServices().requests.getRequest((await context.params).id) }); }
  catch (error) { return workErrorResponse(error); }
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const body = await readJson(request); const action = body.action;
    const actions = ["requested", "acknowledged", "waiting", "received", "close", "archive", "restore"];
    if (action !== undefined && !actions.includes(String(action))) throw new ValidationError("Invalid request action.");
    const service = createWorkServices().requests;
    const result = action === "requested" ? service.markRequested(id) : action === "acknowledged" ? service.markAcknowledged(id) : action === "waiting" ? service.markWaiting(id) : action === "received" ? service.markReceived(id) : action === "close" ? service.closeRequest(id) : action === "archive" ? service.archiveRequest(id) : action === "restore" ? service.restoreRequest(id) : service.updateRequest(id, { ...body, source: "manual", action: undefined });
    return Response.json({ request: result });
  } catch (error) { return workErrorResponse(error); }
}
