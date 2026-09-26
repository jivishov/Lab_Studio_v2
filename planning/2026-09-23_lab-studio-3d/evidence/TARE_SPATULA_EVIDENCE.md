# The balance's TARE key and the spatula: evidence (2026-09-25)

You asked: "1. User must click zero/tare button on the balance 2. User must be able to use spatula to dispense solid compounds." You chose:
- **Balance key, card button kept.** The key on the model performs the zero step, and the step card keeps its button (G-6).
- **Dip, then carry to the glass.** The spatula takes a scoop in the reagent bottle and tips it onto the watch glass.
- **Spatula only.** Tipping the bottle onto the glass is refused with a correction. It is not a runtime attempt.

Nothing new is committed to the runtime. The TARE key sends the zero step's notebook record, as the card's button does. The spatula sends the transfer step's own bottle-to-glass pour. The scoop, the key press and the tip are presentation only (G-3).

## What changed

**Models** (`tools/blender/equipment/`), rebuilt and packed:
- `analytical_balance.py`:
  - the front panel has three plain keys and a wider TARE key, `Balance_key_tare`;
  - the key is dark, with a white "TARE" legend (`Balance_key_tare_legend`); a light key with a white or blue legend read poorly in the review crop;
  - the registry gains `controls: [{ id: "tare", operation: "zero", label: "TARE", objects, centreMm, sizeMm, normalMm }]`;
  - the legend is true of any balance, and the model still prints no specification (U9).
- `spatula.py`: the registry gains `solidRest` (the spoon's bowl, 4 mm radius), where the viewer draws a scoop. No powder is built into the model.
- `validate_equipment3d.py`: each control's operation must be a known one (`zero`), and its objects must be node names in the GLB.
- Sizes: the balance is 59,052 bytes and the spatula 26,620.

**Engine** (`BenchEngine.ts`):
- `pickControl` finds a control under the pointer, seeing through enclosure glass as `pick` does.
- `pressControl` moves the key 1.2 mm into the panel and back over 160 ms. It is skipped under reduced motion.
- `setControlCue` lights a key in the guide colour. It is a static tint.
- `setToolLoad` draws a scoop of the source's powder at the tool's `solidRest` during a carry.
- `animateToolDeposit`: where the carry was released, the spatula rolls about its length (0.28 s), holds (0.18 s) and rolls back (0.22 s). The scoop drops, and the glass's new contents show as it lands. The spatula then returns where the runtime keeps it. It resolves at once under reduced motion, or when there was no carry (Confirm).
- `solidRestOffsetMm`: the spoon's offset from the tool's centre on the bench.
- `showMe` takes an optional via item: the ghost goes to the top of the via item (the bottle, which pulses), then to the target.
- **Pick box for slender items.** An item under 10 mm tall (the spatula, the stirring rod) gets an invisible box (16 mm tall, at least 24 mm wide) that takes the pick. Before it, the spatula was 2–3 px tall at the auto view and could not be picked by mouse (found in the pane, below). Raycasts do not check visibility, and the box is never drawn and casts no shadow.

**Adapters** (`sceneToIntent.ts`):
- `toolTransferFor`: a step that binds `solid-transfer-tool` to a `pourInto` whose source holds a solid is a tool transfer. It is undefined once the step is done.
- `resolveToolRelease`:
  - the dipped tool over the target sends the step's own pour intent (the bottle to the glass);
  - the source over the target is "use the tool";
  - anything else falls through to the ordinary release, so a spatula set down is a free move.
- `pointInFootprint`, for the dip.

**Carry** (`useBenchCarry.ts`):
- **The spatula is held by its spoon end.** The spoon follows the pointer, and the tool's centre lies behind it. The spoon is judged as a 12 mm square over the bottle and the glass, not the whole 180 mm tool. So at pick-up the spatula moves until its spoon is under the pointer.
- Callouts:
  - "Scooped from the reagent bottle" (both modes);
  - "Carry the scoop to the watch glass" (guided);
  - "Release to tip the scoop onto the watch glass" (through the existing accepted-drop callout);
  - "Scoop from the reagent bottle first" (guided, over the glass unloaded).
- The bottle carried over the glass shows an invalid ring. The callout reads "Use the spatula to add a solid" in guided mode and "Release to try this" in assessment. On release, the correction says "Use the spatula to add a solid to the watch glass." It is not recorded as an attempt.
- A press on a control acts on release if the pointer moved less than 8 px. It is never carried, and the cursor is a pointer over it.
- The keyboard carry starts from the spoon, and arrow keys move the spoon.

**Player** (`usePlayer3D.ts`, `Player3D.tsx`, `StepCard.tsx`, `panels.tsx`, `stepRules.ts`):
- **Pressing TARE at the zero step** does exactly what the card's button does. The card's button now reads **Tare**. At any other step nothing changes. A neutral notice with an info icon says "TARE pressed. Nothing is zeroed at this step."
- **Guided mode** (G-7):
  - the TARE key is lit at the zero step;
  - the beacon marks the spatula, then the bottle while the unloaded spatula is carried, then the glass once it is loaded;
  - the tray marks the spatula "needed now";
  - Show me sends the spatula's ghost to the bottle, then the glass;
  - the auto view frames the spatula with the step's items.
- **Confirm** at the transfer step records the same transfer. The bottle is not drawn pouring.
- **Hints:**
  - "Press TARE on the balance, or Tare in the step card."
  - "Dip the spatula into the source, then release it over the target; or use Source, Target and Confirm."
- A selection ring follows the spatula back after the tip.

**Content** (`public/techniques/weighing.json`, D4 exception 5, wording only):
- the zero step: "With the empty watch glass on the pan, press TARE to zero the balance.";
- the transfer: "Use the spatula to transfer {{config.solidMassG}} g of sodium carbonate from the reagent bottle onto the watch glass.";
- both accessible labels likewise.

No step, setting, rule, binding or version changes. The 2D player shows the same words and has no TARE key; 2D is out of scope (your decision).

**Hover labels** (found after the build: the balance's label covered the TARE key). A hover label was anchored at the item's base centre, which for a tall instrument projects onto its front panel. It now hangs below the lowest on-screen point of the item's bottom edge (`BenchEngine.labelPoint`), so it never covers the item's front. Seen in the pane: the balance's label sits under the balance, with the display and TARE clear.

## Checks

- `npx tsc -p tsconfig.app.json --noEmit`: exit 0, tests included.
- `python tools/blender/validate_equipment3d.py --pack 1`: PASS, 14 definitions, 0 failures, models 1,625,408 bytes.
- The weighing narrow validator: 32 of 32, with the instruction text updated.
- The review crop of the balance front: TARE reads clearly, white on the dark key.

**In the pane** (G1 spot checks, `#/3d/technique/weighing`, 2.037 g):
- **The zero step:**
  - the TARE key is lit;
  - the hint and the card's **Tare** button read as above;
  - clicking the key on the model zeroed the balance (30.000 g, then 0.000 g) and advanced to step 3;
  - on a second run, the card's button did the same.
- **The transfer step:**
  - the tray marked the bottle and the spatula;
  - the beacon marked the spatula;
  - the hint read as above.
- **Keyboard carry of the spatula** (`[` `]`): "Scoop from the reagent bottle first" at the glass, "Scooped from the reagent bottle" at the bottle, then "Release to tip the scoop onto the watch glass". Enter committed "Sodium carbonate is on the watch glass, ready to weigh", and the display read 2.037 g.
- **Mouse drag of the spatula**, after the pick box:
  - hovering it shows "Spatula · empty";
  - the drag read "Scooped from the reagent bottle", then "Carry the scoop to the watch glass", then "Release to tip the scoop onto the watch glass";
  - the spoon sat over the glass inside the shield, with the handle out through the open door;
  - on release it committed, the display read 2.037 g, and the powder lay on the glass.
- **The bottle carried onto the glass:** "Not the target for this step" over the balance, then "Use the spatula to add a solid" over the glass. On release, the correction named the spatula, without "Recorded as an attempt".
- **Show me:** the via pulse on the bottle was seen. The thin ghost was too small to confirm at this zoom.
- **Confirm at the transfer step:** no bottle pour; the powder was on the glass, and the display read 2.037 g.
- **Console:** no errors after a full reload and a complete run. Earlier "hook order" and "dependency array size" errors followed hot updates of `Player3D.tsx` during editing.

**Not seen:**
- assessment mode (source-reviewed: no cue, no beacon, the neutral callouts);
- reduced motion;
- the tip animation frame by frame;
- hand control. G3 stays unrun, and a pinch cannot press the key on the model; by hand, the card's **Tare** is the way.

## Tests written, not run

`src/studio3d/__tests__/toolTransfer.test.ts`:
- `toolTransferFor` at weighing's transfer, and undefined when done, at a step with no tool, or when the source holds no solid;
- `resolveToolRelease`:
  - the dipped spatula over the glass sends the bottle-to-glass pour;
  - nothing for an undipped spatula, a wrong or invalid target, or no target;
  - "use the tool" for the bottle over the glass;
- `pointInFootprint` edges;
- the tray's needed-now list with the tool;
- the registry's TARE control and the spatula's `solidRest`.

Updated: `teacherPreparedConfiguration.test.ts`, for the transfer instruction.

## Notes, not changed

- **Pick-up jump.** At pick-up the spatula jumps until its spoon is under the pointer: it is held by the spoon end. Holding it where it was grabbed would leave the lift and the aim judged under the pointer, not the spoon, which put the spoon inside the bottle.
- **The pick box applies to every slender item,** so the stirring rod is easier to pick too. It changes no footprint or drop target.
- **The display leads the scoop.** The display shows the new mass when the transfer commits, a fraction of a second before the scoop lands.
- **Moving the glass off the pan.** A glass moved off the pan cannot be re-seated by a free move (a core question already on your list). The TARE key then still zeroes at the zero step, as the card does.
