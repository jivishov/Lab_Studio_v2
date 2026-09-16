import { expect, test } from "@playwright/test";

test.describe("Cycle 12 Assay Studio release candidate", () => {
  test.skip(
    process.env.VITE_ASSAY_STUDIO_V1 !== "true",
    "Assay Studio remains behind its explicit build flag.",
  );

  test("supports keyboard capability search and validation/export review", async ({ page }) => {
    await page.goto("/#/assays");
    await page.getByRole("searchbox", { name: "Search capabilities" }).fill("metabolic");
    await expect(page.getByRole("table", {
      name: "Registered assay capabilities and honest fidelity ceilings",
    })).toContainText("XTT");

    await page.getByLabel("Starting template").selectOption("xtt-metabolic-activity");
    await page.getByRole("button", { name: "New 96-well assay" }).click();
    await expect(page.getByRole("heading", { name: "Release review" })).toBeVisible();
    await expect(page.getByText("Valid 96-well artifact")).toBeVisible();
    await expect(page.getByRole("button", { name: /\.assay-package\.json/ })).toBeEnabled();
    await expect(page.getByText(/metabolic-activity proxy/i)).toBeVisible();
    await expect(page.getByText(/direct cell count/i)).toBeVisible();
  });
});
