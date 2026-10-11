# Proposal: a reagent shelf over the bench instead of the tray (3D only)

Status: evaluation only, nothing built (you, 2026-10-11: "Evaluate replacing the tray with making a shelf over the
bench with required equipment. Getting rid of the tray in favor of more realistic lab environment."). The decisions
at the end are yours.

## What the tray is today

- The runtime has one location for equipment that is not yet in use: `shelf`. 2D draws it as the sidebar's shelf;
  3D draws it as the floating **Tray** panel of thumbnail tiles (`EquipmentTray`, `panels.tsx`). Nothing in the
  runtime knows about a tray, so replacing it is presentation only, and 2D is untouched either way.
- The tray gives every item on the shelf:
  - a large, named picture, readable for a capillary (2.6 mm wide) or a pencil;
  - three ways to take it: drag to the bench, Enter for its own slot, or a hand-control pinch;
  - a "needed now" dot in guided mode, naming one item where the step names one of a kind;
  - a screen-reader label.
- **How much is on it at the start** (3D techniques and labs):
  - at most 12 items (Hard Water lab);
  - Paper Chromatography lab, 11;
  - most techniques, 3 to 10.
- **Items that start on the shelf**, across the 3D content:
  - glassware and small tools, most of them (pipettes, beakers, vials, strips, rods, pencil, ruler, capillary);
  - three large stations: a ring stand (5 uses), an analytical balance (2) and a Bunsen burner (1).

## What a shelf would be

A two-tier reagent shelf on uprights along the back of the bench, as many teaching benches have. It would be about
1.2 m long, 180 mm deep, with its tiers about 300 and 520 mm above the bench top. Items on the runtime `shelf` would
stand on it as real 3D models at true scale, each keeping one spot for the whole run (the same rule as the bench's
stable layout). Taking one is the bench's own carry: pick it up from the shelf, set it down on the bench. The room
already has a small decorative shelf with five bottles at the back right (`room.ts`). The working shelf would
replace it.

## Evaluation

| Concern | Finding | What it needs |
|---|---|---|
| Realism | Strong gain: items are fetched from where they are kept, at their real size, and the floating panel goes. | A shelf model (D9 scenery, never an instance, G-8). |
| Capacity | 12 items fit on 1.2 m of two tiers if the large stations are not on it. | Large items (ring stand about 600 mm tall, balance 220 × 330 mm, burner) stand at a side station at the bench's right end, still `shelf` in the runtime. |
| Small items | A capillary, pencil or ruler on a shelf 0.5 m up is a few pixels at overview distance. | Shelf-edge tags (as real shelves carry), hover names, an enlarged hit area (the bench already has one for slender items), and a modest visual boost. |
| Mouse and touch | Same gesture as the bench: click or press to pick up, then place. | Raycast picking on shelf items; touch targets at least 44 px at the home view. |
| Hand control | Biggest cost: the hand rig works in the bench plane. | A reach mapping (raise the hand to address the shelf tier) or a pinch-over-the-shelf mode, plus a G1 with the hand. |
| Camera | Tall items on the bench (cylinders, ring stand) can hide the shelf, and the home view must show both. | Home view and slide range that include the shelf; the beacon and framing on a shelf item. |
| Accessibility | Losing the tray would lose its keyboard and screen-reader path. | Keep it as a **Shelf list**: a text list with Enter to place, inside the Bench list ("On the shelf · N" is already there). Nothing is lost; the panel of pictures goes. |
| "Needed now" cue | Today a dot on the tile. | The beacon on the shelf item; the list keeps the "needed now" wording. |
| G-3 / G-8 | No readings involved; the shelf is scenery and its items are real instances. | No change. |
| Load time | Shelf items load their models at the start instead of when placed. | Up to 12 more models load before the first step; to measure in phase 1. |

## Options

- **A. Keep the tray.** Nothing to build; the floating panel stays the least realistic part of the scene.
- **B. Shelf, side station and a Shelf list (recommended).**
  - The shelf holds the glassware and small tools.
  - The large stations stand at the bench's right end.
  - The tray panel is replaced by a text Shelf list for keyboard and screen readers.
  - The hand control reaches the shelf.
- **C. Hybrid.** Draw the shelf with its items for realism, but keep the tray panel as the main way to take them.
  Lower risk, but every item is shown twice, which is the clutter the change is meant to remove.

## Phases (option B)

1. **Draw.**
   - The shelf model, built in Blender as scenery.
   - A spot per item (deterministic, from the start order), and the side station for large items.
   - Shelf-edge tags and hover names.
   - The beacon on shelf items.
   - A home view that shows the shelf.
   - Tests for spots and capacity.
2. **Take.**
   - Mouse and touch picking from the shelf into the existing carry.
   - The Shelf list with Enter.
   - Remove the tray panel.
   - G1 on Paper Chromatography (11 items) and Hard Water (12).
3. **Hand.** The reach to the shelf tier, then a G1 with the hand.
4. **Review.** A fidelity pass over every 3D technique and lab, then the records.

Phases 1 and 2 are about one build session each, and phase 3 about one more. Stop after phase 2 for a look before
the hand work.

**Risks:**
- tall bench items hiding the shelf;
- future packs with more than about 14 shelf items (would need a third tier or a second bay);
- tiny items staying hard to see even with tags.

## Decisions needed

1. Option A, B or C (recommended B).
2. Where large stations go: a side station at the bench's right end (recommended), or drawn on the bench from the
   start. The second changes what the student sees as "already set out", so it is a content question.
3. Keep a text Shelf list for keyboard and screen readers (recommended yes).
4. Hand reach: a raised-hand tier mapping (recommended), or a separate shelf mode.
