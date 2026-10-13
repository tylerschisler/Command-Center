import { expect, test } from "@playwright/test";

test("shows useful empty states without fabricated dashboard data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  await expect(page.getByText("No focus recommendations right now.")).toBeVisible();
  await expect(page.getByText("Generate your first fact-based briefing above.")).toBeVisible();
});

test("surfaces representative work and persists deterministic briefings", async ({ page }) => {
  const context = await page.evaluate(() => {
    const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1); const overdue = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    return { today, overdue, start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10).toISOString(), end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11).toISOString() };
  });
  const person = (await (await page.request.post("/api/people", { data: { firstName: "Dashboard", lastName: "Owner" } })).json()).person;
  const project = (await (await page.request.post("/api/projects", { data: { name: "Dashboard Risk Project", status: "active", health: "at_risk", priority: "high", targetDate: context.today, dueDate: context.overdue } })).json()).project;
  const overdueTask = (await (await page.request.post("/api/tasks", { data: { title: "Dashboard Overdue Task", projectId: project.id, priority: "high", status: "blocked", targetDate: context.today, dueDate: context.overdue } })).json()).task;
  await page.request.post("/api/tasks", { data: { title: "Dashboard Due Today", projectId: project.id, dueDate: context.today } });
  const request = (await (await page.request.post("/api/requests", { data: { title: "Dashboard Overdue Request", requestedFromPersonId: person.id, requestedDate: context.overdue, dueDate: context.overdue, followUpDate: context.today, status: "waiting", projectId: project.id } })).json()).request;
  const meeting = (await (await page.request.post("/api/meetings", { data: { title: "Dashboard Today Meeting", startDateTime: context.start, endDateTime: context.end, participantIds: [person.id], projectId: project.id } })).json()).meeting;
  await page.request.post("/api/knowledge", { data: { title: "Dashboard Knowledge", content: "Recorded fact." } });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today's Work" })).toBeVisible();
  await expect(page.getByText("Dashboard Overdue Task").first()).toBeVisible();
  await expect(page.getByText("Dashboard Overdue Request").first()).toBeVisible();
  await expect(page.getByText("Dashboard Today Meeting").first()).toBeVisible();
  await expect(page.getByText("Dashboard Risk Project").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Focus" })).toBeVisible();
  const generation = page.getByRole("group", { name: "Briefing generation" });
  await generation.getByRole("button", { name: "Morning Briefing" }).click();
  await expect(page.getByRole("complementary").getByText("No AI used")).toBeVisible();
  await expect(page.getByRole("complementary").getByText("Dashboard Overdue Task")).toBeVisible();
  await page.getByRole("button", { name: "Close briefing" }).click();
  await page.request.patch(`/api/tasks/${overdueTask.id}`, { data: { action: "complete" } });
  await page.request.patch(`/api/requests/${request.id}`, { data: { action: "received" } });
  await page.request.patch(`/api/meetings/${meeting.id}`, { data: { action: "addDecision", content: "Dashboard decision recorded." } });
  await page.request.patch(`/api/meetings/${meeting.id}`, { data: { action: "end" } });
  await generation.getByRole("button", { name: "End of Day" }).click();
  await expect(page.getByRole("complementary").getByText(/Completed task.*Dashboard Overdue Task/)).toBeVisible();
  await expect(page.getByRole("complementary").getByText("Dashboard decision recorded.")).toBeVisible();
  await page.getByRole("button", { name: "Close briefing" }).click();
  await generation.getByRole("button", { name: "Weekly Review" }).click();
  await expect(page.getByRole("complementary").getByText("Weekly Review", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Close briefing" }).click();
  await page.reload();
  const library = page.getByRole("region", { name: "Briefing Library" });
  await expect(library).toBeVisible();
  await expect(library.getByRole("button", { name: /Weekly Review/ })).toBeVisible();
  await library.getByRole("button", { name: /End-of-Day Briefing/ }).click();
  await expect(page.getByRole("complementary").getByText("Dashboard decision recorded.")).toBeVisible();
});
