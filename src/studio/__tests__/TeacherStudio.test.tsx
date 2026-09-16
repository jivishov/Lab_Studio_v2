import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import acidBaseTitrationLabJson from "../../../public/labs/acid-base-titration.json";
import { createLegacySampleRackDraft } from "../../test/legacyDrafts";
import * as bundledLabLoader from "../../data/loadBundledLabs";
import type { LabDefinition } from "../../domain/types";
import { DRAFT_STORAGE_KEY } from "../persistence";
import { TeacherStudio } from "../TeacherStudio";

const acidBaseTitrationLab = acidBaseTitrationLabJson as LabDefinition;

describe("TeacherStudio", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const addStep = (templateId: string) => {
    fireEvent.change(screen.getByLabelText(/add step/i), { target: { value: templateId } });
  };

  const openDetails = () => {
    fireEvent.click(
      screen.queryByRole("button", { name: /edit details/i }) ??
        screen.getByRole("button", { name: /edit details/i }),
    );
  };

  const openDetailsTab = (tabName: string) => {
    fireEvent.click(screen.getByRole("tab", { name: tabName }));
  };

  const activeDetailsPanel = (tabName: string) =>
    within(screen.getByRole("tabpanel", { name: tabName }));

  it("renders split workspace with constrained authoring and draft preview panels", () => {
    render(<TeacherStudio />);
    expect(screen.getByRole("heading", { name: /lab design studio/i })).toBeInTheDocument();
    expect(
      screen.queryByText(/build structured lab process maps that run in the same simulator engine/i),
    ).not.toBeInTheDocument();
    const aboutButton = screen.getByRole("button", { name: /about lab design studio/i });
    expect(aboutButton).toHaveAttribute("aria-haspopup", "dialog");
    expect(aboutButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Split" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("separator", { name: /resize studio and draft panes/i })).toHaveAttribute(
      "aria-valuenow",
      "64",
    );
    expect(screen.queryByRole("separator", { name: /resize process map and details panels/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Live preview" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Teacher Draft Lab" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Process" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /connections/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/add step/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/add workflow/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start from lab/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /process map/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit details/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /details/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no teacher-authored code/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /live preview/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /teacher draft lab/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guided/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /assessment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    expect(screen.getByText(/unsaved changes|saved/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new lab/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new technique/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/start template/i)).toBeInTheDocument();
    const readiness = screen.getByLabelText("Readiness");
    expect(within(readiness).getByText("Draft structure")).toBeInTheDocument();
    expect(within(readiness).queryByRole("button", { name: /draft structure ready/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /redo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^export$/i })).toBeInTheDocument();
    expect(screen.getByText(/import json/i)).toBeInTheDocument();
    const preview = screen.getByLabelText(/student player preview/i);
    expect(within(preview).getByLabelText(/process and current step/i)).toBeInTheDocument();
    expect(within(preview).getByRole("heading", { name: /current step/i })).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: /measure volume/i })).toBeInTheDocument();
    expect(within(preview).queryByRole("button", { name: /confirm accessible action/i })).not.toBeInTheDocument();
    expect(within(preview).getByLabelText(/step instructions/i)).toBeInTheDocument();

    fireEvent.click(within(preview).getByRole("button", { name: /assessment/i }));
    expect(within(preview).queryByLabelText(/step instructions/i)).not.toBeInTheDocument();
    expect(within(preview).getByText(/assessment - 0 failed attempts/i)).toBeInTheDocument();
  }, 15000);

  it("resizes and persists the pinned details width from the keyboard", () => {
    const { unmount } = render(<TeacherStudio />);
    openDetails();
    const separator = screen.getByRole("separator", { name: /resize process canvas and step editor sidebar/i });

    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(separator).toHaveAttribute("aria-valuenow", "376");
    expect(window.localStorage.getItem("lab-studio:v1:inspector-width")).toBe("376");

    fireEvent.keyDown(separator, { key: "Home" });
    expect(separator).toHaveAttribute("aria-valuenow", "320");

    fireEvent.keyDown(separator, { key: "End" });
    expect(separator).toHaveAttribute("aria-valuenow", "520");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator).toHaveAttribute("aria-valuenow", "504");
    unmount();

    render(<TeacherStudio />);
    openDetails();
    expect(screen.getByRole("separator", { name: /resize process canvas and step editor sidebar/i })).toHaveAttribute(
      "aria-valuenow",
      "504",
    );
  }, 15000);

  it("switches details tabs and keeps no-action states stable", () => {
    render(<TeacherStudio />);
    openDetails();
    expect(screen.getByRole("tab", { name: "Step" })).toHaveAttribute("aria-selected", "true");

    expect(screen.getByRole("heading", { name: /operation/i })).toBeInTheDocument();

    openDetailsTab("Interaction");
    expect(screen.getByRole("heading", { name: /interaction/i })).toBeInTheDocument();

    openDetailsTab("Completion");
    expect(screen.getByRole("heading", { name: /validation/i })).toBeInTheDocument();

    openDetailsTab("Advanced");
    const inspector = screen.getByRole("heading", { name: /details/i }).closest("aside");
    expect(inspector).not.toBeNull();
    fireEvent.change(within(inspector as HTMLElement).getByLabelText(/linked action id/i), { target: { value: "" } });
    openDetailsTab("Step");
    expect(within(screen.getByRole("tabpanel", { name: "Step" })).getByText(/does not have a linked action/i)).toBeInTheDocument();
    openDetailsTab("Interaction");
    expect(within(screen.getByRole("tabpanel", { name: "Interaction" })).getByText(/does not have a linked action/i)).toBeInTheDocument();
  }, 15000);

  it("opens and closes the Lab Design Studio info dialog", () => {
    render(<TeacherStudio />);
    const aboutButton = screen.getByRole("button", { name: /about lab design studio/i });

    fireEvent.click(aboutButton);
    expect(aboutButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: /design structured labs/i })).toBeInTheDocument();
    expect(screen.getByText(/about lab design studio/i)).toBeInTheDocument();
    expect(
      screen.getByText(/build structured lab process maps that run in the same simulator engine/i),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /design structured labs/i })).not.toBeInTheDocument();

    fireEvent.click(aboutButton);
    fireEvent.click(screen.getByRole("button", { name: /close about dialog/i }));
    expect(screen.queryByRole("dialog", { name: /design structured labs/i })).not.toBeInTheDocument();
  }, 15000);

  it("switches to the Studio tab view without the draft pane", () => {
    render(<TeacherStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Studio" }));
    expect(screen.getByRole("button", { name: "Studio" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: /process map/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /live preview/i })).not.toBeInTheDocument();
  }, 15000);

  it("switches to the draft tab view without the authoring pane", () => {
    render(<TeacherStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Live preview" }));
    expect(screen.getByRole("button", { name: "Live preview" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: /live preview/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /process map/i })).not.toBeInTheDocument();
  }, 15000);

  it("persists tab layout preference and falls back from invalid saved values", () => {
    const { unmount } = render(<TeacherStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Studio" }));
    expect(window.localStorage.getItem("lab-studio:v1:studio-layout")).toBe("tabs");

    unmount();
    window.localStorage.setItem("lab-studio:v1:studio-layout", "stacked");
    render(<TeacherStudio />);
    expect(screen.getByRole("button", { name: "Split" })).toHaveAttribute("aria-pressed", "true");
  }, 15000);

  it("keeps the Live preview tab label stable when the draft title changes", () => {
    render(<TeacherStudio />);
    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: "Custom Draft" } });
    expect(screen.getByRole("button", { name: "Live preview" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Custom Draft" })).not.toBeInTheDocument();
  }, 15000);

  it("tracks saved status and undo/redo for setup edits", () => {
    render(<TeacherStudio />);
    const title = screen.getByLabelText(/^title$/i);

    expect(screen.getByText(/^saved$/i)).toBeInTheDocument();
    fireEvent.change(title, { target: { value: "Custom Draft" } });
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("Custom Draft");

    fireEvent.click(screen.getByRole("button", { name: /^undo$/i }));
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("Teacher Draft Lab");

    fireEvent.click(screen.getByRole("button", { name: /^redo$/i }));
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("Custom Draft");

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(screen.getByText(/^saved$/i)).toBeInTheDocument();
  }, 15000);

  it("creates technique drafts and configures equipment cards without raw JSON", () => {
    render(<TeacherStudio />);

    fireEvent.click(screen.getByRole("button", { name: /new technique/i }));
    expect(screen.getByText(/new technique draft created/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /technique setup/i })).toBeInTheDocument();
    expect(screen.getAllByText("TECHNIQUE").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/^goal$/i), {
      target: { value: "Calibrate a spectrophotometer with standards." },
    });
    fireEvent.change(screen.getByLabelText(/common mistakes/i), {
      target: {
        value: "Skipping blank | The blank cuvette was not inserted first | Insert the blank and retry.",
      },
    });
    fireEvent.change(screen.getByLabelText(/reset behavior/i), {
      target: { value: "resetLab" },
    });

    const equipmentSection = screen.getByLabelText(/^required equipment$/i);
    fireEvent.change(within(equipmentSection).getByLabelText(/equipment catalog/i), {
      target: { value: "spectrophotometer" },
    });
    fireEvent.click(within(equipmentSection).getByRole("button", { name: /^add$/i }));
    expect(within(equipmentSection).getByText("Spectrophotometer", { selector: "strong" })).toBeInTheDocument();

    fireEvent.click(within(equipmentSection).getByRole("button", { name: /add starting item/i }));
    fireEvent.change(within(equipmentSection).getByLabelText(/instance label/i), {
      target: { value: "Spectrophotometer station" },
    });
    fireEvent.change(within(equipmentSection).getByLabelText(/^contents$/i), {
      target: { value: "solution" },
    });
    fireEvent.change(within(equipmentSection).getByLabelText(/contents label/i), {
      target: { value: "Blue dye standard" },
    });
    fireEvent.change(within(equipmentSection).getByLabelText(/volume ml/i), {
      target: { value: "5" },
    });

    expect(within(equipmentSection).getByDisplayValue("Spectrophotometer station")).toBeInTheDocument();
    expect(within(equipmentSection).getByDisplayValue("Blue dye standard")).toBeInTheDocument();
    expect(within(equipmentSection).getByDisplayValue("5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^undo$/i }));
    expect(within(equipmentSection).queryByDisplayValue("5")).not.toBeInTheDocument();
  }, 15000);

  it("retains the last runnable preview and gates export when the current draft is not runnable", () => {
    render(<TeacherStudio />);

    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: "" } });

    expect(screen.getByText(/showing the last runnable preview/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^export$/i })).toBeDisabled();
    const preview = screen.getByLabelText(/student player preview/i);
    expect(within(preview).getByText("Step: Measure sample")).toBeInTheDocument();
  }, 15000);

  it("keeps the Live preview current step aligned to the selected process map node", () => {
    render(<TeacherStudio />);
    const preview = screen.getByLabelText(/student player preview/i);
    expect(within(preview).getByText("Step: Measure sample")).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: /sample bottle, available/i })).toBeInTheDocument();
    expect(within(preview).getAllByText(/pour water sample from the sample bottle into the graduated cylinder until the meniscus reaches 20 ml/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText(/2\. transfer sample/i));
    expect(within(preview).getByText("Step: Transfer sample")).toBeInTheDocument();
    expect(within(preview).getAllByText(/pour 20 ml of sample from the graduated cylinder into the 250 ml beaker/i).length).toBeGreaterThan(0);
  }, 15000);

  it("separates step, workflow, and full lab template menus", () => {
    render(<TeacherStudio />);
    const stepSelect = screen.getByLabelText(/add step/i);
    const workflowSelect = screen.getByLabelText(/add workflow/i);
    const labSelect = screen.getByLabelText(/start from lab/i);

    expect(within(stepSelect).getByRole("option", { name: /weigh item/i })).toBeInTheDocument();
    expect(within(stepSelect).queryByRole("option", { name: /spectrophotometer dilution/i })).not.toBeInTheDocument();
    expect(within(stepSelect).queryByRole("option", { name: /acid-base titration/i })).not.toBeInTheDocument();

    expect(within(workflowSelect).getByRole("option", { name: /spectrophotometer dilution/i })).toBeInTheDocument();
    expect(within(workflowSelect).queryByRole("option", { name: /weigh item/i })).not.toBeInTheDocument();

    expect(within(labSelect).getByRole("option", { name: /acid-base titration/i })).toBeInTheDocument();
    expect(within(labSelect).queryByRole("option", { name: /weigh item/i })).not.toBeInTheDocument();
  }, 15000);

  it("adds a reusable workflow without opening details", async () => {
    render(<TeacherStudio />);
    fireEvent.change(screen.getByLabelText(/add workflow/i), {
      target: { value: "template-transmittance-dilution-technique" },
    });

    expect(await screen.findByText(/spectrophotometer dilution workflow appended/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /details/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /connections/i })).toBeInTheDocument();
  }, 15000);

  it("guards full lab templates before replacing the current draft", async () => {
    const loadLab = vi
      .spyOn(bundledLabLoader, "loadBundledLab")
      .mockResolvedValue(acidBaseTitrationLab);
    render(<TeacherStudio />);

    fireEvent.change(screen.getByLabelText(/start from lab/i), {
      target: { value: "template-acid-base-titration" },
    });

    const confirmation = screen.getByRole("status");
    expect(within(confirmation).getByText(/acid-base titration/i)).toBeInTheDocument();
    expect(within(confirmation).getByText(/will replace the current draft/i)).toBeInTheDocument();
    expect(screen.queryByText(/acid-base titration template loaded/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("Teacher Draft Lab");
    expect(loadLab).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText(/will replace the current draft/i)).not.toBeInTheDocument();
    expect(loadLab).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/start from lab/i), {
      target: { value: "template-acid-base-titration" },
    });
    fireEvent.click(screen.getByRole("button", { name: /load lab/i }));

    expect(await screen.findByText(/acid-base titration template loaded/i)).toBeInTheDocument();
    expect(loadLab).toHaveBeenCalledWith("acid-base-titration");
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("Acid-Base Titration");
    expect(screen.queryByText(/will replace the current draft/i)).not.toBeInTheDocument();
  }, 15000);

  it("shows an import repair panel for invalid JSON", async () => {
    render(<TeacherStudio />);
    const file = new File(["{"], "broken.lab.json", { type: "application/json" });

    fireEvent.change(screen.getByLabelText(/import json/i), {
      target: { files: [file] },
    });

    expect(await screen.findByLabelText(/import repair/i)).toBeInTheDocument();
    expect(screen.getByText(/fix these json issues/i)).toBeInTheDocument();
  }, 15000);

  it("clears pending full lab confirmation when adding a normal step", () => {
    const loadLab = vi.spyOn(bundledLabLoader, "loadBundledLab");
    render(<TeacherStudio />);

    fireEvent.change(screen.getByLabelText(/start from lab/i), {
      target: { value: "template-acid-base-titration" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(/will replace the current draft/i);

    addStep("template-weigh");

    expect(screen.queryByText(/will replace the current draft/i)).not.toBeInTheDocument();
    expect(loadLab).not.toHaveBeenCalled();
    expect(screen.getByText(/10 nodes/i)).toBeInTheDocument();
  }, 15000);

  it("repairs legacy saved drafts that used a sample rack as the measured liquid source", () => {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ version: 1, savedAt: "2026-05-14T00:00:00.000Z", draft: createLegacySampleRackDraft() }),
    );

    render(<TeacherStudio />);

    const preview = screen.getByLabelText(/student player preview/i);
    expect(screen.getByText(/10 nodes/i)).toBeInTheDocument();
    expect(within(preview).getByText("Step: Measure sample")).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: /sample bottle, available/i })).toBeInTheDocument();
    expect(within(preview).getAllByText(/pour water sample from the sample bottle into the graduated cylinder until the meniscus reaches 20 ml/i).length).toBeGreaterThan(0);
    expect(within(preview).queryByRole("button", { name: /sample rack/i })).not.toBeInTheDocument();
  }, 15000);

  it("adds a filtration template with editable interaction controls", () => {
    render(<TeacherStudio />);
    addStep("template-filtration");
    fireEvent.click(screen.getByRole("tab", { name: /connections/i }));
    expect(screen.getByRole("heading", { name: /^connections$/i })).toBeInTheDocument();
    openDetails();
    openDetailsTab("Interaction");
    const interaction = activeDetailsPanel("Interaction");
    expect(screen.getByText(/10 nodes/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/required equipment/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/start node/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /advanced process settings/i }));
    expect(screen.getByLabelText(/start node/i)).toBeInTheDocument();
    expect(interaction.getByLabelText(/operation type/i)).toHaveValue("pourInto");
    expect(interaction.getByLabelText(/source equipment/i)).toHaveValue("beaker-250ml");
    expect(interaction.getByLabelText(/target equipment/i)).toHaveValue("funnel-stand");
    expect(interaction.getByLabelText(/accessible label/i)).toHaveValue(
      "Pour the mixture from the beaker through the funnel stand.",
    );
  }, 15000);

  it("adds a weigh template with a balance interaction target", () => {
    render(<TeacherStudio />);
    addStep("template-weigh");
    openDetails();
    openDetailsTab("Interaction");
    const interaction = activeDetailsPanel("Interaction");
    expect(interaction.getByLabelText(/operation type/i)).toHaveValue("readInstrument");
    expect(interaction.getByLabelText(/source equipment/i)).toHaveValue("watch-glass");
    expect(interaction.getByLabelText(/target equipment/i)).toHaveValue("analytical-balance");
    expect(interaction.getByLabelText(/station/i)).toHaveValue("analytical-balance");
  }, 15000);

  it("adds a thermal decomposition template with a burner interaction target", () => {
    render(<TeacherStudio />);
    addStep("template-thermal-decomposition");
    openDetails();
    openDetailsTab("Interaction");
    const interaction = activeDetailsPanel("Interaction");
    expect(interaction.getByLabelText(/operation type/i)).toHaveValue("placeInInstrument");
    expect(interaction.getByLabelText(/source equipment/i)).toHaveValue("crucible-with-lid");
    expect(interaction.getByLabelText(/target equipment/i)).toHaveValue("bunsen-burner");
    expect(interaction.getByLabelText(/station/i)).toHaveValue("bunsen-burner");
  }, 15000);

  it("adds a paper chromatography template with a chamber snap interaction", () => {
    render(<TeacherStudio />);
    addStep("template-paper-chromatography");
    openDetails();
    openDetailsTab("Interaction");
    const interaction = activeDetailsPanel("Interaction");
    expect(interaction.getByLabelText(/operation type/i)).toHaveValue("snapIntoTarget");
    expect(interaction.getByLabelText(/source equipment/i)).toHaveValue("chromatography-paper");
    expect(interaction.getByLabelText(/target equipment/i)).toHaveValue("chromatography-chamber");
    expect(interaction.getByLabelText(/snap zone/i)).toHaveValue("chromatography-chamber-paper-slot");
  }, 15000);

  it("edits node validation and retry flow paths", () => {
    render(<TeacherStudio />);
    fireEvent.click(screen.getByText(/1\. measure sample/i));
    fireEvent.click(screen.getByRole("button", { name: /add retry path/i }));
    fireEvent.change(screen.getByLabelText(/add branch target/i), {
      target: { value: "demo-transfer-node" },
    });
    fireEvent.click(screen.getByRole("tab", { name: /connections/i }));
    fireEvent.click(screen.getByRole("button", { name: /advanced connection fields/i }));
    expect(screen.getAllByLabelText(/connection condition/i).some((select) => select instanceof HTMLSelectElement && select.value === "retry")).toBe(true);
    const branchCondition = screen.getAllByLabelText(/connection condition/i).at(-1);
    expect(branchCondition).toBeInstanceOf(HTMLSelectElement);
    fireEvent.change(branchCondition as HTMLSelectElement, { target: { value: "calculationResult" } });
    fireEvent.change(screen.getByLabelText(/calculation id/i), { target: { value: "hardness-mg-l" } });
    fireEvent.change(screen.getByLabelText(/calculation minimum/i), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText(/calculation maximum/i), { target: { value: "450" } });
    expect(screen.getByDisplayValue("hardness-mg-l")).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText(/connection condition/i).at(-1) as HTMLSelectElement, {
      target: { value: "always" },
    });
    expect(screen.queryByLabelText(/calculation minimum/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    const savedDraft = JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) ?? "{}") as {
      draft?: LabDefinition;
    };
    const branchEdge = savedDraft.draft?.process.edges.find((edge) => edge.label === "Branch");
    expect(branchEdge?.condition).toEqual({ type: "always" });
    openDetails();
    openDetailsTab("Completion");
    fireEvent.click(screen.getByRole("button", { name: /add rule/i }));
    const completion = activeDetailsPanel("Completion");
    expect(completion.getByDisplayValue(/action completed/i)).toBeInTheDocument();
    fireEvent.change(completion.getAllByLabelText(/^type$/i).at(-1) as HTMLSelectElement, {
      target: { value: "calculationWithinTolerance" },
    });
    fireEvent.change(completion.getByLabelText(/calculation tolerance/i), { target: { value: "0.5" } });
    expect(completion.getByDisplayValue("0.5")).toBeInTheDocument();
  }, 15000);

  it("surfaces missing explicit interaction warnings and lets teachers add one", () => {
    render(<TeacherStudio />);
    fireEvent.click(screen.getByText(/1\. measure sample/i));
    openDetails();
    openDetailsTab("Interaction");
    fireEvent.click(screen.getByRole("button", { name: /remove interaction/i }));
    expect(screen.getByLabelText(/interaction warnings/i)).toHaveTextContent(/missing an explicit interaction spec/i);
    fireEvent.click(screen.getByRole("button", { name: /add interaction/i }));
    expect(activeDetailsPanel("Interaction").getByLabelText(/operation type/i)).toHaveValue("pourInto");
  }, 15000);

  it("opens, collapses, and reopens the details sidebar", () => {
    render(<TeacherStudio />);
    openDetails();
    expect(screen.getByRole("heading", { name: /details/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /collapse details/i }));
    expect(screen.queryByRole("heading", { name: /details/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: /resize process map and details panels/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    expect(screen.getByRole("heading", { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: /resize process map and details panels/i })).toBeInTheDocument();
  }, 15000);

  it("can unpin the details sidebar into a floating sidebar", () => {
    render(<TeacherStudio />);
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: /unpin details/i }));
    expect(screen.getByRole("button", { name: /pin details/i })).toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: /resize process map and details panels/i })).not.toBeInTheDocument();
  }, 15000);
});
