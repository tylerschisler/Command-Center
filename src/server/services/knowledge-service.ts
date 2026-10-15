import { randomUUID } from "node:crypto";
import type { KnowledgePage, NewActivityEvent, NewEntityRelationship, NewKnowledgePage, NewKnowledgeTopic, NewKnowledgeVersion, NewTag } from "@/server/db/schema";
import type { ActivityEventRepository } from "@/server/repositories/activity-event-repository";
import type { KnowledgeListFilters, KnowledgeRepository } from "@/server/repositories/knowledge-repository";
import type { MeetingRepository } from "@/server/repositories/meeting-repository";
import type { PersonRepository } from "@/server/repositories/person-repository";
import type { ProjectRepository } from "@/server/repositories/project-repository";
import { assertPermanentDeleteConfirmation, NotFoundError, ValidationError } from "./service-errors";
import {
  idSchema,
  knowledgePageCreateSchema,
  knowledgePageUpdateSchema,
  knowledgeRelationshipCreateSchema,
  knowledgeTagCreateSchema,
  knowledgeTopicCreateSchema,
  knowledgeTopicUpdateSchema,
  knowledgeVersionRestoreSchema,
} from "./work-validation";

function normalizedName(value: string) { return value.trim().replace(/\s+/g, " ").toLocaleLowerCase(); }

export class KnowledgeService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly projects: ProjectRepository,
    private readonly people: PersonRepository,
    private readonly meetings: MeetingRepository,
    private readonly activity: ActivityEventRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  createPage(input: unknown) {
    const parsed = knowledgePageCreateSchema.parse(input); const timestamp = this.now().toISOString(); const id = randomUUID();
    const page: NewKnowledgePage = { id, title: parsed.title, content: parsed.content, summary: parsed.summary ?? null, createdAt: timestamp, updatedAt: timestamp, archivedAt: null };
    const version = this.version(id, parsed.content, parsed.changeDescription, parsed.changedBy, parsed.changeSource, timestamp);
    return this.toDetail(this.repository.create(page, version, this.event("KNOWLEDGE_PAGE_CREATED", id, `Created knowledge page “${page.title}”.`, parsed.source, { versionId: version.id }, timestamp)));
  }

  getPage(id: string) { return this.toDetail(this.requirePage(id)); }
  listPages(filters: KnowledgeListFilters = {}) { if (filters.topicId) idSchema.parse(filters.topicId); if (filters.tagId) idSchema.parse(filters.tagId); return this.repository.list(filters).map((page) => this.toView(page)); }

  updatePage(id: string, input: unknown) {
    const existing = this.requirePage(id); const parsed = knowledgePageUpdateSchema.parse(input); const { source, changeDescription, changedBy, changeSource, ...requested } = parsed;
    const changedFields = Object.keys(requested).filter((key) => requested[key as keyof typeof requested] !== undefined && requested[key as keyof typeof requested] !== existing[key as keyof KnowledgePage]);
    if (!changedFields.length) return this.toDetail(existing);
    const changes = Object.fromEntries(changedFields.map((key) => [key, requested[key as keyof typeof requested]])) as Partial<NewKnowledgePage>;
    const timestamp = this.now().toISOString(); const contentChanged = changedFields.includes("content"); changes.updatedAt = timestamp;
    const version = contentChanged ? this.version(id, requested.content ?? existing.content, changeDescription ?? "Updated content", changedBy ?? "Current user", changeSource ?? "manual", timestamp) : undefined;
    const updated = this.repository.update(id, changes, this.event("KNOWLEDGE_PAGE_UPDATED", id, `Updated knowledge page “${existing.title}”.`, source, { changedFields, versionId: version?.id }, timestamp), version);
    if (!updated) throw new NotFoundError("Knowledge page not found."); return this.toDetail(updated);
  }

  archivePage(id: string, source: NewActivityEvent["source"] = "manual") { return this.setArchived(id, this.now().toISOString(), "KNOWLEDGE_PAGE_ARCHIVED", source); }
  restorePage(id: string, source: NewActivityEvent["source"] = "manual") { return this.setArchived(id, null, "KNOWLEDGE_PAGE_RESTORED", source); }
  deletePage(id: string, confirmation: unknown, source: NewActivityEvent["source"] = "manual") {
    assertPermanentDeleteConfirmation(confirmation); idSchema.parse(id);
    if (!this.repository.findById(id)) throw new NotFoundError("Knowledge page not found.");
    const timestamp = this.now().toISOString();
    if (!this.repository.delete(id, this.event("KNOWLEDGE_PAGE_DELETED", id, "Permanently deleted a knowledge page and its metadata.", source, {}, timestamp))) throw new NotFoundError("Knowledge page not found.");
    return { deleted: true, id };
  }

  restoreVersion(pageId: string, input: unknown) {
    const page = this.requirePage(pageId); const parsed = knowledgeVersionRestoreSchema.parse(input); const previous = this.repository.findVersionById(parsed.versionId);
    if (!previous || previous.knowledgePageId !== pageId) throw new ValidationError("The selected version does not belong to this knowledge page.");
    const timestamp = this.now().toISOString(); const version = this.version(pageId, previous.content, parsed.changeDescription, parsed.changedBy, "manual", timestamp);
    const updated = this.repository.update(pageId, { content: previous.content, updatedAt: timestamp }, this.event("KNOWLEDGE_VERSION_RESTORED", pageId, `Restored an earlier version of “${page.title}”.`, parsed.source, { restoredVersionId: previous.id, versionId: version.id }, timestamp), version);
    if (!updated) throw new NotFoundError("Knowledge page not found."); return this.toDetail(updated);
  }

  listTopics() { return this.repository.listTopics(); }
  createTopic(input: unknown) {
    const parsed = knowledgeTopicCreateSchema.parse(input); const name = parsed.name.trim().replace(/\s+/g, " "); const normalized = normalizedName(name); const existing = this.repository.findTopicByNormalizedName(normalized); if (existing) return existing;
    const timestamp = this.now().toISOString(); const topic: NewKnowledgeTopic = { id: randomUUID(), name, normalizedName: normalized, description: parsed.description ?? null, createdAt: timestamp, updatedAt: timestamp };
    return this.repository.createTopic(topic, this.event("KNOWLEDGE_TOPIC_CREATED", topic.id, `Created knowledge topic “${topic.name}”.`, parsed.source, {}, timestamp, "knowledge_topic"));
  }
  updateTopic(id: string, input: unknown) {
    idSchema.parse(id); const existing = this.repository.findTopicById(id); if (!existing) throw new NotFoundError("Knowledge topic not found."); const parsed = knowledgeTopicUpdateSchema.parse(input); const { source, ...changes } = parsed;
    if (changes.name) { changes.name = changes.name.trim().replace(/\s+/g, " "); const normalized = normalizedName(changes.name); const duplicate = this.repository.findTopicByNormalizedName(normalized); if (duplicate && duplicate.id !== id) throw new ValidationError("A topic with that name already exists."); Object.assign(changes, { normalizedName: normalized }); }
    const timestamp = this.now().toISOString(); const updated = this.repository.updateTopic(id, { ...changes, updatedAt: timestamp }, this.event("KNOWLEDGE_TOPIC_UPDATED", id, `Updated knowledge topic “${existing.name}”.`, source, {}, timestamp, "knowledge_topic")); if (!updated) throw new NotFoundError("Knowledge topic not found."); return updated;
  }
  assignTopic(pageId: string, topicId: string, source: NewActivityEvent["source"] = "manual") { const page = this.requirePage(pageId); idSchema.parse(topicId); const topic = this.repository.findTopicById(topicId); if (!topic) throw new NotFoundError("Knowledge topic not found."); const timestamp = this.now().toISOString(); this.repository.assignTopic(pageId, topicId, timestamp, this.event("KNOWLEDGE_TOPIC_ASSIGNED", pageId, `Assigned topic “${topic.name}” to “${page.title}”.`, source, { topicId }, timestamp)); return this.getPage(pageId); }
  removeTopic(pageId: string, topicId: string, source: NewActivityEvent["source"] = "manual") { const page = this.requirePage(pageId); idSchema.parse(topicId); const topic = this.repository.findTopicById(topicId); const timestamp = this.now().toISOString(); this.repository.removeTopic(pageId, topicId, this.event("KNOWLEDGE_TOPIC_REMOVED", pageId, `Removed topic from “${page.title}”.`, source, { topicId, topicName: topic?.name }, timestamp)); return this.getPage(pageId); }

  listTags() { return this.repository.listTags(); }
  createTag(input: unknown) { const parsed = knowledgeTagCreateSchema.parse(input); const name = parsed.name.trim().replace(/\s+/g, " "); const normalized = normalizedName(name); const existing = this.repository.findTagByNormalizedName(normalized); if (existing) return existing; const tag: NewTag = { id: randomUUID(), name, normalizedName: normalized }; const timestamp = this.now().toISOString(); return this.repository.createTag(tag, this.event("KNOWLEDGE_TAG_CREATED", tag.id, `Created knowledge tag “${tag.name}”.`, parsed.source, {}, timestamp, "tag")); }
  assignTag(pageId: string, tagId: string, source: NewActivityEvent["source"] = "manual") { const page = this.requirePage(pageId); idSchema.parse(tagId); const tag = this.repository.findTagById(tagId); if (!tag) throw new NotFoundError("Tag not found."); const timestamp = this.now().toISOString(); this.repository.assignTag(pageId, tagId, timestamp, this.event("KNOWLEDGE_TAG_ASSIGNED", pageId, `Assigned tag “${tag.name}” to “${page.title}”.`, source, { tagId }, timestamp)); return this.getPage(pageId); }
  removeTag(pageId: string, tagId: string, source: NewActivityEvent["source"] = "manual") { const page = this.requirePage(pageId); idSchema.parse(tagId); const tag = this.repository.findTagById(tagId); const timestamp = this.now().toISOString(); this.repository.removeTag(pageId, tagId, this.event("KNOWLEDGE_TAG_REMOVED", pageId, `Removed tag from “${page.title}”.`, source, { tagId, tagName: tag?.name }, timestamp)); return this.getPage(pageId); }

  addRelationship(pageId: string, input: unknown) {
    const page = this.requirePage(pageId); const parsed = knowledgeRelationshipCreateSchema.parse(input); this.assertTarget(parsed.targetType, parsed.targetId); if (parsed.targetType === "knowledge_page" && parsed.targetId === pageId) throw new ValidationError("A knowledge page cannot relate to itself.");
    const duplicate = this.repository.listRelationships(pageId).find((item) => item.targetType === parsed.targetType && item.targetId === parsed.targetId && item.relationshipType === parsed.relationshipType); if (duplicate) return this.getPage(pageId);
    const timestamp = this.now().toISOString(); const relationship: NewEntityRelationship = { id: randomUUID(), sourceType: "knowledge_page", sourceId: pageId, relationshipType: parsed.relationshipType, targetType: parsed.targetType, targetId: parsed.targetId, createdAt: timestamp };
    this.repository.addRelationship(relationship, this.event("KNOWLEDGE_RELATIONSHIP_ADDED", pageId, `Added a relationship to “${page.title}”.`, parsed.source, { relationshipId: relationship.id, targetType: relationship.targetType, targetId: relationship.targetId }, timestamp)); return this.getPage(pageId);
  }
  removeRelationship(pageId: string, relationshipId: string, source: NewActivityEvent["source"] = "manual") { const page = this.requirePage(pageId); idSchema.parse(relationshipId); const timestamp = this.now().toISOString(); this.repository.removeRelationship(relationshipId, pageId, this.event("KNOWLEDGE_RELATIONSHIP_REMOVED", pageId, `Removed a relationship from “${page.title}”.`, source, { relationshipId }, timestamp)); return this.getPage(pageId); }
  listForEntity(targetType: "project" | "person" | "meeting", targetId: string) { idSchema.parse(targetId); return this.repository.listRelationshipsTo(targetType, targetId).map((relation) => this.repository.findById(relation.sourceId)).filter((page): page is KnowledgePage => Boolean(page && !page.archivedAt)).map((page) => this.toView(page)); }

  private setArchived(id: string, archivedAt: string | null, eventType: string, source: NewActivityEvent["source"]) { const page = this.requirePage(id); if ((archivedAt && page.archivedAt) || (!archivedAt && !page.archivedAt)) return this.toDetail(page); const timestamp = this.now().toISOString(); const updated = this.repository.update(id, { archivedAt, updatedAt: timestamp }, this.event(eventType, id, `${archivedAt ? "Archived" : "Restored"} knowledge page “${page.title}”.`, source, {}, timestamp)); if (!updated) throw new NotFoundError("Knowledge page not found."); return this.toDetail(updated); }
  private toView(page: KnowledgePage) { return { ...page, topics: this.repository.listPageTopics(page.id), tags: this.repository.listPageTags(page.id) }; }
  private toDetail(page: KnowledgePage) { return { ...this.toView(page), versions: this.repository.listVersions(page.id), relationships: this.repository.listRelationships(page.id).map((relationship) => ({ ...relationship, targetLabel: this.targetLabel(relationship.targetType, relationship.targetId) })), activity: this.activity.listByEntity("knowledge_page", page.id) }; }
  private targetLabel(type: string, id: string) { if (type === "project") return this.projects.findById(id)?.name ?? "Missing project"; if (type === "person") return this.people.findById(id)?.displayName ?? "Missing person"; if (type === "meeting") return this.meetings.findById(id)?.title ?? "Missing meeting"; return this.repository.findById(id)?.title ?? "Missing knowledge page"; }
  private assertTarget(type: string, id: string) { idSchema.parse(id); const exists = type === "project" ? this.projects.findById(id) : type === "person" ? this.people.findById(id) : type === "meeting" ? this.meetings.findById(id) : this.repository.findById(id); if (!exists) throw new ValidationError(`The selected ${type.replace("_", " ")} does not exist.`); }
  private requirePage(id: string) { idSchema.parse(id); const page = this.repository.findById(id); if (!page) throw new NotFoundError("Knowledge page not found."); return page; }
  private version(pageId: string, content: string, description: string, changedBy: string, changeSource: NewKnowledgeVersion["changeSource"], createdAt: string): NewKnowledgeVersion { return { id: randomUUID(), knowledgePageId: pageId, content, changeDescription: description, changedBy, changeSource, createdAt }; }
  private event(eventType: string, entityId: string, description: string, source: NewActivityEvent["source"], metadata: Record<string, unknown>, timestamp: string, entityType = "knowledge_page"): NewActivityEvent { return { id: randomUUID(), eventType, description, entityType, entityId, source, metadata, timestamp }; }
}
