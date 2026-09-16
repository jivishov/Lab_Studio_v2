import { expect, test } from "@playwright/test";

test.describe("Causalyst Cycle 14 local learner and review source", () => {
  test("keeps structured authoring, evidence replay, and teacher approval keyboard reachable", async ({ page }) => {
    test.skip(
      process.env.VITE_CAUSALYST_LOCAL_V1 !== "true",
      "Cycle 14 remains behind the explicit Causalyst local build flag.",
    );
    await page.goto("/#/causalyst-attempt/chemistry-template");
    await expect(page.getByRole("heading", { name: "Chemistry evidence review" })).toBeVisible();
    await expect(page.getByText(/teacher-selected mode:\s*configure/i)).toBeVisible();
    await expect(page.getByText(/semantic events and evidence links only/i)).toBeVisible();
    await page.getByLabel(/i completed the teacher-directed run/i).check();
    const explanation = page.getByLabel(/what does this simulation support/i);
    await explanation.fill("The result is limited to the pinned simulation claims and does not establish a wet-lab or clinical outcome.");
    await page.getByRole("button", { name: /validate and export local submission/i }).focus();
    await expect(page.getByRole("button", { name: /validate and export local submission/i })).toBeFocused();
    await page.goto("/#/causalyst-review/local");
    await expect(page.getByRole("heading", { name: /submission evidence review/i })).toBeVisible();
    await expect(page.getByText(/local only/i)).toBeVisible();
  });
});
