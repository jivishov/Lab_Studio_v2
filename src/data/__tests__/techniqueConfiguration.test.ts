import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TechniqueDefinition } from "../../domain/types";
import { applyLabSetup } from "../labSetup";
import { compileLabComposition } from "../compileLabComposition";
import {
  applyTechniqueConfiguration,
  configurationSlots,
  derivedIdentifier,
  TechniqueConfigurationError,
  unresolvedConfigurationMessage,
  unresolvedConfigurationSlots,
} from "../techniqueConfiguration";

/**
 * The standalone technique route and teacher configuration.
 *
 * `loadBundledTechnique` returns a published technique exactly as authored — no instance bindings,
 * no witness, no `materializeOrderedProcedure`. Most indexed techniques are written against teacher
 * configuration, so their parameters still hold `{{config.*}}` templates at that point. These cases
 * pin which activities that affects, so the count cannot drift silently, and check that the same
 * technique compiled inside its host lab has nothing left unresolved.
 *
 * Authored, not executed, under the AGENTS.md repository validation policy.
 */
const readJson = async <T,>(...parts: string[]): Promise<T> =>
  JSON.parse(await readFile(join(process.cwd(), "public", ...parts), "utf8")) as T;

const loadIndexedTechniques = async (): Promise<Map<string, TechniqueDefinition>> => {
  const index = await readJson<{ id: string; file?: string }[]>("techniques", "index.json");
  const entries = await Promise.all(index.map(async (entry) => [
    entry.id,
    await readJson<TechniqueDefinition>("techniques", entry.file ?? `${entry.id}.json`),
  ] as const));
  return new Map(entries);
};

describe("unresolved teacher configuration on the standalone technique route", () => {
  it("finds the templates a technique still needs and leaves a configured one alone", () => {
    const definition = {
      id: "fx",
      actions: [
        { id: "a", parameters: { volumeMl: "{{config.rinseVolumeMl}}", note: "plain" } },
        { id: "b", parameters: { nested: { deep: ["{{config.toleranceG}}", 5] } } },
      ],
      process: { nodes: [{ hint: "{{config.rinseVolumeMl}}" }] },
      successCriteria: [],
    } as unknown as TechniqueDefinition;

    // Reported once each, sorted, and only for the templates that are actually still there.
    expect(unresolvedConfigurationSlots(definition)).toEqual(["rinseVolumeMl", "toleranceG"]);

    const configured = JSON.parse(
      JSON.stringify(definition).replaceAll(/\{\{config\.[A-Za-z0-9_-]+\}\}/g, "1"),
    ) as TechniqueDefinition;
    expect(unresolvedConfigurationSlots(configured)).toEqual([]);
  });

  it("names the missing fields instead of calling the activity unavailable", () => {
    const message = unresolvedConfigurationMessage(["solventDepthMm", "stopCondition"]);
    expect(message).toContain("solventDepthMm");
    expect(message).toContain("stopCondition");
    // No default is offered, and the host lab is named as the supported way in.
    expect(message).toMatch(/lab that hosts this technique/i);
    expect(message).toMatch(/no default is substituted/i);
    expect(unresolvedConfigurationMessage(["stopCondition"])).toContain("the value for stopCondition");
  });

  it("pins which indexed techniques cannot be started without a host lab", async () => {
    const techniques = await loadIndexedTechniques();
    const blocked = [...techniques]
      .filter(([, technique]) => unresolvedConfigurationSlots(technique).length > 0)
      .map(([id]) => id)
      .sort();

    // Not a quota: this list is the current disposition recorded in
    // tmp/claude-opus-human-readiness-item1/ACTIVITY_SETUP_READINESS.json. A technique joining or
    // leaving it is a catalog change that has to update that record too.
    expect(blocked).toEqual([
      "beers-law-calibration",
      "blue1-class-calibration",
      "blue1-percent-transmittance",
      "bonding-solids-tests",
      "beverage-ph-volume-titration",
      "crystal-violet-kinetics",
      "dilution",
      "drying",
      "filtration",
      "hand-warmer-calorimetry",
      "hard-water-calculation",
      "hard-water-gravimetry",
      "hard-water-precipitation",
      "hard-water-two-sample-inquiry",
      "making-solution",
      "marble-gas-syringe-kinetics",
      "measuring-volume",
      "paper-chromatography",
      "ph-volume-formal-titration-trial",
      "quick-ache-extraction-recovery",
      "redox-titration",
      "thermal-decomposition-mass-loss",
      "titration-endpoint",
      "transfer",
      "transmittance-dilution",
      "two-stage-precipitate-drying",
      "weighing",
    ].sort());

    // The rest of the catalog is unaffected: those techniques carry no configuration templates and
    // the route still starts them directly.
    expect(techniques.size - blocked.length).toBeGreaterThan(0);
  });

  it("leaves nothing unresolved once the host lab supplies the configuration", async () => {
    const source = await readJson<Parameters<typeof applyLabSetup>[0]>("labs", "paper-chromatography.json");
    const technique = await readJson<TechniqueDefinition>("techniques", "paper-chromatography.json");
    expect(unresolvedConfigurationSlots(technique).length).toBeGreaterThan(0);

    const compiled = await compileLabComposition(
      applyLabSetup(source, {
        trials: [{ solvent: "water" }, { solvent: "propanol" }],
        baselineHeightMm: 15,
        solventDepthMm: 5,
        spotVolumeMl: 0.01,
        solventVolumeMl: 10,
        spotterLoadVolumeMl: 0.1,
        paperLengthMm: 120,
        stopFrontMm: 80,
      }) as Parameters<typeof compileLabComposition>[0],
      async (techniqueId) => {
        if (techniqueId !== technique.id) throw new Error(`Unexpected technique ${techniqueId}.`);
        return technique;
      },
    );
    expect(unresolvedConfigurationSlots(compiled)).toEqual([]);
  });
});

/**
 * Supplying the configuration, rather than only reporting that it is missing.
 *
 * Six of the indexed techniques are composed by no lab, so "start it from its host lab" named a
 * route that does not exist. These cases cover the path that replaced it: a teacher supplies the
 * classroom quantities, the evidence identifiers are derived, and nothing is defaulted.
 */
describe("configuring a technique started on its own", () => {
  const definition = (actions: unknown[]): TechniqueDefinition =>
    ({ id: "fx", actions, process: { nodes: [] }, successCriteria: [] }) as unknown as TechniqueDefinition;

  it("separates the values only a teacher can choose from the runtime's own bookkeeping", () => {
    const slots = configurationSlots(definition([
      { id: "a", parameters: { volumeMl: "{{config.aliquotVolumeMl}}", measurementId: "{{config.aliquotEvidenceId}}" } },
      { id: "b", parameters: { tag: "{{config.blankRuleNotebookTag}}", note: "{{config.solutionObservation}}" } },
      { id: "c", parameters: { temperatureC: "{{config.ovenTemperatureC}}" } },
    ]));

    // Quantities first, because those are what a teacher is being asked for.
    expect(slots.map((slot) => slot.id)).toEqual([
      "aliquotVolumeMl",
      "ovenTemperatureC",
      "solutionObservation",
      "aliquotEvidenceId",
      "blankRuleNotebookTag",
    ]);
    expect(slots.filter((slot) => slot.kind === "internal-identifier").map((slot) => slot.id))
      .toEqual(["aliquotEvidenceId", "blankRuleNotebookTag"]);

    // The unit comes from the slot's own name and reaches the teacher in the label.
    const byId = new Map(slots.map((slot) => [slot.id, slot]));
    expect(byId.get("aliquotVolumeMl")).toMatchObject({ mode: "numeric", unit: "mL", label: "Aliquot volume (mL)" });
    expect(byId.get("ovenTemperatureC")).toMatchObject({ mode: "numeric", unit: "°C" });
    // Bound only into `note`, so it is prose rather than a measurement.
    expect(byId.get("solutionObservation")).toMatchObject({ mode: "text", unit: undefined });
  });

  it("classifies by where a slot is bound, not by how its name reads", () => {
    // Same slot name, bound into a quantity parameter: asked for, not derived. An unfamiliar
    // binding has to reach a teacher rather than being filled in on the strength of a suffix.
    const slots = configurationSlots(definition([
      { id: "a", parameters: { volumeMl: "{{config.strangeMeasurementId}}" } },
    ]));
    expect(slots[0]).toMatchObject({ id: "strangeMeasurementId", kind: "classroom-quantity" });
  });

  it("refuses a missing or unusable classroom value instead of substituting one", () => {
    const technique = definition([
      { id: "a", parameters: { volumeMl: "{{config.aliquotVolumeMl}}" } },
    ]);

    expect(() => applyTechniqueConfiguration(technique, {})).toThrow(TechniqueConfigurationError);
    expect(() => applyTechniqueConfiguration(technique, {})).toThrow(/Aliquot volume \(mL\)/);
    expect(() => applyTechniqueConfiguration(technique, { aliquotVolumeMl: "   " })).toThrow(/Aliquot volume/);
    expect(() => applyTechniqueConfiguration(technique, { aliquotVolumeMl: "about ten" }))
      .toThrow(/must be a number/);
  });

  it("binds a whole-string slot with the value's own type, as the compiler does", () => {
    const configured = applyTechniqueConfiguration(
      definition([
        { id: "a", parameters: { volumeMl: "{{config.aliquotVolumeMl}}", note: "{{config.solutionObservation}}" } },
      ]),
      { aliquotVolumeMl: "10.5", solutionObservation: "clear, colourless" },
    );
    const parameters = (configured.actions[0] as { parameters: Record<string, unknown> }).parameters;
    expect(parameters.volumeMl).toBe(10.5);
    expect(parameters.note).toBe("clear, colourless");
    expect(unresolvedConfigurationSlots(configured)).toEqual([]);
  });

  it("gives an evidence identifier one derived name wherever it is cited", () => {
    // Steps cite each other by these names, so the same slot has to resolve to the same string in
    // every parameter it appears in or the citations stop lining up.
    const configured = applyTechniqueConfiguration(
      definition([
        { id: "a", parameters: { measurementId: "{{config.wavelengthMeasurementId}}" } },
        { id: "b", parameters: { referenceId: "{{config.wavelengthMeasurementId}}" } },
      ]),
      {},
    );
    const value = derivedIdentifier("wavelengthMeasurementId");
    expect(value).toBe("standalone-wavelength-measurement-id");
    for (const action of configured.actions as Array<{ parameters: Record<string, unknown> }>) {
      expect(Object.values(action.parameters)).toContain(value);
    }
    // Prefixed so it cannot be mistaken for, or collide with, one a lab composition assigned.
    expect(value.startsWith("standalone-")).toBe(true);
  });

  it("gives every configuration-dependent indexed technique a path that resolves", async () => {
    const techniques = await loadIndexedTechniques();
    const unresolvedAfterBinding: string[] = [];
    let covered = 0;

    for (const [id, technique] of techniques) {
      const slots = configurationSlots(technique);
      if (slots.length === 0) continue;
      covered += 1;
      // Illustrative entries standing in for a teacher's, only to prove the binding path: the
      // route itself supplies nothing and refuses an empty field.
      const supplied = Object.fromEntries(
        slots
          .filter((slot) => slot.kind === "classroom-quantity")
          .map((slot) => [slot.id, slot.mode === "numeric" ? "1" : "observed"]),
      );
      const configured = applyTechniqueConfiguration(technique, supplied);
      if (unresolvedConfigurationSlots(configured).length > 0) unresolvedAfterBinding.push(id);
    }

    expect(covered).toBeGreaterThan(0);
    expect(unresolvedAfterBinding).toEqual([]);
  });

  it("declares every configuration slot it actually uses", async () => {
    // `compositionValidation` refuses an instance that binds a slot the technique does not declare
    // ("binds undeclared configuration slot"), so a technique that reads `{{config.x}}` without
    // declaring `x` cannot be composed by any lab however that lab is authored. Three techniques
    // were in exactly that state — which is why no lab hosted them — and this is what stops another
    // one getting there.
    const techniques = await loadIndexedTechniques();
    const undeclared: string[] = [];

    for (const [id, technique] of techniques) {
      const declared = new Set(
        (technique.composition?.configurationSlots ?? []).map((slot) => slot.id),
      );
      const used = new Set(
        configurationSlots(technique)
          .filter((slot) => slot.kind !== "host-composition-only")
          .map((slot) => slot.id),
      );
      for (const slot of used) if (!declared.has(slot)) undeclared.push(`${id}.${slot}`);
    }

    expect(undeclared).toEqual([]);
  });

  it("reports a declared slot nothing reads without asking a teacher to invent one", async () => {
    // The other direction: a slot the contract declares but no runtime parameter is bound to. Some
    // are read while a lab compiles — an ordered procedure's selection slot is one — which is not
    // something the standalone route does. Reported, never asked for, never filled in.
    const techniques = await loadIndexedTechniques();
    const chromatography = configurationSlots(techniques.get("paper-chromatography")!);
    const hostOnly = chromatography.filter((slot) => slot.kind === "host-composition-only");
    expect(hostOnly.map((slot) => slot.id)).toEqual(["selectedProcedure"]);

    // It is not asked for, and binding succeeds without it.
    const quantities = chromatography.filter((slot) => slot.kind === "classroom-quantity");
    const configured = applyTechniqueConfiguration(
      techniques.get("paper-chromatography")!,
      Object.fromEntries(quantities.map((slot) => [slot.id, "1"])),
    );
    expect(unresolvedConfigurationSlots(configured)).toEqual([]);
  });

  it("asks a teacher for nothing when a technique only needs evidence names", async () => {
    // Two of the six unhosted techniques carry no classroom quantity at all: everything they were
    // waiting for was bookkeeping. They start with no teacher input beyond the approval.
    const techniques = await loadIndexedTechniques();
    for (const id of ["transmittance-dilution", "beers-law-calibration"]) {
      const slots = configurationSlots(techniques.get(id)!);
      expect(slots.length, id).toBeGreaterThan(0);
      expect(slots.filter((slot) => slot.kind === "classroom-quantity"), id).toEqual([]);
      expect(unresolvedConfigurationSlots(applyTechniqueConfiguration(techniques.get(id)!, {})), id)
        .toEqual([]);
    }
  });
});
