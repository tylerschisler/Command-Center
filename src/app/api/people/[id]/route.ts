import { readJson, workErrorResponse } from "@/app/api/work-response";
import { createWorkServices } from "@/server/services/work-services";
import { ValidationError } from "@/server/services/service-errors";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return Response.json({ person: createWorkServices().people.getPerson((await context.params).id) }); }
  catch (error) { return workErrorResponse(error); }
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const body = await readJson(request); const action = body.action;
    if (action !== undefined && !["archive", "restore"].includes(String(action))) throw new ValidationError("Invalid person action.");
    const service = createWorkServices().people;
    const person = action === "archive" ? service.archivePerson(id) : action === "restore" ? service.restorePerson(id) : service.updatePerson(id, { ...body, source: "manual", action: undefined });
    return Response.json({ person });
  } catch (error) { return workErrorResponse(error); }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const body = await readJson(request); return Response.json(createWorkServices().people.deletePerson((await context.params).id, body.confirmation)); }
  catch (error) { return workErrorResponse(error); }
}
