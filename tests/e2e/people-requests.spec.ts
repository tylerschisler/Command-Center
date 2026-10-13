import { expect, test } from "@playwright/test";

test("creates a person, delegates a task, tracks a project request, receives it, and persists", async ({ page }) => {
  await page.goto("/people");
  await page.getByRole("button", { name: "Create person" }).click();
  const personEditor = page.getByRole("complementary", { name: "Person editor" });
  await personEditor.getByLabel("First name").fill("Taylor");
  await personEditor.getByLabel("Last name").fill("Morgan");
  await personEditor.getByLabel("Role").fill("Reviewer");
  await personEditor.getByLabel("Company or team").fill("Assurance");
  await personEditor.getByRole("button", { name: "Save person" }).click();
  await expect(page.getByRole("button", { name: /Taylor Morgan/ })).toBeVisible();

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Projects" }).click();
  await page.getByRole("button", { name: "Create project" }).click();
  const projectEditor = page.getByRole("complementary", { name: "Project editor" });
  await projectEditor.getByLabel("Name").fill("Phase 3 Relationship Project");
  await projectEditor.getByLabel("Status").selectOption("active");
  await projectEditor.getByRole("button", { name: "Save project" }).click();
  const projectDetail = page.getByRole("region", { name: "Phase 3 Relationship Project details" });
  await projectDetail.getByRole("tab", { name: "Tasks" }).click();
  await projectDetail.getByRole("button", { name: "Add task" }).click();
  const taskEditor = page.getByRole("complementary", { name: "Task editor" });
  await taskEditor.getByLabel("Title").fill("Delegated relationship task");
  await taskEditor.getByLabel("Owner").selectOption({ label: "Taylor Morgan" });
  await taskEditor.getByRole("button", { name: "Save task" }).click();

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "My Work" }).click();
  await page.getByRole("tab", { name: "Delegated" }).click();
  await expect(page.getByText("Taylor Morgan").first()).toBeVisible();

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Waiting On" }).click();
  await page.getByRole("button", { name: "Create request" }).click();
  const requestEditor = page.getByRole("complementary", { name: "Request editor" });
  await requestEditor.getByLabel("Request", { exact: true }).fill("Provide signed evidence");
  await requestEditor.getByLabel("Requested from").selectOption({ label: "Taylor Morgan" });
  await requestEditor.locator('select[name="projectId"]').selectOption({ label: "Phase 3 Relationship Project" });
  await requestEditor.getByLabel("Due date").fill("2026-01-01");
  await requestEditor.getByLabel("Follow-up date").fill("2026-01-02");
  await requestEditor.getByRole("button", { name: "Save request" }).click();
  await expect(page.getByText("Request is overdue.").first()).toBeVisible();
  await expect(page.getByText("Follow-up is needed.").first()).toBeVisible();
  await page.getByRole("button", { name: /Provide signed evidence/ }).click();
  await page.getByRole("button", { name: "Mark received" }).click();
  await page.getByRole("tab", { name: "Received" }).click();
  await expect(page.getByRole("button", { name: /Provide signed evidence/ })).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Received" }).click();
  await expect(page.getByText("Provide signed evidence")).toBeVisible();
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Projects" }).click();
  await page.getByRole("button", { name: /Phase 3 Relationship Project/ }).click();
  await page.getByRole("region", { name: "Phase 3 Relationship Project details" }).getByRole("tab", { name: "Waiting On" }).click();
  await expect(page.getByText("Provide signed evidence")).toBeVisible();
});
