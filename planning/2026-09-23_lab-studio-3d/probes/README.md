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
| `probe-d8-compile.mts <labId> [instance=practiceId]` | A bundled lab through the loader's seam (`compileBundledLabCompositionWithPolicy`): the compiled manifest, the step order and the bench; optionally one instance swapped for its practice version, to show why it does not compose (D8 brief) |
| `probe-d8-twins.mts` | D8 option (iv): the 3D `intro-filtration-demo` composed from twins (the Pack 2 practice versions marked `composable`) and Pack 1's measuring-volume, with mechanically derived bindings, compiled with the policy and played through the runtime. Env: `PROBE_INPUTS` and `PROBE_MOVES` by compiled action id (`filtration--weigh-paper`), `PROBE_TITLES`, and `PROBE_ROUND`, a probe-only workaround for the `filterInPortions` defect it found (it did not get past it; fixed on 2026-10-10, and since then the probe plays all 31 steps without it) |
| `probe-lab3d.mts [labId] ['{"field":"value"}']` | D8 E3, the successor of `probe-d8-twins.mts`: a generated 3D lab from `public/labs-3d/` with its setup defaults (or the JSON's values) applied as the setup page applies them, compiled with the 3D resolver's order (a twin listed in `public/techniques-3d/twins.json`, else `public/techniques/`) through the loader's seam, and played through the runtime. A drop-to-the-line step plays the drops it needs plus `PROBE_DROPS_OFF` (default 0; 2026-10-10: ±3 is accepted, ±5 refused), then accepts; with `PROBE_DRAW_BACK` (drops' worth, at a `markDrawBack` step) it then draws that much back up into the pipette and accepts again (+10 and 10 back is accepted; at most 40 drops per request, so split larger runs). The typed inputs default to the setup's sample volume (`measuring-volume--read-volume`) and paper mass. It lists any `{{config.*}}` the compiler left in step text (the 3D loader fills it, `fillStepText`). Env: `PROBE_INPUTS`, `PROBE_MOVES` (compiled action ids), `PROBE_TITLES`, `PROBE_DROPS_OFF` and `PROBE_DRAW_BACK`; no workaround |

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
| `look-lab3d.cjs <prefix>` | D8 E3: the 3D experiment `intro-filtration-demo` at `#/3d/play/…`: the intro by part, the setup page with the approved defaults, and the whole run of 33 steps (since 2026-10-10 part 1 is the Measure Liquid Volume twin, in the 25 mL cylinder: pour, the sample pipette, twenty-eight drops at eye level, "At the line" refused, eight drops' worth drawn back by taps, the last shot three times in quick succession to catch the tip in the liquid (SwiftShader's slow frames can miss it), "At the line", a typed reading), logging the step card's part eyebrow and the notebook rows with their chips before and after the reading (`openLook` takes the route as its fourth argument; `__setup` fills a lab's fields too). `LOOK_PART1_ONLY=1` stops after part 1 |
| `run-weighing-mouse.cjs <prefix>` | Weigh a Solid with real mouse events on the microarray controller (adoption P3): tray clicks, a right-click put-back, the seat stroke, TARE, the spatula's dip and tip, double-click Examine; items are found by sweeping the pointer and reading the hover label |
