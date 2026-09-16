import { expect, type Locator, type Page, test } from "@playwright/test";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const equipmentButton = (page: Page, label: string, content: string): Locator =>
  page.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(label)}, ${escapeRegExp(content)}$`, "i"),
  });

const equipmentCategoryByLabel: Record<string, string> = {
  "250 mL beaker": "Container",
  "250 mL Erlenmeyer flask": "Container",
  "Receiving flask": "Container",
  "Analytical balance": "Measurement",
  "Bunsen burner": "Heating",
  "Capillary spotter": "Tools",
  "Blank cuvette": "Measurement",
  "Blue dye stock": "Sample",
  "Carbonate mixture": "Sample",
  "Chromatography chamber": "Chromatography",
  "Chromatography paper": "Chromatography",
  "Clay triangle": "Heating",
  "Crucible tongs": "Tools",
  "Crucible with lid": "Container",
  "Drying oven": "Heating",
  "Empty crucible with lid": "Container",
  "Filter paper": "Filtration",
  "Food dye sample": "Sample",
  "Funnel and stand": "Filtration",
  "Glass funnel": "Filtration",
  "Graduated cylinder": "Measurement",
  "Metric ruler": "Measurement",
  "Pencil": "Tools",
  "Reagent bottle": "Reagent",
  "Ring stand": "Filtration",
  "Rubber stopper": "Tools",
  "Sample bottle": "Sample",
  "Sample cuvette": "Measurement",
  "Solvent bottle": "Reagent",
  "Spectrophotometer": "Measurement",
  "Volumetric flask": "Container",
  "Wash bottle": "Reagent",
  "Watch glass": "Container",
};

const expandEquipmentCategory = async (page: Page, label: string) => {
  if ((await equipmentButton(page, label, "available").count()) > 0) return;
  const category = equipmentCategoryByLabel[label];
  if (!category) return;
  const toggle = page
    .getByLabel("Equipment shelf")
    .getByRole("button", { name: new RegExp(`^${escapeRegExp(category)}\\s+\\d+`, "i") });
  if ((await toggle.count()) === 0) return;
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
};

const expectNoCentralActionButtons = async (page: Page) => {
  await expect(page.getByRole("button", { name: "Perform step" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run selected action" })).toHaveCount(0);
};

const currentStepButton = (page: Page): Locator =>
  page.getByLabel("Process and current step").locator(".step-control button").first();

const clickCurrentStepButton = async (page: Page) => {
  await currentStepButton(page).click();
};

const completeCurrentSteps = async (page: Page, count: number) => {
  for (let index = 0; index < count; index += 1) {
    await clickCurrentStepButton(page);
  }
};

test("main navigation points to product-level catalogs", async ({ page }) => {
  await page.goto("/#/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });

  await expect(nav.getByRole("link", { name: "Lab Studio", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("link", { name: "Studio", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Labs", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Techniques", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Titration", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Player", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Examples", exact: true })).toHaveCount(0);

  await nav.getByRole("link", { name: "Labs", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Labs", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Labs", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: /Hard-Water Reference Demo/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acid-Base Titration/i })).toBeVisible();

  await nav.getByRole("link", { name: "Techniques", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Techniques", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Techniques", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: /Weigh a Solid/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Filter a Precipitate/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Analyze Transmittance of a Dilution/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Heat and Reweigh a Carbonate Mixture/i })).toBeVisible();

  await page.goto("/#/play/hard-water-demo");
  await expect(nav.getByRole("link", { name: "Labs", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.goto("/#/technique/filtration");
  await expect(nav.getByRole("link", { name: "Techniques", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

const placeEquipment = async (page: Page, label: string, placedContent: string, placedLabel = label) => {
  await expandEquipmentCategory(page, label);
  await equipmentButton(page, label, "available").click();
  await expect(equipmentButton(page, placedLabel, placedContent)).toBeVisible();
};

const dragEquipment = async (page: Page, source: Locator, target: Locator) => {
  await target.scrollIntoViewIfNeeded();
  await source.evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "nearest" });
  });
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Unable to locate bench equipment for drag.");

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
};

type ScreenPoint = { x: number; y: number };

const installMockCameraGestureControl = async (
  page: Page,
  viewport: { width: number; height: number } = { width: 1180, height: 720 },
) => {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    const cameraWorkerHarness: {
      constructorOptions: unknown[];
      messages: Array<Record<string, unknown>>;
      worker?: {
        onmessage: ((event: MessageEvent) => void) | null;
      };
    } = {
      constructorOptions: [],
      messages: [],
    };
    const horizontalGestureEdgeMargin = 0.08;
    const verticalGestureEdgeMargin = 0.06;
    let emittedFrameId = 0;
    const rawAxisForClient = (clientPosition: number, viewportSize: number, margin: number) =>
      margin + (clientPosition / Math.max(1, viewportSize)) * (1 - margin * 2);
    const landmarksForClientPoint = (clientX: number, clientY: number, pinching: boolean) => {
      const rawMirroredX = rawAxisForClient(clientX, window.innerWidth, horizontalGestureEdgeMargin);
      const rawY = rawAxisForClient(clientY, window.innerHeight, verticalGestureEdgeMargin);
      const pointerX = 1 - rawMirroredX;
      const gap = pinching ? 0.025 : 0.09;
      const landmarks = Array.from({ length: 21 }, () => ({ x: pointerX, y: rawY + 0.12, z: 0 }));
      landmarks[0] = { x: pointerX, y: rawY + 0.2, z: 0 };
      landmarks[5] = { x: pointerX - 0.08, y: rawY + 0.04, z: 0 };
      landmarks[9] = { x: pointerX - 0.025, y: rawY + 0.04, z: 0 };
      landmarks[13] = { x: pointerX + 0.03, y: rawY + 0.04, z: 0 };
      landmarks[17] = { x: pointerX + 0.085, y: rawY + 0.04, z: 0 };
      landmarks[4] = { x: pointerX - gap, y: rawY, z: 0 };
      landmarks[8] = { x: pointerX, y: rawY, z: 0 };
      return landmarks;
    };
    const fourFingerLandmarksForClientPoint = (clientX: number, clientY: number) => {
      const rawMirroredX = rawAxisForClient(clientX, window.innerWidth, horizontalGestureEdgeMargin);
      const rawY = rawAxisForClient(clientY, window.innerHeight, verticalGestureEdgeMargin);
      const pointerX = 1 - rawMirroredX;
      const landmarks = Array.from({ length: 21 }, () => ({
        x: pointerX,
        y: rawY + 0.2,
        z: 0,
      }));
      const fingers = [
        { mcp: 5, pip: 6, tip: 8, x: pointerX - 0.06 },
        { mcp: 9, pip: 10, tip: 12, x: pointerX - 0.02 },
        { mcp: 13, pip: 14, tip: 16, x: pointerX + 0.02 },
        { mcp: 17, pip: 18, tip: 20, x: pointerX + 0.06 },
      ];
      landmarks[0] = { x: pointerX, y: rawY + 0.28, z: 0 };
      landmarks[4] = { x: pointerX - 0.14, y: rawY + 0.08, z: 0 };
      for (const finger of fingers) {
        landmarks[finger.mcp] = { x: finger.x, y: rawY + 0.12, z: 0 };
        landmarks[finger.pip] = { x: finger.x, y: rawY + 0.06, z: 0 };
        landmarks[finger.tip] = { x: finger.x, y: rawY, z: 0 };
      }
      return landmarks;
    };
    Object.defineProperty(window, "__cameraWorkerHarness", {
      configurable: true,
      value: cameraWorkerHarness,
    });
    Object.defineProperty(window, "__sendCameraGestureFrame", {
      configurable: true,
      value: (
        clientX: number,
        clientY: number,
        pinching: boolean,
        gestureKind: "pinch" | "fourFinger" = "pinch",
      ) => {
        const now = performance.now();
        emittedFrameId += 1;
        cameraWorkerHarness.worker?.onmessage?.({
          data: {
            bitmapReadyAtMs: now,
            delegate: "GPU",
            engine: "mediapipe-hand-landmarker",
            frameId: emittedFrameId,
            frameTimeMs: now,
            gestureScore: 0.9,
            handednessName: "Right",
            handednessScore: 0.9,
            inferenceMs: 6,
            landmarks: [
              gestureKind === "fourFinger"
                ? fourFingerLandmarksForClientPoint(clientX, clientY)
                : landmarksForClientPoint(clientX, clientY, pinching),
            ],
            sampleStartedAtMs: now,
            sourceHeight: 480,
            sourceWidth: 640,
            type: "frame",
          },
        } as MessageEvent);
      },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => new MediaStream(),
      },
    });
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      constructor(_url: URL | string, options?: WorkerOptions) {
        cameraWorkerHarness.constructorOptions.push(options ?? null);
        cameraWorkerHarness.worker = this;
      }
      postMessage(message: { type?: string } & Record<string, unknown>) {
        cameraWorkerHarness.messages.push(message);
        if (message.type === "init") {
          window.setTimeout(() => {
            this.onmessage?.({
              data: {
                status: "ready",
                type: "status",
              },
            } as MessageEvent);
          }, 0);
        }
      }
      terminate() {}
    }
    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: FakeWorker,
    });
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: async () => ({ close() {} }),
    });
  });
};

const sendGestureFrame = async (page: Page, point: ScreenPoint, pinching: boolean) => {
  await page.evaluate(
    ({ pinching: framePinching, x, y }) =>
      (
        window as Window & {
          __sendCameraGestureFrame?: (
            clientX: number,
            clientY: number,
            pinching: boolean,
            gestureKind?: "pinch" | "fourFinger",
          ) => void;
        }
      ).__sendCameraGestureFrame?.(x, y, framePinching),
    {
      pinching,
      x: point.x,
      y: point.y,
    },
  );
};

const sendFourFingerScrollFrame = async (page: Page, point: ScreenPoint) => {
  await page.evaluate(
    ({ x, y }) =>
      (
        window as Window & {
          __sendCameraGestureFrame?: (
            clientX: number,
            clientY: number,
            pinching: boolean,
            gestureKind?: "pinch" | "fourFinger",
          ) => void;
        }
      ).__sendCameraGestureFrame?.(x, y, false, "fourFinger"),
    point,
  );
};

const waveFourFingerScroll = async (
  page: Page,
  point: ScreenPoint,
  delta: Pick<ScreenPoint, "x" | "y">,
  frames = 8,
) => {
  for (let index = 0; index < frames; index += 1) {
    const progress = frames <= 1 ? 1 : index / (frames - 1);
    await sendFourFingerScrollFrame(page, {
      x: point.x + delta.x * progress,
      y: point.y + delta.y * progress,
    });
    await page.waitForTimeout(40);
  }
};

const holdGestureFrame = async (
  page: Page,
  point: ScreenPoint,
  pinching: boolean,
  frames = 10,
) => {
  for (let index = 0; index < frames; index += 1) {
    await sendGestureFrame(page, point, pinching);
    await page.waitForTimeout(40);
  }
};

const locatorCenter = async (locator: Locator): Promise<ScreenPoint> => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Unable to measure gesture target.");
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
};

const locatorHitPoint = async (locator: Locator): Promise<ScreenPoint> => {
  await locator.scrollIntoViewIfNeeded();
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const container = element.closest(".bench-item[data-instance-id], .equipment-view[data-definition-id], button[data-gesture-action]");
    const fractions = [0.5, 0.3, 0.7, 0.15, 0.85];
    for (const yFraction of fractions) {
      for (const xFraction of fractions) {
        const x = rect.left + rect.width * xFraction;
        const y = rect.top + rect.height * yFraction;
        const hit = document.elementFromPoint(x, y);
        if (hit && (element === hit || element.contains(hit) || (container && container.contains(hit)))) {
          return { x, y };
        }
      }
    }
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
};

const benchPoint = async (
  page: Page,
  xRatio = 0.44,
  yRatio = 0.46,
): Promise<ScreenPoint> => {
  const box = await page.locator(".bench-surface").boundingBox();
  if (!box) throw new Error("Unable to measure workbench surface.");
  return {
    x: box.x + box.width * xRatio,
    y: box.y + box.height * yRatio,
  };
};

const emptyEdgePoint = async (
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  edge: "bottom" | "right",
): Promise<ScreenPoint> =>
  page.evaluate(({ box: region, edge: requestedEdge }) => {
    const eligibleSelector =
      ".equipment-shelf .equipment-view[data-definition-id], .bench-item[data-instance-id], button[data-gesture-action]";
    const fractions = [0.04, 0.96, 0.5, 0.2, 0.8];
    for (const fraction of fractions) {
      const x = Math.min(
        window.innerWidth - 4,
        requestedEdge === "right" ? region.x + region.width - 4 : region.x + region.width * fraction,
      );
      const y = Math.min(
        window.innerHeight - 4,
        requestedEdge === "bottom" ? region.y + region.height - 4 : region.y + region.height * fraction,
      );
      if (!document.elementFromPoint(x, y)?.closest(eligibleSelector)) return { x, y };
    }
    return requestedEdge === "bottom"
      ? { x: region.x + 4, y: region.y + region.height - 4 }
      : { x: region.x + region.width - 4, y: region.y + 4 };
  }, { box, edge });

const startMockedCameraControl = async (page: Page) => {
  const cameraControl = page.getByRole("button", { name: "Camera control", exact: true });
  await expect(cameraControl).toBeEnabled();
  await cameraControl.click();
  await expect(page.getByLabel("Camera gesture control status")).toContainText("Ready");
};

const gestureDragToPoint = async (
  page: Page,
  source: Locator,
  targetPoint: ScreenPoint,
  frames = 14,
) => {
  const sourcePoint = await locatorHitPoint(source);
  await holdGestureFrame(page, sourcePoint, false, 8);
  await sendGestureFrame(page, sourcePoint, true);
  const hitDescription = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return element
      ? `${element.tagName}.${element.className} instance=${element.closest("[data-instance-id]")?.getAttribute("data-instance-id") ?? "none"}`
      : "none";
  }, sourcePoint);
  await expect(
    page.locator('[data-gesture-drag-preview="true"]'),
    `Gesture source hit target: ${hitDescription}`,
  ).toBeVisible();
  await holdGestureFrame(page, targetPoint, true, frames);
  await sendGestureFrame(page, targetPoint, false);
  await expect(page.locator('[data-gesture-drag-preview="true"]')).toHaveCount(0);
};

const gestureDragToLocator = async (
  page: Page,
  source: Locator,
  target: Locator,
  frames = 14,
) => {
  await gestureDragToPoint(page, source, await locatorCenter(target), frames);
};

const gesturePlaceFromShelf = async (
  page: Page,
  definitionLabel: string,
  placedLabel: string,
  placedContent: string,
  xRatio = 0.44,
  yRatio = 0.46,
) => {
  await expandEquipmentCategory(page, definitionLabel);
  const shelfItem = equipmentButton(page, definitionLabel, "available");
  await shelfItem.scrollIntoViewIfNeeded();
  await gestureDragToPoint(page, shelfItem, await benchPoint(page, xRatio, yRatio));
  await expect(equipmentButton(page, placedLabel, placedContent)).toBeVisible();
};

const gesturePlaceInstanceFromShelf = async (
  page: Page,
  categoryLabel: string,
  shelfLabel: string,
  placedLabel: string,
  placedContent: string,
  xRatio = 0.44,
  yRatio = 0.46,
) => {
  await expandEquipmentCategory(page, categoryLabel);
  const shelfItem = equipmentButton(page, shelfLabel, "available");
  await shelfItem.scrollIntoViewIfNeeded();
  await gestureDragToPoint(page, shelfItem, await benchPoint(page, xRatio, yRatio));
  await expect(equipmentButton(page, placedLabel, placedContent)).toBeVisible();
};

const placeInstanceEquipment = async (
  page: Page,
  categoryLabel: string,
  shelfLabel: string,
  placedContent: string,
  placedLabel = shelfLabel,
) => {
  await expandEquipmentCategory(page, categoryLabel);
  await equipmentButton(page, shelfLabel, "available").click();
  await expect(equipmentButton(page, placedLabel, placedContent)).toBeVisible();
};

const gestureActivate = async (page: Page, target: Locator) => {
  const targetPoint = await locatorHitPoint(target);
  await holdGestureFrame(page, targetPoint, false, 8);
  await sendGestureFrame(page, targetPoint, true);
  await expect(page.getByLabel("Camera gesture control status")).toContainText("Pinch held");
  await sendGestureFrame(page, targetPoint, false);
};

test("studio can add a filtration node and persist a draft", async ({ page }, testInfo) => {
  await page.goto("/#/studio");
  await expect(page.getByRole("heading", { name: "Lab Design Studio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Live preview" })).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Live preview" }).click();
    await expect(page.getByRole("heading", { name: "Live preview" })).toBeVisible();
    await page.getByRole("button", { name: "Studio", exact: true }).click();
  } else {
    await expect(page.getByRole("heading", { name: "Live preview" })).toBeVisible();
    await expect(page.getByText("Step: Measure sample")).toBeVisible();
    await expect(
      page.getByText(/Pour water sample from the sample bottle into the graduated cylinder until the meniscus reaches 20 mL/i).first(),
    ).toBeVisible();
    await placeEquipment(page, "Sample bottle", "120 mL hard water sample");
    await placeEquipment(page, "Graduated cylinder", "empty");
    await dragEquipment(
      page,
      equipmentButton(page, "Sample bottle", "120 mL hard water sample"),
      equipmentButton(page, "Graduated cylinder", "empty"),
    );
    await expect(page.getByText("Step: Transfer sample")).toBeVisible();
    await expect(
      page.getByText(/Pour 20 mL of sample from the graduated cylinder into the 250 mL beaker/i).first(),
    ).toBeVisible();
    await placeEquipment(page, "250 mL beaker", "empty");
    await dragEquipment(
      page,
      equipmentButton(page, "Graduated cylinder", "20 mL hard water sample"),
      equipmentButton(page, "250 mL beaker", "empty"),
    );
    await expect(page.getByText("Step: Precipitate calcium carbonate")).toBeVisible();
    await page.locator('[data-testid="rf__node-demo-measure-node"]').dispatchEvent("click");
    await expect(page.getByText("Step: Measure sample")).toBeVisible();
    await expect(equipmentButton(page, "Sample bottle", "100 mL hard water sample")).toBeVisible();
    await expect(equipmentButton(page, "Graduated cylinder", "empty")).toBeVisible();
    await expect(equipmentButton(page, "250 mL beaker", "20 mL hard water sample")).toBeVisible();
    await expect(currentStepButton(page)).toBeDisabled();
    await page.locator('[data-testid="rf__node-demo-precipitate-node"]').dispatchEvent("click");
    await expect(page.getByText("Step: Precipitate calcium carbonate")).toBeVisible();
    await expect(equipmentButton(page, "250 mL beaker", "20 mL hard water sample")).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByText("Step: Precipitate calcium carbonate")).toBeVisible();
    await expect(page.getByText(/0 placed/i)).toBeVisible();
    await expect(page.getByText(/Preview uses current bench state/i)).toBeVisible();
    await expect(page.locator(".equipment-shelf-row")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workbench" })).toBeVisible();

    const alignedControls = [
      page.locator(".studio-view-toggle"),
      page.getByRole("button", { name: "Save draft" }),
      page.getByRole("button", { name: "Export" }),
      page.locator(".file-button").filter({ hasText: "Import" }),
    ];
    const boxes = await Promise.all(alignedControls.map((locator) => locator.boundingBox()));
    if (boxes.some((box) => !box)) throw new Error("Unable to measure Studio header controls.");
    const bottoms = boxes.map((box) => (box?.y ?? 0) + (box?.height ?? 0));
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(3);

    const workbenchBox = await page.getByRole("heading", { name: "Workbench" }).boundingBox();
    const viewport = page.viewportSize();
    if (!workbenchBox || !viewport) throw new Error("Unable to measure workbench visibility.");
    expect(workbenchBox.y).toBeLessThan(viewport.height);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollHeight <= window.innerHeight + 2 &&
            document.body.scrollHeight <= window.innerHeight + 2,
        ),
      )
      .toBe(true);
  }
  await page.getByLabel("Add template").selectOption("template-filtration");
  await expect(page.getByText("10 nodes")).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("lab-studio:v1:draft")))
    .toContain("teacher-draft");
});

test("studio assistant applies a mocked template edit", async ({ page }) => {
  await page.route("http://127.0.0.1:8787/api/assistant/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        configured: true,
        models: ["gpt-5.4-mini", "gpt-5.5", "gpt-5.5-pro"],
      }),
    });
  });
  let assistantTurn = 0;
  await page.route("http://127.0.0.1:8787/api/assistant/responses", async (route) => {
    assistantTurn += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        assistantTurn === 1
          ? {
              responseId: "mock-response-1",
              status: "completed",
              outputText: "",
              toolCalls: [
                {
                  callId: "mock-call-1",
                  name: "add_template_node",
                  arguments: { templateId: "template-filtration" },
                },
              ],
            }
          : {
              responseId: "mock-response-2",
              status: "completed",
              outputText: "Added the filtration template.",
              toolCalls: [],
            },
      ),
    });
  });

  await page.goto("/#/studio");
  await page.getByRole("button", { name: "Assistant" }).click();
  await expect(page.getByRole("heading", { name: "Workflow builder" })).toBeVisible();
  await page.getByPlaceholder(/ask for a filtration workflow/i).fill("Add a filtration step");
  await page.getByRole("button", { name: "Send assistant message" }).click();
  await expect(page.getByText("Added the filtration template.")).toBeVisible();
  await expect(page.getByText("10 nodes")).toBeVisible();
});

test("hard-water public lab route completes through evidence and calculation controls", async ({ page }) => {
  await page.goto("/#/play/hard-water-demo");
  await expect(page.getByRole("heading", { name: "Hard-Water Reference Demo" })).toBeVisible();
  await expectNoCentralActionButtons(page);
  await expect(page.getByText("Measure sample").first()).toBeVisible();
  await clickCurrentStepButton(page);
  await expect(page.getByText("The graduated cylinder contains 20 mL of sample.").last()).toBeVisible();
  await page.getByRole("button", { name: "Record sample volume" }).click();
  await expect(page.getByText("Transfer sample").first()).toBeVisible();
  for (let index = 0; index < 10; index += 1) {
    await clickCurrentStepButton(page);
  }
  await page.getByRole("button", { name: "Record dry mass" }).click();
  await page.getByRole("button", { name: "Submit hardness calculation" }).click();
  await expect(page.getByText("375.00 mg/L as CaCO3")).toBeVisible();
  await expect(page.getByText("Progress: 14 completed / 14 total")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm accessible action" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submit hardness calculation" })).toHaveCount(0);
  await expectNoCentralActionButtons(page);
});

test("acid-base titration public lab completes through keyboard fallback", async ({ page }) => {
  await page.goto("/#/play/acid-base-titration");
  await expect(page.getByRole("heading", { name: "Acid-Base Titration" })).toBeVisible();
  await expectNoCentralActionButtons(page);
  await expect(page.getByText("Measure acid aliquot").first()).toBeVisible();

  for (let index = 0; index < 4; index += 1) {
    await clickCurrentStepButton(page);
  }
  await page.getByRole("button", { name: "Record initial burette reading" }).click();
  const dispenseDrop = page
    .getByLabel("Process and current step")
    .getByRole("button", { name: "Dispense one drop", exact: true });
  await expect(page.getByText(/0 \/ 496 drops/i)).toBeVisible();
  await dispenseDrop.evaluate((button) => {
    for (let index = 0; index < 496; index += 1) {
      (button as HTMLButtonElement).click();
    }
  });
  await expect(page.getByText(/496 \/ 496 drops/i)).toBeVisible();
  await expect(page.getByText(/burette 25\.00 mL/i)).toBeVisible();
  await page.getByRole("button", { name: "Accept endpoint" }).click();
  await clickCurrentStepButton(page);
  await page.getByRole("button", { name: "Record final burette reading" }).click();
  await page.getByRole("button", { name: "Submit acid molarity calculation" }).click();
  await expect(page.getByText("0.0992 M").first()).toBeVisible();
  await expect(page.getByText("Progress: 9 completed / 9 total")).toBeVisible();
  await expectNoCentralActionButtons(page);
});

test("marble statue kinetics public lab completes through keyboard fallback", async ({ page }) => {
  await page.goto("/#/play/marble-statue-kinetics");
  await expect(page.getByRole("heading", { name: "How Long Will That Marble Statue Last?" })).toBeVisible();
  await expectNoCentralActionButtons(page);

  for (let index = 0; index < 12; index += 1) {
    await clickCurrentStepButton(page);
  }
  await page.getByRole("button", { name: /Submit initial rate for 2\.0 m hcl calculation/i }).click();
  await page.getByRole("button", { name: /Submit initial rate for 4\.0 m hcl calculation/i }).click();
  await page.getByRole("button", { name: /Submit initial rate for 6\.0 m hcl calculation/i }).click();
  await clickCurrentStepButton(page);
  await clickCurrentStepButton(page);

  await expect(page.getByText("3.253 mL/s", { exact: true })).toBeVisible();
  await expect(page.getByText("Progress: 17 completed / 17 total")).toBeVisible();
  await expectNoCentralActionButtons(page);
});

test("hard-water physical workflow completes through direct bench manipulation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop pointer coverage complements the mobile keyboard fallback smoke flow.");

  await page.goto("/#/play/hard-water-demo");
  await expect(page.getByRole("heading", { name: "Hard-Water Reference Demo" })).toBeVisible();
  await expectNoCentralActionButtons(page);

  await placeEquipment(page, "Sample bottle", "120 mL hard water sample");
  await placeEquipment(page, "Graduated cylinder", "empty");
  await placeEquipment(page, "Reagent bottle", "20 mL carbonate reagent");
  await placeEquipment(page, "250 mL beaker", "empty");
  await placeEquipment(page, "Filter paper", "empty");
  await placeEquipment(page, "Ring stand", "empty");
  await placeEquipment(page, "Glass funnel", "empty");
  await placeEquipment(page, "250 mL Erlenmeyer flask", "empty");
  await placeEquipment(page, "Wash bottle", "500 mL deionized water");
  await placeEquipment(page, "Watch glass", "empty");
  await placeEquipment(page, "Drying oven", "empty");
  await placeEquipment(page, "Analytical balance", "empty");

  await dragEquipment(
    page,
    equipmentButton(page, "Sample bottle", "120 mL hard water sample"),
    equipmentButton(page, "Graduated cylinder", "empty"),
  );
  await expect(page.getByText("The graduated cylinder contains 20 mL of sample.").last()).toBeVisible();
  await page.getByRole("button", { name: "Record sample volume" }).click();

  await dragEquipment(
    page,
    equipmentButton(page, "Graduated cylinder", "20 mL hard water sample"),
    equipmentButton(page, "250 mL beaker", "empty"),
  );
  await expect(page.getByText("The 20 mL sample is transferred to the beaker.").last()).toBeVisible();

  await dragEquipment(
    page,
    equipmentButton(page, "Reagent bottle", "20 mL carbonate reagent"),
    equipmentButton(page, "250 mL beaker", "20 mL hard water sample"),
  );
  await expect(page.getByText("Calcium carbonate precipitate is represented structurally.").last()).toBeVisible();

  await dragEquipment(
    page,
    equipmentButton(page, "Glass funnel", "empty"),
    equipmentButton(page, "Ring stand", "empty"),
  );
  await expect(page.getByText("The funnel is seated in the circular support ring.").last()).toBeVisible();

  await dragEquipment(
    page,
    equipmentButton(page, "Filter paper", "empty"),
    equipmentButton(page, "Funnel and stand", "empty"),
  );
  await expect(page.getByText("Filter paper is seated in the funnel.").last()).toBeVisible();

  await dragEquipment(
    page,
    equipmentButton(page, "Wash bottle", "500 mL deionized water"),
    equipmentButton(page, "Funnel and stand", "empty"),
  );
  await expect(page.getByText("Filter paper is wetted and sealed.").last()).toBeVisible();

  await dragEquipment(
    page,
    equipmentButton(page, "250 mL Erlenmeyer flask", "empty"),
    equipmentButton(page, "Funnel and stand", "empty"),
  );
  await expect(page.getByText("Receiving flask is under the funnel.").last()).toBeVisible();

  await dragEquipment(
    page,
    equipmentButton(page, "250 mL beaker", "40 mL calcium carbonate precipitate mixture"),
    equipmentButton(page, "Funnel and stand", "empty"),
  );
  await expect(page.getByText("Precipitate remains on the filter paper.").last()).toBeVisible();

  await dragEquipment(
    page,
    equipmentButton(page, "Wash bottle", "495 mL deionized water"),
    equipmentButton(page, "Funnel and stand", "empty"),
  );
  await expect(page.getByText("Precipitate rinse evidence recorded.").last()).toBeVisible();

  await dragEquipment(
    page,
    equipmentButton(page, "Watch glass", "empty"),
    equipmentButton(page, "Drying oven", "empty"),
  );
  await expect(page.getByText("The precipitate is dry enough to weigh.").last()).toBeVisible();

  await clickCurrentStepButton(page);
  await expect(page.getByText("Dry precipitate mass recorded.").last()).toBeVisible();
  await page.getByRole("button", { name: "Record dry mass" }).click();
  await page.getByRole("button", { name: "Submit hardness calculation" }).click();

  await expect(page.getByText("375.00 mg/L as CaCO3")).toBeVisible();
  await expect(page.getByText("Progress: 14 completed / 14 total")).toBeVisible();
  await expectNoCentralActionButtons(page);
});

test("filtration technique supports pointer placement and keyboard action controls", async ({ page }) => {
  await page.goto("/#/technique/filtration");
  await expect(page.getByRole("heading", { name: "Filter a Precipitate" })).toBeVisible();
  await expandEquipmentCategory(page, "Filter paper");
  await page.getByRole("button", { name: /Filter paper, available/i }).click();
  await expect(page.getByText("1 placed")).toBeVisible();
  await expect(currentStepButton(page)).toBeVisible();
});

test("filtration technique can start mocked camera gesture control", async ({ page }) => {
  await installMockCameraGestureControl(page);

  await page.goto("/#/technique/filtration");
  const cameraControl = page.getByRole("button", { name: "Camera control", exact: true });
  await expect(cameraControl).toBeEnabled();
  await expect(page.getByRole("button", { name: "Camera control help", exact: true })).toBeVisible();
  await cameraControl.click();
  await expect(page.getByLabel("Camera gesture control status")).toContainText("Ready");
  await expect(page.getByLabel("Camera gesture control status")).toContainText("Show one hand");
  const speedSlider = page.getByRole("slider", { name: "Cursor response" });
  await expect(speedSlider).toHaveValue("3");
  await expect(speedSlider).toHaveAttribute("aria-valuetext", "Balanced");
  await speedSlider.fill("2");
  await expect(speedSlider).toHaveValue("2");
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("lab-studio:v1:camera-cursor-speed")))
    .toBe("2");
  const workerHarness = await page.evaluate(() => {
    const harness = (
      window as Window & {
        __cameraWorkerHarness?: {
          constructorOptions: unknown[];
          messages: Array<Record<string, unknown>>;
        };
      }
    ).__cameraWorkerHarness;
    return {
      constructorOptions: harness?.constructorOptions ?? [],
      messages: harness?.messages ?? [],
    };
  });
  expect(workerHarness.constructorOptions).toEqual([{ type: "module" }]);
  const initMessage = workerHarness.messages.find((message) => message.type === "init");
  expect(initMessage).toEqual(
    expect.objectContaining({
      gestureRecognizerModelUrl: expect.stringContaining("/mediapipe/models/gesture_recognizer.task"),
      handLandmarkerModelUrl: expect.stringContaining("/mediapipe/models/hand_landmarker.task"),
      type: "init",
    }),
  );
  expect(initMessage?.wasmBaseUrl).toBeUndefined();
  await expandEquipmentCategory(page, "Ring stand");
  const ringStand = page.getByRole("button", { name: /Ring stand, available/i });
  await expect(ringStand).toBeVisible();
  const ringStandBox = await ringStand.boundingBox();
  const benchBox = await page.locator(".bench-surface").boundingBox();
  if (!ringStandBox || !benchBox) {
    throw new Error("Unable to measure camera gesture placement targets.");
  }

  const ringStandPoint = {
    x: ringStandBox.x + ringStandBox.width / 2,
    y: ringStandBox.y + ringStandBox.height / 2,
  };
  const benchDropPoint = {
    x: benchBox.x + Math.min(benchBox.width * 0.45, 360),
    y: benchBox.y + Math.min(benchBox.height * 0.45, 260),
  };

  await sendGestureFrame(page, ringStandPoint, true);
  await expect(page.getByLabel("Camera gesture control status")).toContainText("Pinch held");
  const gestureCursor = page.locator(".gesture-cursor");
  await expect(gestureCursor).toHaveClass(/is-pinching/);
  await expect(gestureCursor).toHaveCSS("position", "fixed");
  await expect(gestureCursor).toHaveCSS("pointer-events", "none");
  await expect(gestureCursor).toHaveCSS("z-index", "300");
  const pinchedCursorBox = await gestureCursor.boundingBox();
  if (!pinchedCursorBox) {
    throw new Error("Unable to measure camera gesture cursor after pinch.");
  }
  expect(pinchedCursorBox.x + pinchedCursorBox.width / 2).toBeCloseTo(
    ringStandBox.x + ringStandBox.width / 2,
    0,
  );
  expect(pinchedCursorBox.y + pinchedCursorBox.height / 2).toBeCloseTo(
    ringStandBox.y + ringStandBox.height / 2,
    0,
  );
  const dragPreview = page.locator('[data-gesture-drag-preview="true"]');
  await expect(dragPreview).toBeVisible();
  const initialPreviewBox = await dragPreview.boundingBox();
  if (!initialPreviewBox) {
    throw new Error("Unable to measure camera gesture drag preview after pinch.");
  }

  await holdGestureFrame(page, benchDropPoint, true, 14);
  const movedPreviewBox = await dragPreview.boundingBox();
  if (!movedPreviewBox) {
    throw new Error("Unable to measure camera gesture drag preview after movement.");
  }
  expect(Math.abs(movedPreviewBox.x + movedPreviewBox.width / 2 - benchDropPoint.x)).toBeLessThan(36);
  expect(Math.abs(movedPreviewBox.y + movedPreviewBox.height / 2 - benchDropPoint.y)).toBeLessThan(36);
  expect(
    Math.hypot(movedPreviewBox.x - initialPreviewBox.x, movedPreviewBox.y - initialPreviewBox.y),
  ).toBeGreaterThan(40);
  await sendGestureFrame(page, benchDropPoint, false);
  await expect(page.getByLabel("Camera gesture control status")).toContainText("Camera cursor ready");
  await expect(gestureCursor).not.toHaveClass(/is-pinching/);
  await expect(dragPreview).toHaveCount(0);
  const releasedCursorBox = await gestureCursor.boundingBox();
  if (!releasedCursorBox) {
    throw new Error("Unable to measure camera gesture cursor after release.");
  }
  const releasedCursorCenter = {
    x: releasedCursorBox.x + releasedCursorBox.width / 2,
    y: releasedCursorBox.y + releasedCursorBox.height / 2,
  };
  expect(releasedCursorCenter.x).toBeGreaterThanOrEqual(benchBox.x);
  expect(releasedCursorCenter.x).toBeLessThanOrEqual(benchBox.x + benchBox.width);
  expect(releasedCursorCenter.y).toBeGreaterThanOrEqual(benchBox.y);
  expect(releasedCursorCenter.y).toBeLessThanOrEqual(benchBox.y + benchBox.height);
  await expect(page.getByRole("button", { name: /Ring stand, empty/i })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Unable to measure viewport for camera gesture scrolling.");
  const documentEdgePoint = await page.evaluate(() => {
    const y = window.innerHeight - 4;
    const eligibleSelector =
      ".equipment-shelf .equipment-view[data-definition-id], .bench-item[data-instance-id], button[data-gesture-action]";
    for (const fraction of [0.5, 0.92, 0.08, 0.75, 0.25]) {
      const x = window.innerWidth * fraction;
      if (!document.elementFromPoint(x, y)?.closest(eligibleSelector)) return { x, y };
    }
    return { x: window.innerWidth / 2, y };
  });
  await holdGestureFrame(page, documentEdgePoint, false, 16);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.evaluate(() => window.scrollTo(0, 0));
  const shelfScroll = page.locator(".equipment-shelf-scroll");
  let shelfBox = await shelfScroll.boundingBox();
  if (!shelfBox) throw new Error("Unable to measure equipment shelf scroll region.");
  await shelfScroll.evaluate((element) => {
    element.scrollTop = 0;
  });
  await waveFourFingerScroll(
    page,
    {
      x: shelfBox.x + shelfBox.width / 2,
      y: Math.min(shelfBox.y + shelfBox.height / 2, viewport.height - 120),
    },
    {
      x: 0,
      y: 72,
    },
  );
  await expect.poll(() => shelfScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const workbench = page.locator(".workbench");
  await workbench.evaluate((element) => {
    element.scrollLeft = 0;
  });
  const workbenchBox = await workbench.boundingBox();
  if (!workbenchBox) throw new Error("Unable to measure workbench scroll region.");
  const workbenchEdgePoint = await emptyEdgePoint(page, workbenchBox, "right");
  await holdGestureFrame(
    page,
    workbenchEdgePoint,
    false,
    16,
  );
  await expect.poll(() => workbench.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Failed to load url");
});

test("filtration technique loads real camera gesture worker assets", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => new MediaStream(),
      },
    });
  });

  await page.goto("/#/technique/filtration");
  await expect(page.getByRole("heading", { name: "Filter a Precipitate" })).toBeVisible();
  await page.getByRole("button", { name: "Camera control", exact: true }).click();
  await expect(page.getByLabel("Camera gesture control status")).toContainText("Ready", {
    timeout: 20_000,
  });
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Failed to load url");
});

test("paper chromatography supports mocked camera gesture placement, spotting, and development", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop mocked-camera gesture coverage avoids adding mobile-specific QA.");

  await installMockCameraGestureControl(page);
  await page.goto("/#/technique/paper-chromatography");
  await expect(page.getByRole("heading", { name: "Paper Chromatography" })).toBeVisible();
  await startMockedCameraControl(page);

  await gesturePlaceFromShelf(
    page,
    "Chromatography chamber",
    "Chromatography chamber",
    "empty",
    0.32,
    0.42,
  );
  await expect(page.getByText("The chromatography chamber is upright on the workbench.").last()).toBeVisible();

  await gesturePlaceFromShelf(
    page,
    "Reagent bottle",
    "Solvent bottle",
    "20 mL chromatography solvent",
    0.66,
    0.42,
  );
  await gestureDragToLocator(
    page,
    equipmentButton(page, "Solvent bottle", "20 mL chromatography solvent"),
    equipmentButton(page, "Chromatography chamber", "empty"),
  );
  await expect(page.getByText("A shallow solvent layer is below the future baseline.").last()).toBeVisible();

  await gesturePlaceFromShelf(
    page,
    "Chromatography paper",
    "Chromatography paper",
    "empty",
    0.32,
    0.72,
  );
  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("Pencil baseline evidence recorded.").last()).toBeVisible();

  await gesturePlaceInstanceFromShelf(
    page,
    "Sample bottle",
    "Sample bottle",
    "Food dye sample",
    "1 mL food dye sample",
    0.50,
    0.72,
  );
  await gesturePlaceFromShelf(
    page,
    "Capillary spotter",
    "Capillary spotter",
    "empty",
    0.66,
    0.72,
  );
  await gestureDragToLocator(
    page,
    equipmentButton(page, "Food dye sample", "1 mL food dye sample"),
    equipmentButton(page, "Capillary spotter", "empty"),
  );
  await expect(page.getByText("The capillary contains a small dye sample.").last()).toBeVisible();
  await gestureDragToLocator(
    page,
    equipmentButton(page, "Capillary spotter", "0.1 mL food dye sample"),
    equipmentButton(page, "Chromatography paper", "empty"),
  );
  await expect(page.getByText("A small dye spot is on the pencil baseline.").last()).toBeVisible();

  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("The compact sample spot is dry.").last()).toBeVisible();

  await gestureDragToLocator(
    page,
    equipmentButton(page, "Chromatography paper", "spotted sample"),
    equipmentButton(page, "Chromatography chamber", "10 mL chromatography solvent"),
  );
  await expect(page.getByText("The paper is suspended in the chamber and the chromatogram develops.").last()).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
});

test("transmittance dilution supports mocked camera gesture pour interactions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop mocked-camera gesture coverage avoids adding mobile-specific QA.");

  await installMockCameraGestureControl(page);
  await page.goto("/#/technique/transmittance-dilution");
  await expect(page.getByRole("heading", { name: "Analyze Transmittance of a Dilution" })).toBeVisible();
  await startMockedCameraControl(page);

  await gesturePlaceFromShelf(
    page,
    "Volumetric flask",
    "Volumetric flask",
    "empty",
    0.56,
    0.46,
  );
  await expect(page.getByText("The volumetric flask is upright on the bench.").last()).toBeVisible();
  await gesturePlaceFromShelf(
    page,
    "Graduated cylinder",
    "Graduated cylinder",
    "empty",
    0.28,
    0.46,
  );
  await expect(page.getByText("The graduated cylinder is ready beside the flask.").last()).toBeVisible();
  await gesturePlaceInstanceFromShelf(
    page,
    "Sample bottle",
    "Sample bottle",
    "Blue dye stock",
    "25 mL blue dye stock",
    0.28,
    0.68,
  );
  await gestureDragToLocator(
    page,
    equipmentButton(page, "Blue dye stock", "25 mL blue dye stock"),
    equipmentButton(page, "Graduated cylinder", "empty"),
  );
  await expect(page.getByText("Eight milliliters of stock dye are measured in the cylinder.").last()).toBeVisible();
  await gestureDragToLocator(
    page,
    equipmentButton(page, "Graduated cylinder", "8 mL blue dye stock"),
    equipmentButton(page, "Volumetric flask", "empty"),
  );
  await expect(page.getByText("The measured dye aliquot is in the volumetric flask.").last()).toBeVisible();

  await gesturePlaceFromShelf(
    page,
    "Wash bottle",
    "Wash bottle",
    "500 mL deionized water",
    0.76,
    0.46,
  );
  await gestureDragToLocator(
    page,
    equipmentButton(page, "Wash bottle", "500 mL deionized water"),
    page.getByRole("button", { name: /Volumetric flask, 8 mL blue dye stock/i }),
  );
  await expect(page.getByText("Water is added below the calibration mark.").last()).toBeVisible();
  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("The partially diluted dye is swirled.").last()).toBeVisible();
  await gestureDragToLocator(
    page,
    page.getByRole("button", { name: /^Wash bottle, .*deionized water$/i }),
    page.getByRole("button", { name: /Volumetric flask, .*blue dye/i }),
  );
  await expect(page.getByText("The bottom of the meniscus rests on the calibration mark.").last()).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
});

test("thermal decomposition supports mocked camera gesture instrument, heat, and cool interactions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop mocked-camera gesture coverage avoids adding mobile-specific QA.");

  await installMockCameraGestureControl(page);
  await page.goto("/#/technique/thermal-decomposition-mass-loss");
  await expect(page.getByRole("heading", { name: "Heat and Reweigh a Carbonate Mixture" })).toBeVisible();
  await startMockedCameraControl(page);

  await gesturePlaceFromShelf(
    page,
    "Analytical balance",
    "Analytical balance",
    "empty",
    0.35,
    0.44,
  );
  await expect(page.getByText("The balance is ready for cooled mass readings.").last()).toBeVisible();

  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("The empty crucible and lid are on the bench.").last()).toBeVisible();
  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("The carbonate mixture is in the crucible.").last()).toBeVisible();
  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("Initial crucible and sample mass recorded.").last()).toBeVisible();
  await gestureActivate(page, page.getByRole("button", { name: "Record initial mass" }));
  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("The ring stand is upright on the bench.").last()).toBeVisible();
  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("The clay triangle rests in the iron ring.").last()).toBeVisible();
  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("The Bunsen burner is under the support.").last()).toBeVisible();
  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("The crucible sits on the clay triangle with the lid slightly ajar.").last()).toBeVisible();
  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("Gentle heating habit recorded.").last()).toBeVisible();

  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("The bicarbonate has decomposed and the crucible is hot.").last()).toBeVisible();
  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("The burner is off before cooling.").last()).toBeVisible();
  await gestureActivate(page, currentStepButton(page));
  await expect(page.getByText("The crucible has cooled enough to weigh.").last()).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
});

test("thermal decomposition technique completes heat, cool, reweigh, and composition flow", async ({ page }) => {
  await page.goto("/#/technique/thermal-decomposition-mass-loss");
  await expect(page.getByRole("heading", { name: "Heat and Reweigh a Carbonate Mixture" })).toBeVisible();
  await expectNoCentralActionButtons(page);

  await completeCurrentSteps(page, 19);

  await expect(page.getByText("0.3101 g")).toBeVisible();
  await expect(page.getByText("Sodium bicarbonate mass")).toBeVisible();
  await expect(page.getByText("0.840 g")).toBeVisible();
  await expect(page.getByText("Initial sodium carbonate mass")).toBeVisible();
  await expect(page.getByText("0.660 g")).toBeVisible();
  await expect(page.getByText("Sodium bicarbonate percent")).toBeVisible();
  await expect(page.getByText("56 %")).toBeVisible();
  await expect(page.getByText("Sodium carbonate percent")).toBeVisible();
  await expect(page.getByText("44 %")).toBeVisible();
  await expect(page.getByText("Progress: 19 completed / 19 total")).toBeVisible();
});

test("transmittance dilution technique completes through evidence and calculation controls", async ({ page }) => {
  await page.goto("/#/technique/transmittance-dilution");
  await expect(page.getByRole("heading", { name: "Analyze Transmittance of a Dilution" })).toBeVisible();
  await expectNoCentralActionButtons(page);

  await completeCurrentSteps(page, 20);

  await expect(page.getByText("42.0 %T")).toBeVisible();
  await expect(page.getByText("8.00 uM")).toBeVisible();
  await expect(page.getByText("0.4200")).toBeVisible();
  await expect(page.getByText("0.3768 A").first()).toBeVisible();
  await expect(page.getByText("Progress: 20 completed / 20 total")).toBeVisible();
});

test("paper chromatography technique completes through keyboard fallback", async ({ page }) => {
  await page.goto("/#/technique/paper-chromatography");
  await expect(page.getByRole("heading", { name: "Paper Chromatography" })).toBeVisible();
  await expectNoCentralActionButtons(page);

  await completeCurrentSteps(page, 15);

  await expect(page.getByText("80 mm").first()).toBeVisible();
  await expect(page.getByText("64 mm").first()).toBeVisible();
  await expect(page.getByText("Blue Rf 0.8").first()).toBeVisible();
  await expect(page.getByText("Red Rf 0.6").first()).toBeVisible();
  await expect(page.getByText("Yellow Rf 0.3").first()).toBeVisible();
  await expect(page.getByText("Progress: 15 completed / 15 total")).toBeVisible();
});

test("paper chromatography supports desktop spot and develop pointer flow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop pointer coverage complements the mobile keyboard fallback smoke flow.");

  await page.goto("/#/technique/paper-chromatography");
  await expect(page.getByRole("heading", { name: "Paper Chromatography" })).toBeVisible();
  await expectNoCentralActionButtons(page);

  await clickCurrentStepButton(page);
  await placeEquipment(page, "Reagent bottle", "20 mL chromatography solvent", "Solvent bottle");
  await dragEquipment(
    page,
    equipmentButton(page, "Solvent bottle", "20 mL chromatography solvent"),
    equipmentButton(page, "Chromatography chamber", "empty"),
  );
  await expect(page.getByText("A shallow solvent layer is below the future baseline.").last()).toBeVisible();

  await clickCurrentStepButton(page);
  await clickCurrentStepButton(page);
  await placeInstanceEquipment(page, "Sample bottle", "Sample bottle", "1 mL food dye sample", "Food dye sample");
  await placeEquipment(page, "Capillary spotter", "empty");
  await dragEquipment(
    page,
    equipmentButton(page, "Food dye sample", "1 mL food dye sample"),
    equipmentButton(page, "Capillary spotter", "empty"),
  );
  await expect(page.getByText("The capillary contains a small dye sample.").last()).toBeVisible();
  await dragEquipment(
    page,
    equipmentButton(page, "Capillary spotter", "0.1 mL food dye sample"),
    equipmentButton(page, "Chromatography paper", "empty"),
  );
  await expect(page.getByText("A small dye spot is on the pencil baseline.").last()).toBeVisible();
  await clickCurrentStepButton(page);

  await dragEquipment(
    page,
    equipmentButton(page, "Chromatography paper", "spotted sample"),
    equipmentButton(page, "Chromatography chamber", "10 mL chromatography solvent"),
  );
  await expect(page.getByText("The paper is suspended in the chamber and the chromatogram develops.").last()).toBeVisible();

  await completeCurrentSteps(page, 7);

  await expect(page.getByText("Blue Rf 0.8").first()).toBeVisible();
  await expect(page.getByText("Progress: 15 completed / 15 total")).toBeVisible();
});

test("status panels adapt below the workbench", async ({ page }, testInfo) => {
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.goto("/#/technique/weighing");
  await expect(page.getByRole("heading", { name: "Weigh a Solid" })).toBeVisible();

  const status = page.getByLabel("Lab evidence and status");
  await expect(status.getByRole("heading", { name: "Feedback" })).toBeVisible();
  await expect(status.getByRole("heading", { name: "Notebook" })).toBeVisible();
  await expect(status.getByRole("heading", { name: "Results" })).toBeVisible();

  const [benchBox, feedbackBox, notebookBox, resultsBox] = await Promise.all([
    page.locator(".workbench").boundingBox(),
    status.locator(".feedback-panel").boundingBox(),
    status.locator(".notebook-panel").boundingBox(),
    status.locator(".results-panel").boundingBox(),
  ]);
  if (!benchBox || !feedbackBox || !notebookBox || !resultsBox) {
    throw new Error("Unable to measure status panel layout.");
  }

  expect(feedbackBox.y).toBeGreaterThan(benchBox.y + benchBox.height);
  if (testInfo.project.name === "desktop") {
    expect(Math.abs(feedbackBox.y - notebookBox.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(feedbackBox.y - resultsBox.y)).toBeLessThanOrEqual(2);
    expect(feedbackBox.x).toBeLessThan(notebookBox.x);
    expect(notebookBox.x).toBeLessThan(resultsBox.x);
  } else {
    expect(feedbackBox.y).toBeLessThan(notebookBox.y);
    expect(notebookBox.y).toBeLessThan(resultsBox.y);
  }
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    )
    .toBe(true);
});

test("Bunsen burner 4DGS trial stays isolated and exposes SVG fallback", async ({ page }) => {
  await page.goto("/#/trial/future-splat-bench");
  await expect(page.getByRole("heading", { name: "Bunsen Burner 4DGS Trial" })).toBeVisible();
  await expect(page.getByText(/synthetic reconstruction trial/i)).toBeVisible();
  await expect(page.getByTestId("future-splat-png-fallback")).toBeVisible();
  await expect(page.getByLabel("SVG fallback")).toBeChecked();
  await expect(page.getByLabel("Trained synthetic 4DGS")).toBeDisabled();

  await page.getByRole("button", { name: "Low flame" }).click();
  await expect(page.getByText(/small stable flame/i)).toBeVisible();
  await expect(page.getByText("84 C")).toBeVisible();

  await page.getByRole("button", { name: "High flame" }).click();
  await expect(page.getByText(/maximum temporal difference/i)).toBeVisible();
  await expect(page.getByText("148 C")).toBeVisible();

  await page.getByRole("button", { name: "Cooldown" }).click();
  await expect(page.getByText(/residual low glow/i)).toBeVisible();
  await expect(page.getByText("39 C")).toBeVisible();

  await expectNoCentralActionButtons(page);
});
