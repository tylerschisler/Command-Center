import { describe, expect, it } from "vitest";
import { buildCommandCenter, localDateForInstant, type DashboardSnapshot } from "@/domain/command-center";
import type { Briefing, NewActivityEvent, NewBriefing } from "@/server/db/schema";
import type { BriefingRepository, CommandCenterRepository } from "@/server/repositories/command-center-repository";
import { BriefingService } from "@/server/services/briefing-service";

const now = "2026-10-13T15:00:00.000Z";
function snapshot(): DashboardSnapshot {
  return {
    people: [{ id: "person", firstName: "Sam", lastName: "Lee", displayName: "Sam Lee", companyOrTeam: null, role: null, notes: null, createdAt: now, updatedAt: now, archivedAt: null }],
    projects: [{ id: "project", name: "October UAR", description: "", status: "active", health: "at_risk", priority: "high", ownerId: null, startDate: null, targetDate: "2026-10-15", dueDate: "2026-10-14", completedDate: null, createdAt: now, updatedAt: now, archivedAt: null }],
    tasks: [
      { id: "overdue", title: "Review SOC report", description: "", status: "blocked", priority: "high", ownerId: null, unresolvedOwnerToken: null, projectId: "project", meetingId: null, startDate: null, targetDate: "2026-10-13", dueDate: "2026-10-12", completedDate: null, recurrenceRuleId: null, estimatedEffort: null, createdAt: now, updatedAt: now, archivedAt: null },
      { id: "today", title: "Submit evidence", description: "", status: "in_progress", priority: "medium", ownerId: null, unresolvedOwnerToken: null, projectId: "project", meetingId: null, startDate: null, targetDate: null, dueDate: "2026-10-13", completedDate: null, recurrenceRuleId: null, estimatedEffort: null, createdAt: now, updatedAt: now, archivedAt: null },
    ],
    requests: [{ id: "request", title: "Control evidence", description: "", requestedFromPersonId: "person", status: "waiting", priority: "critical", requestedDate: "2026-10-01", dueDate: "2026-10-10", followUpDate: "2026-10-13", receivedDate: null, closedDate: null, projectId: "project", relatedTaskId: null, meetingId: null, createdAt: now, updatedAt: now, archivedAt: null }],
    meetings: [{ id: "meeting", title: "Control review", startDateTime: "2026-10-13T16:00:00.000Z", endDateTime: "2026-10-13T17:00:00.000Z", location: null, agenda: null, notes: null, status: "scheduled", projectId: "project", createdAt: now, updatedAt: now, archivedAt: null }],
    participants: [{ meetingId: "meeting", personId: "person" }], decisions: [{ id: "decision", meetingId: "meeting", content: "Retain quarterly evidence.", createdAt: now }],
    activity: [
      { id: "a1", eventType: "TASK_COMPLETED", description: "Completed prior task.", entityType: "task", entityId: "done", source: "manual", metadata: {}, timestamp: now },
      { id: "a2", eventType: "TASK_CREATED", description: "Created Submit evidence.", entityType: "task", entityId: "today", source: "manual", metadata: {}, timestamp: now },
      { id: "a3", eventType: "PROJECT_HEALTH_CHANGED", description: "Changed October UAR health to At Risk.", entityType: "project", entityId: "project", source: "manual", metadata: {}, timestamp: now },
      { id: "a4", eventType: "REQUEST_RECEIVED", description: "Received evidence.", entityType: "request", entityId: "resolved", source: "manual", metadata: {}, timestamp: now },
      { id: "a5", eventType: "MEETING_COMPLETED", description: "Completed control review.", entityType: "meeting", entityId: "meeting", source: "manual", metadata: {}, timestamp: now },
      { id: "a6", eventType: "MEETING_DECISION_ADDED", description: "Recorded a decision.", entityType: "meeting", entityId: "meeting", source: "manual", metadata: { decisionId: "decision" }, timestamp: now },
      { id: "a7", eventType: "KNOWLEDGE_PAGE_UPDATED", description: "Updated controls page.", entityType: "knowledge_page", entityId: "page", source: "manual", metadata: {}, timestamp: now },
    ],
  };
}
class SnapshotRepository implements CommandCenterRepository { constructor(private readonly value: DashboardSnapshot) {} snapshot() { return this.value; } }
class MemoryBriefings implements BriefingRepository {
  items: Briefing[] = []; events: NewActivityEvent[] = [];
  create(value: NewBriefing, event: NewActivityEvent) { const briefing = value as Briefing; this.items.push(briefing); this.events.push(event); return briefing; }
  findById(id: string) { return this.items.find((item) => item.id === id); }
  list(type?: Briefing["type"]) { return this.items.filter((item) => !type || item.type === type); }
}

describe("Command Center calculations", () => {
  it("calculates summary, attention order, focus, and date boundaries deterministically", () => {
    const result = buildCommandCenter(snapshot(), { today: "2026-10-13", timeZone: "America/Chicago" });
    expect(result.summary).toEqual({ dueToday: 1, overdueTasks: 1, meetingsToday: 1, openRequests: 1, projectsAtRisk: 1 });
    expect(result.todayWork.map((item) => item.id)).toEqual(["overdue", "today"]);
    expect(result.attention[0]).toMatchObject({ id: "overdue", reasons: expect.arrayContaining(["Overdue", "Target is after due date"]) });
    expect(result.attention).toContainEqual(expect.objectContaining({ id: "request", reasons: expect.arrayContaining(["Overdue dependency"]) }));
    expect(result.focus).toHaveLength(4); expect(result.meetings[0].attendees).toEqual(["Sam Lee"]);
    expect(localDateForInstant("2026-10-14T02:30:00.000Z", "America/Chicago")).toBe("2026-10-13");
  });
});

describe("BriefingService fact generation", () => {
  it.each(["morning", "end_of_day", "weekly"] as const)("generates and persists %s facts from current state and activity", (type) => {
    const stored = new MemoryBriefings(); const service = new BriefingService(new SnapshotRepository(snapshot()), stored, () => new Date(now));
    const briefing = service.generate(type, { today: "2026-10-13", timeZone: "America/Chicago" });
    const facts = briefing.structuredFacts as Record<string, unknown>;
    expect(facts.type).toBe(type); expect(briefing.aiGenerated).toBe(false); expect(briefing.renderedContent).toContain("Attention Needed");
    expect(stored.events[0]).toMatchObject({ eventType: "BRIEFING_GENERATED", entityType: "briefing", entityId: briefing.id });
    if (type !== "morning") { expect(briefing.renderedContent).toContain("Completed prior task."); expect(briefing.renderedContent).toContain("Retain quarterly evidence."); }
    if (type === "weekly") expect(briefing.periodStart).toBe("2026-10-12");
  });
});
