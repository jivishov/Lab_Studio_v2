import { expect, test, type Locator, type Page } from "@playwright/test";

type ActivationMode = "pointer" | "keyboard";

const activate = async (button: Locator, mode: ActivationMode) => {
  if (mode === "pointer") {
    await button.click();
  } else {
    await button.focus();
    await button.press("Enter");
  }
};

const executeTwoPointDilution = async (page: Page, mode: ActivationMode): Promise<string[]> => {
  await page.goto("/#/assay/assay-cycle06-layout");
  await page.reload();
  const heading = page.getByRole("heading", { name: "Pipetting rehearsal" });
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toBeVisible();
  await expect(page.getByLabel("Plate orientation A1 top-left")).toBeVisible();

  await page.getByRole("textbox", { name: "Volume in microliters" }).fill("100");
  await activate(page.getByRole("button", { name: "Set volume" }), mode);

  const source = page.getByRole("combobox", { name: "Transfer source" });
  const target = page.getByRole("combobox", { name: "Target well or anchor" });

  const transfer = async (sourceValue: string, targetValue: string) => {
    await source.selectOption(sourceValue);
    await target.selectOption(targetValue);
    await activate(page.getByRole("button", { name: "Attach tip" }), mode);
    await activate(page.getByRole("button", { name: "Aspirate" }), mode);
    await activate(page.getByRole("button", { name: "Dispense" }), mode);
    await activate(page.getByRole("button", { name: "Eject tip" }), mode);
  };

  await transfer("source:illustrative-diluent", "A1");
  await transfer("source:illustrative-diluent", "A2");
  await transfer("source:illustrative-stock", "A1");

  await target.selectOption("A1");
  await activate(page.getByRole("button", { name: "Attach tip" }), mode);
  await activate(page.getByRole("button", { name: "Mix 3 cycles" }), mode);
  await activate(page.getByRole("button", { name: "Eject tip" }), mode);

  await source.selectOption("well:A1");
  await target.selectOption("A2");
  await activate(page.getByRole("button", { name: "Attach tip" }), mode);
  await activate(page.getByRole("button", { name: "Aspirate" }), mode);
  await activate(page.getByRole("button", { name: "Dispense" }), mode);
  await activate(page.getByRole("button", { name: "Eject tip" }), mode);
  await activate(page.getByRole("button", { name: "Attach tip" }), mode);
  await activate(page.getByRole("button", { name: "Mix 3 cycles" }), mode);
  await activate(page.getByRole("button", { name: "Eject tip" }), mode);

  await expect(source.locator('option[value="well:A2"]')).toContainText("200 uL, mixed");
  const trace = page.getByRole("table", { name: "Accepted and rejected runtime operations in attempted order" });
  await expect(trace).toBeVisible();
  expect(await trace.locator("tbody tr td:nth-child(3)").allTextContents()).not.toContain("rejected");
  return trace.locator("tbody tr td:nth-child(2)").allTextContents();
};

test("Cycle 07 pointer and keyboard dilution paths dispatch the same accepted runtime sequence", async ({
  page,
}, testInfo) => {
  test.skip(process.env.VITE_ASSAY_STUDIO_V1 !== "true", "Cycle 07 route is behind its build-time flag.");
  test.skip(testInfo.project.name !== "desktop", "Cycle 07 adds tablet/laptop-and-above QA only.");

  const pointerOperations = await executeTwoPointDilution(page, "pointer");
  const keyboardOperations = await executeTwoPointDilution(page, "keyboard");
  expect(keyboardOperations).toEqual(pointerOperations);
  expect(keyboardOperations).toEqual([
    "setVolume",
    "attachTips", "aspirate", "dispense", "ejectTips",
    "attachTips", "aspirate", "dispense", "ejectTips",
    "attachTips", "aspirate", "dispense", "ejectTips",
    "attachTips", "mix", "ejectTips",
    "attachTips", "aspirate", "dispense", "ejectTips",
    "attachTips", "mix", "ejectTips",
  ]);

  await page.getByRole("heading", { name: "96-well serial-dilution formula trace" }).scrollIntoViewIfNeeded();
  const formulaTable = page.getByRole("table", { name: "Per-column concentration and volume formula trace" });
  await expect(formulaTable).toContainText("5000 uM");
  await expect(formulaTable).toContainText("2.44140625 uM");
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await page.screenshot({ path: "test-results/cycle07-assay-dilution-keyboard-formula-trace.png" });
});
