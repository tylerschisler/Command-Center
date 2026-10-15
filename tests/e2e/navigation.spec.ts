import { expect, test } from "@playwright/test";

test("application boots and primary navigation renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name:"Command Center" })).toBeVisible();
  const health = await page.request.get("/api/health");
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toEqual({ status:"ok", database:"connected" });
  const navigation = page.getByRole("navigation", { name:"Primary navigation" });
  await expect(navigation.getByRole("link")).toHaveCount(9);
  await navigation.getByRole("link", { name:"Projects" }).click();
  await expect(page.getByRole("heading", { name:"Projects" })).toBeVisible();
  await expect(navigation.getByRole("link", { name:"Projects" })).toHaveAttribute("aria-current", "page");
  await navigation.getByRole("link", { name:"Home" }).click();
  await expect(page).toHaveURL(/\/$/); await expect(page.getByRole("heading", { name:"Command Center" })).toBeVisible();
  await expect(navigation.getByRole("link", { name:"Home" })).toHaveAttribute("aria-current", "page");
  for (const [name, heading] of [["My Work", "My Work"], ["Projects", "Projects"], ["Waiting On", "Waiting On"], ["Calendar", "Calendar"], ["People", "People"], ["Knowledge", "Knowledge"], ["Intelligence", "GRC Intelligence"], ["Settings", "Settings"]]) {
    await navigation.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
    await navigation.getByRole("link", { name: "Home" }).click();
    await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  }
  await page.reload(); await expect(page.getByRole("heading", { name:"Command Center" })).toBeVisible();
  await navigation.getByRole("link", { name:"My Work" }).focus(); await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/$/);
});
