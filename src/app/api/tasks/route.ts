import { readJson, workErrorResponse } from "@/app/api/work-response";
import { createWorkServices } from "@/server/services/work-services";
import type { TaskListFilters } from "@/server/repositories/task-repository";
import { ValidationError } from "@/server/services/service-errors";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ownership = url.searchParams.get("ownership");
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const meetingId = url.searchParams.get("meetingId") ?? undefined;
    if (ownership && ownership !== "mine" && ownership !== "delegated") throw new ValidationError("Invalid ownership filter.");
    const filters: TaskListFilters = {};
    if (ownership === "mine" || ownership === "delegated") filters.ownership = ownership;
    if (projectId) filters.projectId = projectId;
    if (meetingId) filters.meetingId = meetingId;
    return Response.json({ tasks: createWorkServices().tasks.listTasks(filters) });
  } catch (error) { return workErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return Response.json({ task: createWorkServices().tasks.createTask({ ...body, source: "manual" }) }, { status: 201 });
  } catch (error) { return workErrorResponse(error); }
}
