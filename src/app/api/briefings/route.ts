import { readJson, workErrorResponse } from "@/app/api/work-response";
import { BRIEFING_TYPES, type BriefingType } from "@/domain/command-center";
import { createWorkServices } from "@/server/services/work-services";
import { ValidationError } from "@/server/services/service-errors";

export async function GET(request: Request) {
  try {
    const type = new URL(request.url).searchParams.get("type");
    if (type && !BRIEFING_TYPES.includes(type as BriefingType)) throw new ValidationError("Invalid briefing type.");
    return Response.json({ briefings: createWorkServices().briefings.listBriefings(type as BriefingType | undefined) });
  } catch (error) { return workErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const type = body.type;
    if (type !== "morning" && type !== "end_of_day" && type !== "weekly") throw new ValidationError("Invalid briefing type.");
    return Response.json({ briefing: createWorkServices().briefings.generate(type, { today: String(body.today ?? ""), timeZone: String(body.timeZone ?? "") }, "manual") }, { status: 201 });
  } catch (error) { return workErrorResponse(error); }
}
