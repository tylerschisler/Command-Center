import { readJson, workErrorResponse } from "@/app/api/work-response";
import { createWorkServices } from "@/server/services/work-services";

export async function GET(request: Request) {
  try { return Response.json({ people: createWorkServices().people.listPeople(new URL(request.url).searchParams.get("archived") === "true") }); }
  catch (error) { return workErrorResponse(error); }
}
export async function POST(request: Request) {
  try { return Response.json({ person: createWorkServices().people.createPerson({ ...(await readJson(request)), source: "manual" }) }, { status: 201 }); }
  catch (error) { return workErrorResponse(error); }
}
