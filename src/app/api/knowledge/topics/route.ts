import { readJson, workErrorResponse } from "@/app/api/work-response";
import { createWorkServices } from "@/server/services/work-services";

export async function GET() { try { return Response.json({ topics: createWorkServices().knowledge.listTopics() }); } catch (error) { return workErrorResponse(error); } }
export async function POST(request: Request) { try { return Response.json({ topic: createWorkServices().knowledge.createTopic({ ...(await readJson(request)), source: "manual" }) }, { status: 201 }); } catch (error) { return workErrorResponse(error); } }
