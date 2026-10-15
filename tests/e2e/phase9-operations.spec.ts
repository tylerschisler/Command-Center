import { expect, test } from "@playwright/test";

test("refreshes GRC intelligence, saves to Knowledge, and manages encrypted backups and cost controls", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/intelligence");
  await expect(page.getByRole("heading", { name: "GRC Intelligence" })).toBeVisible();
  await page.getByRole("button", { name: "Refresh sources" }).click();
  await expect(page.getByRole("heading", { name: "CISA publishes third-party security guidance" })).toBeVisible();
  const story = page.getByRole("article").filter({ hasText: "CISA publishes third-party security guidance" });
  await expect(story.getByRole("link", { name: /Original source/ })).toHaveAttribute("href", /^https:\/\//);
  await story.getByRole("button", { name: "Save to Knowledge" }).click();
  await expect(story.getByRole("button", { name: "Saved to Knowledge" })).toBeDisabled();

  await page.goto("/knowledge");
  await expect(page.getByText("CISA publishes third-party security guidance", { exact: true }).first()).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Encrypted Backups" })).toBeVisible();
  await page.getByRole("button", { name: "Backup Now" }).click();
  await expect(page.getByRole("cell", { name: "valid", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Validate" }).first().click();
  await expect(page.getByText("The backup operation failed.")).toHaveCount(0);

  await page.getByLabel("Monthly AI Cost Warning").fill("5"); await page.getByLabel("Monthly AI Cost Warning").blur();
  await page.getByLabel("Monthly AI Cost Cutoff").fill("10"); await page.getByLabel("Monthly AI Cost Cutoff").blur();
  await page.getByLabel("Hard AI Cost Cutoff").check();
  await page.reload();
  await expect(page.getByLabel("Monthly AI Cost Warning")).toHaveValue("5");
  await expect(page.getByLabel("Hard AI Cost Cutoff")).toBeChecked();
});
