import { expect, test } from "@playwright/test";

test("Cycle 06 assay plate map keeps keyboard grid and table behavior equivalent", async ({
  page,
}, testInfo) => {
  test.skip(process.env.VITE_ASSAY_STUDIO_V1 !== "true", "Cycle 06 route is behind its build-time flag.");
  test.skip(testInfo.project.name !== "desktop", "Cycle 06 adds tablet/laptop-and-above QA only.");

  await page.goto("/#/assay/assay-cycle06-layout");
  await expect(page.getByRole("heading", { name: "Define the experimental layout" })).toBeVisible();
  await expect(page.getByLabel("Plate orientation A1 at top left")).toBeVisible();

  const a1 = page.getByRole("button", { name: /^Well A1,/ });
  await a1.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: /^Well A2,/ })).toBeFocused();

  await page.getByRole("combobox", { name: "Well role" }).selectOption("positiveControl");
  await page.getByRole("textbox", { name: "Condition label or reference" }).fill("condition-baseline");
  await page.getByRole("textbox", { name: "Replicate group label or reference" }).fill("replicate-demo");
  await page.getByRole("button", { name: "Apply to selected wells" }).click();

  await page.getByRole("button", { name: "Accessible table" }).click();
  const table = page.getByRole("table");
  await expect(table).toContainText("A2");
  await expect(table.getByRole("button", { name: /Well A2, Positive control/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/cycle06-assay-studio-keyboard-table.png",
  });
});
