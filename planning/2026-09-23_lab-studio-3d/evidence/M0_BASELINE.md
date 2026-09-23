# M0 evidence: core baseline reconciliation (plan D1)

Date: 2026-09-23. Branch `claude/lab-studio-3d`, created from `1d28429b14b5d6c02ec48048ae1a2ef84dee6a6a`.

## What was compared

| Line | Location | State |
|---|---|---|
| GitHub main | `jivishov/Lab_Studio_v2` `origin/main` | `1d28429`. Re-fetched on 2026-09-23 and unchanged; it is the plan's snapshot. |
| Authoritative working copy | `C:\Users\EmilJivishov\Projects\Lab_studio`: the Projects repository, branch `codex/Lab_Studio`, HEAD `c32ba48` | 116 modified tracked paths and 34 untracked paths. The plan's inventory recorded 115 modified. |

The method was a content comparison with CR stripped (`tr -d '\r' | sha1sum`) and `git diff --no-index --ignore-cr-at-eol`. Nothing in the working copy was modified.

## Plan §2.8 files

| File | Working copy vs main | Finding |
|---|---|---|
| `src/runtime/interactionIntents.ts` | identical | The uncommitted edits already equal main. The committed `c32ba48` differs. |
| `src/runtime/actionInputs.ts` | identical | as above |
| `src/runtime/attachments.ts` | identical | as above |
| `src/domain/types.ts` | identical | as above |
| `src/equipment/composites.ts` | identical | as above |
| `src/equipment/visualCatalog.ts` | identical | as above |
| `src/equipment/visualStateRegistry.json` | identical | as above |
| `src/player/EquipmentView.tsx` | identical | as above |
| `src/player/contentDisplay.ts` | identical | as above |
| `src/data/techniqueHosts.ts` | identical | Untracked in the working copy; committed on main |
| `src/runtime/reducer.ts` | main has 74 more lines, the working copy 6 | Main is newer. It adds three things: `mergeContents` keeps chamber closure owned by the receiving vessel; `dilute` records final-volume measurement evidence when `volume.outputMeasurementId` is set; and there is a new `acidBaseMolarityFromEquivalenceVolume` calculation. The working copy's 6 lines are the older forms of the same lines. |
| `src/domain/validation.ts` | 2 lines | Main is newer: it also allows `outputMeasurementId` on `dilute`. |
| `src/domain/equipmentRoleRegistry.json` | small | Main is newer: it adds the 2 L distilled-water stock variant. |
| `src/domain/atomRegistry.ts` | main has 42 more lines | Main is newer: typed chromatogram development and the dilute final-volume atom rules. |
| `src/domain/atomRegistry.json` | mixed | Main is newer: it migrates the marble content examples from lab to technique and sets chromatogram development to `recordNotebook`. |
| `src/equipment/catalog.ts` | main has 10 more lines | Main is newer: per-variant stock capacity and accessible names. |
| `src/equipment/stockBottleVariants.json` | 1 line | Main is newer: `distilled-water-bottle-2l`. Untracked in the working copy. |
| `src/studio/studioState.ts` | 1 line | Main is newer: `appendTechniqueToDraft` keeps a start node. |
| `src/studio/TeacherStudio.tsx` | main has 86 more lines, the working copy 29 | Main is newer: configure-before-append (`workflowConfiguration`). The working copy still appends without configuring. |
| `src/App.tsx` | main has 25 more lines | Main is newer: build identity bar and stricter setup gating for lab routes. |
| `src/data/techniqueConfiguration.ts` | main has 285 more lines, the working copy 100 | **Main is newer. The working copy lacks `standaloneTechniqueConfigurationBlocker`, `compositionTechniqueConfigurationBlocker`, `supportsStandaloneTechniqueConfiguration` and `applyTechniqueConfigurationForComposition`.** The plan's §2.6 inventory and the `measuring-volume` host-bound rule were evaluated with those functions. Untracked in the working copy. |
| `src/player/TechniqueSetupForm.tsx` | main has 180 more lines, the working copy 104 | Main is newer: the `TeacherSetupLayout` pattern. Untracked in the working copy. |
| `public/techniques/transmittance-dilution.json` and `scripts/generatorInputs/simulator/transmittanceDilution.mjs` | main has about 126 more lines | Main is newer. The working copy still has the older "Dilute and mix to the configured final volume" (`atom.dilute.to-final-volume`) shape. The content and its generator agree with each other on both lines. |

## The whole working copy

- 138 dirty paths are files that exist on both lines: 89 are content-identical to main and 49 differ.
- In the 49 that differ, main carries the larger or newer side each time, for example the audits, source-trace registry, tests and generator inputs.
- The one intentional difference is `AGENTS.md`: main carries the export repository's authority header.
- Present only in the working copy: `completion-nokia.wav`, a planning handoff note, and untracked working folders (`Demo_2_5/`, `local-builds/`, `v2/`, planning evidence, and this plan folder). None of them is core source.

## Decision

The core baseline is main `1d28429`, as is. No per-file merge is needed, and the working copy remains untouched. Parity checks in M8 ("Pack 1 JSON and its generator against the reconciled baseline") compare against `1d28429`.

## Static checks on the baseline

- `npx tsc -b` on untouched `1d28429`: **exit 0**. It uses TypeScript 7.0.2, with `node_modules` copied from the main-derived `tmp/item3-human-test-20260918/checkout`: three 0.184.0, `@xyflow/react` 12.11.6, React 19.3.0.

## Correction to plan §2.8

The plan says the runtime seam differs between the two lines. That holds for the committed `c32ba48`. It does not hold for the working copy as it stands, whose uncommitted edits already match main for the seam files. That observation is what the decision above rests on.
