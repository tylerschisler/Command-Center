import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/client";
import { activityEvents, intelligenceItems, type IntelligenceItem, type NewActivityEvent, type NewIntelligenceItem } from "@/server/db/schema";

export interface IntelligenceFilters { topic?: string; since?: string; minimumRelevance?: number; limit?: number; }
export interface IntelligenceRepository {
  list(filters?: IntelligenceFilters): IntelligenceItem[];
  findById(id: string): IntelligenceItem | undefined;
  findDuplicate(canonicalUrl: string, normalizedHeadline: string, publicationDate: string): IntelligenceItem | undefined;
  insertMany(items: NewIntelligenceItem[], event: NewActivityEvent): IntelligenceItem[];
  markSaved(id: string, knowledgePageId: string, event: NewActivityEvent): IntelligenceItem | undefined;
}

export class DrizzleIntelligenceRepository implements IntelligenceRepository {
  constructor(private readonly database: AppDatabase) {}
  list(filters: IntelligenceFilters = {}) {
    const conditions = [];
    if (filters.since) conditions.push(gte(intelligenceItems.publicationDate, filters.since));
    if (filters.minimumRelevance !== undefined) conditions.push(gte(intelligenceItems.relevanceScore, filters.minimumRelevance));
    if (filters.topic) conditions.push(sql`exists (select 1 from json_each(${intelligenceItems.topics}) where value = ${filters.topic})`);
    return this.database.select().from(intelligenceItems).where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(intelligenceItems.relevanceScore), desc(intelligenceItems.publicationDate)).limit(Math.min(filters.limit ?? 100, 200)).all();
  }
  findById(id: string) { return this.database.select().from(intelligenceItems).where(eq(intelligenceItems.id, id)).get(); }
  findDuplicate(canonicalUrl: string, normalizedHeadline: string, publicationDate: string) {
    return this.database.select().from(intelligenceItems).where(sql`${intelligenceItems.canonicalUrl} = ${canonicalUrl} or (${intelligenceItems.normalizedHeadline} = ${normalizedHeadline} and substr(${intelligenceItems.publicationDate}, 1, 10) = substr(${publicationDate}, 1, 10))`).get();
  }
  insertMany(items: NewIntelligenceItem[], event: NewActivityEvent) {
    return this.database.transaction((tx) => {
      const created = items.length ? tx.insert(intelligenceItems).values(items).returning().all() : [];
      tx.insert(activityEvents).values(event).run();
      return created;
    });
  }
  markSaved(id: string, knowledgePageId: string, event: NewActivityEvent) {
    return this.database.transaction((tx) => {
      const updated = tx.update(intelligenceItems).set({ savedKnowledgePageId: knowledgePageId }).where(eq(intelligenceItems.id, id)).returning().get();
      if (updated) tx.insert(activityEvents).values(event).run();
      return updated;
    });
  }
}
