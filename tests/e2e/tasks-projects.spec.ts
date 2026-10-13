import { expect, test } from "@playwright/test";

test("creates a project and task, surfaces schedule risk, completes work, and persists", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "Create project" }).click();
  const projectEditor = page.getByRole("complementary", { name: "Project editor" });
  await projectEditor.getByLabel("Name").fill("E2E Phase 2 Project");
  await projectEditor.getByLabel("Status").selectOption("active");
  await projectEditor.locator('input[name="targetDate"]').fill("2026-06-20");
  await projectEditor.locator('input[name="dueDate"]').fill("2026-06-15");
  await projectEditor.getByRole("button", { name: "Save project" }).click();

  await expect(page.getByRole("button", { name: /E2E Phase 2 Project/ })).toBeVisible();
  await expect(page.getByText("Target completion is after required due date.").first()).toBeVisible();
  const detail = page.getByRole("region", { name: "E2E Phase 2 Project details" });
  await expect(detail).toBeVisible();
  await detail.getByRole("tab", { name: "Tasks" }).click();
  await detail.getByRole("button", { name: "Add task" }).click();

  const taskEditor = page.getByRole("complementary", { name: "Task editor" });
  await taskEditor.getByLabel("Title").fill("E2E Project Task");
  await taskEditor.locator('input[name="targetDate"]').fill("2026-06-20");
  await taskEditor.locator('input[name="dueDate"]').fill("2026-06-15");
  await taskEditor.getByRole("button", { name: "Save task" }).click();
  await expect(detail.getByText("E2E Project Task")).toBeVisible();
  await expect(detail.getByText("Target completion is after required due date.")).toBeVisible();
  await detail.getByRole("button", { name: "Complete" }).click();
  await expect(detail.getByText("Completed")).toBeVisible();
  await expect(page.getByText(/100% · 1\/1 tasks/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /E2E Phase 2 Project/ })).toContainText("100% · 1/1 tasks");
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "My Work" }).click();
  await page.getByRole("tab", { name: "Completed" }).click();
  await expect(page.getByRole("button", { name: "E2E Project Task" })).toBeVisible();
});
