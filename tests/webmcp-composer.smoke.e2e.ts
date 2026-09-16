import { expect, test, type Page } from "@playwright/test";

interface ToolResult {
  ok: boolean;
  code: string;
  message: string;
  data?: Record<string, unknown>;
  state: { surface: "studio" | "rehearsal"; revision: number };
}

const STUDIO_TOOLS = [
  "inspect_lab_capabilities",
  "inspect_lab_inventory",
  "replace_lab_inventory",
  "preview_lab_experiment",
  "inspect_lab_preview",
  "start_lab_rehearsal",
  "run_lab_protocol_check",
] as const;

const REHEARSAL_TOOLS = [
  "inspect_rehearsal",
  "act_current_step",
  "operate_titration",
  "record_step_evidence",
  "submit_step_calculation",
  "reset_rehearsal",
] as const;

const installWebMCPRecorder = async (page: Page) => {
  await page.addInitScript(() => {
    type CapturedTool = {
      name: string;
      execute: (input: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>;
    };
    const tools: Record<string, CapturedTool> = {};
    Object.defineProperty(window, "__labStudioWebMCPTools", {
      configurable: true,
      value: tools,
    });
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: async (tool: CapturedTool, options?: { signal?: AbortSignal }) => {
          tools[tool.name] = tool;
          options?.signal?.addEventListener("abort", () => {
            if (tools[tool.name] === tool) delete tools[tool.name];
          }, { once: true });
        },
      },
    });
  });
};

const registeredTools = (page: Page) => page.evaluate(() =>
  Object.keys((window as unknown as { __labStudioWebMCPTools: Record<string, unknown> }).__labStudioWebMCPTools).sort(),
);

const invokeTool = async (
  page: Page,
  name: string,
  input: Record<string, unknown> = {},
): Promise<ToolResult> => page.evaluate(async ({ toolName, toolInput }) => {
  const tools = (window as unknown as {
    __labStudioWebMCPTools: Record<string, {
      execute: (value: Record<string, unknown>, options: { signal: AbortSignal }) => Promise<unknown>;
    }>;
  }).__labStudioWebMCPTools;
  const tool = tools[toolName];
  if (!tool) throw new Error(`WebMCP tool ${toolName} is not registered.`);
  return tool.execute(toolInput, { signal: new AbortController().signal });
}, { toolName: name, toolInput: input }) as Promise<ToolResult>;

const inspectionData = (result: ToolResult) => result.data as {
  completed: boolean;
  currentNode: { id: string; title: string };
  recommendedNextOperation: string;
  visibleEquipment?: Array<{ id: string; label: string }>;
  color?: string;
};

const equipmentId = (
  inspection: ReturnType<typeof inspectionData>,
  labelPattern: RegExp,
): string | undefined => inspection.visibleEquipment?.find((item) => labelPattern.test(item.label))?.id;

const validActInput = (inspection: ReturnType<typeof inspectionData>) => {
  const nodeId = inspection.currentNode.id;
  const sourcePattern = nodeId.includes("place-ring-stand")
    ? /ring stand/i
    : nodeId.includes("mount-burette") || nodeId.includes("read-initial-burette")
      ? /burette/i
      : nodeId.includes("measure-acid")
        ? /unknown acid/i
        : nodeId.includes("transfer-acid")
          ? /graduated cylinder/i
          : nodeId.includes("add-indicator")
            ? /phenolphthalein/i
            : nodeId.includes("position-flask")
              ? /erlenmeyer/i
              : /.*/;
  const targetPattern = nodeId.includes("mount-burette") || nodeId.includes("position-flask")
    ? /ring stand/i
    : nodeId.includes("measure-acid")
      ? /graduated cylinder/i
      : nodeId.includes("transfer-acid") || nodeId.includes("add-indicator")
        ? /erlenmeyer/i
        : undefined;
  const sourceInstanceId = equipmentId(inspection, sourcePattern);
  const targetInstanceId = targetPattern ? equipmentId(inspection, targetPattern) : undefined;
  return {
    ...(sourceInstanceId ? { sourceInstanceId } : {}),
    ...(targetInstanceId ? { targetInstanceId } : {}),
  };
};

test("WebMCP Composer inspect-to-human-Apply challenge journey", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Cycle 06 targets tablet, laptop, and desktop; mobile QA was not requested.");
  await installWebMCPRecorder(page);
  await page.goto("/#/studio");

  await expect.poll(() => registeredTools(page)).toEqual([...STUDIO_TOOLS].sort());
  const originalDraftTitle = await page.locator(".studio-draft-title strong").textContent();

  const capabilities = await invokeTool(page, "inspect_lab_capabilities");
  expect(capabilities.ok).toBe(true);
  expect(JSON.stringify(capabilities)).not.toContain("0.0992");
  const inventory = await invokeTool(page, "inspect_lab_inventory");
  expect(inventory.ok).toBe(true);
  const profile = inventory.data as {
    revision: number;
    equipment: unknown[];
    chemicals: unknown[];
    facilities: Record<string, boolean>;
  };

  const replaced = await invokeTool(page, "replace_lab_inventory", {
    expectedRevision: profile.revision,
    equipment: profile.equipment,
    chemicals: profile.chemicals,
    facilities: profile.facilities,
  });
  expect(replaced.ok).toBe(true);
  const currentInventory = await invokeTool(page, "inspect_lab_inventory");
  const currentRevision = (currentInventory.data as { revision: number }).revision;

  const preview = await invokeTool(page, "preview_lab_experiment", {
    schemaVersion: "1",
    familyId: "acid_base_titration_v1",
    expectedInventoryRevision: currentRevision,
    objective: "Estimate the molarity of a synthetic monoprotic-acid sample.",
    title: "WebMCP Synthetic Acid Pre-Lab",
    audience: "high_school",
    experience: "novice",
    durationMinutes: 45,
    deliveryContext: "virtual_training",
    aliquotVolumeMl: 20,
    endpointEvidence: "phenolphthalein",
    sampleLabel: "Synthetic unknown acid A",
  });
  expect(preview.ok).toBe(true);
  const previewData = preview.data as { stageId: string };
  await expect(page.getByRole("heading", { name: "WebMCP Synthetic Acid Pre-Lab" })).toBeVisible();
  expect(await page.locator(".studio-draft-title strong").textContent()).toBe(originalDraftTitle);
  await expect(page.getByRole("button", { name: "Apply to Studio" })).toBeDisabled();

  const rehearsalStart = await invokeTool(page, "start_lab_rehearsal", { stageId: previewData.stageId });
  expect(rehearsalStart.ok).toBe(true);
  expect(rehearsalStart.state.surface).toBe("rehearsal");
  await expect.poll(() => registeredTools(page)).toEqual([...REHEARSAL_TOOLS].sort());
  await expect(page.getByRole("dialog", { name: /guided rehearsal/i })).toBeVisible();

  let inspected = inspectionData(await invokeTool(page, "inspect_rehearsal"));
  const wrongSource = inspected.visibleEquipment?.find(
    (item) => item.id !== validActInput(inspected).sourceInstanceId,
  )?.id;
  expect(wrongSource).toBeTruthy();
  const invalid = await invokeTool(page, "act_current_step", { sourceInstanceId: wrongSource });
  expect(invalid.ok).toBe(false);
  expect(invalid.code).toBe("REHEARSAL_ACTION_REJECTED");

  let earlyEndpointAttempted = false;
  let coarseAttempted = false;
  let dropCount = 0;
  for (let step = 0; step < 40; step += 1) {
    inspected = inspectionData(await invokeTool(page, "inspect_rehearsal"));
    if (inspected.completed) break;
    if (inspected.recommendedNextOperation === "act_current_step") {
      const result = await invokeTool(page, "act_current_step", validActInput(inspected));
      expect(result.ok).toBe(true);
    } else if (inspected.recommendedNextOperation === "record_step_evidence") {
      expect((await invokeTool(page, "record_step_evidence")).ok).toBe(true);
    } else if (inspected.recommendedNextOperation === "submit_step_calculation") {
      expect((await invokeTool(page, "submit_step_calculation")).ok).toBe(true);
    } else if (inspected.recommendedNextOperation === "operate_titration") {
      if (!earlyEndpointAttempted) {
        const early = await invokeTool(page, "operate_titration", { mode: "accept" });
        expect(early.ok).toBe(false);
        earlyEndpointAttempted = true;
      }
      if (!coarseAttempted) {
        expect((await invokeTool(page, "operate_titration", { mode: "coarse" })).ok).toBe(true);
        coarseAttempted = true;
      } else if (inspected.color === "palePink" || inspected.color === "darkPink") {
        expect((await invokeTool(page, "operate_titration", { mode: "accept" })).ok).toBe(true);
      } else {
        expect((await invokeTool(page, "operate_titration", { mode: "drop" })).ok).toBe(true);
        dropCount += 1;
      }
    } else {
      throw new Error(`Unexpected rehearsal operation: ${inspected.recommendedNextOperation}`);
    }
  }
  inspected = inspectionData(await invokeTool(page, "inspect_rehearsal"));
  expect(inspected.completed).toBe(true);
  expect(earlyEndpointAttempted).toBe(true);
  expect(coarseAttempted).toBe(true);
  expect(dropCount).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Close rehearsal" }).click();
  await expect.poll(() => registeredTools(page)).toEqual([...STUDIO_TOOLS].sort());
  const report = await invokeTool(page, "run_lab_protocol_check", { stageId: previewData.stageId });
  expect(report.ok).toBe(true);
  await expect(page.getByRole("heading", { name: "10 of 10 declared checks passed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply to Studio" })).toBeEnabled();
  expect(await page.locator(".studio-draft-title strong").textContent()).toBe(originalDraftTitle);

  await page.getByRole("button", { name: "Apply to Studio" }).click();
  await expect(page.locator(".studio-draft-title strong")).toHaveText("WebMCP Synthetic Acid Pre-Lab");
});
