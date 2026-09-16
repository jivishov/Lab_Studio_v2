import { expect, test } from "@playwright/test";

const enabled = process.env.VITE_ASSAY_STUDIO_V1 === "true";

test.describe("Assay Studio Cycle 09 operational planning", () => {
  test.skip(!enabled, "Assay Studio remains default-off until its later release gate.");

  test("keyboard path reviews explicit assumptions, formulas, shortages, and capacity", async ({ page }) => {
    await page.goto("/#/assay/assay-cycle06-layout");
    await expect(page.getByRole("heading", {
      name: "Materials, capacity, and run schedule",
    })).toBeVisible();
    await expect(page.getByText("Complete plan")).toBeVisible();
    await expect(page.getByRole("table", {
      name: /Exact requirements and inventory comparison/i,
    })).toBeVisible();
    await expect(page.getByRole("table", {
      name: /Sequential operational phases/i,
    })).toBeVisible();
    await page.getByLabel("Participants").fill("8");
    await page.getByLabel("User-declared planning note").fill(
      "Teacher-reviewed local grouping.",
    );
    await expect(page.getByText("592 1")).toBeVisible();
    await page.getByRole("button", { name: "Formula trace CSV" }).focus();
    await expect(page.getByRole("button", { name: "Formula trace CSV" }))
      .toBeFocused();
  });
});
