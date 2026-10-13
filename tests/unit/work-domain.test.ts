import { describe, expect, it } from "vitest";
import { calculateProjectProgress, hasTargetAfterDueRisk, isOverdue } from "@/domain/work";

describe("work risk and progress rules", () => {
  it("calculates progress from active tasks only", () => {
    expect(calculateProjectProgress([
      { status: "completed", archivedAt: null },
      { status: "in_progress", archivedAt: null },
      { status: "completed", archivedAt: "2026-01-01T00:00:00.000Z" },
    ])).toEqual({ totalTasks: 2, completedTasks: 1, openTasks: 1, percent: 50 });
    expect(calculateProjectProgress([]).percent).toBe(0);
  });

  it("detects target-after-due and overdue without changing dates", () => {
    expect(hasTargetAfterDueRisk("2026-05-12", "2026-05-10")).toBe(true);
    expect(hasTargetAfterDueRisk("2026-05-10", "2026-05-10")).toBe(false);
    expect(isOverdue("2026-05-09", "in_progress", "2026-05-10")).toBe(true);
    expect(isOverdue("2026-05-09", "completed", "2026-05-10")).toBe(false);
  });
});
