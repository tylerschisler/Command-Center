import { randomUUID } from "node:crypto";
import { addDays, BRIEFING_TYPES, buildCommandCenter, eventsInPeriod, isValidCalendarDate, isValidTimeZone, localDateForInstant, type BriefingType, type DashboardContext } from "@/domain/command-center";
import type { ActivityEvent, Briefing } from "@/server/db/schema";
import type { BriefingRepository, CommandCenterRepository } from "@/server/repositories/command-center-repository";
import { NotFoundError, ValidationError } from "./service-errors";

export interface BriefingFacts {
  version: 1;
  type: Exclude<BriefingType, "custom">;
  period: { start: string; end: string; timeZone: string };
  generatedAt: string;
  current: ReturnType<typeof buildCommandCenter>;
  history: Record<string, Array<{ eventType: string; description: string; entityType: string; entityId: string; timestamp: string }>>;
  decisions: Array<{ content: string; meetingId: string; createdAt: string }>;
  projectMovement: Array<{ projectId: string; projectName: string; completedTaskCount: number; requestChangeCount: number }>;
  upcoming: { start: string; end: string; deadlines: Array<{ entityType: string; title: string; date: string; kind: string }>; meetings: Array<{ id: string; title: string; date: string; startDateTime: string }> };
  forward: ReturnType<typeof buildCommandCenter> | null;
}

function assertContext(context: DashboardContext) {
  if (!isValidCalendarDate(context.today)) throw new ValidationError("A valid local date is required.");
  if (!isValidTimeZone(context.timeZone)) throw new ValidationError("A valid IANA time zone is required.");
}
function summarize(events: ActivityEvent[], types: string[]) {
  return events.filter((event) => types.includes(event.eventType)).map(({ eventType, description, entityType, entityId, timestamp }) => ({ eventType, description, entityType, entityId, timestamp }));
}
function label(type: Exclude<BriefingType, "custom">) { return type === "morning" ? "Morning Briefing" : type === "end_of_day" ? "End-of-Day Briefing" : "Weekly Review"; }
function bullets(items: string[], empty: string) { return items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${empty}`; }
function render(facts: BriefingFacts) {
  const dashboard = facts.current;
  const lines = [`# ${label(facts.type)}`, `Period: ${facts.period.start}${facts.period.end === facts.period.start ? "" : ` through ${facts.period.end}`}`, "", "## At a Glance", `- ${dashboard.summary.dueToday} task(s) due today`, `- ${dashboard.summary.overdueTasks} overdue task(s)`, `- ${dashboard.summary.meetingsToday} meeting(s) today`, `- ${dashboard.summary.openRequests} open request(s)`, `- ${dashboard.summary.projectsAtRisk} project(s) at risk or off track`, ""];
  if (facts.type === "morning") {
    lines.push("## Today's Work", bullets(dashboard.todayWork.map((item) => `${item.title}${item.dueDate ? ` — due ${item.dueDate}` : ""}`), "No task requires attention today."), "", "## Meetings", bullets(dashboard.meetings.map((meeting) => `${meeting.title} — ${meeting.startDateTime}`), "No meetings today."), "", "## Waiting On", bullets(dashboard.waitingOn.map((request) => `${request.title} — ${request.personName}`), "No open requests."), "", "## Upcoming Important Deadlines", bullets(facts.upcoming.deadlines.map((item) => `${item.title} — ${item.kind} ${item.date}`), "No deadlines in the next seven days."));
  } else {
    lines.push("## Accomplishments", bullets([...facts.history.tasksCompleted.map((event) => event.description), ...facts.history.tasksCreated.map((event) => event.description)], "No task completions or creations were recorded."), "", "## Project Movement", bullets([...facts.history.projectChanges.map((event) => event.description), ...facts.projectMovement.map((item) => `${item.projectName}: ${item.completedTaskCount} task(s) completed; ${item.requestChangeCount} request change(s).`)], "No project changes were recorded."), "", "## Waiting On", bullets(facts.history.requestChanges.map((event) => event.description), "No request lifecycle changes were recorded."), "", "## Meetings & Decisions", bullets([...facts.history.meetingsCompleted.map((event) => event.description), ...facts.decisions.map((decision) => decision.content)], "No completed meetings or decisions were recorded."), "", "## Knowledge Captured", bullets(facts.history.knowledgeChanges.map((event) => event.description), "No Knowledge changes were recorded."));
  }
  lines.push("", "## Attention Needed", bullets(dashboard.attention.map((item) => `${item.title} — ${item.reasons.join(", ")}`), "Nothing currently needs attention."), "", facts.type === "weekly" ? "## Next Week" : "## Tomorrow", bullets([...facts.upcoming.deadlines.map((item) => `${item.title} — ${item.kind} ${item.date}`), ...facts.upcoming.meetings.map((item) => `${item.title} — ${item.date}`)], "Nothing scheduled."), "", "## Focus", bullets(dashboard.focus.map((item) => `${item.title} — ${item.reasons.join(", ")}`), "No focus recommendations."));
  return lines.join("\n");
}

export class CommandCenterService {
  constructor(private readonly repository: CommandCenterRepository) {}
  getHome(context: DashboardContext) { assertContext(context); return buildCommandCenter(this.repository.snapshot(), context); }
}

export class BriefingService {
  constructor(private readonly dashboardRepository: CommandCenterRepository, private readonly briefingRepository: BriefingRepository, private readonly clock = () => new Date()) {}
  listBriefings(type?: BriefingType) {
    if (type && !BRIEFING_TYPES.includes(type)) throw new ValidationError("Invalid briefing type.");
    return this.briefingRepository.list(type);
  }
  getBriefing(id: string) {
    if (!id.trim()) throw new ValidationError("A briefing ID is required.");
    const briefing = this.briefingRepository.findById(id);
    if (!briefing) throw new NotFoundError("Briefing not found.");
    return briefing;
  }
  generate(type: Exclude<BriefingType, "custom">, context: DashboardContext, source: "manual" | "system" = "manual"): Briefing {
    assertContext(context);
    if (!(["morning", "end_of_day", "weekly"] as const).includes(type)) throw new ValidationError("This briefing type cannot be generated in Phase 6.");
    const snapshot = this.dashboardRepository.snapshot();
    const start = type === "weekly" ? (() => { const value = new Date(`${context.today}T12:00:00.000Z`); const offset = (value.getUTCDay() + 6) % 7; return addDays(context.today, -offset); })() : context.today;
    const end = type === "weekly" ? addDays(start, 6) : context.today;
    const periodEvents = eventsInPeriod(snapshot.activity, start, end, context.timeZone);
    const history = {
      tasksCompleted: summarize(periodEvents, ["TASK_COMPLETED"]),
      tasksCreated: summarize(periodEvents, ["TASK_CREATED"]),
      projectChanges: summarize(periodEvents, ["PROJECT_UPDATED", "PROJECT_COMPLETED", "PROJECT_HEALTH_CHANGED", "PROJECT_ARCHIVED"]),
      requestChanges: summarize(periodEvents, ["REQUEST_CREATED", "REQUEST_UPDATED", "REQUEST_REQUESTED", "REQUEST_ACKNOWLEDGED", "REQUEST_WAITING", "REQUEST_RECEIVED", "REQUEST_CLOSED", "REQUEST_ARCHIVED", "REQUEST_RESTORED"]),
      meetingsCompleted: summarize(periodEvents, ["MEETING_COMPLETED"]),
      knowledgeChanges: summarize(periodEvents, ["KNOWLEDGE_PAGE_CREATED", "KNOWLEDGE_PAGE_UPDATED", "KNOWLEDGE_VERSION_RESTORED"]),
      important: periodEvents.filter((event) => event.eventType !== "BRIEFING_GENERATED").slice(0, 25).map(({ eventType, description, entityType, entityId, timestamp }) => ({ eventType, description, entityType, entityId, timestamp })),
    };
    const decisionIds = new Set(periodEvents.filter((event) => event.eventType === "MEETING_DECISION_ADDED" && typeof event.metadata.decisionId === "string").map((event) => String(event.metadata.decisionId)));
    const decisions = snapshot.decisions.filter((decision) => decisionIds.has(decision.id)).map(({ content, meetingId, createdAt }) => ({ content, meetingId, createdAt }));
    const forwardDate = type === "weekly" ? addDays(end, 1) : addDays(context.today, 1);
    const upcomingStart = type === "morning" ? context.today : forwardDate; const upcomingEnd = type === "weekly" || type === "morning" ? addDays(upcomingStart, 6) : upcomingStart;
    const inUpcoming = (date: string | null | undefined) => Boolean(date && date >= upcomingStart && date <= upcomingEnd);
    const deadlines: Array<{ entityType: string; title: string; date: string; kind: string }> = [];
    const addDeadline = (entityType: string, title: string, date: string | null, kind: string) => { if (inUpcoming(date)) deadlines.push({ entityType, title, date: date!, kind }); };
    for (const item of snapshot.tasks.filter((value) => !value.archivedAt && value.status !== "completed")) { addDeadline("task", item.title, item.dueDate, "task due"); addDeadline("task", item.title, item.targetDate, "task target"); }
    for (const item of snapshot.projects.filter((value) => !value.archivedAt && value.status !== "completed" && value.status !== "cancelled")) { addDeadline("project", item.name, item.dueDate, "project due"); addDeadline("project", item.name, item.targetDate, "project target"); }
    for (const item of snapshot.requests.filter((value) => !value.archivedAt && value.status !== "received" && value.status !== "closed")) { addDeadline("request", item.title, item.dueDate, "request due"); addDeadline("request", item.title, item.followUpDate, "request follow-up"); }
    deadlines.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
    const upcomingMeetings = snapshot.meetings.filter((item) => !item.archivedAt && item.status !== "cancelled").map((item) => ({ id: item.id, title: item.title, date: localDateForInstant(item.startDateTime, context.timeZone), startDateTime: item.startDateTime })).filter((item) => item.date >= upcomingStart && item.date <= upcomingEnd).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
    const taskById = new Map(snapshot.tasks.map((item) => [item.id, item])); const requestById = new Map(snapshot.requests.map((item) => [item.id, item])); const projectById = new Map(snapshot.projects.map((item) => [item.id, item]));
    const movement = new Map<string, { projectId: string; projectName: string; completedTaskCount: number; requestChangeCount: number }>();
    for (const event of periodEvents) { const projectId = event.entityType === "task" ? taskById.get(event.entityId)?.projectId : event.entityType === "request" ? requestById.get(event.entityId)?.projectId : null; if (!projectId) continue; const value = movement.get(projectId) ?? { projectId, projectName: projectById.get(projectId)?.name ?? "Unknown project", completedTaskCount: 0, requestChangeCount: 0 }; if (event.eventType === "TASK_COMPLETED") value.completedTaskCount += 1; if (event.entityType === "request" && history.requestChanges.some((item) => item.eventType === event.eventType && item.entityId === event.entityId && item.timestamp === event.timestamp)) value.requestChangeCount += 1; movement.set(projectId, value); }
    const facts: BriefingFacts = { version: 1, type, period: { start, end, timeZone: context.timeZone }, generatedAt: this.clock().toISOString(), current: buildCommandCenter(snapshot, context), history, decisions, projectMovement: [...movement.values()], upcoming: { start: upcomingStart, end: upcomingEnd, deadlines, meetings: upcomingMeetings }, forward: buildCommandCenter(snapshot, { ...context, today: forwardDate }) };
    const id = randomUUID();
    const title = `${label(type)} — ${type === "weekly" ? `${start}–${end}` : context.today}`;
    return this.briefingRepository.create({ id, type, title, periodStart: start, periodEnd: end, structuredFacts: facts as unknown as Record<string, unknown>, renderedContent: render(facts), generatedAt: facts.generatedAt, aiGenerated: false, createdAt: facts.generatedAt }, { id: randomUUID(), eventType: "BRIEFING_GENERATED", description: `Generated ${label(type).toLowerCase()} for ${start}${end === start ? "" : ` through ${end}`}.`, entityType: "briefing", entityId: id, source, metadata: { briefingId: id, type, periodStart: start, periodEnd: end }, timestamp: facts.generatedAt });
  }
}
