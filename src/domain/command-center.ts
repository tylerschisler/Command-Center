import type { ActivityEvent, Meeting, MeetingDecision, Person, Project, Task, WorkRequest } from "@/server/db/schema";
import { calculateProjectProgress, hasTargetAfterDueRisk, isFollowUpNeeded, isOverdue, isRequestOverdue } from "./work";

export const BRIEFING_TYPES = ["morning", "end_of_day", "weekly", "custom"] as const;
export type BriefingType = (typeof BRIEFING_TYPES)[number];

export interface DashboardSnapshot {
  tasks: Task[];
  projects: Project[];
  requests: WorkRequest[];
  meetings: Meeting[];
  people: Person[];
  participants: Array<{ meetingId: string; personId: string }>;
  decisions: MeetingDecision[];
  activity: ActivityEvent[];
}

export interface DashboardContext { today: string; timeZone: string }
export interface DashboardItem {
  id: string;
  entityType: "task" | "project" | "request" | "meeting";
  title: string;
  href: string;
  reasons: string[];
  score: number;
}

const DAY = 86_400_000;
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function weekStart(date: string) {
  const value = new Date(`${date}T12:00:00.000Z`);
  const mondayOffset = (value.getUTCDay() + 6) % 7;
  return addDays(date, -mondayOffset);
}
export function localDateForInstant(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const part = (name: string) => parts.find((item) => item.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function isValidTimeZone(timeZone: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone }).format(); return true; } catch { return false; }
}
export function isValidCalendarDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date;
}

function priorityScore(priority: Task["priority"] | Project["priority"] | WorkRequest["priority"]) {
  return priority === "critical" ? 1_000 : priority === "high" ? 500 : priority === "medium" ? 50 : 0;
}
function dueSoon(date: string | null, today: string, window = 7) { return Boolean(date && date >= today && date <= addDays(today, window)); }
function activeRequest(request: WorkRequest) { return !request.archivedAt && request.status !== "received" && request.status !== "closed"; }
function activeTask(task: Task) { return !task.archivedAt && task.status !== "completed"; }
function activeProject(project: Project) { return !project.archivedAt && !["completed", "cancelled"].includes(project.status); }

export function buildCommandCenter(snapshot: DashboardSnapshot, context: DashboardContext) {
  const { today, timeZone } = context;
  const people = new Map(snapshot.people.map((person) => [person.id, person]));
  const projects = new Map(snapshot.projects.map((project) => [project.id, project]));
  const openTasks = snapshot.tasks.filter(activeTask);
  const openRequests = snapshot.requests.filter(activeRequest);
  const todayMeetings = snapshot.meetings.filter((meeting) => !meeting.archivedAt && meeting.status !== "cancelled" && localDateForInstant(meeting.startDateTime, timeZone) === today);
  const taskView = (task: Task) => ({ ...task, ownerName: task.ownerId ? people.get(task.ownerId)?.displayName ?? "Unknown person" : task.unresolvedOwnerToken ? "Unresolved delegated owner" : "Me", projectName: task.projectId ? projects.get(task.projectId)?.name ?? null : null });
  const requestView = (request: WorkRequest) => ({ ...request, personName: people.get(request.requestedFromPersonId)?.displayName ?? "Unknown person", projectName: request.projectId ? projects.get(request.projectId)?.name ?? null : null });
  const projectView = (project: Project) => {
    const projectTasks = snapshot.tasks.filter((task) => task.projectId === project.id);
    const progress = calculateProjectProgress(projectTasks);
    return { ...project, progress, overdueTaskCount: projectTasks.filter((task) => activeTask(task) && isOverdue(task.dueDate, task.status, today)).length, openRequestCount: openRequests.filter((request) => request.projectId === project.id).length };
  };
  const meetingView = (meeting: Meeting) => ({ ...meeting, projectName: meeting.projectId ? projects.get(meeting.projectId)?.name ?? null : null, attendees: snapshot.participants.filter((row) => row.meetingId === meeting.id).map((row) => people.get(row.personId)?.displayName).filter(Boolean) as string[] });

  const attention: DashboardItem[] = [];
  for (const task of openTasks) {
    const reasons: string[] = []; let score = priorityScore(task.priority);
    if (isOverdue(task.dueDate, task.status, today)) { reasons.push("Overdue"); score += 10_000; }
    if (hasTargetAfterDueRisk(task.targetDate, task.dueDate)) { reasons.push("Target is after due date"); score += 5_000; }
    if (dueSoon(task.dueDate, today)) { reasons.push(task.dueDate === today ? "Due today" : "Due soon"); score += 200; }
    if (task.status === "blocked") { reasons.push("Blocked"); score += 100; }
    if (reasons.length) attention.push({ id: task.id, entityType: "task", title: task.title, href: "/my-work", reasons, score });
  }
  for (const project of snapshot.projects.filter(activeProject)) {
    const reasons: string[] = []; let score = priorityScore(project.priority);
    if (isOverdue(project.dueDate, project.status, today)) { reasons.push("Overdue"); score += 10_000; }
    if (hasTargetAfterDueRisk(project.targetDate, project.dueDate)) { reasons.push("Target is after due date"); score += 5_000; }
    if (project.health === "off_track") { reasons.push("Off Track"); score += 1_200; }
    if (project.health === "at_risk") { reasons.push("At Risk"); score += 600; }
    if (dueSoon(project.dueDate, today, 14)) { reasons.push(project.dueDate === today ? "Due today" : "Due within 14 days"); score += 200; }
    if (reasons.length) attention.push({ id: project.id, entityType: "project", title: project.name, href: "/projects", reasons, score });
  }
  for (const request of openRequests) {
    const reasons: string[] = []; let score = priorityScore(request.priority);
    if (isRequestOverdue(request.dueDate, request.status, today)) { reasons.push("Overdue dependency"); score += 10_000; }
    if (dueSoon(request.dueDate, today)) { reasons.push(request.dueDate === today ? "Due today" : "Due soon"); score += 200; }
    if (isFollowUpNeeded(request.followUpDate, request.status, today)) { reasons.push("Follow-up needed"); score += 100; }
    if (reasons.length) attention.push({ id: request.id, entityType: "request", title: request.title, href: "/waiting-on", reasons, score });
  }
  attention.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const todayWork = openTasks.filter((task) => isOverdue(task.dueDate, task.status, today) || task.dueDate === today || task.targetDate === today || ((task.priority === "critical" || task.priority === "high") && dueSoon(task.dueDate, today))).sort((a, b) => {
    const score = (task: Task) => (isOverdue(task.dueDate, task.status, today) ? 10_000 : 0) + (task.dueDate === today ? 2_000 : 0) + (task.targetDate === today ? 1_000 : 0) + priorityScore(task.priority);
    return score(b) - score(a) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  }).slice(0, 8).map(taskView);
  const waitingOn = openRequests.slice().sort((a, b) => {
    const score = (request: WorkRequest) => (isRequestOverdue(request.dueDate, request.status, today) ? 10_000 : 0) + (isFollowUpNeeded(request.followUpDate, request.status, today) ? 1_000 : 0) + (dueSoon(request.dueDate, today) ? 100 : 0) + priorityScore(request.priority);
    return score(b) - score(a) || a.dueDate.localeCompare(b.dueDate);
  }).slice(0, 6).map(requestView);
  const projectHealth = snapshot.projects.filter(activeProject).map(projectView).filter((project) => project.health !== "on_track" || hasTargetAfterDueRisk(project.targetDate, project.dueDate) || dueSoon(project.dueDate, today, 14)).sort((a, b) => ({ off_track: 0, at_risk: 1, on_track: 2 })[a.health] - ({ off_track: 0, at_risk: 1, on_track: 2 })[b.health] || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")).slice(0, 6);
  return {
    date: today,
    timeZone,
    summary: { dueToday: openTasks.filter((task) => task.dueDate === today).length, overdueTasks: openTasks.filter((task) => isOverdue(task.dueDate, task.status, today)).length, meetingsToday: todayMeetings.length, openRequests: openRequests.length, projectsAtRisk: snapshot.projects.filter((project) => activeProject(project) && (project.health === "at_risk" || project.health === "off_track")).length },
    todayWork,
    attention: attention.slice(0, 10),
    waitingOn,
    meetings: todayMeetings.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime)).map(meetingView),
    projectHealth,
    focus: attention.slice(0, 5),
  };
}

export function eventsInPeriod(events: ActivityEvent[], start: string, end: string, timeZone: string) {
  return events.filter((event) => { const date = localDateForInstant(event.timestamp, timeZone); return date >= start && date <= end; });
}

export const millisecondsPerDay = DAY;
