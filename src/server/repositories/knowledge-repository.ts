import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/client";
import {
  activityEvents,
  entityRelationships,
  knowledgePages,
  knowledgePageTags,
  knowledgePageTopics,
  knowledgeTopics,
  knowledgeVersions,
  tags,
  type EntityRelationship,
  type KnowledgePage,
  type KnowledgeTopic,
  type KnowledgeVersion,
  type NewActivityEvent,
  type NewEntityRelationship,
  type NewKnowledgePage,
  type NewKnowledgeTopic,
  type NewKnowledgeVersion,
  type NewTag,
  type Tag,
} from "@/server/db/schema";

export interface KnowledgeListFilters {
  archived?: boolean;
  topicId?: string;
  tagId?: string;
  query?: string;
}

export interface KnowledgeRepository {
  create(page: NewKnowledgePage, version: NewKnowledgeVersion, event: NewActivityEvent): KnowledgePage;
  findById(id: string): KnowledgePage | undefined;
  list(filters?: KnowledgeListFilters): KnowledgePage[];
  update(id: string, changes: Partial<NewKnowledgePage>, event: NewActivityEvent, version?: NewKnowledgeVersion): KnowledgePage | undefined;
  listTopics(): KnowledgeTopic[];
  findTopicById(id: string): KnowledgeTopic | undefined;
  findTopicByNormalizedName(name: string): KnowledgeTopic | undefined;
  createTopic(topic: NewKnowledgeTopic, event: NewActivityEvent): KnowledgeTopic;
  updateTopic(id: string, changes: Partial<NewKnowledgeTopic>, event: NewActivityEvent): KnowledgeTopic | undefined;
  listPageTopics(pageId: string): KnowledgeTopic[];
  assignTopic(pageId: string, topicId: string, createdAt: string, event: NewActivityEvent): boolean;
  removeTopic(pageId: string, topicId: string, event: NewActivityEvent): boolean;
  listTags(): Tag[];
  findTagById(id: string): Tag | undefined;
  findTagByNormalizedName(name: string): Tag | undefined;
  createTag(tag: NewTag, event: NewActivityEvent): Tag;
  listPageTags(pageId: string): Tag[];
  assignTag(pageId: string, tagId: string, createdAt: string, event: NewActivityEvent): boolean;
  removeTag(pageId: string, tagId: string, event: NewActivityEvent): boolean;
  listVersions(pageId: string): KnowledgeVersion[];
  findVersionById(id: string): KnowledgeVersion | undefined;
  listRelationships(pageId: string): EntityRelationship[];
  listRelationshipsTo(targetType: string, targetId: string): EntityRelationship[];
  addRelationship(relationship: NewEntityRelationship, event: NewActivityEvent): EntityRelationship;
  removeRelationship(id: string, pageId: string, event: NewActivityEvent): boolean;
  delete(id: string, event: NewActivityEvent): boolean;
}

export class DrizzleKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly database: AppDatabase) {}

  create(page: NewKnowledgePage, version: NewKnowledgeVersion, event: NewActivityEvent) {
    return this.database.transaction((tx) => {
      const created = tx.insert(knowledgePages).values(page).returning().get();
      tx.insert(knowledgeVersions).values(version).run();
      tx.insert(activityEvents).values(event).run();
      return created;
    });
  }

  delete(id: string, event: NewActivityEvent) {
    return this.database.transaction((tx) => {
      tx.delete(entityRelationships).where(and(eq(entityRelationships.sourceType, "knowledge_page"), eq(entityRelationships.sourceId, id))).run();
      tx.delete(entityRelationships).where(and(eq(entityRelationships.targetType, "knowledge_page"), eq(entityRelationships.targetId, id))).run();
      const removed = tx.delete(knowledgePages).where(eq(knowledgePages.id, id)).returning({ id: knowledgePages.id }).get();
      if (!removed) return false;
      tx.insert(activityEvents).values(event).run();
      return true;
    });
  }

  findById(id: string) { return this.database.select().from(knowledgePages).where(eq(knowledgePages.id, id)).get(); }

  list(filters: KnowledgeListFilters = {}) {
    if (filters.query?.trim()) {
      const words = filters.query.trim().split(/\s+/).filter(Boolean);
      const fts = words.map((word) => `"${word.replaceAll('"', '""')}"*`).join(" AND ");
      const likeTerm = `%${filters.query.trim()}%`; const clauses = [filters.archived ? "kp.archived_at is not null" : "kp.archived_at is null"]; const values: unknown[] = [];
      if (filters.topicId) { clauses.push("exists (select 1 from knowledge_page_topics filter_kpt where filter_kpt.knowledge_page_id = kp.id and filter_kpt.knowledge_topic_id = ?)"); values.push(filters.topicId); }
      if (filters.tagId) { clauses.push("exists (select 1 from knowledge_page_tags filter_kpg where filter_kpg.knowledge_page_id = kp.id and filter_kpg.tag_id = ?)"); values.push(filters.tagId); }
      values.push(fts, likeTerm, likeTerm);
      const rows = this.database.$client.prepare(`select distinct kp.id from knowledge_pages kp where ${clauses.join(" and ")} and (kp.id in (select id from knowledge_pages_fts where knowledge_pages_fts match ?) or exists (select 1 from knowledge_page_topics kpt join knowledge_topics kt on kt.id = kpt.knowledge_topic_id where kpt.knowledge_page_id = kp.id and kt.name like ?) or exists (select 1 from knowledge_page_tags kpg join tags t on t.id = kpg.tag_id where kpg.knowledge_page_id = kp.id and t.name like ?)) order by kp.title`).all(...values) as Array<{ id: string }>;
      if (!rows.length) return [];
      return this.database.select().from(knowledgePages).where(inArray(knowledgePages.id, rows.map((row) => row.id))).orderBy(asc(knowledgePages.title)).all();
    }
    const archiveCondition = filters.archived ? isNotNull(knowledgePages.archivedAt) : isNull(knowledgePages.archivedAt);
    if (filters.topicId && filters.tagId) return this.database.selectDistinct({ page: knowledgePages }).from(knowledgePages)
      .innerJoin(knowledgePageTopics, eq(knowledgePages.id, knowledgePageTopics.knowledgePageId)).innerJoin(knowledgePageTags, eq(knowledgePages.id, knowledgePageTags.knowledgePageId))
      .where(and(archiveCondition, eq(knowledgePageTopics.knowledgeTopicId, filters.topicId), eq(knowledgePageTags.tagId, filters.tagId))).orderBy(asc(knowledgePages.title)).all().map((row) => row.page);
    if (filters.topicId) return this.database.select({ page: knowledgePages }).from(knowledgePages).innerJoin(knowledgePageTopics, eq(knowledgePages.id, knowledgePageTopics.knowledgePageId))
      .where(and(archiveCondition, eq(knowledgePageTopics.knowledgeTopicId, filters.topicId))).orderBy(asc(knowledgePages.title)).all().map((row) => row.page);
    if (filters.tagId) return this.database.select({ page: knowledgePages }).from(knowledgePages).innerJoin(knowledgePageTags, eq(knowledgePages.id, knowledgePageTags.knowledgePageId))
      .where(and(archiveCondition, eq(knowledgePageTags.tagId, filters.tagId))).orderBy(asc(knowledgePages.title)).all().map((row) => row.page);
    return this.database.select().from(knowledgePages).where(archiveCondition).orderBy(asc(knowledgePages.title)).all();
  }

  update(id: string, changes: Partial<NewKnowledgePage>, event: NewActivityEvent, version?: NewKnowledgeVersion) {
    return this.database.transaction((tx) => {
      const updated = tx.update(knowledgePages).set(changes).where(eq(knowledgePages.id, id)).returning().get();
      if (!updated) return undefined;
      if (version) tx.insert(knowledgeVersions).values(version).run();
      tx.insert(activityEvents).values(event).run();
      return updated;
    });
  }

  listTopics() { return this.database.select().from(knowledgeTopics).orderBy(asc(knowledgeTopics.name)).all(); }
  findTopicById(id: string) { return this.database.select().from(knowledgeTopics).where(eq(knowledgeTopics.id, id)).get(); }
  findTopicByNormalizedName(name: string) { return this.database.select().from(knowledgeTopics).where(eq(knowledgeTopics.normalizedName, name)).get(); }
  createTopic(topic: NewKnowledgeTopic, event: NewActivityEvent) { return this.database.transaction((tx) => { const created = tx.insert(knowledgeTopics).values(topic).returning().get(); tx.insert(activityEvents).values(event).run(); return created; }); }
  updateTopic(id: string, changes: Partial<NewKnowledgeTopic>, event: NewActivityEvent) { return this.database.transaction((tx) => { const updated = tx.update(knowledgeTopics).set(changes).where(eq(knowledgeTopics.id, id)).returning().get(); if (!updated) return undefined; tx.insert(activityEvents).values(event).run(); return updated; }); }
  listPageTopics(pageId: string) { return this.database.select({ topic: knowledgeTopics }).from(knowledgeTopics).innerJoin(knowledgePageTopics, eq(knowledgeTopics.id, knowledgePageTopics.knowledgeTopicId)).where(eq(knowledgePageTopics.knowledgePageId, pageId)).orderBy(asc(knowledgeTopics.name)).all().map((row) => row.topic); }
  assignTopic(pageId: string, topicId: string, createdAt: string, event: NewActivityEvent) { return this.database.transaction((tx) => { const existing = tx.select().from(knowledgePageTopics).where(and(eq(knowledgePageTopics.knowledgePageId, pageId), eq(knowledgePageTopics.knowledgeTopicId, topicId))).get(); if (existing) return false; tx.insert(knowledgePageTopics).values({ knowledgePageId: pageId, knowledgeTopicId: topicId, createdAt }).run(); tx.insert(activityEvents).values(event).run(); return true; }); }
  removeTopic(pageId: string, topicId: string, event: NewActivityEvent) { return this.database.transaction((tx) => { const removed = tx.delete(knowledgePageTopics).where(and(eq(knowledgePageTopics.knowledgePageId, pageId), eq(knowledgePageTopics.knowledgeTopicId, topicId))).returning().get(); if (!removed) return false; tx.insert(activityEvents).values(event).run(); return true; }); }

  listTags() { return this.database.select().from(tags).orderBy(asc(tags.name)).all(); }
  findTagById(id: string) { return this.database.select().from(tags).where(eq(tags.id, id)).get(); }
  findTagByNormalizedName(name: string) { return this.database.select().from(tags).where(eq(tags.normalizedName, name)).get(); }
  createTag(tag: NewTag, event: NewActivityEvent) { return this.database.transaction((tx) => { const created = tx.insert(tags).values(tag).returning().get(); tx.insert(activityEvents).values(event).run(); return created; }); }
  listPageTags(pageId: string) { return this.database.select({ tag: tags }).from(tags).innerJoin(knowledgePageTags, eq(tags.id, knowledgePageTags.tagId)).where(eq(knowledgePageTags.knowledgePageId, pageId)).orderBy(asc(tags.name)).all().map((row) => row.tag); }
  assignTag(pageId: string, tagId: string, createdAt: string, event: NewActivityEvent) { return this.database.transaction((tx) => { const existing = tx.select().from(knowledgePageTags).where(and(eq(knowledgePageTags.knowledgePageId, pageId), eq(knowledgePageTags.tagId, tagId))).get(); if (existing) return false; tx.insert(knowledgePageTags).values({ knowledgePageId: pageId, tagId, createdAt }).run(); tx.insert(activityEvents).values(event).run(); return true; }); }
  removeTag(pageId: string, tagId: string, event: NewActivityEvent) { return this.database.transaction((tx) => { const removed = tx.delete(knowledgePageTags).where(and(eq(knowledgePageTags.knowledgePageId, pageId), eq(knowledgePageTags.tagId, tagId))).returning().get(); if (!removed) return false; tx.insert(activityEvents).values(event).run(); return true; }); }

  listVersions(pageId: string) { return this.database.select().from(knowledgeVersions).where(eq(knowledgeVersions.knowledgePageId, pageId)).orderBy(desc(knowledgeVersions.createdAt)).all(); }
  findVersionById(id: string) { return this.database.select().from(knowledgeVersions).where(eq(knowledgeVersions.id, id)).get(); }
  listRelationships(pageId: string) { return this.database.select().from(entityRelationships).where(and(eq(entityRelationships.sourceType, "knowledge_page"), eq(entityRelationships.sourceId, pageId))).orderBy(asc(entityRelationships.createdAt)).all(); }
  listRelationshipsTo(targetType: string, targetId: string) { return this.database.select().from(entityRelationships).where(and(eq(entityRelationships.targetType, targetType), eq(entityRelationships.targetId, targetId))).orderBy(asc(entityRelationships.createdAt)).all(); }
  addRelationship(relationship: NewEntityRelationship, event: NewActivityEvent) { return this.database.transaction((tx) => { const created = tx.insert(entityRelationships).values(relationship).returning().get(); tx.insert(activityEvents).values(event).run(); return created; }); }
  removeRelationship(id: string, pageId: string, event: NewActivityEvent) { return this.database.transaction((tx) => { const removed = tx.delete(entityRelationships).where(and(eq(entityRelationships.id, id), eq(entityRelationships.sourceId, pageId))).returning().get(); if (!removed) return false; tx.insert(activityEvents).values(event).run(); return true; }); }
}
