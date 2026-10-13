import { readJson, workErrorResponse } from "@/app/api/work-response";
import { REQUEST_STATUSES, type RequestStatus } from "@/domain/work";
import type { RequestListFilters } from "@/server/repositories/request-repository";
import { ValidationError } from "@/server/services/service-errors";
import { createWorkServices } from "@/server/services/work-services";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const status = url.searchParams.get("status");
    if (status && !REQUEST_STATUSES.includes(status as RequestStatus)) throw new ValidationError("Invalid request status filter.");
    const filters: RequestListFilters = {};
    const personId = url.searchParams.get("personId"); const projectId = url.searchParams.get("projectId");
    if (personId) filters.personId = personId; if (projectId) filters.projectId = projectId; if (status) filters.status = status as RequestStatus;
    return Response.json({ requests: createWorkServices().requests.listRequests(filters) });
  } catch (error) { return workErrorResponse(error); }
}
export async function POST(request: Request) {
  try { return Response.json({ request: createWorkServices().requests.createRequest({ ...(await readJson(request)), source: "manual" }) }, { status: 201 }); }
  catch (error) { return workErrorResponse(error); }
}
