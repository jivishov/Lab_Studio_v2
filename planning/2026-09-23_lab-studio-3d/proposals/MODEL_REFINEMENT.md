# The 3D equipment models: review and refinement proposal (2026-10-10)

Stage 1 (review) and Stage 2 (proposal) of `NEXT_THREAD_PROMPT.md`. Nothing here is built yet.

## How the models were looked at

- **Cycles.** A fresh `--review --composites` set of all 36 models and the twelve composites, at preview
  samples (enough to judge shape and material), written to the scratchpad by a wrapper around
  `build_equipment3d.py` that redirects its output. Nothing under `public/` was written. The renders on disk in
  `tools/blender/.build/review/` were up to a day older than eight modules, so they were not used.
- **In the app.** Each model alone on the bench, at the High tier (the default), from the front and turned 35°,
  drawn by the app's own `BenchEngine` with its room, lighting and `materials.ts`: a scratch headless look
  (SwiftShader) that imports the engine and the registry from the dev server. Also `look-room.cjs … high`.
  The tiers change pixel ratio, MSAA, shadows and texture size, never a model material, so High stands for all
  three. Low has no MSAA, so thin lines (graduations, rods, wires) alias there.
- **Source.** `labeq/` (geometry, materials, markings, render, export), the four helpers (`_bottles`, `_fits`,
  `_scales`, `_stand`), the build, pack and validate scripts, and every module's build function.
- **A measurement.** A scratch build of all 36 models, with lathes tessellated to a chord tolerance and fillets
  sampled by their size (L1 below), to measure what that saves and whether any bound moves.

The facts in the brief were checked: 36 models, 41 Python files, Pack 1 2,138,696 bytes over 20 definitions
and Pack 2 1,983,832 over 22, both validators pass, and Pack 3 lists the 17 definitions with no model.

## Size against budget (packed GLB, now)

Budgets: 250 KB an item, 600 KB an instrument, about 4 MB a pack.

| Model | Bytes | Triangles | Share of budget | After L1 (measured triangles) |
|---|---:|---:|---:|---:|
| reagent-bottle | 241,920 | 44,793 | 97% | 16,617 (−63%) |
| wash-bottle | 239,980 | 43,631 | 96% | 18,895 (−57%) |
| sample-bottle | 239,672 | 44,517 | 96% | 14,709 (−67%) |
| sample-bottle-1l | 226,120 | 41,601 | 90% | 19,245 (−54%) |
| volumetric-flask | 223,068 | 41,701 | 89% | 14,597 (−65%) |
| bunsen-burner | 161,812 | 25,016 | 65% | 18,408 (−26%) |
| small-vial | 150,808 | 27,648 | 60% | 6,144 (−78%) |
| erlenmeyer-flask-250ml | 149,732 | 26,723 | 60% | 15,475 (−42%) |
| graduated-cylinder | 145,164 | 22,388 | 58% | 10,292 (−54%) |
| crucible-with-lid | 134,260 | 20,928 | 54% | 14,208 (−32%) |
| beaker-250ml | 132,336 | 22,115 | 53% | 10,243 (−54%) |
| funnel-stand | 124,792 | 19,884 | 50% | 8,380 (−58%) |
| beaker-150ml | 121,140 | 20,501 | 48% | 7,973 (−61%) |
| watch-glass | 109,076 | 20,800 | 44% | 10,560 (−49%) |
| graduated-cylinder-25ml | 108,240 | 16,837 | 43% | 5,893 (−65%) |
| funnel | 80,928 | 14,080 | 32% | 3,600 (−74%) |
| beral-pipette | 75,688 | 12,800 | 30% | 5,840 (−54%) |
| drying-oven (instrument) | 72,048 | 6,510 | 12% | unchanged |
| filter-paper | 62,208 | 10,080 | 25% | 9,152 (−9%) |
| analytical-balance (instrument) | 59,052 | 5,615 | 10% | 3,919 (−30%) |
| pipette-pump | 56,432 | 8,928 | 23% | 4,992 (−44%) |
| graduated-pipette-10ml | 51,948 | 7,028 | 21% | 4,436 (−37%) |
| test-tube | 46,748 | 7,680 | 19% | 3,280 (−57%) |
| ring-stand | 45,272 | 5,804 | 18% | 4,780 (−18%) |
| clay-triangle | 44,512 | 3,996 | 18% | 3,420 (−14%) |
| weigh-boat | 28,392 | 3,952 | 11% | 3,224 (−18%) |
| lab-sink | 27,028 | 2,616 | 11% | 2,520 |
| spatula | 26,620 | 3,672 | 11% | 1,576 (−57%) |
| spectrophotometer (instrument) | 20,292 | 1,126 | 3% | unchanged |
| rubber-stopper-set | 15,872 | 2,304 | 6% | 1,280 (−44%) |
| test-tube-rack (scenery) | 12,492 | 584 | 5% | unchanged |
| scoopula | 11,056 | 1,204 | 4% | unchanged |
| stirring-rod | 10,648 | 1,152 | 4% | 864 |
| crucible-tongs | 10,368 | 568 | 4% | unchanged |
| cuvette | 9,852 | 220 | 4% | unchanged |
| heat-safe-pad | 3,432 | 108 | 1% | unchanged |
| **All 36** | **3,279,008** | **539,110** | | **254,842 (−53%)** |

The five bottles and flasks sit at 89–97% of the item budget, with no room for any added detail. The triangles
go where nothing is seen: lathes of 96 to 288 segments whatever their radius, and nine profile points on every
fillet, even a 0.4 mm one. The spectrophotometer, the costliest instrument in reality, is the cheapest model.

Pack 3 already reuses 19 of these models (2,120,232 bytes), which leaves about 1.88 MB, some 110 KB each, for
its 17 new models. Its new glass items (a Büchner funnel, a side-arm flask, a waste beaker, two bottles) would
each cost what a bottle costs now.

## Library-wide findings (first: what one change fixes everywhere)

**L1. Tessellation is fixed per module, not by tolerance.** `lathe()` defaults to 192 segments, and each module
picks its own (32 to 288): the small vial, 28 mm across, has 96, and so has 27,648 triangles. `rounded()` puts
`n = 8` intervals on every fillet whatever its size. Measured: lathes at a 0.03 mm chord tolerance (rounded up to
a multiple of 8, at least 16, never more than the module asks), and fillets sampled about every 0.25 mm of arc
(2 to 8 intervals), cut the 36 models from 539,110 to 254,842 triangles (−53%). No bound moves by more than
0.01 mm. The 250 mL beaker's spout and the sample bottle's neck render the same as now at full review size. Fill
profiles, graduations, anchors and footprints are computed from the unrounded profile points, so none of them move.

**L2. The thumbnail studio washes out everything white or clear.** `render.py` uses a white cove, and the
build sets the exposure for glass, so white enamel prints, LDPE, filter paper, porcelain, white instrument
plastic, and the ceramic pad and pipe clay (both mid-tone materials) all read near white. Thin items (the
10 mL pipette, the Beral pipette, the stirring rod, the spatula) shrink to a hairline in a square 256 px frame.
In the app, the tray tiles for "10 mL graduated pipette" and "Water pipette" look empty (seen in
`look-room.cjs`). The review renders share the studio, so they mislead the review the same way: the beakers'
approximate scales and every bottle's capacity print are invisible in Cycles, though they read in the app.

**L3. There is no way to cut a real hole.** The test-tube rack's holes are dark discs painted on a solid plate,
and the tube visibly passes through the disc (composite `test-tube-in-rack`). The spectrophotometer's well is a
dark square on its deck. Pack 3 needs real openings: the Büchner funnel's perforated plate, the sample rack and
the chromatography chamber.

**L4. Threads are stacked rings.** `_bottles.py` draws the GL thread as three separate raised rings, and the
small vial's thread is a wave in its lathe profile. Both read as rings, not a thread, close up. Pack 3's distilled
water and propanol bottles will need the same.

**L5. The composite renders ignore state objects and forms.** `build_composite` hides a child's forms, but never
applies `stateObjects` defaults, as `build_one` does. So `composite-ring-stand-with-crucible` shows the crucible's
lid twice (closed and askew), and `composite-ring-stand-with-burner` shows every flame at once as a glowing
blob in the ring. This affects only the review renders, never the app, but it makes those composites useless
for the `AGENTS.md` inspection.

**L6. The same code, four times over.** The spout pull is copied in both beakers and both cylinders, and the
graduation-scale loop in both cylinders and the 10 mL pipette. Moving them to `labeq` changes no shape, but
makes the Pack 3 waste beaker and any new graduated item one call.

**L7. Seen only in the app (viewer, `src/studio3d/bench/look/materials.ts`, not core):**
- **Ghost prints.** On the 250 mL beaker the "200" reads "2200": the glass beside a print refracts the print,
  because three.js draws every opaque mesh, prints included, into the buffer that transmissive glass samples.
  Marking the `print` and `frosted` roles transparent keeps them out of that buffer.
- **Invisible clear plastic.** The cuvette's clear faces vanish completely, so it reads as two frosted sheets
  standing apart. It is built from five flat slabs with 0.2 mm bevels, and flat transmissive faces with no
  curvature show nothing.
- **Faint thin glass.** The stirring rod and the 10 mL pipette barely show, and the glass feet of the cylinders
  disappear. This is the M3 limit ("flat glass reads faintly in real time"); a material change could help, but
  it needs trying.
- **Hot brushed steel.** The scoopula and the tongs flare white under the room lights (`metal-brushed`, roughness
  map with anisotropy). This is minor.

## Model findings (worst first)

1. **spectrophotometer** (20 KB of 600 KB, 1,126 triangles). Two stacked boxes. The "raised lid" is a free-standing
   slab behind the well, attached to nothing, which reads as a small laptop in the app. The well is a dark square on
   a surround, with no opening. The keypad is eight flat squares, and the display bezel is flush. Its four rubber
   feet are buried inside the housing, which starts at the bench. Real benchtop visible spectrophotometers have
   a hinged sample-compartment lid, a recessed well, and moulded, drafted panels. Fidelity otherwise holds: a blank
   display, a 90° turned cuvette, and the beam along x.
2. **test-tube-rack** (scenery). Painted holes (L3), and the docstring's "lower plate with shallow wells" is not
   modelled. The seats are right.
3. **crucible-tongs.** Two 4.8 mm round wires with 4-sided tubes (`resolution=4`), so it reads as a hairpin. Real
   crucible tongs are stamped flat steel bars with bowed jaws and a riveted pivot.
4. **reagent-bottle, sample-bottle, sample-bottle-1l.** Stacked-ring threads (L4). Each is at 90–97% of its
   budget (L1). Shape, open neck, capacity print and frosted writing spot are right.
5. **small-vial.** Wave threads (L4). Its whole threaded neck is in the "thick" glass slot, which the viewer
   draws milky (`attenuationDistance` 0.045), so in the app it looks like a white plastic band. Only the lip
   should be thick.
6. **cuvette.** Invisible clear faces in the app (L7). Five slabs rather than one moulded body. Real cuvettes have
   rounded outer corners, which would also catch the light that makes them visible.
7. **analytical-balance.** Proportions and the open right door are right. Plain boxes: the doors have no
   handles, there is no levelling bubble and no feet, and the top of the shield has no handle.
8. **pipette-pump.** A smooth tube with a side disc. A real 10 mL pump has a prominent knurled thumbwheel and a
   quick-release lever, and its colour reads toy-like in the app.
9. **bunsen-burner.** Fine overall (barrel, air collar with ports by state, ribbed inlet). The base is a flat
   puck; a cast burner base is domed. Minor.
10. **Fine as they are** (shape and markings match the real items, and the catalogue): beaker-150ml,
    beaker-250ml, erlenmeyer-flask-250ml, graduated-cylinder, graduated-cylinder-25ml, graduated-pipette-10ml,
    volumetric-flask, funnel, watch-glass, test-tube, stirring-rod, beral-pipette, wash-bottle, weigh-boat,
    filter-paper, crucible-with-lid, clay-triangle, ring-stand, funnel-stand, drying-oven, lab-sink,
    heat-safe-pad, spatula, scoopula, rubber-stopper-set. Their only issues are the library-wide ones (size,
    thumbnail legibility, ghost prints, faint thin glass).

The composites place every child where it should be: the anchors are right. The defects are L3 (the rack) and
L5 (state objects).

## UI issues recorded for the later polish pass (not fixed here)

- Tray tiles of thin glass items look empty (fixed at the source by L2 if chosen, but the tile could also crop
  or tilt long items).
- The hover-label and beacon sizes were not reviewed; nothing new was seen.
- (Found in the build's G1 look, 2026-10-10.) Which glass surface shows is decided by triangle order, not depth.
  - Glass writes no depth (plan §6.2), so within one mesh the triangle drawn last wins each pixel, and gltfpack
    orders triangles for the GPU cache.
  - After the rebuild, the 125 mL and 1 L bottles show the ceiling lights on their shoulders, where the far inner
    surface used to overwrite the near outer one. Reversing the order in the page brings back the old look.
  - The new look is the more physical one, but neither is controlled.
  - Possible fixes, for a decision:
    - give the inner and outer surfaces their own primitives and draw the outer last (`renderOrder`);
    - or, if gltfpack's encoding allows it, a pack step that puts each glass mesh's outer-surface triangles
      last.

  Evidence: `evidence/MODEL_REFINEMENT_EVIDENCE.md`.

## Proposal, ranked

Library-wide first, then the worst models. Every model keeps its real dimensions, fill profile, graduations,
anchors, footprint and material names. Changing anything in `labeq/` changes every model's source hash, so every
model is rebuilt, packed and re-thumbnailed once at the end, whatever is chosen.

| # | Change | Cost | Registry change | How it is checked |
|---|---|---|---|---|
| L1 | `labeq.geometry`: `segments_for(radius, tol=0.03)` used by `lathe` when a module does not insist, and fillets sampled by arc length in `rounded()` | −53% triangles, about −45% bytes over all models (to be measured); about 1 MB freed for Pack 3 | none (source hashes only); bounds ≤ 0.01 mm | validator per pack; bounds diff per model; full review renders; an Examine close-up of a beaker spout and a bottle neck in the app |
| L2 | `render.py`: a mid-grey cove for thumbnails and review renders, exposure set for it, and a minimum on-screen width for long thin items | build time only (all thumbnails re-render anyway) | none | every thumbnail inspected, and the tray in `look-room.cjs` |
| L3 | `labeq.geometry`: a plate or wall with real round or square holes (an exact boolean applied in the module, still procedural) | small | none | the rack and spectrophotometer composites |
| L4 | `labeq.geometry`: a helical thread with run-out ends | +2–4k triangles a bottle, well inside the room L1 frees | none (same outer radius) | review renders of the three bottles and the vial |
| L5 | `build_equipment3d.py`: composites apply state-object defaults and can name a state (lid closed, flame off) | none | none | the two Heat composites re-rendered |
| L6 | `labeq`: the spout pull and the graduation-scale builder moved out of the four modules | none | none | the same graduations (the validator re-derives them) |
| V1 | `materials.ts`: prints and frosted spots drawn transparent, out of the transmission buffer | none | none | G1 close-ups of the beaker and the cylinder |
| V2 | `materials.ts`: try clear-plastic and thin-glass edge legibility; keep only if the G1 look is better | none | none | G1 at each tier |
| M1 | spectrophotometer: a hinged sample-compartment lid, a real well, drafted panels, raised keys, a recessed display bezel, and feet under a housing lifted onto them | about +40–80 KB, still under 25% of budget | possibly the bounds and the display centre (kept the same where possible; the feet lift the housing about 3.5 mm unless kept hidden) | composite with cuvette; Transmittance G1 look (`look-transfer`/photometer path) if any registry value moves |
| M2 | test-tube-rack: real holes and lower wells (needs L3) | small | none (seats unchanged) | `test-tube-in-rack` composite |
| M3 | crucible-tongs: flat stamped bars (keeping their 4.8 mm height, so `tipMm` and `grip` stay), bowed jaws, rivet | small | none | review render; Heat G1 look of the tongs |
| M4 | bottles and small vial: helical threads (needs L4); the vial's thick slot only at the lip | covered by L1 | none | review renders |
| M5 | minor pass: cuvette as one moulded body with rounded corners; balance door handles, feet and level bubble; pipette pump thumbwheel and lever; burner's domed base | small | none (bounds kept) | review renders, composites, cuvette G1 |

**Cost of the build.** Every model is rebuilt with full samples, about 1.5 to 2 hours of Cycles on this laptop's
GPU, plus the composites. Every `meta.json` and the registry are regenerated; only the source hashes, and
whatever M1 moves, differ.

**What stays unrun or out of scope.** No dimension, fill profile, graduation, anchor or material name changes. No
new material is needed. Nothing under `src/runtime/` or `src/domain/`. Pack 3's own models are not built. The
viewer items (V1, V2) are in `src/studio3d/bench/look/`, outside core, and are offered separately.

### Fidelity review of this proposal

- L1 changes only how finely a surface is approximated, never where it is. The measured bounds move ≤ 0.01 mm;
  the fill-profile maths uses the unrounded points, so liquid levels and the validator's ring and graduation
  checks are unaffected. The risk is faceting on curved silhouettes seen close in Examine. The checks above
  look for it, and a module can still insist on more segments.
- L2 changes only how thumbnails are lit. A grey backdrop is not a false statement about an object; the items
  keep their true colours.
- M1 keeps the spectrophotometer generic, and its display blank. A hinged lid shown raised is the real open state,
  and it is what the slab already claimed. If the feet are made visible, the housing must rise onto them, which
  moves the deck, the well anchor and the display centre up by the foot height. Recommended: keep the anchor and
  display where they are, and leave the feet hidden as now, so nothing the runtime reads moves.
- M3 keeps the tongs' height, so the carried pair is aimed exactly as now.
- V1 changes only draw order, not what is drawn.
- Nothing proposed prints a contents label, a tolerance class or a reading.

## Decisions (2026-10-10)

You chose, in line: "L1 tessellation (Recommended), L2 thumbnail studio, L3–L4 + L6 helpers, L5 composite
states"; "M1 spectrophotometer (Recommended), M2 rack + M3 tongs, M4 threads, M5 minor detail pass"; "Fix
print ghost only (Recommended)"; "Registry test only (Recommended)". So everything in the ranked table was
built except V2, which stays recorded here for the polish pass. What was built, and how it was checked, is in
`evidence/MODEL_REFINEMENT_EVIDENCE.md`.

Choices made while building, within the decision:

- **L6.** The graduation builder went to `equipment/_scales.py` (`graduation_scale`), beside the beakers'
  approximate scale, rather than to `labeq`: it is equipment knowledge, not geometry. The spout pull went to
  `labeq.geometry` (`pull_spout`).
- **L2.** Besides the mid-grey cove, an upright item more than eight times as tall as it is wide (the 10 mL
  pipette, the Beral pipette, the stirring rod, the test tube) leans 38° in its thumbnail only. Its GLB and
  review render stay upright.
- **L5.** Composites show each state group's default, except where a composite names another
  (`COMPOSITE_STATES`): the burner under the ring burns blue with its collar open.
- **M1.** The feet stay out of sight, as recommended, but a dark plinth set in under the housing now reads as
  the gap a real instrument stands on. The lid is 43.6 mm long, so that, raised 100° on its hinge, it stays
  within the old height (170.02 mm against 170.00).

## Fidelity review of the build (2026-10-10)

You asked, during the build: "Critically review your work for fidelity and refine where needed." Five findings,
all refined the same day. Each kept every registry value.

1. **The print fix also reached pipe clay.** `Pipe clay` shares the `frosted` role with the bottles' writing
   spot, so marking that role transparent took the clay triangle out of the opaque scene too, with no reason.
   It now applies only to `Frosted marking spot` (and to the `print` role).
2. **The tongs were a near-square bar, not stamped strip.** A 6.5 × 4.8 mm bar is not flat. Scissor-action
   tongs are two strips riveted face to face, so the arms are now two 7 × 2.4 mm strips, one on the bench and
   one on top of it. That is also why the registry fits without change: the pair is 4.8 mm high (`grip`), and
   the jaws' tips meet 2.4 mm up (`tipMm`). The bounds moved by 0.6 mm at most, at the jaw tip's square end.
3. **The vial's thread was not a vial's.** A 20 mL screw-cap vial has a 400-series finish: about one turn at
   8 threads an inch. The first build drew 1.75 turns at 3 mm pitch. It is now 1.25 turns at 3.2 mm, 0.8 mm
   deep, with its ends faded over a quarter turn.
4. **The GL thread ran onto the shoulder.** The bottles' helix of 2.5 turns ran 2.5 mm below the span the old
   rings covered, onto the neck's fillet. It is now two turns over exactly that span (3 to 11 mm below the lip
   at 4 mm pitch), clear of the shoulder.
5. **The spectrophotometer's panels were not drafted.** M1 promised drafted panels, and the first build had
   straight sides. The side walls now lean in 1.5° from the top of the bottom bevel, so the housing keeps its
   320 mm width there. Only x moves, so the sloped panel, the display face and the keys keep their exact
   places.

Checked and found sound:
- Every registry is unchanged (compared value by value).
- Every mesh cut by a boolean has exactly its own material slots.
- The well's five faces are dark.
- The vial's thick glass is only at the lip and the floor.
- The graduation and spout helpers reproduce the old loops exactly: the same volumes, labels, tick sizes,
  depths and lifts.
