import { readJson, workErrorResponse } from "@/app/api/work-response";
import { ValidationError } from "@/server/services/service-errors";
import { createWorkServices } from "@/server/services/work-services";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return Response.json({ meeting: createWorkServices().meetings.getMeeting((await context.params).id) }); }
  catch (error) { return workErrorResponse(error); }
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const body = await readJson(request); const action = body.action; const service = createWorkServices().meetings;
    const actions = ["start", "end", "cancel", "archive", "restore", "addParticipant", "removeParticipant", "addDecision", "quickTask", "quickRequest"];
    if (action !== undefined && !actions.includes(String(action))) throw new ValidationError("Invalid meeting action.");
    if ((action === "addParticipant" || action === "removeParticipant") && typeof body.personId !== "string") throw new ValidationError("A person ID is required.");
    const result = action === "start" ? service.startMeeting(id) : action === "end" ? service.endMeeting(id) : action === "cancel" ? service.cancelMeeting(id)
      : action === "archive" ? service.archiveMeeting(id) : action === "restore" ? service.restoreMeeting(id)
        : action === "addParticipant" ? service.addParticipant(id, String(body.personId)) : action === "removeParticipant" ? service.removeParticipant(id, String(body.personId))
          : action === "addDecision" ? service.addDecision(id, { content: body.content, source: "manual" })
            : action === "quickTask" ? service.createMeetingTask(id, { ...body, action: undefined, source: "manual" })
              : action === "quickRequest" ? service.createMeetingRequest(id, { ...body, action: undefined, source: "manual" })
                : service.updateMeeting(id, { ...body, action: undefined, source: "manual" });
    return Response.json(action === "quickTask" ? { task: result } : action === "quickRequest" ? { request: result } : { meeting: result });
  } catch (error) { return workErrorResponse(error); }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const body = await readJson(request); return Response.json(createWorkServices().meetings.deleteMeeting((await context.params).id, body.confirmation)); }
  catch (error) { return workErrorResponse(error); }
}
