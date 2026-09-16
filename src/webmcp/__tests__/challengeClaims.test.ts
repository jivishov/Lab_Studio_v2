import { describe, expect, it } from "vitest";
import { createFidelityManifest } from "../../experimentComposer/fidelity";
import { PROTOCOL_CHECK_NAMES } from "../../protocolCheck/types";
import { defineWebMCPToolSet, registerWebMCPToolSet } from "../registerToolSet";
import { createRehearsalToolSet } from "../rehearsalTools";
import {
  REHEARSAL_TOOL_NAMES,
  STUDIO_TOOL_NAMES,
  rehearsalToolInputSchemas,
  studioToolInputSchemas,
} from "../toolSchemas";

const forbiddenAuthority = /(apply|discard|save|export|publish|commit|assessment)/i;

describe("R002 challenge claim inventory", () => {
  it("freezes exactly seven Studio and six non-overlapping rehearsal tools", () => {
    expect(STUDIO_TOOL_NAMES).toEqual([
      "inspect_lab_capabilities",
      "inspect_lab_inventory",
      "replace_lab_inventory",
      "preview_lab_experiment",
      "inspect_lab_preview",
      "start_lab_rehearsal",
      "run_lab_protocol_check",
    ]);
    expect(REHEARSAL_TOOL_NAMES).toEqual([
      "inspect_rehearsal",
      "act_current_step",
      "operate_titration",
      "record_step_evidence",
      "submit_step_calculation",
      "reset_rehearsal",
    ]);
    expect(new Set([...STUDIO_TOOL_NAMES, ...REHEARSAL_TOOL_NAMES]).size).toBe(13);
    expect([...STUDIO_TOOL_NAMES, ...REHEARSAL_TOOL_NAMES].some((name) => forbiddenAuthority.test(name))).toBe(false);
  });

  it("keeps all 13 final inputs strict", () => {
    const schemas = { ...studioToolInputSchemas, ...rehearsalToolInputSchemas } as Record<
      string,
      { additionalProperties?: boolean }
    >;
    expect(Object.keys(schemas)).toHaveLength(13);
    Object.values(schemas).forEach((schema) => expect(schema.additionalProperties).toBe(false));
  });

  it("locks the exact ten Protocol Check claims", () => {
    expect(PROTOCOL_CHECK_NAMES).toEqual([
      "schema_valid",
      "interaction_contracts_valid",
      "inventory_roles_resolved",
      "titration_model_derives",
      "happy_path_completes",
      "wrong_target_rejected",
      "early_endpoint_rejected",
      "premature_calculation_rejected",
      "reset_restores_initial_state",
      "limitations_present",
    ]);
  });

  it("states modeled, procedural, static-client, safety, and omitted-pH boundaries", () => {
    const virtual = createFidelityManifest("virtual_training");
    const physical = createFidelityManifest("physical_procedure_rehearsal");
    const allText = JSON.stringify({ virtual, physical });
    expect(virtual.status).toBe("modeled_and_executable");
    expect(physical.status).toBe("procedurally_executable");
    expect(allText).toMatch(/synthetic/i);
    expect(allText).toMatch(/full pH curve/i);
    expect(allText).toMatch(/not cryptographically secret/i);
    expect(allText).toMatch(/not a comprehensive safety review/i);
    expect(allText).toMatch(/does not characterize/i);
  });

  it("exposes no rehearsal surface without the guided action controller", () => {
    expect(createRehearsalToolSet(undefined)).toBeUndefined();
  });

  it("treats missing document.modelContext as unsupported progressive enhancement", async () => {
    const emptySet = defineWebMCPToolSet({ surface: "studio", allowedNames: [], tools: [] });
    const registration = await registerWebMCPToolSet(emptySet, {
      resolveModelContext: () => undefined,
    });
    expect(registration.status).toBe("unsupported");
    expect(registration.surface).toBe("studio");
  });
});
