import { z } from "zod";

export const intelligenceTopicSchema = z.enum([
  "GRC", "Cybersecurity", "Banking Regulation", "Third-Party Risk", "Data Breach",
  "NIST", "CISA", "OCC", "FDIC", "FFIEC", "Federal Reserve", "SEC", "AI Governance", "Privacy",
]);

export type IntelligenceTopic = z.infer<typeof intelligenceTopicSchema>;

export function normalizeHeadline(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function canonicalizePublicUrl(value: string) {
  const url = new URL(value);
  if (!(["http:", "https:"] as string[]).includes(url.protocol)) throw new Error("Only public HTTP(S) source URLs are allowed.");
  const host = url.hostname.toLocaleLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host.endsWith(".local") || host.endsWith(".internal") || host === "::1" || host === "[::1]" || /^\[?(?:fc|fd|fe8|fe9|fea|feb)/i.test(host) || /^127\./.test(host) || /^10\./.test(host) || /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new Error("Local and private source URLs are not allowed.");
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  return url.toString();
}

export function sanitizeExternalText(value: string, limit = 1_000) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ").trim().slice(0, limit);
}

const TOPIC_PATTERNS: Array<[IntelligenceTopic, RegExp]> = [
  ["NIST", /\bnist\b|cybersecurity framework|csf\b/i], ["CISA", /\bcisa\b|known exploited vulnerabilities|\bkev\b/i],
  ["OCC", /office of the comptroller|\bocc\b/i], ["FDIC", /\bfdic\b/i], ["FFIEC", /\bffiec\b/i],
  ["Federal Reserve", /federal reserve|\bfed\b/i], ["SEC", /securities and exchange commission|\bsec\b/i],
  ["AI Governance", /artificial intelligence|\bai\b|machine learning/i], ["Privacy", /privacy|personal data|data protection/i],
  ["Third-Party Risk", /third.party|vendor|supply chain/i], ["Data Breach", /breach|ransomware|data leak|incident/i],
  ["Banking Regulation", /bank|financial service|credit union|prudential|regulat/i], ["GRC", /governance|risk|compliance|audit|control/i],
  ["Cybersecurity", /cyber|security|vulnerab|malware|threat/i],
];

export function classifyTopics(text: string, defaults: IntelligenceTopic[] = []) {
  const topics = new Set<IntelligenceTopic>(defaults);
  for (const [topic, pattern] of TOPIC_PATTERNS) if (pattern.test(text)) topics.add(topic);
  return [...topics];
}

export function scoreIntelligence(input: { text: string; publicationDate: string; sourcePriority: number; topics: IntelligenceTopic[] }, now = new Date()) {
  const ageDays = Math.max(0, (now.getTime() - new Date(input.publicationDate).getTime()) / 86_400_000);
  const freshness = ageDays <= 1 ? 25 : ageDays <= 7 ? 18 : ageDays <= 30 ? 8 : 0;
  const authority = Math.max(0, Math.min(25, input.sourcePriority));
  const topicWeight = Math.min(30, input.topics.length * 6);
  const sector = /bank|financial|third.party|vendor|regulat|compliance/i.test(input.text) ? 15 : 0;
  const significance = /critical|emergency|breach|ransomware|enforcement|final rule|framework/i.test(input.text) ? 5 : 0;
  return Math.min(100, authority + freshness + topicWeight + sector + significance);
}

export function whyItMatters(topics: IntelligenceTopic[]) {
  if (topics.includes("Banking Regulation") || topics.some((topic) => ["OCC", "FDIC", "FFIEC", "Federal Reserve", "SEC"].includes(topic))) return "May change regulatory expectations, examination priorities, or compliance obligations for financial-services organizations.";
  if (topics.includes("Third-Party Risk")) return "May affect vendor oversight, due diligence, contract requirements, or concentration-risk decisions.";
  if (topics.includes("Data Breach") || topics.includes("Cybersecurity")) return "May affect control testing, incident readiness, risk assessments, or security governance priorities.";
  if (topics.includes("AI Governance") || topics.includes("Privacy")) return "May affect policy, data-governance, model-risk, or privacy compliance decisions.";
  return "May warrant review for changes to governance, risk, compliance, or control expectations.";
}
