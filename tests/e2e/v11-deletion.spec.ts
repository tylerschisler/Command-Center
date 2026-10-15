import { expect, test } from "@playwright/test";

test("permanent deletion requires explicit confirmation and cancel preserves the record", async ({ page }) => {
  const response = await page.request.post("/api/tasks", { data: { title: "V1.1 deletion check" } });
  expect(response.ok()).toBe(true);
  await page.goto("/my-work");
  await expect(page.getByText("V1.1 deletion check", { exact: true })).toBeVisible();

  const menu = page.locator('summary[aria-label="Actions for V1.1 deletion check"]');
  await menu.click();
  await page.getByRole("menuitem", { name: "Delete permanently" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("V1.1 deletion check", { exact: true })).toBeVisible();

  await page.getByRole("menuitem", { name: "Delete permanently" }).click();
  await page.getByLabel(/Type DELETE/).fill("DELETE");
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText("V1.1 deletion check", { exact: true })).toHaveCount(0);
});
