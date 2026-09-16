import { expect, test } from "@playwright/test";

test.describe("Assay Studio Cycle 10 reviewed ingestion", () => {
  test.skip(!process.env.VITE_ASSAY_STUDIO_V1, "Assay Studio remains default-off.");

  test("maps long CSV and exposes a keyboard-operable explicit review table", async ({ page }) => {
    await page.goto("/#/assay/assay-cycle06-layout");
    const section = page.getByRole("heading", { name: "Observation import & review" });
    await expect(section).toBeVisible();
    await page.getByLabel("CSV source preview").fill([
      "Plate,Well,Signal,Unit,Channel",
      "assay-cycle06-plate,A1,0.12,AU,primary",
      "assay-cycle06-plate,A2,0.85,AU,primary",
    ].join("\n"));
    await page.getByRole("button", { name: "Preview mapping" }).click();
    await expect(page.getByRole("table", { name: "Mapped observations and explicit review state" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Commit reviewed set" })).toBeDisabled();
    await page.getByRole("button", { name: "Accept all mapped" }).click();
    await expect(page.getByRole("button", { name: "Commit reviewed set" })).toBeEnabled();
    await page.getByRole("button", { name: "Commit reviewed set" }).click();
    await expect(page.getByRole("status")).toContainText("explicitly reviewed observations");
  });
});
