import { expect, test } from "@playwright/test";

test("manages multi-topic versioned knowledge with search and relationships", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "Create project" }).click();
  const projectEditor = page.getByRole("complementary", { name: "Project editor" });
  await projectEditor.getByLabel("Name").fill("October UAR Project");
  await projectEditor.getByLabel("Status").selectOption("active");
  await projectEditor.getByRole("button", { name: "Save project" }).click();

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Knowledge" }).click();
  const knowledgeNav = page.getByRole("navigation", { name: "Knowledge views" });
  await knowledgeNav.getByRole("button", { name: "Topics" }).click();
  const topicForm = page.locator(".knowledge-taxonomy form");
  await topicForm.getByLabel("Name").fill("Applications");
  await topicForm.getByRole("button", { name: "Create topic" }).click();
  await expect(page.locator(".knowledge-taxonomy").getByRole("button", { name: "Applications", exact: true })).toBeVisible();
  await topicForm.getByLabel("Name").fill("User Access Reviews");
  await topicForm.getByRole("button", { name: "Create topic" }).click();
  await expect(page.locator(".knowledge-taxonomy").getByRole("button", { name: "User Access Reviews", exact: true })).toBeVisible();

  await knowledgeNav.getByRole("button", { name: "Tags" }).click();
  const tagForm = page.locator(".knowledge-taxonomy form");
  await tagForm.getByLabel("Name").fill("Access Control");
  await tagForm.getByRole("button", { name: "Create tag" }).click();
  await expect(page.locator(".knowledge-taxonomy").getByRole("button", { name: "#Access Control", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Create page" }).click();
  let editor = page.getByRole("complementary", { name: "Knowledge page editor" });
  await editor.getByLabel("Title").fill("Privileged Access");
  await editor.getByLabel("Content Markdown").fill("# Privileged Access\nSupporting controls.");
  await editor.getByRole("button", { name: "Save page" }).click();
  await expect(page.getByRole("article", { name: "Privileged Access knowledge page" })).toBeVisible();

  await page.getByRole("button", { name: "Create page" }).click();
  editor = page.getByRole("complementary", { name: "Knowledge page editor" });
  await editor.getByLabel("Title").fill("Galileo");
  await editor.getByLabel("Summary").fill("Application and UAR procedure");
  await editor.getByLabel("Content Markdown").fill("# Galileo\n\nReview privileged accounts.");
  await editor.getByRole("button", { name: "Save page" }).click();

  const detail = page.getByRole("article", { name: "Galileo knowledge page" });
  await expect(detail).toBeVisible();
  await detail.getByLabel("Assign topic").selectOption({ label: "Applications" });
  await expect(detail.getByText("Applications")).toBeVisible();
  await detail.getByLabel("Assign topic").selectOption({ label: "User Access Reviews" });
  await expect(detail.getByText("User Access Reviews")).toBeVisible();
  await detail.getByLabel("Assign tag").selectOption({ label: "Access Control" });
  await expect(detail.getByText("#Access Control")).toBeVisible();

  await detail.getByRole("button", { name: "Edit" }).click();
  editor = page.getByRole("complementary", { name: "Knowledge page editor" });
  await editor.getByLabel("Content Markdown").fill("# Galileo\n\nReview privileged accounts and service accounts.");
  await editor.getByLabel("Change description").fill("Added service accounts");
  await editor.getByRole("button", { name: "Save page" }).click();
  await expect(detail.getByText("Added service accounts")).toBeVisible();

  const relationshipForm = detail.locator(".relationship-form");
  await relationshipForm.getByLabel("Relationship target type").selectOption("project");
  await relationshipForm.getByLabel("Relationship target", { exact: true }).selectOption({ label: "October UAR Project" });
  await relationshipForm.getByRole("button", { name: "Add relationship" }).click();
  await expect(detail.locator(".detail-list strong", { hasText: "October UAR Project" })).toBeVisible();
  await relationshipForm.getByLabel("Relationship target type").selectOption("knowledge_page");
  await relationshipForm.getByLabel("Relationship target", { exact: true }).selectOption({ label: "Privileged Access" });
  await relationshipForm.getByRole("button", { name: "Add relationship" }).click();
  await expect(detail.locator(".detail-list strong", { hasText: "Privileged Access" })).toBeVisible();

  await page.getByRole("search").getByRole("textbox").fill("service accounts");
  await page.getByRole("search").getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("button", { name: /Galileo/ })).toBeVisible();
  for (const topic of ["Applications", "User Access Reviews"]) {
    await knowledgeNav.getByRole("button", { name: "Topics" }).click();
    await page.locator(".knowledge-taxonomy").getByRole("button", { name: topic, exact: true }).click();
    await expect(page.getByRole("button", { name: /Galileo/ })).toBeVisible();
  }

  await knowledgeNav.getByRole("button", { name: "All Pages" }).click();
  await page.getByRole("button", { name: /Galileo/ }).click();
  await detail.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("button", { name: /Galileo/ })).toHaveCount(0);
  await knowledgeNav.getByRole("button", { name: "Archived" }).click();
  await page.getByRole("button", { name: /Galileo/ }).click();
  await expect(detail.getByText("Added service accounts")).toBeVisible();
  await detail.getByRole("button", { name: "Restore", exact: true }).click();

  await page.reload();
  await page.getByRole("button", { name: /Galileo/ }).click();
  await expect(detail.getByText("Review privileged accounts and service accounts.", { exact: true })).toBeVisible();
  await expect(detail.getByText("Applications")).toBeVisible();
  await expect(detail.getByText("User Access Reviews")).toBeVisible();
  await expect(detail.locator(".detail-list strong", { hasText: "Privileged Access" })).toBeVisible();
});
