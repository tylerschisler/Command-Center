import { readJson, workErrorResponse } from "@/app/api/work-response";
import { PROJECT_STATUSES, type ProjectStatus } from "@/domain/work";
import { createWorkServices } from "@/server/services/work-services";
import { ValidationError } from "@/server/services/service-errors";

export async function GET(request: Request) {
  try {
    const status = new URL(request.url).searchParams.get("status");
    if (status && !PROJECT_STATUSES.includes(status as ProjectStatus)) throw new ValidationError("Invalid project status filter.");
    const filters = status && PROJECT_STATUSES.includes(status as ProjectStatus) ? { status: status as ProjectStatus } : {};
    return Response.json({ projects: createWorkServices().projects.listProjects(filters) });
  } catch (error) { return workErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return Response.json({ project: createWorkServices().projects.createProject({ ...body, source: "manual" }) }, { status: 201 });
  } catch (error) { return workErrorResponse(error); }
}
