import { readJson, workErrorResponse } from "@/app/api/work-response";
import { createWorkServices } from "@/server/services/work-services";

export async function GET() { try { return Response.json({ tags: createWorkServices().knowledge.listTags() }); } catch (error) { return workErrorResponse(error); } }
export async function POST(request: Request) { try { return Response.json({ tag: createWorkServices().knowledge.createTag({ ...(await readJson(request)), source: "manual" }) }, { status: 201 }); } catch (error) { return workErrorResponse(error); } }
