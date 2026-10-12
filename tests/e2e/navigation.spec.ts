import { expect, test } from "@playwright/test";

test("application boots and primary navigation renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name:"Good morning." })).toBeVisible();
  const health = await page.request.get("/api/health");
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toEqual({ status:"ok", database:"connected" });
  const navigation = page.getByRole("navigation", { name:"Primary navigation" });
  await expect(navigation.getByRole("link")).toHaveCount(9);
  await navigation.getByRole("link", { name:"Projects" }).click();
  await expect(page.getByRole("heading", { name:"Projects" })).toBeVisible();
});
