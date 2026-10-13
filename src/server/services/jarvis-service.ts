import { z } from "zod";
import { isValidCalendarDate, isValidTimeZone } from "@/domain/command-center";
import { jarvisResponseSchema, type JarvisPageContext } from "@/domain/jarvis";
import type { AiProvider } from "@/server/ai/ai-provider";
import type { AiSettingsService } from "./ai-settings-service";
import type { JarvisToolController } from "@/server/jarvis/tool-controller";
import { ValidationError } from "./service-errors";

const requestSchema = z.object({ prompt: z.string().trim().min(1).max(8_000), today: z.string(), timeZone: z.string(), pageContext: z.object({ entityType: z.enum(["task", "project", "request", "person", "meeting", "knowledge_page", "briefing"]), entityId: z.string().uuid(), label: z.string().max(200).optional() }).nullable().default(null), priorSubject: z.object({ entityType: z.enum(["task", "project", "request", "person", "meeting", "knowledge_page", "briefing"]), entityId: z.string().uuid(), label: z.string().max(200).optional() }).nullable().optional() });
export class JarvisUnavailableError extends Error {}

export class JarvisService {
  constructor(private readonly provider: AiProvider | null, private readonly tools: JarvisToolController, private readonly settings: AiSettingsService) {}
  async run(input: unknown) {
    const parsed = requestSchema.parse(input); if (!isValidCalendarDate(parsed.today) || !isValidTimeZone(parsed.timeZone)) throw new ValidationError("Jarvis requires a valid local date and IANA time zone.");
    const status = this.settings.status(); if (!status.cloudAiEnabled) throw new JarvisUnavailableError("Jarvis is unavailable because Cloud AI is disabled. Core Command Center features remain available.");
    if (!this.provider) throw new JarvisUnavailableError("Jarvis is unavailable because the AI provider is not configured. Core Command Center features remain available.");
    const result = await this.provider.executeToolLoop({ ...parsed, pageContext: parsed.pageContext as JarvisPageContext, priorSubject: parsed.priorSubject as JarvisPageContext, tools: this.tools.tools(), executeTool: (name, args) => this.tools.execute(name, args, { today: parsed.today, timeZone: parsed.timeZone, pageContext: parsed.pageContext as JarvisPageContext }) });
    this.settings.recordUsage(result.usage);
    const knownIds = new Set<string>(); if (parsed.pageContext) knownIds.add(parsed.pageContext.entityId); if (parsed.priorSubject) knownIds.add(parsed.priorSubject.entityId);
    const collect = (value: unknown) => { if (!value || typeof value !== "object") return; if (Array.isArray(value)) { value.forEach(collect); return; } const record = value as Record<string, unknown>; if (typeof record.id === "string") knownIds.add(record.id); Object.values(record).forEach(collect); };
    result.executedTools.forEach((entry) => collect(entry.result.data));
    const response = jarvisResponseSchema.parse(result.response); response.blocks = response.blocks.map((block) => ({ ...block, items: block.items.filter((item) => knownIds.has(item.entityId)) }));
    response.actions = result.executedTools.flatMap((entry) => entry.result.mutation ? [{ action: entry.result.mutation.action, reference: { entityType: entry.result.mutation.entityType as "task" | "project" | "request" | "person" | "meeting" | "knowledge_page" | "briefing", entityId: entry.result.mutation.entityId, label: entry.result.mutation.label, detail: "Changed through a validated application service." } }] : []);
    if (response.navigation?.entityId && !knownIds.has(response.navigation.entityId)) response.navigation = null;
    if (response.actions.length > 1) response.mode = "action_summary"; else if (response.actions.length === 1 && response.mode !== "workspace") response.mode = "ambient";
    return { response, subject: this.subjectFrom(response, parsed.pageContext), usage: result.usage };
  }
  permissions() { return this.tools.permissions(); }
  private subjectFrom(response: z.infer<typeof jarvisResponseSchema>, pageContext: JarvisPageContext) { const first = response.blocks.flatMap((block) => block.items)[0] ?? response.actions[0]?.reference; return first ? { entityType: first.entityType, entityId: first.entityId, label: first.label } : pageContext; }
}
