import { randomUUID } from "node:crypto";
import { z } from "zod";
import { canonicalizePublicUrl, normalizeHeadline, sanitizeExternalText, scoreIntelligence, whyItMatters } from "@/domain/intelligence";
import type { NewActivityEvent, NewIntelligenceItem } from "@/server/db/schema";
import type { IntelligenceProvider } from "@/server/intelligence/intelligence-provider";
import { topicsForRetrieved } from "@/server/intelligence/intelligence-provider";
import type { IntelligenceFilters, IntelligenceRepository } from "@/server/repositories/intelligence-repository";
import type { KnowledgeService } from "./knowledge-service";
import { NotFoundError, ValidationError } from "./service-errors";

const filterSchema = z.object({ topic: z.string().trim().max(80).optional(), since: z.string().datetime().optional(), minimumRelevance: z.number().int().min(0).max(100).optional(), limit: z.number().int().min(1).max(200).optional() });
const saveSchema = z.object({ notes: z.string().trim().max(4_000).optional().default("") });

export class IntelligenceService {
  constructor(private readonly repository: IntelligenceRepository, private readonly provider: IntelligenceProvider, private readonly knowledge: KnowledgeService, private readonly now = () => new Date()) {}
  list(filters: IntelligenceFilters = {}) { return this.repository.list(filterSchema.parse(filters)); }
  async refresh(source: NewActivityEvent["source"] = "manual") {
    const fetchedAt = this.now().toISOString(); const retrieved = await this.provider.retrieve(); const candidates: NewIntelligenceItem[] = [];
    for (const raw of retrieved) {
      const headline = sanitizeExternalText(raw.headline, 300); const summary = sanitizeExternalText(raw.summary, 700); const canonicalUrl = canonicalizePublicUrl(raw.sourceUrl); const normalizedHeadline = normalizeHeadline(headline);
      if (!headline || !normalizedHeadline || this.repository.findDuplicate(canonicalUrl, normalizedHeadline, raw.publicationDate)) continue;
      const topics = topicsForRetrieved({ ...raw, headline, summary });
      candidates.push({ id: randomUUID(), headline, normalizedHeadline, sourceName: sanitizeExternalText(raw.sourceName, 120), sourceUrl: canonicalUrl, canonicalUrl, publicationDate: raw.publicationDate, fetchedAt, summary, relevanceScore: scoreIntelligence({ text: `${headline} ${summary}`, publicationDate: raw.publicationDate, sourcePriority: raw.sourcePriority, topics }, this.now()), whyItMatters: whyItMatters(topics), topics, savedKnowledgePageId: null });
    }
    const seenUrls = new Set<string>(), seenHeadlines = new Set<string>(); const unique = candidates.filter((item) => { const headlineKey = `${item.normalizedHeadline}:${item.publicationDate.slice(0, 10)}`; if (seenUrls.has(item.canonicalUrl) || seenHeadlines.has(headlineKey)) return false; seenUrls.add(item.canonicalUrl); seenHeadlines.add(headlineKey); return true; });
    const event: NewActivityEvent = { id: randomUUID(), eventType: "INTELLIGENCE_REFRESHED", description: `Refreshed public GRC intelligence and stored ${unique.length} new item(s).`, entityType: "intelligence", entityId: randomUUID(), source, metadata: { fetchedCount: retrieved.length, storedCount: unique.length }, timestamp: fetchedAt };
    return { items: this.repository.insertMany(unique, event), fetchedCount: retrieved.length, storedCount: unique.length };
  }
  saveToKnowledge(id: string, input: unknown) {
    if (!z.string().uuid().safeParse(id).success) throw new ValidationError("A valid intelligence item ID is required.");
    const item = this.repository.findById(id); if (!item) throw new NotFoundError("Intelligence item not found.");
    if (item.savedKnowledgePageId) return { item, page: this.knowledge.getPage(item.savedKnowledgePageId) };
    const { notes } = saveSchema.parse(input); const content = [`# ${item.headline}`, "", item.summary, "", `Why it matters: ${item.whyItMatters}`, "", `Source: ${item.sourceName}`, `Published: ${item.publicationDate}`, `Original: ${item.sourceUrl}`, ...(notes ? ["", "## Notes", notes] : [])].join("\n");
    const page = this.knowledge.createPage({ title: item.headline, summary: item.summary, content, changeDescription: "Saved from GRC Intelligence", changedBy: "Current user", changeSource: "manual", source: "manual" });
    const timestamp = this.now().toISOString();
    const updated = this.repository.markSaved(id, page.id, { id: randomUUID(), eventType: "INTELLIGENCE_SAVED_TO_KNOWLEDGE", description: `Saved intelligence item “${item.headline}” to Knowledge.`, entityType: "intelligence", entityId: id, source: "manual", metadata: { knowledgePageId: page.id }, timestamp });
    if (!updated) throw new NotFoundError("Intelligence item not found."); return { item: updated, page };
  }
}
