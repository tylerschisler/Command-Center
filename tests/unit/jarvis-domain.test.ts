import { describe, expect, it } from "vitest";
import { jarvisResponseSchema, navigationHref, resolveNaturalDate } from "@/domain/jarvis";

describe("Jarvis deterministic boundaries", () => {
  it("resolves supported local dates without model arithmetic", () => {
    expect(resolveNaturalDate("today", "2026-10-13")).toBe("2026-10-13");
    expect(resolveNaturalDate("tomorrow", "2026-10-13")).toBe("2026-10-14");
    expect(resolveNaturalDate("Friday", "2026-10-13")).toBe("2026-10-16");
    expect(resolveNaturalDate("end of week", "2026-10-13")).toBe("2026-10-18");
    expect(() => resolveNaturalDate("eventually", "2026-10-13")).toThrow();
  });
  it("accepts only typed UI output and local navigation", () => {
    expect(() => jarvisResponseSchema.parse({ mode: "workspace", title: "x", summary: "x", blocks: [{ type: "html", heading: "x", text: "<script>", metrics: [], items: [] }], actions: [], navigation: null })).toThrow();
    expect(navigationHref({ destination: "projects", entityId: null, filter: "active" })).toBe("/projects?view=active");
  });
});
