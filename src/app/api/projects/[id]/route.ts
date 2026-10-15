import { readJson, workErrorResponse } from "@/app/api/work-response";
import { createWorkServices } from "@/server/services/work-services";
import { ValidationError } from "@/server/services/service-errors";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return Response.json({ project: createWorkServices().projects.getProject((await context.params).id) }); }
  catch (error) { return workErrorResponse(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    const action = body.action;
    if (action !== undefined && !["complete", "archive", "restore"].includes(String(action))) throw new ValidationError("Invalid project action.");
    const service = createWorkServices().projects;
    const project = action === "complete" ? service.completeProject(id)
      : action === "archive" ? service.archiveProject(id)
        : action === "restore" ? service.restoreProject(id)
          : service.updateProject(id, { ...body, source: "manual", action: undefined });
    return Response.json({ project });
  } catch (error) { return workErrorResponse(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const body = await readJson(request); return Response.json(createWorkServices().projects.deleteProject((await context.params).id, body.confirmation)); }
  catch (error) { return workErrorResponse(error); }
}
