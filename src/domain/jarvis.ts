import { z } from "zod";
import { addDays, isValidCalendarDate } from "./command-center";

export const jarvisEntityTypes = ["task", "project", "request", "person", "meeting", "knowledge_page", "briefing"] as const;
export const navigationDestinations = ["home", "my_work", "projects", "waiting_on", "calendar", "people", "knowledge", "settings"] as const;

export const workspaceReferenceSchema = z.object({
  entityType: z.enum(jarvisEntityTypes),
  entityId: z.string().uuid(),
  label: z.string().min(1).max(200),
  detail: z.string().max(500),
});
export const workspaceBlockSchema = z.object({
  type: z.enum(["summary", "metric_group", "prioritized_items", "references", "warning", "recommended_actions", "briefing_section"]),
  heading: z.string().min(1).max(120),
  text: z.string().max(4_000),
  metrics: z.array(z.object({ label: z.string().max(100), value: z.string().max(100) })).max(12),
  items: z.array(workspaceReferenceSchema).max(25),
});
export const jarvisNavigationSchema = z.object({
  destination: z.enum(navigationDestinations),
  entityId: z.string().uuid().nullable(),
  filter: z.enum(["all", "mine", "delegated", "today", "upcoming", "completed", "overdue", "follow_up", "received", "active", "planning"]).nullable(),
}).nullable();
export const jarvisResponseSchema = z.object({
  mode: z.enum(["ambient", "action_summary", "workspace"]),
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(2_000),
  blocks: z.array(workspaceBlockSchema).max(20),
  actions: z.array(z.object({ action: z.string().max(100), reference: workspaceReferenceSchema })).max(20),
  navigation: jarvisNavigationSchema,
});

export type JarvisWorkspaceResponse = z.infer<typeof jarvisResponseSchema>;
export type JarvisResponse = JarvisWorkspaceResponse;
export type JarvisReference = z.infer<typeof workspaceReferenceSchema>;
export type JarvisPageContext = { entityType: (typeof jarvisEntityTypes)[number]; entityId: string; label?: string } | null;

export function resolveNaturalDate(value: string, today: string): string {
  const normalized = value.trim().toLocaleLowerCase();
  if (!isValidCalendarDate(today)) throw new Error("A valid local date is required.");
  if (isValidCalendarDate(normalized)) return normalized;
  if (normalized === "today") return today;
  if (normalized === "tomorrow") return addDays(today, 1);
  if (normalized === "end of week") return addDays(today, (7 - new Date(`${today}T12:00:00.000Z`).getUTCDay()) % 7);
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const next = normalized.startsWith("next "); const weekday = next ? normalized.slice(5) : normalized; const target = weekdays.indexOf(weekday);
  if (target >= 0) {
    const current = new Date(`${today}T12:00:00.000Z`).getUTCDay(); let delta = (target - current + 7) % 7;
    if (delta === 0 || next) delta += 7;
    return addDays(today, delta);
  }
  throw new Error(`Could not resolve date “${value}”. Use today, tomorrow, a weekday, next weekday, end of week, or YYYY-MM-DD.`);
}

export function navigationHref(navigation: NonNullable<z.infer<typeof jarvisNavigationSchema>>) {
  const base: Record<(typeof navigationDestinations)[number], string> = { home: "/", my_work: "/my-work", projects: "/projects", waiting_on: "/waiting-on", calendar: "/calendar", people: "/people", knowledge: "/knowledge", settings: "/settings" };
  const params = new URLSearchParams();
  if (navigation.filter) params.set("view", navigation.filter);
  if (navigation.entityId) params.set(navigation.destination === "knowledge" ? "page" : "entity", navigation.entityId);
  const query = params.toString(); return `${base[navigation.destination]}${query ? `?${query}` : ""}`;
}
