import { expect, test } from "@playwright/test";

test.describe("Assay Studio Cycle 11 checked protocol analysis", () => {
  test.skip(!process.env.VITE_ASSAY_STUDIO_V1, "Assay Studio remains default-off.");

  test("reviews XTT and broth-microdilution examples through the table-first profile path", async ({ page }) => {
    await page.goto("/#/assay-results/assay-cycle11-xtt-golden");
    await expect(page.getByRole("heading", { name: "XTT metabolic-activity normalization" })).toBeVisible();
    await expect(page.getByText(/metabolic-activity proxy; not a direct cell count/i)).toBeVisible();
    await expect(page.getByRole("table", { name: "Profile-bound reviewed well results" })).toBeVisible();
    await page.getByLabel("Checked protocol example").selectOption("mic");
    await expect(page.getByRole("heading", { name: "Educational broth-microdilution endpoint" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("0.5 uM");
    await expect(page.getByText(/no clinical category or treatment advice/i)).toBeVisible();
  });
});
