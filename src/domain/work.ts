export const TASK_STATUSES = ["not_started", "in_progress", "waiting", "blocked", "completed"] as const;
export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
export const PRIORITIES = ["critical", "high", "medium", "low"] as const;
export const PROJECT_HEALTH = ["on_track", "at_risk", "off_track"] as const;
export const REQUEST_STATUSES = ["draft", "requested", "acknowledged", "waiting", "received", "closed"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type ProjectHealth = (typeof PROJECT_HEALTH)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export function calendarToday(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const labels: Record<TaskStatus | ProjectStatus | Priority | ProjectHealth | RequestStatus, string> = {
  not_started: "Not Started", in_progress: "In Progress", waiting: "Waiting", blocked: "Blocked",
  completed: "Completed", planning: "Planning", active: "Active", on_hold: "On Hold", cancelled: "Cancelled",
  critical: "Critical", high: "High", medium: "Medium", low: "Low",
  on_track: "On Track", at_risk: "At Risk", off_track: "Off Track",
  draft: "Draft", requested: "Requested", acknowledged: "Acknowledged", received: "Received", closed: "Closed",
};

export function hasTargetAfterDueRisk(targetDate: string | null | undefined, dueDate: string | null | undefined): boolean {
  return Boolean(targetDate && dueDate && targetDate > dueDate);
}

export function isRequestOverdue(dueDate: string | null | undefined, status: RequestStatus, today = calendarToday()): boolean {
  return Boolean(dueDate && dueDate < today && status !== "received" && status !== "closed");
}

export function isFollowUpNeeded(followUpDate: string | null | undefined, status: RequestStatus, today = calendarToday()): boolean {
  return Boolean(followUpDate && followUpDate <= today && status !== "received" && status !== "closed");
}

export function isDueSoon(dueDate: string | null | undefined, status: RequestStatus, today = calendarToday(), days = 7): boolean {
  if (!dueDate || status === "received" || status === "closed" || dueDate < today) return false;
  const end = new Date(`${today}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + days);
  return dueDate <= end.toISOString().slice(0, 10);
}

export function isOverdue(
  dueDate: string | null | undefined,
  status: TaskStatus | ProjectStatus,
  today = calendarToday(),
): boolean {
  return Boolean(dueDate && dueDate < today && status !== "completed" && status !== "cancelled");
}

export function calculateProjectProgress(tasks: ReadonlyArray<{ status: TaskStatus; archivedAt: string | null }>) {
  const activeTasks = tasks.filter((task) => !task.archivedAt);
  const completedTasks = activeTasks.filter((task) => task.status === "completed").length;
  return {
    totalTasks: activeTasks.length,
    completedTasks,
    openTasks: activeTasks.length - completedTasks,
    percent: activeTasks.length === 0 ? 0 : Math.round((completedTasks / activeTasks.length) * 100),
  };
}
