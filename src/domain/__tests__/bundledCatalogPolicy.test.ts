import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BUNDLED_CATALOG_POLICY_DIAGNOSTIC,
  BUNDLED_CATALOG_POLICY_FINAL_STRICT,
  bundledCatalogPolicySha256,
  bundledCatalogSemanticFingerprint,
  bundledTechniqueSurface,
  evaluateBundledCatalogPolicy,
  type BundledCatalogOwner,
} from "../bundledCatalogPolicy";
import { bundledCatalogPolicyMigrationEntries } from "../bundledCatalogPolicyMigration";
import { deriveActionEffectContract } from "../atomRegistry";
import type { TechniqueDefinition } from "../types";

const publicTechnique = (file: string): TechniqueDefinition =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", file), "utf8")) as TechniqueDefinition;

const actionById = (technique: TechniqueDefinition, actionId: string) => {
  const action = technique.actions.find((candidate) => candidate.id === actionId);
  if (!action) throw new Error(`Expected action ${actionId}.`);
  return action;
};

const orderedProcedureFor = (technique: TechniqueDefinition) => {
  const orderedProcedure = technique.composition?.orderedProcedure;
  if (!orderedProcedure) throw new Error(`Expected an authored ordered procedure for ${technique.id}.`);
  return orderedProcedure;
};

const projectionFinding = (
  technique: TechniqueDefinition,
  action: TechniqueDefinition["actions"][number],
) => ({
  rule: "bundled/atom-identity" as const,
  authority: "public-bundle" as const,
  owner: {
    kind: "technique" as const,
    id: technique.id,
    version: technique.metadata.version,
    artifact: `public/techniques/${technique.id}.json`,
  },
  sourceActionId: action.id,
  detail: "projection sensitivity fixture",
  action,
});

describe("bundled catalog policy", () => {
  it("uses portable SHA-256 with exact UTF-8 byte semantics", () => {
    expect(bundledCatalogPolicySha256("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(bundledCatalogPolicySha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(bundledCatalogPolicySha256("Lab Studio μmol")).toBe(
      "40849c5f691b3b4ed389187366173ac56e9bea843f5d26a70ac54431e986986d",
    );
  });

  it("keeps every migration entry id unique across exact owner keys", () => {
    const ids = bundledCatalogPolicyMigrationEntries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("defaults to final-strict and requires explicit diagnostic mode", async () => {
    const paper = publicTechnique("paper-chromatography.json");
    const surface = bundledTechniqueSurface(
      "public-bundle",
      "public/techniques/paper-chromatography.json",
      paper,
    );

    const strict = await evaluateBundledCatalogPolicy([surface]);
    const diagnostic = await evaluateBundledCatalogPolicy([surface], {
      mode: BUNDLED_CATALOG_POLICY_DIAGNOSTIC,
    });

    expect(strict.evaluationMode).toBe(BUNDLED_CATALOG_POLICY_FINAL_STRICT);
    expect(diagnostic.evaluationMode).toBe(BUNDLED_CATALOG_POLICY_DIAGNOSTIC);
    expect(strict.transitionFindings).toEqual([]);
    expect(diagnostic.transitionFindings).toEqual([]);
  });

  it("keeps matching migration debt diagnostic-only and blocking in final-strict mode", async () => {
    const paper = structuredClone(publicTechnique("paper-chromatography.json"));
    const action = actionById(paper, "measure-choice-acetone-1-region-1");
    delete action.atomId;
    const surface = bundledTechniqueSurface(
      "public-bundle",
      "public/techniques/paper-chromatography.json",
      paper,
    );
    const preflight = await evaluateBundledCatalogPolicy([surface]);
    const finding = preflight.findings.find(
      (candidate) => candidate.rule === "bundled/atom-identity" && candidate.sourceActionId === action.id,
    );
    if (!finding) throw new Error("Expected an atom-identity finding for the synthetic migration fixture.");

    vi.doMock("../bundledCatalogPolicyMigration", () => ({
      bundledCatalogPolicyMigrationEntries: [{
        id: "f03-test-migration-entry",
        policySchemaVersion: preflight.schemaVersion,
        rule: finding.rule,
        authority: "public-bundle",
        owner: finding.owner,
        sourceActionId: finding.sourceActionId,
        semanticFingerprint: finding.semanticFingerprint,
        repairBatch: "F05",
        disposition: "existing-unresolved-debt",
        removalCondition: "Remove this synthetic entry when the atom identity is restored.",
        f02Evidence: "Synthetic focused test fixture.",
        sourceEvidence: "Synthetic focused test fixture.",
      }],
    }));
    vi.resetModules();
    try {
      const isolatedPolicy = await import("../bundledCatalogPolicy");
      const strict = await isolatedPolicy.evaluateBundledCatalogPolicy([surface]);
      const diagnostic = await isolatedPolicy.evaluateBundledCatalogPolicy([surface], {
        mode: isolatedPolicy.BUNDLED_CATALOG_POLICY_DIAGNOSTIC,
      });

      expect(strict.accepted).toBe(false);
      expect(strict.transitionFindings).toEqual([]);
      expect(strict.blockingFindings).toEqual(expect.arrayContaining([
        expect.objectContaining({
          sourceActionId: action.id,
          migrationEntryId: "f03-test-migration-entry",
          transition: "blocking",
        }),
      ]));
      expect(diagnostic.accepted).toBe(true);
      expect(diagnostic.blockingFindings).toEqual([]);
      expect(diagnostic.transitionFindings).toEqual(expect.arrayContaining([
        expect.objectContaining({
          sourceActionId: action.id,
          migrationEntryId: "f03-test-migration-entry",
          transition: "allowed-existing-debt",
        }),
      ]));
    } finally {
      vi.doUnmock("../bundledCatalogPolicyMigration");
      vi.resetModules();
    }
  });

  it("accepts the repaired paper measurement surface without transition debt", async () => {
    const paper = publicTechnique("paper-chromatography.json");
    const result = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/paper-chromatography.json", paper),
    ]);

    expect(result.accepted).toBe(true);
    expect(result.blockingFindings).toEqual([]);
    expect(result.migrationIssues).toEqual([]);
    expect(result.transitionFindings).toEqual([]);
    expect(actionById(paper, "measure-choice-acetone-1-region-1").atomId).toBe(
      "atom.observe.measure-chromatography-distance",
    );
  });

  // Investigation 5 prescribes no post-development drying SOP. The removed extra free-text field
  // was not teacher authorization: its content-owned teacherConfiguration role accepted arbitrary
  // typed text, set an approval boolean, and supplied neither teacher identity nor evidence of a
  // method the simulator could enforce. That particular unauthenticated claim is removed for this
  // behavior/evidence mismatch, not because the manual is silent about what a teacher could
  // authorize. The replacement remains inferred R/C handling, and the overall procedure approval
  // still gates the route.
  // This case keeps the original purpose -- an implementation cycle must not invent a drying
  // method -- while asserting the contract the step can actually honour: it writes the
  // trial-specific dry evidence its own trial's measurements consume, it keeps the physical
  // condition that the solvent front is marked first, and the lab-level procedure approval that
  // gates the trials is untouched.
  //
  // What this case does NOT assert: that a learner can reach the step, or that the drying handler
  // enforces anything. Those are runtime properties. `src/runtime/__tests__/cycle10Separation.test.ts`
  // covers the develop/mark/dry chain physically, and `runtime.test.ts` covers this technique's own
  // refusal and success paths.
  it("keeps unsupported post-development drying free of any invented method", () => {
    const paper = publicTechnique("paper-chromatography.json");
    const dryingActions = paper.actions.filter(
      (action) => action.atomId === "atom.observe.dry-developed-chromatography-paper",
    );

    expect(dryingActions.length).toBeGreaterThan(0);
    expect(paper.composition?.configurationSlots.some((slot) => slot.id === "postDevelopmentDryingMethod")).toBe(false);
    expect(paper.composition?.approvalGates ?? []).toEqual([]);

    const dryTags = new Set<string>();
    for (const action of dryingActions) {
      // The trial identity comes from the paper instance this step is bound to, not from the
      // action id: a tag derived from the id would agree with itself if the id were wrong.
      const paperInstanceId = action.parameters.sourceInstanceId;
      expect(typeof paperInstanceId, action.id).toBe("string");
      const trial = String(paperInstanceId).replace(/-paper$/, "");
      expect(trial, action.id).not.toBe(paperInstanceId);
      expect(action.parameters.tag, action.id).toBe(`${trial}-chromatogram-dry`);
      dryTags.add(String(action.parameters.tag));

      // No invented handling: no method, device, duration, temperature or ventilation, and no
      // teacher-configuration lock standing in for one.
      for (const key of [
        "postDevelopmentDryingMethod",
        "dryingMethod",
        "dryingDevice",
        "dryingDurationSeconds",
        "dryingDurationMinutes",
        "dryingTemperatureC",
        "ventilation",
        "configurationRequired",
        "unlocked",
        "inputMode",
        "inputRole",
        "inputRequired",
        "inputKey",
        "inputLabel",
        "sourceAuthorityStatus",
      ]) {
        expect(action.parameters[key], `${action.id}/${key}`).toBeUndefined();
      }
      expect(JSON.stringify(action.stateChanges), action.id).not.toMatch(/approv/i);

      // Retained physical condition: the front must already be marked, and drying an unmarked
      // strip remains a declared invalid case.
      expect(
        action.prerequisites.map((rule) => rule.notebookTag),
        action.id,
      ).toEqual([`${trial}-front-marked`]);
      const invalidCaseIds = action.invalidCases.map((item) => item.id);
      expect(invalidCaseIds, action.id).toContain("front-not-marked");
      expect(invalidCaseIds, action.id).not.toContain("missing-post-development-drying-method-approval");
      expect(invalidCaseIds, action.id).not.toContain("empty-post-development-drying-method-approval");
    }
    // One tag per trial: the removed gate wrote a single shared tag for all of them.
    expect(dryTags.size).toBe(dryingActions.length);
    expect(dryTags.has("post-development-drying-method-approved")).toBe(false);

    // The overall procedure approval is unchanged by this repair and still gates the trials.
    const approvalConsumers = paper.actions.filter((action) =>
      action.prerequisites.some((rule) => rule.notebookTag === "procedure-approved"),
    );
    expect(approvalConsumers.length).toBeGreaterThan(0);
    expect(approvalConsumers.map((action) => action.id)).toEqual(
      expect.arrayContaining(["place-water-chamber", "place-propanol-chamber", "place-metric-ruler"]),
    );
  });

  it("rejects removal of a repaired atom identity instead of refreshing the ledger", async () => {
    const paper = structuredClone(publicTechnique("paper-chromatography.json"));
    const action = paper.actions.find((candidate) => candidate.id === "measure-choice-acetone-1-region-1");
    if (!action) throw new Error("Expected the repaired paper-chromatography action.");
    delete action.atomId;

    const result = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/paper-chromatography.json", paper),
    ]);

    expect(result.accepted).toBe(false);
    expect(result.blockingFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "bundled/atom-identity",
          sourceActionId: action.id,
          transition: "blocking",
        }),
      ]),
    );
  });

  it("keeps operational parameters in the repaired projection", async () => {
    const paper = structuredClone(publicTechnique("paper-chromatography.json"));
    const action = paper.actions.find((candidate) => candidate.id === "measure-choice-acetone-1-region-1");
    if (!action) throw new Error("Expected the repaired paper-chromatography action.");
    expect(action.atomId).toBe("atom.observe.measure-chromatography-distance");

    const baseline = await bundledCatalogSemanticFingerprint(projectionFinding(paper, action));
    const operational = structuredClone(action);
    operational.parameters = {
      ...operational.parameters,
      sampleIdentity: "f03-materially-different-sample",
    };
    expect(await bundledCatalogSemanticFingerprint(projectionFinding(paper, operational))).not.toBe(
      baseline,
    );

    const presentationOnly = structuredClone(action);
    presentationOnly.parameters = {
      ...presentationOnly.parameters,
      instruction: "A presentation-only wording revision.",
    };
    expect(await bundledCatalogSemanticFingerprint(projectionFinding(paper, presentationOnly))).toBe(
      baseline,
    );
  });

  it("does not treat boolean Note fields or scientific Note values as presentation-only", async () => {
    const paper = structuredClone(publicTechnique("paper-chromatography.json"));
    const action = paper.actions.find((candidate) => candidate.id === "measure-choice-acetone-1-region-1");
    if (!action) throw new Error("Expected the repaired paper-chromatography action.");
    expect(action.atomId).toBe("atom.observe.measure-chromatography-distance");

    const baseline = await bundledCatalogSemanticFingerprint(projectionFinding(paper, action));
    const mutations = [
      {
        field: "requiresStudentNote",
        parameters: { ...action.parameters, requiresStudentNote: true },
      },
      {
        field: "wavelengthNote",
        parameters: { ...action.parameters, wavelengthNote: "700 nm" },
      },
    ];
    for (const mutation of mutations) {
      const operational = structuredClone(action);
      operational.parameters = mutation.parameters;
      expect(
        await bundledCatalogSemanticFingerprint(projectionFinding(paper, operational)),
        `${mutation.field} must affect the semantic fingerprint`,
      ).not.toBe(baseline);
    }
  });

  it("requires the mass producer to dominate its consumer in process order", async () => {
    const marble = structuredClone(publicTechnique("marble-gas-syringe-kinetics.json"));
    // Use a real mass.source === "measurement" consumer. The F05-A brass delivery is intentionally
    // whole-solid plus continuity-qualified prerequisite evidence, not a mass-contract consumer,
    // so bypassing it cannot exercise this policy's producer-ordering branch.
    const consumer = marble.actions.find((candidate) => candidate.id === "gas-technique-transfer-marble");
    const consumerMass = consumer?.mass;
    if (!consumer || !consumerMass || consumerMass.source !== "measurement") {
      throw new Error("Expected the marble transfer to consume its measured mass.");
    }
    const producer = marble.actions.find(
      (candidate) =>
        candidate.mass?.source === "action-input" &&
        candidate.mass.outputMeasurementId === consumerMass.referenceId,
    );
    const producerNode = producer && marble.process.nodes.find((candidate) => candidate.actionId === producer.id);
    const consumerNode = marble.process.nodes.find((candidate) => candidate.actionId === consumer.id);
    if (!producer || !producerNode || !consumerNode) {
      throw new Error("Expected process nodes for the marble mass producer and consumer.");
    }
    const baseline = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/marble-gas-syringe-kinetics.json", marble),
    ]);
    expect(baseline.findings.filter(
      (finding) => finding.rule === "bundled/mass-producer" && finding.sourceActionId === consumer.id,
    )).toEqual([]);

    // Cloning the producer's predecessor onto the genuine consumer creates a process route that
    // bypasses the producer, which is exactly the dominance failure this rule must report.
    const edge = marble.process.edges.find((candidate) => candidate.to === producerNode.id);
    if (!edge) throw new Error("Expected an edge into the marble mass producer.");
    marble.process.edges.push({
      ...structuredClone(edge),
      to: consumerNode.id,
      label: "Incorrectly bypass the mass producer",
    });

    const result = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/marble-gas-syringe-kinetics.json", marble),
    ]);

    expect(result.accepted).toBe(false);
    expect(result.blockingFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "bundled/mass-producer",
          sourceActionId: consumer.id,
          transition: "blocking",
          relatedActionIds: [producer.id],
          detail: expect.stringContaining(`reachable without first completing producer "${producer.id}"`),
        }),
      ]),
    );
  });

  it("keeps the policy contract zero-capable when inventory mutation and a gram output coexist", async () => {
    const brass = structuredClone(publicTechnique("brass-spectrophotometry.json"));
    const action = brass.actions.find((candidate) => candidate.id === "weigh-brass-action");
    if (!action) throw new Error("Expected the brass mass-output action.");
    action.parameters = { ...action.parameters, inputMin: 0, inputMinExclusive: false };

    const result = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/brass-spectrophotometry.json", brass),
    ]);

    expect(result.findings.filter((finding) => finding.sourceActionId === action.id)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: "bundled/mass-output" })]),
    );
    expect(result.blockingFindings).toEqual([]);
  });

  it("rejects duplicate declared mass-output producers within one authoring scope", async () => {
    const brass = structuredClone(publicTechnique("brass-spectrophotometry.json"));
    const action = brass.actions.find((candidate) => candidate.id === "weigh-brass-action");
    if (!action) throw new Error("Expected the brass mass-output action.");
    brass.actions.push({ ...structuredClone(action), id: "f03-duplicate-brass-mass-output" });

    const result = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/brass-spectrophotometry.json", brass),
    ]);

    expect(result.accepted).toBe(false);
    expect(result.blockingFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "bundled/mass-output",
          sourceActionId: "weigh-brass-action",
          transition: "blocking",
        }),
      ]),
    );
  });

  it("allows only a structurally declared canonical and alias mass producer pair", async () => {
    const quickAche = publicTechnique("quick-ache-extraction-recovery.json");
    const baseline = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/quick-ache-extraction-recovery.json", quickAche),
    ]);
    expect(baseline.findings.filter((finding) =>
      ["bundled/mass-output", "bundled/mass-producer"].includes(finding.rule),
    )).toEqual([]);

    const withoutAliasProof = structuredClone(quickAche);
    const gravityGroup = orderedProcedureFor(withoutAliasProof).groups.find((group) => group.id === "acidic-gravity");
    if (!gravityGroup?.actionAliases) throw new Error("Expected the authored acidic-gravity alias map.");
    delete gravityGroup.actionAliases["qar-weigh-acidic-solid"];
    const rejected = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/quick-ache-extraction-recovery.json", withoutAliasProof),
    ]);
    expect(rejected.blockingFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "bundled/mass-output",
          sourceActionId: "qar-weigh-acidic-solid",
        }),
      ]),
    );
  });

  it("proves the current Quick canonical and gravity mass producers are exclusive materialized alternatives", async () => {
    const quickAche = publicTechnique("quick-ache-extraction-recovery.json");
    const quickAcheProcedure = orderedProcedureFor(quickAche);
    const acidicVacuum = quickAcheProcedure.groups.find((group) => group.id === "acidic-vacuum");
    const acidicGravity = quickAcheProcedure.groups.find((group) => group.id === "acidic-gravity");
    const canonical = actionById(quickAche, "qar-weigh-acidic-solid");
    const alias = actionById(quickAche, "plan-gravity-qar-weigh-acidic-solid");
    const canonicalMass = canonical.mass;
    const aliasMass = alias.mass;
    if (
      !acidicVacuum ||
      !acidicGravity?.actionAliases ||
      canonicalMass?.source !== "action-input" ||
      aliasMass?.source !== "action-input"
    ) {
      throw new Error("Expected the current Quick acidic alternatives and action-input mass contracts.");
    }

    expect(canonical.mass?.source).toBe("action-input");
    expect(alias.mass?.source).toBe("action-input");
    expect(canonicalMass.outputMeasurementId).toBe(aliasMass.outputMeasurementId);
    expect(acidicGravity.actionAliases[canonical.id]).toBe(alias.id);
    expect(acidicVacuum.actionIds).toContain(canonical.id);
    expect(acidicVacuum.actionIds).not.toContain(alias.id);
    expect(acidicGravity.actionIds).toContain(alias.id);
    expect(acidicGravity.actionIds).not.toContain(canonical.id);
    expect(acidicVacuum.family).toBe(acidicGravity.family);
    expect(quickAcheProcedure.requiredFamilies).toEqual(
      expect.arrayContaining([acidicVacuum.family, acidicGravity.family]),
    );
    expect(quickAcheProcedure.groups.filter((group) => group.family === acidicVacuum.family)).toHaveLength(2);

    const result = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/quick-ache-extraction-recovery.json", quickAche),
    ]);
    expect(result.findings.filter((finding) =>
      ["bundled/mass-output", "bundled/mass-producer"].includes(finding.rule),
    )).toEqual([]);
  });

  it("rejects duplicate producers when canonical and gravity groups could be selected together", async () => {
    const simultaneous = structuredClone(publicTechnique("quick-ache-extraction-recovery.json"));
    const gravityGroup = orderedProcedureFor(simultaneous).groups.find((group) => group.id === "acidic-gravity");
    if (!gravityGroup) throw new Error("Expected the authored acidic-gravity group.");
    gravityGroup.family = "gravity-acidic";

    const result = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/quick-ache-extraction-recovery.json", simultaneous),
    ]);
    expect(result.blockingFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "bundled/mass-output",
          sourceActionId: "qar-weigh-acidic-solid",
          transition: "blocking",
        }),
      ]),
    );
  });

  it("rejects an ambiguous third producer for a shared mass output", async () => {
    const ambiguous = structuredClone(publicTechnique("quick-ache-extraction-recovery.json"));
    const third = actionById(ambiguous, "plan-gravity-qar-weigh-acidic-watch-glass-tare");
    if (!third.mass || third.mass.source !== "action-input") throw new Error("Expected the third Quick action-input mass producer.");
    third.mass = { ...third.mass, outputMeasurementId: "qar-recovered-acidic-component-mass" };

    const result = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/quick-ache-extraction-recovery.json", ambiguous),
    ]);
    expect(result.blockingFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "bundled/mass-output",
          sourceActionId: "qar-weigh-acidic-solid",
          transition: "blocking",
        }),
      ]),
    );
  });

  it("rejects alias chains and cycles instead of treating them as producer alternatives", async () => {
    for (const mutation of [
      (technique: TechniqueDefinition) => {
        const group = orderedProcedureFor(technique).groups.find((candidate) => candidate.id === "acidic-gravity");
        if (!group?.actionAliases) throw new Error("Expected the authored acidic-gravity alias map.");
        group.actionAliases["plan-gravity-qar-weigh-acidic-solid"] = "plan-gravity-qar-weigh-acidic-watch-glass-tare";
      },
      (technique: TechniqueDefinition) => {
        const group = orderedProcedureFor(technique).groups.find((candidate) => candidate.id === "acidic-gravity");
        if (!group?.actionAliases) throw new Error("Expected the authored acidic-gravity alias map.");
        group.actionAliases["plan-gravity-qar-weigh-acidic-solid"] = "qar-weigh-acidic-solid";
      },
    ]) {
      const chained = structuredClone(publicTechnique("quick-ache-extraction-recovery.json"));
      mutation(chained);
      const result = await evaluateBundledCatalogPolicy([
        bundledTechniqueSurface("public-bundle", "public/techniques/quick-ache-extraction-recovery.json", chained),
      ]);
      expect(result.blockingFindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: "bundled/mass-output",
            sourceActionId: "qar-weigh-acidic-solid",
            transition: "blocking",
          }),
        ]),
      );
    }
  });

  it("rejects a mass consumer placed before its selected canonical producer", async () => {
    const wrongOrder = structuredClone(publicTechnique("quick-ache-extraction-recovery.json"));
    const source = actionById(wrongOrder, "qar-decant-filtrate-to-beaker");
    const consumer = structuredClone(source);
    consumer.id = "f05-acidic-mass-consumer-before-producer";
    consumer.mass = { source: "measurement", referenceId: "qar-recovered-acidic-component-mass" };
    wrongOrder.actions.push(consumer);
    const sourceNode = wrongOrder.process.nodes.find((node) => node.actionId === source.id);
    if (!sourceNode) throw new Error("Expected a Quick process node for the synthetic consumer.");
    wrongOrder.process.nodes.push({ ...structuredClone(sourceNode), id: `${consumer.id}-node`, actionId: consumer.id });
    const acidicVacuum = orderedProcedureFor(wrongOrder).groups.find((group) => group.id === "acidic-vacuum");
    if (!acidicVacuum) throw new Error("Expected the authored acidic-vacuum group.");
    acidicVacuum.actionIds.unshift(consumer.id);

    const result = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/quick-ache-extraction-recovery.json", wrongOrder),
    ]);
    expect(result.blockingFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "bundled/mass-producer",
          sourceActionId: consumer.id,
          transition: "blocking",
          relatedActionIds: expect.arrayContaining([
            "qar-weigh-acidic-solid",
            "plan-gravity-qar-weigh-acidic-solid",
          ]),
          detail: expect.stringContaining("within materialized group \"acidic-vacuum\""),
        }),
      ]),
    );
  });

  it("rejects an end consumer when its producer family is optional", async () => {
    const optionalFamily = structuredClone(publicTechnique("quick-ache-extraction-recovery.json"));
    const endConsumer = structuredClone(actionById(optionalFamily, "qar-record-dry-component-masses"));
    endConsumer.id = "f05-optional-acidic-end-consumer";
    endConsumer.mass = { source: "measurement", referenceId: "qar-recovered-acidic-component-mass" };
    optionalFamily.actions.push(endConsumer);
    const plan = orderedProcedureFor(optionalFamily);
    plan.requiredFamilies = ["organic"];
    plan.endActionIds.push(endConsumer.id);

    const result = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/quick-ache-extraction-recovery.json", optionalFamily),
    ]);
    expect(result.blockingFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "bundled/mass-producer",
          sourceActionId: endConsumer.id,
          transition: "blocking",
          detail: expect.stringContaining("no unavoidable selected producer family"),
        }),
      ]),
    );
  });

  it("rejects a shared consumer with only requiresEarlier and no producer-selection guarantee", async () => {
    const omittedProducer = structuredClone(publicTechnique("quick-ache-extraction-recovery.json"));
    const sharedConsumer = structuredClone(actionById(omittedProducer, "qar-record-dry-component-masses"));
    sharedConsumer.id = "f05-requires-earlier-only-consumer";
    sharedConsumer.mass = { source: "measurement", referenceId: "qar-recovered-acidic-component-mass" };
    omittedProducer.actions.push(sharedConsumer);
    const plan = orderedProcedureFor(omittedProducer);
    const organicGroup = plan.groups.find((group) => group.id === "organic");
    if (!organicGroup) throw new Error("Expected the Quick organic group.");
    plan.requiredFamilies = ["organic"];
    organicGroup.requiresEarlier = ["acidic-vacuum"];
    organicGroup.actionIds.push(sharedConsumer.id);

    const result = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/quick-ache-extraction-recovery.json", omittedProducer),
    ]);
    expect(result.blockingFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "bundled/mass-producer",
          sourceActionId: sharedConsumer.id,
          transition: "blocking",
          detail: expect.stringContaining("no unavoidable selected producer family/group"),
        }),
      ]),
    );
  });

  it("rejects an ordering path that crosses an omitted intermediate group", async () => {
    const omittedIntermediate = structuredClone(publicTechnique("quick-ache-extraction-recovery.json"));
    const sharedConsumer = structuredClone(actionById(omittedIntermediate, "qar-record-dry-component-masses"));
    sharedConsumer.id = "f05-omitted-intermediate-consumer";
    sharedConsumer.mass = { source: "measurement", referenceId: "qar-recovered-acidic-component-mass" };
    const intermediateAction = structuredClone(actionById(omittedIntermediate, "qar-record-dry-component-masses"));
    intermediateAction.id = "f05-optional-order-intermediate-action";
    omittedIntermediate.actions.push(sharedConsumer, intermediateAction);
    const plan = orderedProcedureFor(omittedIntermediate);
    const organicGroup = plan.groups.find((group) => group.id === "organic");
    if (!organicGroup) throw new Error("Expected the Quick organic group.");
    plan.requiredFamilies = ["organic"];
    organicGroup.requiresSelected = ["acidic-vacuum"];
    organicGroup.requiresEarlier = ["f05-optional-order-intermediate"];
    organicGroup.actionIds.push(sharedConsumer.id);
    plan.groups.push({
      id: "f05-optional-order-intermediate",
      actionIds: [intermediateAction.id],
      family: "optional-intermediate",
      requiresEarlier: ["acidic-vacuum"],
      testCount: 0,
      evidenceKind: "procedure",
    });

    const result = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface("public-bundle", "public/techniques/quick-ache-extraction-recovery.json", omittedIntermediate),
    ]);
    expect(result.blockingFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "bundled/mass-producer",
          sourceActionId: sharedConsumer.id,
          transition: "blocking",
          detail: expect.stringContaining("does not require it earlier"),
        }),
      ]),
    );
  });

  it("derives observe effects from reducer handler precedence instead of the generic notebook handler", () => {
    const handWarmer = publicTechnique("hand-warmer-calorimetry.json");
    const quickAche = publicTechnique("quick-ache-extraction-recovery.json");
    const thermalDecomposition = publicTechnique("thermal-decomposition-mass-loss.json");
    const stirrer = deriveActionEffectContract(actionById(handWarmer, "P1-13"));
    const timer = deriveActionEffectContract(actionById(handWarmer, "P2-M13"));
    const temperature = deriveActionEffectContract(actionById(handWarmer, "P1-26"));
    const visualState = structuredClone(actionById(handWarmer, "P1-13"));
    visualState.id = "f03-observed-visual-state";
    visualState.parameters = {
      visualStateTargetInstanceId: "f03-observed-vessel",
      observedVisualState: "settled-two-layer",
    };
    const typedExtractionObservation = structuredClone(actionById(quickAche, "qar-inspect-separated-layers"));
    typedExtractionObservation.parameters = {
      ...typedExtractionObservation.parameters,
      controlType: "stirrer",
    };
    const typedFractionHandling = structuredClone(actionById(thermalDecomposition, "recover-replicate-product"));
    typedFractionHandling.parameters = {
      ...typedFractionHandling.parameters,
      controlType: "stirrer",
    };
    const precedence = structuredClone(actionById(handWarmer, "P1-13"));
    precedence.id = "f03-observe-precedence";
    precedence.parameters = {
      controlType: "stirrer",
      waitSeconds: 15,
      temperatureEvidenceKind: "timed",
      visualStateTargetInstanceId: "f03-observed-vessel",
      observedVisualState: "settled-two-layer",
    };

    expect(stirrer.contract?.classes).toEqual([
      "apparatus-material-instrument-state",
      "evidence-recording",
    ]);
    expect(timer.contract?.classes).toEqual([
      "apparatus-material-instrument-state",
      "evidence-recording",
    ]);
    expect(temperature.errors).toEqual([]);
    expect(temperature.contract?.classes).toEqual([
      "measurement-direct-observation-acquisition",
      "evidence-recording",
    ]);
    expect(temperature.contract?.classes).not.toContain("apparatus-material-instrument-state");
    expect(deriveActionEffectContract(visualState).contract?.classes).toEqual([
      "apparatus-material-instrument-state",
      "evidence-recording",
    ]);
    expect(deriveActionEffectContract(precedence).contract?.classes).toEqual([
      "apparatus-material-instrument-state",
      "evidence-recording",
    ]);
    expect(deriveActionEffectContract(typedExtractionObservation).contract?.classes).toEqual([
      "measurement-direct-observation-acquisition",
      "evidence-recording",
    ]);
    expect(deriveActionEffectContract(typedFractionHandling).contract?.classes).toEqual([
      "apparatus-material-instrument-state",
    ]);
  });

  it("keeps notebook-only observation eligible, rejects default atomless reset, and rejects an atom below its handler ceiling", async () => {
    const handWarmer = publicTechnique("hand-warmer-calorimetry.json");
    const notebookOnly = structuredClone(actionById(handWarmer, "P1-13"));
    notebookOnly.id = "f03-notebook-only-observation";
    delete notebookOnly.atomId;
    notebookOnly.parameters = { note: "A notebook-only observation." };
    const notebookTechnique = structuredClone(handWarmer);
    notebookTechnique.actions = [notebookOnly];
    const notebookResult = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface(
        "public-bundle",
        "fixture://f03-notebook-only-observation.json",
        notebookTechnique,
      ),
    ]);
    expect(deriveActionEffectContract(notebookOnly).contract?.classes).toEqual(["evidence-recording"]);
    expect(notebookResult.findings).toEqual([]);

    const reset = structuredClone(notebookOnly);
    reset.id = "f03-default-reset-without-atom";
    reset.verb = "reset";
    reset.interaction = undefined;
    const resetTechnique = structuredClone(notebookTechnique);
    resetTechnique.actions = [reset];
    const resetResult = await evaluateBundledCatalogPolicy([
      bundledTechniqueSurface(
        "public-bundle",
        "fixture://f03-default-reset-without-atom.json",
        resetTechnique,
      ),
    ]);
    expect(resetResult.blockingFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: "bundled/atom-identity", sourceActionId: reset.id }),
    ]));

    const belowCeiling = structuredClone(actionById(handWarmer, "P1-26"));
    belowCeiling.id = "f03-temperature-handler-below-atom-ceiling";
    belowCeiling.atomId = "atom.observe.mark-chromatography-baseline";
    expect(deriveActionEffectContract(belowCeiling).errors).toEqual(expect.arrayContaining([
      expect.stringContaining('derives effect class "measurement-direct-observation-acquisition"'),
    ]));
  });
});

describe("the canonical projection sees solid-transfer semantics", () => {
  // This is a literal copy of the immutable pre-Opus action at
  // public/techniques/thermal-decomposition-mass-loss.json:662-723. The source file's verified
  // original SHA-256 is 59276aeb9ed3191f65871cd7bfa0db841166034825867e4212548e8371a88301.
  // Provenance stays beside the frozen fixture; it is deliberately not added to the semantic input.
  const PRE_CONTRACT_SOURCE_PROVENANCE = {
    path: "public/techniques/thermal-decomposition-mass-loss.json",
    lines: "662-723",
    sha256: "59276aeb9ed3191f65871cd7bfa0db841166034825867e4212548e8371a88301",
  } as const;
  const PRE_CONTRACT_OWNER = {
    kind: "technique" as const,
    id: "thermal-decomposition-mass-loss",
    version: "1.1.0",
    artifact: PRE_CONTRACT_SOURCE_PROVENANCE.path,
  } as const;
  const CURRENT_OWNER = {
    ...PRE_CONTRACT_OWNER,
    version: "2.0.0",
  } as const;
  const PRE_CONTRACT_RECOVER_UNUSED_SAMPLE_ACTION: TechniqueDefinition["actions"][number] = {
    id: "recover-unused-sample",
    verb: "transfer",
    label: "Recover unused unheated mixture",
    equipmentRoleBindings: {
      "solid-reagent-source": "sample-bottle",
      "recovery-vessel": "beaker-250ml",
    },
    parameters: {
      sourceDefinitionId: "sample-bottle",
      targetDefinitionId: "beaker-250ml",
      targetInstanceId: "unused-sample-recovery-1",
      requiredDestination: "unused",
      preserveUnheatedIdentity: true,
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "sample-bottle",
      targetDefinitionId: "beaker-250ml",
      accessibleLabel: "Recover unused unheated mixture",
      successCue: "Recover unused unheated mixture complete.",
      invalidCue: "Review the approved sequence before recover unused unheated mixture.",
    },
    prerequisites: [{
      id: "recover-unused-sample-prerequisite",
      type: "actionEvidence",
      label: "Record the loaded crucible and lid mass is complete.",
      actionId: "record-initial-crucible-mass",
    }],
    stateChanges: [
      "Recover unused unheated mixture: route state and evidence advance only after validation.",
    ],
    invalidCases: [
      {
        id: "wrong-order",
        when: "the route requests this operation before its compiled prerequisite",
        message: "That operation is out of sequence for the approved method.",
        recovery: "Return to the highlighted prerequisite and preserve the current evidence.",
      },
      {
        id: "teacher-approval-required",
        when: "physical execution is requested before the inquiry plan is approved",
        message: "Physical execution is locked until the teacher approves the plan and safety controls.",
        recovery: "Complete the plan, configuration, PPE, and report assignment before approval.",
      },
      {
        id: "same-balance-required",
        when: "a mass is requested from a different balance than the baseline balance",
        message: "Every mass in the run must use the same balance.",
        recovery: "Return to the balance locked by the empty-crucible reading or restart the run.",
      },
    ],
    feedback: {
      success: "Recover unused unheated mixture complete.",
      invalid: "Review the approved sequence before recover unused unheated mixture.",
    },
    evidence: ["transfer", "recovery", "provenance"],
  };

  /**
   * The projection decides what "the same action" means for a recorded fingerprint, so it has two
   * obligations that pull against each other. It must notice a defined solid-transfer contract,
   * because a destination that receives a physical mass and one that receives a provenance record
   * are not the same operation. And it must stay invisible when no contract is declared, or every
   * fingerprint recorded before the field existed would silently stop matching.
   */
  const finding = (
    action: TechniqueDefinition["actions"][number],
    owner: BundledCatalogOwner = CURRENT_OWNER,
  ) => ({
    rule: "bundled/atom-identity" as const,
    authority: "public-bundle" as const,
    owner,
    sourceActionId: action.id,
    detail: `projection sensitivity fixture from ${PRE_CONTRACT_SOURCE_PROVENANCE.path}:${PRE_CONTRACT_SOURCE_PROVENANCE.lines} (${PRE_CONTRACT_SOURCE_PROVENANCE.sha256})`,
    action,
  });

  it("keeps the immutable pre-contract action compatible with its frozen fingerprint", async () => {
    expect(await bundledCatalogSemanticFingerprint(
      finding(PRE_CONTRACT_RECOVER_UNUSED_SAMPLE_ACTION, PRE_CONTRACT_OWNER),
    )).toBe(
      "79a503a59cd1d056c64664ebe39f1fde9a02290592ea09103d84dd7bb2c6b90d",
    );
  });

  it("distinguishes a physical destination from a qualitative one", async () => {
    const thermal = publicTechnique("thermal-decomposition-mass-loss.json");
    const physical = structuredClone(actionById(thermal, "recover-unused-sample"));
    const qualitative = structuredClone(physical);
    qualitative.solidTransfer = {
      mode: "whole-remaining",
      destinationRepresentation: "qualitative-unknown",
      requireNonEmptySource: true,
    };
    expect(await bundledCatalogSemanticFingerprint(finding(physical, CURRENT_OWNER))).not.toBe(
      await bundledCatalogSemanticFingerprint(finding(qualitative, CURRENT_OWNER)),
    );

    const stripped = structuredClone(physical);
    delete stripped.solidTransfer;
    expect(await bundledCatalogSemanticFingerprint(finding(physical, CURRENT_OWNER))).not.toBe(
      await bundledCatalogSemanticFingerprint(finding(stripped, CURRENT_OWNER)),
    );
  });
});
