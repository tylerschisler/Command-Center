import { readJson, workErrorResponse } from "@/app/api/work-response";
import { createWorkServices } from "@/server/services/work-services";
import { ValidationError } from "@/server/services/service-errors";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return Response.json({ task: createWorkServices().tasks.getTask((await context.params).id) }); }
  catch (error) { return workErrorResponse(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    const action = body.action;
    if (action !== undefined && !["complete", "archive", "restore"].includes(String(action))) throw new ValidationError("Invalid task action.");
    const service = createWorkServices().tasks;
    const task = action === "complete" ? service.completeTask(id)
      : action === "archive" ? service.archiveTask(id)
        : action === "restore" ? service.restoreTask(id)
          : service.updateTask(id, { ...body, source: "manual", action: undefined });
    return Response.json({ task });
  } catch (error) { return workErrorResponse(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const body = await readJson(request); return Response.json(createWorkServices().tasks.deleteTask((await context.params).id, body.confirmation)); }
  catch (error) { return workErrorResponse(error); }
}
