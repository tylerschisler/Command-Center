import { canonicalizePublicUrl, classifyTopics, intelligenceTopicSchema, sanitizeExternalText, type IntelligenceTopic } from "@/domain/intelligence";
import { z } from "zod";

export interface IntelligenceSource { name: string; feedUrl: string; priority: number; defaultTopics: IntelligenceTopic[]; }
export interface RetrievedIntelligenceItem { headline: string; sourceName: string; sourceUrl: string; publicationDate: string; summary: string; sourcePriority: number; defaultTopics: IntelligenceTopic[]; }
export interface IntelligenceProvider { retrieve(): Promise<RetrievedIntelligenceItem[]>; }

export const DEFAULT_INTELLIGENCE_SOURCES: IntelligenceSource[] = [
  { name: "CISA", feedUrl: "https://www.cisa.gov/news.xml", priority: 25, defaultTopics: ["CISA", "Cybersecurity"] },
  { name: "NIST", feedUrl: "https://www.nist.gov/news-events/cybersecurity/rss.xml", priority: 25, defaultTopics: ["NIST", "Cybersecurity"] },
  { name: "SEC", feedUrl: "https://www.sec.gov/news/pressreleases.rss", priority: 24, defaultTopics: ["SEC", "Banking Regulation"] },
];

export function configuredIntelligenceSources(value?: string): IntelligenceSource[] {
  if (!value) return DEFAULT_INTELLIGENCE_SOURCES;
  const schema = z.array(z.object({ name: z.string().trim().min(1).max(120), feedUrl: z.string().url(), priority: z.number().int().min(0).max(25), defaultTopics: z.array(intelligenceTopicSchema).max(10) })).min(1).max(20);
  const parsed = schema.parse(JSON.parse(value));
  return parsed.map((source) => ({ ...source, feedUrl: canonicalizePublicUrl(source.feedUrl), defaultTopics: source.defaultTopics as IntelligenceTopic[] }));
}

function first(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return sanitizeExternalText(match[1], 2_000);
  }
  return "";
}
function link(block: string) {
  const text = first(block, ["link", "guid"]);
  if (text) return text;
  return block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ?? "";
}
function parseFeed(xml: string, source: IntelligenceSource): RetrievedIntelligenceItem[] {
  const blocks = xml.match(/<(?:item|entry)(?:\s[^>]*)?>[\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  return blocks.slice(0, 30).flatMap((block) => {
    const headline = first(block, ["title"]); const rawUrl = link(block); const date = first(block, ["pubDate", "published", "updated"]); const summary = first(block, ["description", "summary", "content"]);
    if (!headline || !rawUrl || !date) return [];
    try {
      const sourceUrl = canonicalizePublicUrl(rawUrl); const parsedDate = new Date(date);
      if (!Number.isFinite(parsedDate.getTime())) return [];
      return [{ headline, sourceName: source.name, sourceUrl, publicationDate: parsedDate.toISOString(), summary: summary || "The source did not provide a summary.", sourcePriority: source.priority, defaultTopics: source.defaultTopics }];
    } catch { return []; }
  });
}

export class PublicFeedIntelligenceProvider implements IntelligenceProvider {
  constructor(private readonly sources: IntelligenceSource[] = DEFAULT_INTELLIGENCE_SOURCES, private readonly fetcher: typeof fetch = fetch) {}
  async retrieve() {
    const batches = await Promise.allSettled(this.sources.map(async (source) => {
      canonicalizePublicUrl(source.feedUrl);
      const response = await this.fetcher(source.feedUrl, { headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml", "user-agent": "CommandCenter/1.0 local-intelligence" }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error(`source_http_${response.status}`);
      return parseFeed((await response.text()).slice(0, 2_000_000), source);
    }));
    return batches.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  }
}

export class DeterministicFakeIntelligenceProvider implements IntelligenceProvider {
  async retrieve(): Promise<RetrievedIntelligenceItem[]> { return [{ headline: "CISA publishes third-party security guidance", sourceName: "CISA", sourceUrl: "https://www.cisa.gov/resources-tools/resources/example-guidance", publicationDate: new Date().toISOString(), summary: "New public guidance highlights governance and vendor-risk practices for critical services.", sourcePriority: 25, defaultTopics: ["CISA", "Cybersecurity", "Third-Party Risk"] }]; }
}

export function topicsForRetrieved(item: RetrievedIntelligenceItem) { return classifyTopics(`${item.headline} ${item.summary}`, item.defaultTopics); }
