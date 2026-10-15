import { readJson, workErrorResponse } from "@/app/api/work-response";
import { ValidationError } from "@/server/services/service-errors";
import { createWorkServices } from "@/server/services/work-services";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return Response.json({ page: createWorkServices().knowledge.getPage((await context.params).id) }); }
  catch (error) { return workErrorResponse(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const body = await readJson(request); const action = body.action; const service = createWorkServices().knowledge;
    const actions = ["archive", "restore", "restoreVersion", "assignTopic", "removeTopic", "assignTag", "removeTag", "addRelationship", "removeRelationship"];
    if (action !== undefined && !actions.includes(String(action))) throw new ValidationError("Invalid knowledge action.");
    const result = action === "archive" ? service.archivePage(id) : action === "restore" ? service.restorePage(id)
      : action === "restoreVersion" ? service.restoreVersion(id, { versionId: body.versionId, changeDescription: body.changeDescription, source: "manual" })
        : action === "assignTopic" ? service.assignTopic(id, String(body.topicId)) : action === "removeTopic" ? service.removeTopic(id, String(body.topicId))
          : action === "assignTag" ? service.assignTag(id, String(body.tagId)) : action === "removeTag" ? service.removeTag(id, String(body.tagId))
            : action === "addRelationship" ? service.addRelationship(id, { targetType: body.targetType, targetId: body.targetId, relationshipType: body.relationshipType, source: "manual" })
              : action === "removeRelationship" ? service.removeRelationship(id, String(body.relationshipId))
                : service.updatePage(id, { ...body, action: undefined, source: "manual", changeSource: "manual" });
    return Response.json({ page: result });
  } catch (error) { return workErrorResponse(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const body = await readJson(request); return Response.json(createWorkServices().knowledge.deletePage((await context.params).id, body.confirmation)); }
  catch (error) { return workErrorResponse(error); }
}
