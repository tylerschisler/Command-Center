import { readJson, workErrorResponse } from "@/app/api/work-response";
import { MEETING_STATUSES, type MeetingStatus } from "@/domain/work";
import type { MeetingListFilters } from "@/server/repositories/meeting-repository";
import { ValidationError } from "@/server/services/service-errors";
import { createWorkServices } from "@/server/services/work-services";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const status = url.searchParams.get("status"); if (status && !MEETING_STATUSES.includes(status as MeetingStatus)) throw new ValidationError("Invalid meeting status filter.");
    const filters: MeetingListFilters = {}; const projectId = url.searchParams.get("projectId"); const personId = url.searchParams.get("personId");
    if (projectId) filters.projectId = projectId; if (personId) filters.personId = personId; if (status) filters.status = status as MeetingStatus;
    return Response.json({ meetings: createWorkServices().meetings.listMeetings(filters) });
  } catch (error) { return workErrorResponse(error); }
}
export async function POST(request: Request) {
  try { return Response.json({ meeting: createWorkServices().meetings.createMeeting({ ...(await readJson(request)), source: "manual" }) }, { status: 201 }); }
  catch (error) { return workErrorResponse(error); }
}
