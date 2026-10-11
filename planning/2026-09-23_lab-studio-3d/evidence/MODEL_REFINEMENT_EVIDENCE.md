# Model refinement: evidence (2026-10-10)

Your request: "Implement the plan here: …NEXT_THREAD_PROMPT.md" (review the 36 equipment models, propose, then
build what you decide). Then, during the build: "Critically review your work for fidelity and refine where
needed."

The review, the proposal, your decisions and the fidelity review of the build are in
`proposals/MODEL_REFINEMENT.md`. This note lists what was built, what it measured, the checks, the looks, and
what was not run or not seen.

## What was built

Everything in the ranked table except V2, as you chose:

- **L1, tessellation by tolerance** (`labeq/geometry.py`).
  - `segments_for(radius, asked, tol=0.03)`: a lathe uses the fewest segments, a multiple of 8 and at least 16,
    that keep the chord within 0.03 mm of the true circle. It never uses more than the module asks for.
    `tol=0` keeps the module's count, which the pump's knurled wheel needs.
  - `rounded()` samples each fillet about every 0.25 mm of arc, with 2 to 8 intervals.
- **L2, the thumbnail studio** (`labeq/render.py`, `build_equipment3d.py`).
  - A mid-grey cove (grey 0.24, wash 70), so clear glass and white plastic show their edges.
  - An upright item more than 8× as tall as it is wide leans 38° in its thumbnail only: the 10 mL pipette,
    the Beral pipette, the stirring rod and the test tube.
- **L3, real holes**: `cut()`, an exact boolean in the module, with the cut mesh's material slots cleared. Also
  `cylinder_mesh()`.
- **L4, the helical thread**: `helix_thread_mesh()`, right-handed, with cosine run-out ends.
- **L5, composite states**: `apply_states()`. Composites show each state group's default, or a state named in
  `COMPOSITE_STATES`: the burner under the ring burns blue with its collar open. The bounds ignore hidden
  objects.
- **L6, shared helpers**:
  - `pull_spout()` moved to `labeq.geometry`, used by both beakers and both cylinders;
  - `graduation_scale()` moved to `equipment/_scales.py`, used by both cylinders and the 10 mL pipette.
- **V1, the print ghost** (`src/studio3d/bench/look/materials.ts`).
  - The `print` role and the bottles' `Frosted marking spot` are drawn as transparent (still fully opaque).
    That keeps them out of the buffer that transmissive glass samples, so each is drawn once, after the glass.
  - Pipe clay, which shares the `frosted` role, is excluded: it is a solid part.
- **M1, the spectrophotometer**:
  - a dark plinth under the housing, standing in for its hidden feet;
  - side walls drafted 1.5°;
  - a dark compartment block with a real 30 mm well cut into it, its five faces dark;
  - a hinged lid with a finger tab, raised 100° on a hinge barrel;
  - a raised display bezel around a blank glass face;
  - a key field with eight raised keys.

  The well anchor, the display centre, normal and size, and the 320 × 300 mm footprint are unchanged.
- **M2, the test-tube rack**: four real holes in the upper plate, and 2 mm wells in a thicker lower plate. The
  seats are unchanged.
- **M3, the crucible tongs**: two 7 × 2.4 mm strips riveted face to face, swept along smoothed paths. The pair is
  still 4.8 mm high, and the jaw tips still meet 2.4 mm up.
- **M4, the threads**:
  - the three GL bottles have a two-turn helix, 3 to 11 mm below the lip at 4 mm pitch (3.5 mm on the 125 mL
    bottle);
  - the small vial has a 400-series finish of 1.25 turns at 3.2 mm, with thick glass only at its lip and floor.
- **M5, the minor pass**:
  - the cuvette is one moulded body with rounded edges and a bore, frosted on its two side faces;
  - the balance has four feet, a door handle on each draft-shield door, and a level bubble;
  - the pipette pump has a knurled thumbwheel with 30 grooves and a release lever;
  - the burner has a domed base.

The five fidelity refinements (the pipe-clay exclusion, the tongs strips, the vial finish, the GL thread span
and the drafted panels) are described in `MODEL_REFINEMENT.md`.

Order of work:
1. A full build of all 36 with `--review --composites`.
2. The six models touched by the fidelity refinements rebuilt the same way: the spectrophotometer, the tongs,
   the vial and the three bottles.
3. All 36 packed.

The 30 other models were not changed after the full build.

## Size

Packed GLB bytes, against `HEAD` before the work (`d13146b`):

| Model | Bytes before | Bytes after | Change | Triangles before | Triangles after |
|---|---:|---:|---:|---:|---:|
| bunsen-burner | 161,812 | 130,384 | −19% | 25,016 | 18,984 |
| wash-bottle | 239,980 | 118,488 | −51% | 43,631 | 18,895 |
| sample-bottle-1l | 226,120 | 114,924 | −49% | 41,601 | 17,845 |
| reagent-bottle | 241,920 | 100,660 | −58% | 44,793 | 15,041 |
| crucible-with-lid | 134,260 | 97,564 | −27% | 20,928 | 14,208 |
| erlenmeyer-flask-250ml | 149,732 | 96,192 | −36% | 26,723 | 15,475 |
| volumetric-flask | 223,068 | 95,372 | −57% | 41,701 | 14,597 |
| analytical-balance (instrument) | 59,052 | 91,744 | +55% | 5,615 | 8,679 |
| sample-bottle | 239,672 | 90,796 | −62% | 44,517 | 13,485 |
| graduated-cylinder | 145,164 | 82,836 | −43% | 22,388 | 10,292 |
| drying-oven (instrument) | 72,048 | 72,296 | 0% | 6,510 | 6,510 |
| beaker-250ml | 132,336 | 72,044 | −46% | 22,115 | 10,243 |
| funnel-stand | 124,792 | 67,076 | −46% | 19,884 | 8,380 |
| watch-glass | 109,076 | 62,428 | −43% | 20,800 | 10,560 |
| beaker-150ml | 121,140 | 57,436 | −53% | 20,501 | 7,973 |
| filter-paper | 62,208 | 56,980 | −8% | 10,080 | 9,144 |
| pipette-pump | 56,432 | 51,276 | −9% | 8,928 | 7,340 |
| graduated-cylinder-25ml | 108,240 | 50,628 | −53% | 16,837 | 5,893 |
| small-vial | 150,808 | 43,176 | −71% | 27,648 | 5,888 |
| clay-triangle | 44,512 | 40,976 | −8% | 3,996 | 3,420 |
| beral-pipette | 75,688 | 39,920 | −47% | 12,800 | 5,840 |
| ring-stand | 45,272 | 39,728 | −12% | 5,804 | 4,780 |
| graduated-pipette-10ml | 51,948 | 39,016 | −25% | 7,028 | 4,436 |
| crucible-tongs | 10,368 | 36,132 | +248% | 568 | 3,928 |
| spectrophotometer (instrument) | 20,292 | 34,540 | +70% | 1,126 | 1,974 |
| funnel | 80,928 | 30,692 | −62% | 14,080 | 3,600 |
| lab-sink | 27,028 | 26,432 | −2% | 2,616 | 2,520 |
| test-tube | 46,748 | 24,312 | −48% | 7,680 | 3,280 |
| weigh-boat | 28,392 | 24,008 | −15% | 3,952 | 3,224 |
| test-tube-rack (scenery) | 12,492 | 20,740 | +66% | 584 | 1,758 |
| spatula | 26,620 | 15,924 | −40% | 3,672 | 1,576 |
| scoopula | 11,056 | 11,072 | 0% | 1,204 | 1,204 |
| rubber-stopper-set | 15,872 | 10,548 | −34% | 2,304 | 1,280 |
| stirring-rod | 10,648 | 8,736 | −18% | 1,152 | 864 |
| cuvette | 9,852 | 5,680 | −42% | 220 | 204 |
| heat-safe-pad | 3,432 | 3,432 | 0% | 108 | 108 |
| **All 36** | **3,279,008** | **1,964,188** | **−40%** | **539,110** | **263,428** |

- **By pack:**
  - Pack 1: 2,138,696 → 1,161,968 bytes (−46%).
  - Pack 2: 1,983,832 → 1,306,504 (−34%).
- **Against the proposal.** It estimated about −45% in bytes. The measured −40% includes what M1–M5 added: about
  81 KB over the balance, tongs, spectrophotometer and rack.
- **Largest models now:**
  - the bunsen burner, 52% of the item budget;
  - the analytical balance, 15% of the instrument budget.

  No bottle or flask is above 48% of the item budget.
- **Pack 3.** Its 19 reused models and the rack's scenery go from 2,120,232 to 1,222,176 bytes. That leaves about
  2.78 MB of its 4 MB, or about 163 KB for each of its 17 new models, where there was about 110 KB.

## What the runtime reads

- **The registry.** `src/studio3d/equipment3d/registry.json` differs from `HEAD` in the 36 `provenance.sourceHash`
  lines only. No footprint, fill profile, graduation, anchor, display, grip, pour or state value moved.
- **The bounds.** 34 models are within 0.05 mm of `HEAD`, including the spectrophotometer: its top is at
  170.02 mm against 170.00, from the raised lid. Two moved more:
  - the tongs: min `[-115.23, -21.47, -0.8]` and max `[116.8, 21.47, 5.6]`, against `[-115.16, -21.38, -0.8]` and
    `[116.23, 21.38, 5.6]`. That is at most 0.57 mm, at the jaw tip's square end. Their height (`grip`) and tip
    height (`tipMm`) are unchanged.
  - the pipette pump: 0.07 mm narrower in y (±13.43 against ±13.5).
- **Material names.** No material was added or renamed. `viewerMaterials.json` is unchanged.
- **Probes.** Because no runtime registry value changed, no per-technique probe or per-technique G1 look was
  rerun.

## Checks

| Check | Result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | exit 0 (run after the last edit to `materials.ts`) |
| `npm run content:check` | 22 violations, the recorded baseline (`baseline: 22 new, 0 changed fingerprint`) |
| `node scripts/practice3d/build.mjs --check` | exit 0 |
| `py tools/blender/validate_equipment3d.py --pack 1` | PASS, 20 definitions, 0 failures, models 1,161,968 bytes |
| `py tools/blender/validate_equipment3d.py --pack 2` | PASS, 22 definitions, 0 failures, models 1,306,504 bytes |
| `npx vitest run --config vite.config.ts src/studio3d/__tests__/equipment3dRegistry.test.ts` | 1 file, 4 tests passed |
| Registry diff against `HEAD` | only the 36 source hashes |
| Bounds diff against `HEAD` | as above |

The rest of the 3D vitest suite was intentionally not run: you chose "Registry test only".

## Looks

**Review renders (Blender, full quality):**
- all 36 models, from the full build, and the six refined models again after their rebuild;
- every composite, including the cuvette seated in the real well (`composite-spectrophotometer-with-cuvette`),
  the tube through a real rack hole, the burner burning blue under the ring, and the crucible with one lid;
- thumbnails on the grey cove, legible for clear glass. The four leaning items now fill their tiles.

**G1 in the app's own `BenchEngine`.** Headless Chromium with SwiftShader, at the high tier, two yaw views each,
with no console errors. 27 models were looked at:
- the 17 changed by M1–M5, L6 and V1: the spectrophotometer, rack, tongs, cuvette, balance, pump, burner, clay
  triangle, vial, the three bottles, both beakers, both cylinders and the 10 mL pipette;
- 10 more rebuilt by L1 alone: the Erlenmeyer flask, volumetric flask, wash bottle, funnel, watch glass, test
  tube, Beral pipette, crucible, funnel stand and filter paper.

What the looks showed:

- **The print ghost is gone.** At HEAD, the 150 mL beaker read "1100" with doubled ticks and a smeared "150 mL".
  Now each tick, the "100" and the "150 mL" show once. The Erlenmeyer flask's doubled graduations are single too
  (`renders/MR_print_ghost.jpg`).
- **The new geometry reads at bench distance:**
  - the spectrophotometer's raised lid, bezel and keys;
  - the rack's holes and wells;
  - the tongs' flat strips;
  - the pump's lever;
  - the bottles' and the vial's threads;
  - the cuvette's edges, which show better than before.
- **Pipe clay** stays solid (the clay triangle).
- **New: a glare on the GL bottles' shoulders.**
  - *What shows.* At the high tier, the 125 mL and 1 L bottles now show bloomed highlights of the ceiling lights
    on their shoulders, which the HEAD models did not. The reagent bottle's shallower shoulder shows none.
  - *What was ruled out.* HEAD's GLB loaded into today's viewer shows no glare, so the viewer change (V1) is not
    the cause. The normals at the shoulder are identical, vertex for vertex. Hiding the new thread or the thick
    lip leaves the glare; hiding the body removes it.
  - *The cause.* Reversing the body's triangle order in the page removes the glare, and the new model then looks
    like the old one (`renders/MR_bottle_draw_order.jpg`).
    - Glass is drawn with depth writing off (plan §6.2), so within one mesh the triangle drawn last wins each
      pixel.
    - gltfpack orders triangles for the GPU cache, so which surface wins is arbitrary and differs from build to
      build.
    - In the new order, the near outer surface, with its real reflection of the lights, is drawn after the far
      inner surface. Before, the far surface overwrote it.
  - *Assessment.* The new look is the more physical of the two, but neither is controlled. It is recorded for the
    polish pass (`MODEL_REFINEMENT.md`, UI issues) and left unfixed, because you chose to fix the print ghost
    only in the viewer.

**The room look.** `look-room.cjs` was run at low, balanced and high: Dilute a Stock Solution, with four items
placed from the tray. All four items loaded at each tier, with no console errors, and the bench reads as before.

The tray tiles are fixed at the source (`renders/MR_tray_before_after.jpg`). At HEAD, the 10 mL pipette's tile and
the water pipette's tile were blank white. Now each pipette leans across a grey tile, and the clear beaker's rim
and floor read.

Images in `renders/`:
- `MR_print_ghost.jpg`: the beaker graduations, HEAD on the left, now on the right.
- `MR_refined_review_1.jpg`, `MR_refined_review_2.jpg`: review renders of the six refined models and of the
  cuvette composite.
- `MR_bottle_draw_order.jpg`: the 125 mL bottle as built, then with its thread, its thick lip and its body
  hidden, and with the body's triangles reversed.
- `MR_tray_before_after.jpg`: the tray at HEAD and now.

## Not run or not seen

- G3, the per-technique looks and the probes. G3 waits for you, and no registry value moved.
- The low and balanced tiers for the single-model looks. Only the room look covers all three tiers.
- Examine close-ups in the player's own Examine view. The model looks frame each model through `BenchEngine`
  directly.
- The hover labels and the beacon (UI polish).
- Pack 3's own models, which are not built.
- V2, edge legibility for clear plastic and thin glass, which was not chosen.
