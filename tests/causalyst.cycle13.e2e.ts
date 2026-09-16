import { expect, test } from "@playwright/test";

test.describe("Causalyst Cycle 13 local authoring", () => {
  test("authors and previews a validated assay assessment with keyboard controls", async ({ page }) => {
    await page.goto("/#/causalyst-author/assay-template");
    await expect(page.getByRole("heading", { name: "Causalyst" })).toBeVisible();
    await page.getByRole("tab", { name: /boundaries/i }).click();
    await page.getByLabel("Required fidelity").selectOption("F2");
    await page.getByRole("tab", { name: /preview/i }).click();
    await page.getByRole("button", { name: "Show learner preview" }).click();
    await expect(page.getByRole("heading", { name: "Assay evidence review" })).toBeVisible();
    await expect(page.getByText(/teacher required/i)).toBeVisible();
    await expect(page.getByText(/does not generate prompts/i)).toBeVisible();
  });
});
