# Probes (narrow static checks used during the build)

These are not tests and are not part of any suite. They load the real core modules through the
TypeScript composition loader and print what the runtime, validation or catalogue policy does,
so a content or core change can be checked without running the test suite. They import by the
absolute worktree path (`file:///C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d/`),
so they run only in this worktree on this machine.

Run any `.mts` probe from the worktree root:

```bash
node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs planning/2026-09-23_lab-studio-3d/probes/<file>.mts
```

| File | What it checks |
|---|---|
| `validate-weighing.mts` | Weigh a Solid's teacher-prepared values: 32 checks (setup, five steps, roles, Studio workflows) |
| `validate-transmittance.mts` | transmittance-dilution's settings, literal volumes, %T and generator byte parity: 28 checks |
| `probe-catalog-policy.mts` | The bundled-catalogue policy (as the loader applies it) on all five Pack 1 techniques |
| `probe-dilution.mts` | Dilute a Stock Solution through the runtime: the whole run, an overshoot, an early "at the line", plus validation, the composition contract, the evidence audit and the policy |
| `probe-making-solution.mts` | Make a Solution through the runtime: the whole run with the flask's contents after every step, an overshoot at the mark, the setup rules, validation, the composition contract, the derived effects, the evidence audit and the policy |
| `probe-transmittance-steps.mts` | transmittance-dilution step by step through the Confirm path, printing attachments and volumes (`node … probe-transmittance-steps.mts 28`) |
| `probe-making-solution-baseline.mts` | Make a Solution and the old dilution as they behaved before atomization (the reagent bottle starts empty; "dissolve" creates the solute) |
| `probe-derived-effects.mts` | The handler-derived effect of transmittance-dilution's atomless actions (what `legacyActionEffects` must match) |
| `probe-practice.mts <id> '<config json>' [watch ids]` | A Pack 2 practice version through the runtime by the process control, with validation, the composition contract, derived effects, the evidence audit and the policy. Env: `PROBE_INPUTS` (action id → entry), `PROBE_MOVES` (action id → items moved to the bench first), `PROBE_DUMP` (an item to print), `PROBE_DIR` (another folder, such as `public/techniques`) |
| `probe-hosts-and-slots.mts` | Standalone blockers, host labs and setup slots of measuring-volume, making-solution and dilution |

`look-dilution.cjs` is the one-look visual spot check (G1) used when the app's browser pane could
not draw (a hidden pane stops animation frames). It drives Dilute a Stock Solution through the
real page in headless Chromium with SwiftShader and saves screenshots. It needs the dev server on
port 5182 and Playwright from `Lab_studio/node_modules`:

```bash
NODE_PATH="C:/Users/EmilJivishov/Projects/Lab_studio/node_modules" node planning/2026-09-23_lab-studio-3d/probes/look-dilution.cjs <output-prefix>
```

It sets the player's graphics preference to Low (SwiftShader frames are slow) and waits after
pours, which block carries until they finish drawing.

Two more headless scripts, run the same way (dev server on 5182, `NODE_PATH` as above):

| File | What it does |
|---|---|
| `look-room.cjs <prefix> [low balanced high]` | Dilute a Stock Solution under the microarray room and look: one screenshot per tier, then Whole bench and Overhead (adoption P1, P2) |
| `look-making-solution.cjs <prefix>` | Make a Solution's 14 steps by keyboard carries and the step card, with frames of the tip and the boat's rinse, the half-full flask, the swirl, the mark, the inversion and the results; a carry is retried while a committed animation is still drawn |
| `look-transfer.cjs`, `look-precipitation.cjs`, `look-filtration.cjs`, `look-drying.cjs`, `look-heat.cjs` `<prefix>` | Pack 2's practice versions, one G1 look each, by keyboard carries and the step card (helpers in `look-common.cjs`); the drying and heating clocks take minutes under SwiftShader |
| `run-weighing-mouse.cjs <prefix>` | Weigh a Solid with real mouse events on the microarray controller (adoption P3): tray clicks, a right-click put-back, the seat stroke, TARE, the spatula's dip and tip, double-click Examine; items are found by sweeping the pointer and reading the hover label |
