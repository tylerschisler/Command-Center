import { expect, test } from "@playwright/test";

test("Jarvis stays opt-in and performs a grounded service action", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/settings");
  const toggle = page.getByRole("checkbox", { name: "Cloud AI Enabled" });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.getByRole("button", { name: /Ask Jarvis/ }).click();
  await page.getByRole("textbox", { name: "Ask Jarvis" }).fill("Create a task for the SOC report tomorrow");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("heading", { name: "Task created" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review the SOC report" })).toBeVisible();
  await page.getByRole("button", { name: "Close Jarvis" }).click();
  await page.getByRole("link", { name: "My Work" }).click();
  await expect(page.getByText("Review the SOC report", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Ask Jarvis/ }).click();
  await page.getByRole("textbox", { name: "Ask Jarvis" }).fill("What should I focus on today?");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("heading", { name: "Today’s Focus" })).toBeVisible();
  await page.getByRole("button", { name: "Close Jarvis" }).click();

  const projectResponse = await page.request.post("/api/projects", { data: { name: "October UAR" } }); const project = (await projectResponse.json()).project;
  await page.goto("/projects"); await page.getByRole("tab", { name: "Planning" }).click(); await page.getByRole("button", { name: /October UAR/ }).click();
  await page.getByRole("button", { name: /Ask Jarvis/ }).click();
  await expect(page.getByText("Working with: October UAR")).toBeVisible();
  await page.getByRole("textbox", { name: "Ask Jarvis" }).fill("Add a task to follow up tomorrow"); await page.getByRole("button", { name: "Run" }).click(); await expect(page.getByRole("heading", { name: "Project task created" })).toBeVisible();
  const tasks = await (await page.request.get("/api/tasks")).json(); expect(tasks.tasks.some((task: { projectId: string }) => task.projectId === project.id)).toBe(true);
  await page.getByRole("button", { name: "Close Jarvis" }).click();

  const knowledgeResponse = await page.request.post("/api/knowledge", { data: { title: "Admin Export Notes", content: "Existing note." } }); const knowledge = (await knowledgeResponse.json()).page;
  await page.goto("/knowledge"); await page.getByRole("button", { name: /Admin Export Notes/ }).click(); await page.getByRole("button", { name: /Ask Jarvis/ }).click(); await expect(page.getByText("Working with: Admin Export Notes")).toBeVisible();
  await page.getByRole("textbox", { name: "Ask Jarvis" }).fill("Add that administrator users require a separate export"); await page.getByRole("button", { name: "Run" }).click(); await expect(page.getByRole("heading", { name: "Knowledge updated" })).toBeVisible();
  const updatedKnowledge = await (await page.request.get(`/api/knowledge/${knowledge.id}`)).json(); expect(updatedKnowledge.page.content).toContain("Administrator users"); expect(updatedKnowledge.page.versions[0].changeSource).toBe("jarvis");
  await page.getByRole("textbox", { name: "Ask Jarvis" }).fill("Give me my weekly review"); await page.getByRole("button", { name: "Run" }).click(); await expect(page.getByRole("heading", { name: "Weekly Review" })).toBeVisible();
  await page.getByRole("button", { name: "Close Jarvis" }).click(); await page.goto("/settings"); await page.getByRole("checkbox", { name: "Cloud AI Enabled" }).uncheck(); await page.getByRole("button", { name: /Ask Jarvis/ }).click(); await page.getByRole("textbox", { name: "Ask Jarvis" }).fill("What should I focus on today?"); await page.getByRole("button", { name: "Run" }).click(); await expect(page.getByText(/Jarvis is unavailable because Cloud AI is disabled/)).toBeVisible();
});

test("Jarvis tolerates loading, legacy settings, missing STT, API failure, and reload", async ({ page }) => {
  await page.request.patch("/api/ai/settings", { data: { cloudAiEnabled: true, voiceEnabled: false } });
  await page.route("**/api/ai/settings", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ cloudAiEnabled: true }) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Ask Jarvis/ }).click();
  await expect(page.getByRole("textbox", { name: "Ask Jarvis" })).toBeVisible();
  await expect(page.getByText("Voice input is off.")).toBeVisible();
  await page.getByRole("textbox", { name: "Ask Jarvis" }).fill("What should I focus on today?");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("heading", { name: "Today’s Focus" })).toBeVisible();
  await page.getByRole("button", { name: "Close Jarvis" }).click();

  await page.unroute("**/api/ai/settings");
  await page.route("**/api/ai/settings", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ cloudAiEnabled: true, voice: { enabled: true, sttEnabled: true, sttConfigured: false } }) });
  });
  await page.getByRole("button", { name: /Ask Jarvis/ }).click();
  await expect(page.getByText(/Configure.*OPENAI_STT_MODEL/)).toBeVisible();
  await page.getByRole("button", { name: "Close Jarvis" }).click();

  await page.unroute("**/api/ai/settings");
  await page.route("**/api/ai/settings", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });
  await page.getByRole("button", { name: /Ask Jarvis/ }).click();
  await expect(page.getByText("Voice settings could not be loaded. Typed Jarvis remains available.")).toBeVisible();
  await page.getByRole("textbox", { name: "Ask Jarvis" }).fill("What should I focus on today?");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("heading", { name: "Today’s Focus" })).toBeVisible();
  await page.getByRole("button", { name: "Close Jarvis" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Ask Jarvis/ }).click();
  await expect(page.getByRole("textbox", { name: "Ask Jarvis" })).toBeVisible();
  await expect(page.getByText("Voice settings could not be loaded. Typed Jarvis remains available.")).toBeVisible();
});
