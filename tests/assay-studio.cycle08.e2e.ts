import { expect, test } from "@playwright/test";

const enabled = process.env.VITE_ASSAY_STUDIO_V1 === "true";

test.describe("Assay Studio Cycle 08 controls and QC", () => {
  test.skip(!enabled, "Assay Studio remains default-off until its later release gate.");

  test("keyboard path exposes explicit assignments and table-first QC parity", async ({ page }) => {
    await page.goto("/#/assay/assay-cycle06-layout");
    await expect(page.getByRole("heading", { name: "Explicit assignment editor" })).toBeVisible();
    await page.getByRole("button", { name: "Review QC" }).click();
    await expect(page.getByRole("heading", { name: "Controls, replicates, and evidence review" })).toBeVisible();
    await expect(page.getByText("Pass under this rule set")).toBeVisible();
    await expect(page.getByRole("table", {
      name: /reviewed observation, correction, normalization, and flag data/i,
    })).toBeVisible();
    await expect(page.getByText(/synthetic Cycle 08 QC fixture/i)).toBeVisible();
  });
});
