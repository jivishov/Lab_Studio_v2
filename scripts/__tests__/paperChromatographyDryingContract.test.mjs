import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { refinePaperChromatographyDefinition } from "../generatorInputs/simulator/paperChromatography.mjs";

/**
 * The post-development drying step of Investigation 5.
 *
 * `public/techniques/paper-chromatography.json` is generator output: the seed lives in
 * `scripts/generatorInputs/simulator/paperChromatography.mjs` and a refiner runs over it. A repair
 * applied only to the published JSON is undone by the next regeneration, which is exactly how the
 * two drifted apart before -- the refiner overwrote each trial's drying tag with one shared
 * approval tag that nothing consumed. These cases therefore assert the published file, the refiner
 * output and the consumer contract together.
 *
 * Source position, stated once so no case has to re-argue it: the Investigation 5 chapter
 * (`ap-chem-lab-manual-student-inv-5.pdf`, printed 47-53) contains no drying instruction of any
 * kind -- the string "dry" does not occur in it -- and no drying device appears in its materials
 * table. Drying the marked strip before measuring it is practical handling (R), like the
 * pre-development spot dry the same technique already models plainly, and the runtime enforces its
 * physical ordering. It is not a teacher-authored method, and nothing here claims one.
 *
 * Not executed under the AGENTS.md repository validation policy.
 */

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const read = (relative) => JSON.parse(readFileSync(join(root, relative), "utf8"));

const DRY_ATOM = "atom.observe.dry-developed-chromatography-paper";
const SPOT_ATOM = "atom.observe.dry-chromatography-spot";
const GATE_KEYS = [
  "configurationRequired",
  "unlocked",
  "inputMode",
  "inputRole",
  "inputKey",
  "inputLabel",
  "inputRequired",
  "sourceAuthorityStatus",
];

/**
 * Which paper this step is bound to. The trial identity is taken from the equipment binding, never
 * from the action id or from the tag: an inventory derived from the thing under test cannot
 * disagree with it.
 */
const paperOf = (action) => action.parameters?.sourceInstanceId;

/**
 * The dry-evidence consumers, identified by what they *do* rather than by what they ask for.
 *
 * This is the point the first version of this file got wrong: it collected consumers by looking for
 * prerequisites whose tag was already a known producer tag, so a misspelled or cross-trial
 * prerequisite simply dropped out of the inventory and the file reported nothing. Filtering on a
 * `-chromatogram-dry` suffix instead has the same hole -- a typo can lose the suffix too.
 *
 * Two roles in this technique read a dried chromatogram, and both are recognisable without reading
 * a tag:
 *   - the ruler readings, which carry the typed measurement atom; and
 *   - the band identification that precedes them, which carries the `overlapPolicy` rule.
 * The drying process nodes are a third location, recognised by the action they validate.
 */
const dryEvidenceConsumers = (technique) => technique.actions.filter((action) =>
  action.atomId === "atom.observe.measure-chromatography-distance" ||
  action.parameters?.overlapPolicy !== undefined);

const dryingActionsOf = (technique) => technique.actions.filter((action) => action.atomId === DRY_ATOM);

/**
 * Every problem in the dry-evidence binding, as plain strings so the mutation cases below can
 * assert on them. Deliberately narrow: it inspects the drying producers, the two consumer roles
 * above and the drying nodes, and nothing else. It is not a second content validator.
 */
const dryEvidenceProblems = (technique, lab) => {
  const problems = [];
  const drying = dryingActionsOf(technique);

  // Producers, indexed by the paper they dry.
  const producerByPaper = new Map();
  for (const action of drying) {
    const paper = paperOf(action);
    if (typeof paper !== "string" || paper.length === 0) {
      problems.push(`${action.id}: drying step names no paper instance`);
      continue;
    }
    if (producerByPaper.has(paper)) {
      problems.push(`${paper}: dried by both ${producerByPaper.get(paper).id} and ${action.id}`);
      continue;
    }
    producerByPaper.set(paper, action);
  }
  const producerTags = new Set();
  for (const [paper, action] of producerByPaper) {
    const tag = action.parameters?.tag;
    if (typeof tag !== "string" || tag.length === 0) {
      problems.push(`${action.id}: writes no notebook tag`);
      continue;
    }
    if (producerTags.has(tag)) problems.push(`${action.id}: writes shared dry tag ${tag}`);
    producerTags.add(tag);
    // A shape assertion, not the identity used for matching: the runtime matches by tag, and the
    // authored convention is the trial's own name. A producer that broke the convention while all
    // its consumers followed it would already be caught by the consumer loop below.
    if (tag !== `${paper.replace(/-paper$/, "")}-chromatogram-dry`) {
      problems.push(`${action.id}: dry tag ${tag} does not name paper ${paper}`);
    }
  }

  // Everything any action or node in this technique writes, plus the lab-level tags the technique
  // legitimately reads across the composition boundary. Used to tell an orphaned prerequisite
  // (nothing writes it) from a cross-trial one (the wrong trial writes it).
  const writtenTags = new Set();
  for (const action of technique.actions) {
    if (typeof action.parameters?.tag === "string") writtenTags.add(action.parameters.tag);
  }
  for (const action of lab.actions ?? []) {
    if (typeof action.parameters?.tag === "string") writtenTags.add(action.parameters.tag);
  }

  for (const consumer of dryEvidenceConsumers(technique)) {
    const paper = paperOf(consumer);
    const producer = typeof paper === "string" ? producerByPaper.get(paper) : undefined;
    if (!producer) {
      problems.push(`${consumer.id}: reads a dried chromatogram but names no dried paper (${String(paper)})`);
      continue;
    }
    const expected = producer.parameters?.tag;
    const notebookRules = (consumer.prerequisites ?? []).filter((rule) => rule.type === "notebookEntry");
    const tags = notebookRules.map((rule) => rule.notebookTag);
    if (!tags.includes(expected)) {
      problems.push(`${consumer.id}: does not require ${expected} (requires ${tags.join(", ") || "nothing"})`);
    }
    for (const rule of notebookRules) {
      const tag = rule.notebookTag;
      if (typeof tag !== "string" || tag.length === 0) {
        problems.push(`${consumer.id}/${rule.id}: notebook rule names no tag`);
        continue;
      }
      // Orphan: nothing in the technique or the lab writes this tag, whatever it is spelled like.
      if (!writtenTags.has(tag)) {
        problems.push(`${consumer.id}/${rule.id}: requires orphaned tag ${tag}`);
        continue;
      }
      // Cross-trial: a dry tag that belongs to a different paper than this consumer's.
      if (producerTags.has(tag) && tag !== expected) {
        problems.push(`${consumer.id}/${rule.id}: requires ${tag}, which belongs to another trial`);
      }
    }
  }

  const byId = new Map(technique.actions.map((action) => [action.id, action]));
  for (const node of technique.process.nodes) {
    const producer = node.actionId === undefined ? undefined : byId.get(node.actionId);
    if (!producer || producer.atomId !== DRY_ATOM) continue;
    for (const rule of node.validation ?? []) {
      if (rule.type !== "notebookEntry") continue;
      if (rule.notebookTag !== producer.parameters?.tag) {
        problems.push(`${node.id}/${rule.id}: validates ${rule.notebookTag}, not ${producer.parameters?.tag}`);
      }
    }
  }

  return problems;
};

describe("paper chromatography post-development drying contract", () => {
  const technique = read("public/techniques/paper-chromatography.json");
  const lab = read("public/labs/paper-chromatography.json");
  const dryingActions = dryingActionsOf(technique);

  it("writes one trial-specific dry tag per trial and carries no drying approval field", () => {
    // Membership is derived, not pinned: one post-development dry per paper that also gets a
    // pre-development spot dry. (Both are 17 in the reviewed snapshot; a new trial must move both
    // together rather than trip a quota.)
    const spotActions = technique.actions.filter((action) => action.atomId === SPOT_ATOM);
    expect(dryingActions.length).toBeGreaterThan(0);
    expect(dryingActions.length).toBe(spotActions.length);
    expect(new Set(dryingActions.map(paperOf)).size).toBe(dryingActions.length);

    for (const action of dryingActions) {
      expect(action.parameters.chromatographyOperation).toBe("dryDevelopedPaper");
      expect(action.parameters.tag).toBe(`${String(paperOf(action)).replace(/-paper$/, "")}-chromatogram-dry`);
      for (const key of GATE_KEYS) {
        expect(action.parameters, `${action.id}.${key}`).not.toHaveProperty(key);
      }
      const caseIds = action.invalidCases.map((entry) => entry.id);
      expect(caseIds, action.id).not.toContain("missing-post-development-drying-method-approval");
      expect(caseIds, action.id).not.toContain("empty-post-development-drying-method-approval");
      // The physical warning the trial actually depends on is kept.
      expect(caseIds, action.id).toContain("front-not-marked");
      expect(action.stateChanges.join(" ")).not.toMatch(/approval|approved/i);
      // The step stays an ambient, untimed observation: no interval, no device, no method.
      expect(action.parameters).not.toHaveProperty("dryingIntervalMin");
      expect(action.parameters).not.toHaveProperty("postDevelopmentDryingMethod");
    }
    expect(new Set(dryingActions.map((action) => action.parameters.tag)).size).toBe(dryingActions.length);
    // No consumer anywhere still waits on the retired approval tag.
    expect(JSON.stringify(technique)).not.toContain("post-development-drying-method-approved");
  });

  it("binds every dry-evidence consumer to its own trial's producer", () => {
    const consumers = dryEvidenceConsumers(technique);
    // Before the repair all producers wrote one shared approval tag, so every one of these
    // prerequisites named a tag nothing wrote: no trial's measurements could be taken.
    expect(consumers.length).toBeGreaterThan(dryingActions.length);
    expect(dryEvidenceProblems(technique, lab)).toEqual([]);
  });

  it("reports an orphaned dry prerequisite even when the tag no longer looks like one", () => {
    const mutated = structuredClone(technique);
    const consumer = dryEvidenceConsumers(mutated).find((action) => paperOf(action) === "water-paper");
    const rule = consumer.prerequisites.find((candidate) => candidate.notebookTag === "water-chromatogram-dry");
    // A typo that also loses the suffix: the inventory must still contain this consumer, because it
    // was collected by role rather than by the shape of the tag it happens to carry.
    rule.notebookTag = "water-chromatogam-dr";
    const problems = dryEvidenceProblems(mutated, lab);
    expect(problems).toEqual(expect.arrayContaining([
      expect.stringContaining("does not require water-chromatogram-dry"),
      expect.stringContaining("requires orphaned tag water-chromatogam-dr"),
    ]));
  });

  it("reports a dry prerequisite borrowed from another trial", () => {
    const mutated = structuredClone(technique);
    const consumer = dryEvidenceConsumers(mutated).find((action) => paperOf(action) === "water-paper");
    const rule = consumer.prerequisites.find((candidate) => candidate.notebookTag === "water-chromatogram-dry");
    rule.notebookTag = "propanol-chromatogram-dry";
    const problems = dryEvidenceProblems(mutated, lab);
    expect(problems).toEqual(expect.arrayContaining([
      expect.stringContaining("which belongs to another trial"),
    ]));
  });

  it("reports a drying node that validates the wrong trial's evidence", () => {
    const mutated = structuredClone(technique);
    const node = mutated.process.nodes.find((candidate) => candidate.id === "dry-water-chromatogram-node");
    node.validation[0].notebookTag = "propanol-chromatogram-dry";
    expect(dryEvidenceProblems(mutated, lab)).toEqual(expect.arrayContaining([
      expect.stringContaining("dry-water-chromatogram-node"),
    ]));
  });

  it("leaves the pre-development spot dry untouched as the pattern it follows", () => {
    const spotActions = technique.actions.filter((action) => action.atomId === SPOT_ATOM);
    expect(spotActions.length).toBeGreaterThan(0);
    for (const action of spotActions) {
      expect(action.parameters.chromatographyOperation).toBe("drySpot");
      expect(action.parameters.tag).toBe(`${String(paperOf(action)).replace(/-paper$/, "")}-spot-dry`);
      expect(action.parameters).not.toHaveProperty("configurationRequired");
    }
  });

  it("keeps the lab-level procedure approval reachable from inside the trial instance", () => {
    const producers = lab.actions.filter((action) => action.parameters?.tag === "procedure-approved");
    expect(producers.map((action) => action.id)).toEqual(["submit-procedure-approval"]);

    const instances = lab.techniqueInstances.filter((instance) => instance.techniqueId === "paper-chromatography");
    expect(instances).toHaveLength(1);
    // Addressed by identity, not by position: a later instance added ahead of this one must not
    // silently move the repair onto a different technique.
    expect(instances[0].instanceId).toBe("chromatography-trials");
    // Without this entry the compiler prefixes the technique's prerequisite to
    // `chromatography-trials--procedure-approved`, while the writer is a lab-level action outside
    // that scope -- a gate nothing can satisfy.
    expect(instances[0].preserveIds.references["procedure-approved"]).toBe("procedure-approved");

    const gated = technique.actions.filter((action) =>
      (action.prerequisites ?? []).some((rule) => rule.notebookTag === "procedure-approved"),
    );
    expect(gated.length).toBeGreaterThan(0);
    // The overall procedure gate stays: this repair makes it satisfiable, it does not remove it.
    expect(gated.map((action) => action.id)).toEqual(expect.arrayContaining([
      "place-water-chamber",
      "place-propanol-chamber",
      "place-metric-ruler",
    ]));
  });

  it("regenerates the drying actions and stays idempotent under repeated refinement", () => {
    const refined = refinePaperChromatographyDefinition({ id: "paper-chromatography" });
    const refinedDrying = refined.actions.filter((action) => action.atomId === DRY_ATOM);
    // Limit of this comparison, stated plainly: it compares the drying actions and two absent
    // strings. It does not claim the generator reproduces the whole published file byte for byte,
    // and it does not run the generator pipeline that writes `public/`.
    expect(refinedDrying).toEqual(dryingActions);

    // The refiner rebuilds from the embedded seed on every call rather than mutating its argument,
    // so re-running it cannot accumulate duplicate stateChanges or invalidCases. Asserting it here
    // keeps that property from being lost if the refiner ever starts editing the passed definition.
    expect(refinePaperChromatographyDefinition(refined)).toEqual(refined);
    expect(JSON.stringify(refined)).not.toContain("post-development-drying-method-approved");
    expect(JSON.stringify(refined)).not.toContain("sourceAuthorityStatus");
  });
});

/**
 * The chamber-closure contract, asserted against the shipped content rather than a fixture.
 *
 * Investigation 5, printed page 49, requires the container to be sealed during development, and the
 * derived plan separates the three operations that used to be one action: TR-06 insert, TR-07 close
 * the lid, TR-08 let the solvent rise. These cases check that every authored trial family carries
 * all three in that order — the two built-in solvents and the fifteen selectable classroom-dataset
 * trials alike — and that the published file and the maintained generator input still agree.
 *
 * What these cases do not do: they read content. Whether the runtime refuses an open chamber is a
 * reducer question, covered in `src/runtime/__tests__/cycle10Separation.test.ts`. Neither file is
 * executed under the AGENTS.md repository validation policy.
 */
describe("paper chromatography chamber closure contract", () => {
  const technique = read("public/techniques/paper-chromatography.json");
  const lab = read("public/labs/paper-chromatography.json");
  const byId = new Map(technique.actions.map((action) => [action.id, action]));
  const developActions = technique.actions.filter((action) => action.verb === "developChromatogram");
  const trials = developActions.map((action) => action.id.slice("develop-".length, -"-paper".length));

  it("gives every authored trial its own insertion, closing and reopening", () => {
    // Derived from the develop actions rather than pinned to 17: a new trial has to bring the whole
    // set with it instead of tripping a quota.
    expect(trials.length).toBeGreaterThan(0);
    expect(new Set(trials).size).toBe(trials.length);

    for (const trial of trials) {
      const develop = byId.get(`develop-${trial}-paper`);
      const insert = byId.get(`insert-${trial}-paper`);
      const close = byId.get(`close-${trial}-chamber`);
      const open = byId.get(`open-${trial}-chamber`);
      expect(insert, trial).toBeTruthy();
      expect(close, trial).toBeTruthy();
      expect(open, trial).toBeTruthy();

      // The develop action declares that it needs a sealed chamber. The runtime reads that as a
      // requirement on state, which is only satisfiable because insertion happens separately.
      expect(develop.parameters.chamberSealed, trial).toBe(true);

      // Insertion names the same strip and the same chamber as the development it precedes.
      expect(insert.parameters.sourceInstanceId, trial).toBe(develop.parameters.sourceInstanceId);
      expect(insert.parameters.targetInstanceId, trial).toBe(develop.parameters.targetInstanceId);
      expect(insert.parameters.snapZoneId, trial).toBe(develop.parameters.snapZoneId);
      expect(insert.interaction.type, trial).toBe("snapIntoTarget");
      expect(insert.atomId, trial).toBe("atom.place.insert-strip-into-chamber");

      // Closure is an operation on the chamber instance, not a sentence about it.
      for (const [action, operation, atomId] of [
        [close, "closeChamber", "atom.observe.close-developing-chamber"],
        [open, "openChamber", "atom.observe.open-developing-chamber"],
      ]) {
        expect(action.parameters.chamberOperation, action.id).toBe(operation);
        expect(action.parameters.targetInstanceId, action.id).toBe(develop.parameters.targetInstanceId);
        expect(action.parameters.targetDefinitionId, action.id).toBe("chromatography-chamber");
        expect(action.atomId, action.id).toBe(atomId);
        expect(action.equipmentRoleBindings["developing-chamber"], action.id).toBe("chromatography-chamber");
        expect(action.verb, action.id).toBe("observe");
        expect(action.interaction.type, action.id).toBe("recordNotebook");
      }
      expect(close.parameters.tag, trial).toBe(`${trial}-chamber-closed`);
      expect(open.parameters.tag, trial).toBe(`${trial}-chamber-opened`);
    }
  });

  it("orders the handling so the lid is off to load and on to develop", () => {
    const nodeIndex = new Map(technique.process.nodes.map((node, index) => [node.id, index]));
    const edges = new Set(technique.process.edges.map((edge) => `${edge.from}->${edge.to}`));

    for (const trial of trials) {
      const chain = [
        `dry-${trial}-spot-node`,
        `insert-${trial}-paper-node`,
        `close-${trial}-chamber-node`,
        `develop-${trial}-paper-node`,
        `open-${trial}-chamber-node`,
        `remove-${trial}-paper-node`,
      ];
      for (const id of chain) expect(nodeIndex.has(id), `${trial}/${id}`).toBe(true);
      for (let index = 1; index < chain.length; index += 1) {
        expect(nodeIndex.get(chain[index]), `${trial} order`).toBe(nodeIndex.get(chain[index - 1]) + 1);
        expect(edges.has(`${chain[index - 1]}->${chain[index]}`), `${trial} edge ${index}`).toBe(true);
      }
      // The collapsed edges are gone: development no longer follows the spot dry directly, and
      // removal no longer follows development directly.
      expect(edges.has(`dry-${trial}-spot-node->develop-${trial}-paper-node`)).toBe(false);
      expect(edges.has(`develop-${trial}-paper-node->remove-${trial}-paper-node`)).toBe(false);

      // Prerequisites follow the same chronology, so a route that skipped a step would also fail
      // its evidence check rather than relying on the reducer alone.
      const requires = (actionId, requiredActionId) =>
        (byId.get(actionId).prerequisites ?? []).some((rule) => rule.actionId === requiredActionId);
      expect(requires(`close-${trial}-chamber`, `insert-${trial}-paper`), trial).toBe(true);
      expect(requires(`develop-${trial}-paper`, `close-${trial}-chamber`), trial).toBe(true);
      expect(requires(`open-${trial}-chamber`, `develop-${trial}-paper`), trial).toBe(true);
      expect(requires(`remove-${trial}-paper`, `open-${trial}-chamber`), trial).toBe(true);
      expect(requires(`remove-${trial}-paper`, `develop-${trial}-paper`), trial).toBe(false);
    }
  });

  it("carries the new operations in the ordered procedure the compiled lab walks", () => {
    // `materializeOrderedProcedure` rebuilds the process from these group lists, so a trial missing
    // from them would compile without its lid steps however correct the canonical process looked.
    const groups = technique.composition.orderedProcedure.groups;
    for (const trial of trials) {
      const group = groups.find((candidate) => candidate.actionIds.includes(`develop-${trial}-paper`));
      expect(group, trial).toBeTruthy();
      const sequence = [
        `dry-${trial}-spot`,
        `insert-${trial}-paper`,
        `close-${trial}-chamber`,
        `develop-${trial}-paper`,
        `open-${trial}-chamber`,
        `remove-${trial}-paper`,
      ].map((id) => group.actionIds.indexOf(id));
      expect(sequence.includes(-1), trial).toBe(false);
      expect(sequence, trial).toEqual([...sequence].sort((left, right) => left - right));
      expect(sequence[5] - sequence[0], trial).toBe(5);
    }
  });

  it("describes development as development, on a chamber already loaded and sealed", () => {
    // The split left the three operations correct and the learner-facing description of the middle
    // one untouched: the node still said "Insert, seal, and develop …" and told the learner to
    // suspend the paper and close the lid — two steps they had just completed — while the action
    // carried a snapIntoTarget the player renders as "Drag the chromatography paper onto the
    // chromatography chamber", through a closed lid. Both are content, so both are asserted here.
    const nodeById = new Map(technique.process.nodes.map((node) => [node.id, node]));

    for (const trial of trials) {
      const develop = byId.get(`develop-${trial}-paper`);
      const node = nodeById.get(`develop-${trial}-paper-node`);
      expect(node, trial).toBeTruthy();

      // One description of the step: the node is derived from the action rather than restating it.
      expect(node.title, trial).toBe(develop.label);
      expect(node.description, trial).toBe(develop.parameters.instruction);
      expect(node.feedback.success, trial).toBe(`${develop.label} complete.`);
      expect(node.feedback.retry, trial).toBe(develop.feedback.invalid);
      expect(node.hints, trial).toEqual([develop.feedback.invalid]);
      const evidence = node.validation.find(
        (rule) => rule.type === "actionEvidence" && rule.actionId === develop.id,
      );
      expect(evidence, trial).toBeTruthy();
      expect(evidence.label, trial).toBe(`${develop.label} was completed.`);

      // Nothing in the step asks for the insertion or the closing a second time.
      const learnerText = [
        node.title,
        node.description,
        node.feedback.success,
        node.feedback.retry,
        ...node.hints,
        ...node.validation.map((rule) => rule.label),
        develop.label,
        develop.parameters.instruction,
        develop.interaction.accessibleLabel,
      ].join(" ");
      expect(learnerText, trial).not.toMatch(/insert[,\s]/i);
      expect(learnerText, trial).not.toMatch(/\bseal the\b|\bclose the lid\b|\bsuspend the\b/i);

      // Development moves nothing, so it takes the same process-control endpoint as the lid steps
      // rather than a drag of the strip into a chamber the strip is already inside.
      expect(develop.interaction.type, trial).toBe("recordNotebook");
      expect(develop.interaction.sourceDefinitionId, trial).toBeUndefined();
      expect(develop.interaction.targetDefinitionId, trial).toBeUndefined();

      // The reducer still resolves the same apparatus, because the ids never lived on the
      // interaction.
      expect(develop.parameters.sourceInstanceId, trial).toBeTruthy();
      expect(develop.parameters.targetInstanceId, trial).toBeTruthy();
    }
  });

  it("authors the open lid every chamber starts and resets with", () => {
    // Absence used to carry two meanings at once — "this apparatus has no lid" and "this lid has
    // not been closed yet" — and the bench caption and accessible name both read it as the first,
    // so an untouched chamber announced no state at all and drew itself sealed. A chamber that
    // models a lid now says which way it starts. `createRuntimeState` rebuilds contents from here,
    // so this is also what full and physical reset restore.
    const chamberIds = new Set(
      trials.map((trial) => byId.get(`develop-${trial}-paper`).parameters.targetInstanceId),
    );
    expect(chamberIds.size).toBe(trials.length);

    for (const [label, definition] of [["technique", technique], ["lab", lab]]) {
      const chambers = definition.initialState.equipment.filter(
        (item) => item.definitionId === "chromatography-chamber",
      );
      expect(chambers.length, label).toBe(trials.length);
      for (const chamber of chambers) {
        expect(chamber.contents.developingChamberClosed, `${label}/${chamber.id}`).toBe(false);
      }
      // Only apparatus that models a lid declares one.
      for (const item of definition.initialState.equipment) {
        if (item.definitionId === "chromatography-chamber") continue;
        expect(item.contents.developingChamberClosed, `${label}/${item.id}`).toBeUndefined();
      }
    }
  });

  it("keeps every technique id preserved across the lab composition boundary", () => {
    const instance = lab.techniqueInstances.find((candidate) => candidate.techniqueId === "paper-chromatography");
    for (const action of technique.actions) {
      expect(instance.preserveIds.actions[action.id], action.id).toBe(action.id);
    }
    for (const node of technique.process.nodes) {
      expect(instance.preserveIds.nodes[node.id], node.id).toBe(node.id);
    }
  });

  it("regenerates the chamber operations from the maintained generator input", () => {
    const refined = refinePaperChromatographyDefinition({ id: "paper-chromatography" });
    // Scope of this comparison: the published file and the generator input are the same bytes for
    // this technique. It still does not run the generator pipeline that writes `public/`.
    expect(JSON.stringify(refined, null, 2) + "\n").toBe(
      readFileSync(join(root, "public/techniques/paper-chromatography.json"), "utf8"),
    );
    expect(refinePaperChromatographyDefinition(refined)).toEqual(refined);
  });
});
