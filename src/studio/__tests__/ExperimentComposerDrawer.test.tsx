import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import rawLab from "../../../public/labs/acid-base-titration.json";
import rawTechnique from "../../../public/techniques/titration-endpoint.json";
import { hydrateBundledLab } from "../../data/hydrateBundledLab";
import { validateBundledLabSource, validateTechniqueDefinition } from "../../domain/validation";
import { defaultLabInventory } from "../../experimentComposer/catalogs";
import { compileAcidBaseTitration } from "../../experimentComposer/compileAcidBaseTitration";
import { ExperimentComposerDrawer } from "../ExperimentComposerDrawer";

const loadVerifiedSource = async () => {
  const lab = validateBundledLabSource(rawLab);
  const technique = validateTechniqueDefinition(rawTechnique);
  if (!lab.ok || !lab.value) throw new Error(lab.errors.join("; "));
  if (!technique.ok || !technique.value) throw new Error(technique.errors.join("; "));
  return hydrateBundledLab(lab.value, async () => technique.value!);
};

describe("ExperimentComposerDrawer", () => {
  it("contains keyboard focus and exposes Escape close semantics", () => {
    const launcher = document.createElement("button");
    document.body.appendChild(launcher);
    launcher.focus();
    const onClose = vi.fn();
    render(<ExperimentComposerDrawer
      open
      revision={0}
      inventory={defaultLabInventory()}
      canApply={false}
      webMCPStatus="unsupported"
      activity={[]}
      onClose={onClose}
      onUseSimulationProfile={vi.fn(async () => undefined)}
      onStageExample={vi.fn(async () => undefined)}
      onOpenRehearsal={vi.fn(async () => ({ ok: false, message: "not ready" }))}
      onRunProtocolCheck={vi.fn(async () => ({ ok: false, message: "not ready" }))}
      onApply={vi.fn(async () => ({ ok: false, message: "locked" }))}
      onDiscard={vi.fn(async () => undefined)}
    />);
    launcher.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: /close experiment composer/i })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    launcher.remove();
  });

  it("renders complete review, honest delegate status, and human-only guarded controls", async () => {
    const source = await loadVerifiedSource();
    const inventory = defaultLabInventory();
    const outcome = await compileAcidBaseTitration({
      schemaVersion: "1",
      familyId: "acid_base_titration_v1",
      expectedInventoryRevision: 0,
      objective: "Estimate a synthetic acid molarity.",
      audience: "high_school",
      experience: "novice",
      durationMinutes: 45,
      deliveryContext: "virtual_training",
      aliquotVolumeMl: 20,
      endpointEvidence: "phenolphthalein",
    }, inventory, source, { stageRevision: 1, loadSource: loadVerifiedSource });
    if (!outcome.ok) throw new Error(outcome.issues.map((issue) => issue.message).join("; "));
    const onApply = vi.fn(async () => ({ ok: true, message: "applied" }));
    const onDiscard = vi.fn(async () => undefined);
    render(<ExperimentComposerDrawer
      open
      revision={3}
      inventory={inventory}
      stage={outcome.stage}
      canApply={false}
      webMCPStatus="ready"
      activity={[]}
      onClose={vi.fn()}
      onUseSimulationProfile={vi.fn(async () => undefined)}
      onStageExample={vi.fn(async () => undefined)}
      onOpenRehearsal={vi.fn(async () => ({ ok: false, message: "not ready" }))}
      onRunProtocolCheck={vi.fn(async () => ({ ok: false, message: "not ready" }))}
      onApply={onApply}
      onDiscard={onDiscard}
    />);
    expect(screen.getByRole("dialog", { name: /stage before changing studio/i })).toBeInTheDocument();
    expect(screen.getByText(/simulation profile.*not evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/inventory role resolution/i)).toBeInTheDocument();
    expect(screen.getByText(/generated module sequence/i)).toBeInTheDocument();
    expect(screen.getByText(/blockers, warnings, assumptions, and limitations/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open rehearsal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run protocol check/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply to studio/i })).toBeDisabled();
    expect(screen.getByText(/visible human-only controls.*never registered as WebMCP tools/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /discard/i }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });
});
