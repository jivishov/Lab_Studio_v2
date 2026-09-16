import { describe, expect, it } from "vitest";
import type { ActionDefinition } from "../../domain/types";
import { actionInputField, actionInputRequestError, resolveActionInput } from "../actionInputs";

const action = (parameters: ActionDefinition["parameters"]): ActionDefinition => ({
  id: "input-action",
  verb: "calculate",
  label: "Submit result",
  parameters,
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: "Recorded.", invalid: "Try again." },
  evidence: [],
});

describe("action inputs", () => {
  it("treats student calculations as numeric responses and validates their range", () => {
    const definition = action({
      inputLabel: "Best-fit slope",
      inputMin: 0,
      inputMode: "numeric",
      requireStudentValue: true,
      unit: "AU/M",
    });

    expect(actionInputField(definition)).toMatchObject({
      key: "input-action",
      mode: "numeric",
      role: "studentResponse",
      unit: "AU/M",
    });
    expect(resolveActionInput(definition, "-1")).toMatchObject({ valid: false });
    expect(resolveActionInput(definition, "2.192")).toMatchObject({ valid: true, value: 2.192 });
  });

  it("keeps teacher configuration distinct from student responses", () => {
    const definition = action({
      inputKey: "measurement-wavelength",
      inputLabel: "Teacher-set wavelength",
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
    });

    expect(actionInputField(definition)).toMatchObject({
      key: "measurement-wavelength",
      role: "teacherConfiguration",
    });
  });

  it("turns source-required notes into required student text evidence", () => {
    const definition = action({
      note: "Record the assigned sample/test-line label.",
      requiresStudentNote: true,
    });

    expect(actionInputField(definition)).toMatchObject({
      mode: "text",
      required: true,
      role: "studentResponse",
    });
    expect(actionInputRequestError(definition, { verb: "calculate" })).toContain("required");
    expect(actionInputRequestError(definition, {
      verb: "calculate",
      note: "Unknown A / aqueous line",
    })).toBeUndefined();
  });

  it("requires an explicit session-only textual classroom configuration record", () => {
    const definition = action({
      configurationRequired: true,
      unlocked: false,
      inputMode: "text",
      inputRole: "teacherConfiguration",
      inputLabel: "Teacher protocol approval record (session only)",
    });

    expect(actionInputField(definition)).toMatchObject({
      mode: "text",
      required: true,
      role: "teacherConfiguration",
    });
    expect(actionInputRequestError(definition, {
      verb: "calculate",
      parameters: { configurationApproved: true },
    })).toContain("required");
    expect(actionInputRequestError(definition, {
      verb: "calculate",
      note: "Protocol approval recorded for this session.",
      parameters: { configurationApproved: true },
    })).toBeUndefined();
  });

  it("turns an explicitly locked extension into a session approval choice", () => {
    const definition = action({ configurationRequired: true, unlocked: false });

    expect(actionInputField(definition)).toMatchObject({
      mode: "choice",
      options: ["Teacher approved"],
      role: "teacherConfiguration",
    });
    expect(resolveActionInput(definition, "Teacher approved")).toMatchObject({
      note: "Teacher approved",
      valid: true,
    });
  });

  it("rejects a required response that is absent from the runtime request", () => {
    const definition = action({ inputMode: "text", inputLabel: "Evidence-based explanation" });

    expect(actionInputRequestError(definition, { verb: "calculate" })).toContain("required");
    expect(actionInputRequestError(definition, { verb: "calculate", note: "Observed trend" })).toBeUndefined();
  });

  // The composition compiler binds a parameter only when its whole value is `{{config.slot}}`, so a
  // slot named inside a sentence reaches the player untouched. Quick Ache's three recovery drying
  // steps do exactly that, and the learner was shown the braces instead of the approved criterion.
  it("resolves a configuration slot named inside a label from the action's own parameters", () => {
    const definition = action({
      inputMode: "choice",
      inputOptions: ["dry", "wet", "uncertain"],
      inputLabel: "Observed dryness against approved criterion: {{config.drynessCriterion}}",
      drynessCriterion: "Instructor-approved observed dry endpoint",
      coolingLimitC: 25,
    });

    expect(actionInputField(definition)?.label).toBe(
      "Observed dryness against approved criterion: Instructor-approved observed dry endpoint",
    );
  });

  it("drops an unresolvable slot rather than showing template syntax", () => {
    // Nothing is invented for a slot the compilation never bound: the sentence loses the fragment
    // and its dangling separator, and the learner never sees braces.
    const unbound = action({
      inputMode: "choice",
      inputOptions: ["dry", "wet"],
      inputLabel: "Observed dryness against approved criterion: {{config.drynessCriterion}}",
      drynessCriterion: "{{config.drynessCriterion}}",
    });
    expect(actionInputField(unbound)?.label).toBe("Observed dryness against approved criterion");

    const absent = action({
      inputMode: "text",
      inputLabel: "Cooling endpoint {{config.coolingLimitC}} degrees",
    });
    expect(actionInputField(absent)?.label).toBe("Cooling endpoint  degrees");

    // Numeric and boolean slots print their approved value, and a label with no slot is untouched.
    const numeric = action({
      inputMode: "text",
      inputLabel: "Cooling endpoint {{config.coolingLimitC}} degrees",
      coolingLimitC: 25,
    });
    expect(actionInputField(numeric)?.label).toBe("Cooling endpoint 25 degrees");
    const plain = action({ inputMode: "text", inputLabel: "Evidence-based explanation" });
    expect(actionInputField(plain)?.label).toBe("Evidence-based explanation");
  });

  // The resolver used to share one `/g` matcher between its "does this label name a slot?" test and
  // its replacement, and `lastIndex` survives both. That made the answer depend on what was
  // resolved just before: the call after one that left the matcher part-way through a label started
  // searching from that offset, found no placeholder, and handed the learner the raw
  // `{{config.…}}` template. The assertions above already encode the failing order — an unresolved
  // slot followed by a shorter label — so this pins the property itself rather than one arrangement
  // of it.
  it("resolves a configured label the same way however many times it is asked", () => {
    const unresolved = action({
      inputMode: "text",
      inputLabel: "Hold until {{config.coolingLimitC}}",
      coolingLimitC: "{{config.coolingLimitC}}",
    });
    const configured = action({
      inputMode: "text",
      inputLabel: "Stop at {{config.stopMm}} mm",
      stopMm: 80,
    });

    const repeated = [0, 1, 2, 3].map(() => actionInputField(configured)?.label);
    expect(new Set(repeated).size).toBe(1);
    expect(repeated[0]).toBe("Stop at 80 mm");

    // Interleaving the unresolvable label must not move the next answer either.
    expect(actionInputField(unresolved)?.label).toBe("Hold until");
    expect(actionInputField(configured)?.label).toBe("Stop at 80 mm");
    expect(actionInputField(unresolved)?.label).toBe("Hold until");
    expect(actionInputField(configured)?.label).toBe("Stop at 80 mm");

    // Several slots in one label resolve independently of each other.
    const mixed = action({
      inputMode: "text",
      inputLabel: "Between {{config.lowMl}} and {{config.highMl}} mL",
      lowMl: 5,
      highMl: 25,
    });
    expect(actionInputField(mixed)?.label).toBe("Between 5 and 25 mL");
  });
});
