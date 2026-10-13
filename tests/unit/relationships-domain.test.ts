import { describe, expect, it } from "vitest";
import { isDueSoon, isFollowUpNeeded, isRequestOverdue } from "@/domain/work";

describe("request risk rules", () => {
  it("calculates overdue, due-soon, and follow-up-needed deterministically", () => {
    expect(isRequestOverdue("2026-05-09", "waiting", "2026-05-10")).toBe(true);
    expect(isRequestOverdue("2026-05-09", "received", "2026-05-10")).toBe(false);
    expect(isFollowUpNeeded("2026-05-10", "acknowledged", "2026-05-10")).toBe(true);
    expect(isFollowUpNeeded("2026-05-10", "closed", "2026-05-10")).toBe(false);
    expect(isDueSoon("2026-05-17", "requested", "2026-05-10")).toBe(true);
    expect(isDueSoon("2026-05-18", "requested", "2026-05-10")).toBe(false);
  });
});
