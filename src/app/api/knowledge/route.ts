import { readJson, workErrorResponse } from "@/app/api/work-response";
import type { KnowledgeListFilters } from "@/server/repositories/knowledge-repository";
import { ValidationError } from "@/server/services/service-errors";
import { createWorkServices } from "@/server/services/work-services";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const service = createWorkServices().knowledge;
    const targetType = url.searchParams.get("targetType"); const targetId = url.searchParams.get("targetId");
    if (targetType || targetId) {
      if (!targetId || !["project", "person", "meeting"].includes(targetType ?? "")) throw new ValidationError("A valid relationship target is required.");
      return Response.json({ pages: service.listForEntity(targetType as "project" | "person" | "meeting", targetId) });
    }
    const filters: KnowledgeListFilters = { archived: url.searchParams.get("archived") === "true" };
    const topicId = url.searchParams.get("topicId"); const tagId = url.searchParams.get("tagId"); const query = url.searchParams.get("query");
    if (topicId) filters.topicId = topicId; if (tagId) filters.tagId = tagId; if (query) filters.query = query;
    return Response.json({ pages: service.listPages(filters), topics: service.listTopics(), tags: service.listTags() });
  } catch (error) { return workErrorResponse(error); }
}

export async function POST(request: Request) {
  try { return Response.json({ page: createWorkServices().knowledge.createPage({ ...(await readJson(request)), source: "manual", changeSource: "manual" }) }, { status: 201 }); }
  catch (error) { return workErrorResponse(error); }
}
