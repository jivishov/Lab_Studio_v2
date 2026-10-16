# Proposal: an open teaching lab around a longer island bench (3D only)

Status: **decided 2026-10-16, not built:** all four decisions answered as recommended ("Island in open lab",
"2000 × 700, Home fits use", "Keep spots clear", "Both"). Asked for on 2026-10-16, with seven photos
of a real teaching lab: "I propose to remove the immediate walls the bench has, extend the front view with lab view
with maybe some cabinets by the wall, extend the bench horizontally and allow larger area for shelving, equipment
placing and hence preventing the view blocked by any equipment. Just like in any lab there must be some comfortable
area to move around, hence the front of the bench may be some large place. ... First, confirm the completed work,
then build the plan how to proceed with the lab view."

The shelf build's three open questions (`evidence/TRAY_SHELF_EVIDENCE.md`) are folded in here as decisions 3 and 4,
because the new layout changes their answers.

## Where the room is today

- **The room is closed tight around the bench** (`bench/look/room.ts`, the natural room of 2026-10-12):
  - side walls at the ends of the bench run;
  - the back wall just behind the reagent shelf (`WALL_FACE`), with the window and its view of trees over the shelf;
  - a front wall 5.2 m out, past the camera's farthest reach.

  From Home, the view past the shelf is the wall about 0.2 m behind it, so the room reads as a booth, not a lab.
- **The worktop** is `WORKTOP` (room units): the 1400 × 700 mm working area, about 130 mm deeper at the back for
  the shelf, and about 620 mm longer at the right for the side station. It is black-charcoal epoxy on under-bench
  cabinets with a toe kick.
- **The working area** is `BENCH_MM` (`adapters/benchCoordinates.ts`), 1400 × 700 mm, the one mapping from the
  runtime's 760 × 520 bench. Runtime units are never rewritten: the 3D view reads them through `toBench` and writes
  them back through `fromBench`. The 3D bench layout (`stableBench.ts`) keeps 2D's 15-slot grid, five a row.
- **The reagent shelf** (`adapters/shelfSpots.ts`) is 1200 mm long, 180 mm deep, with tiers at 300 and 520 mm and
  a 580 mm top. It holds up to 13 items. The side station (x 740 to 1300 mm) holds the four large stations.
- **What hides what.** The drying oven (420 mm tall) starts in the back row of the working area, in front of the
  shelf. At Home it hides three lower-tier items and half of a fourth in the hard-water lab, and the watch glass in
  Dry and Weigh. Nothing else is hidden at Home in the 14 routes checked.

## What the photos show

Read from the seven photos (side views, extrapolated to the front view):

1. **Island benches**, long and double-sided, with white worktops on white, lockable under-bench cabinets and a
   toe kick.
2. **A centre-spine rack** down each island:
   - grey uprights carrying the services: sockets, gas and water valves with yellow handles, blue hoses;
   - two open shelf tiers above, with reagent bottles;
   - ring-stand rods standing at the spine.
3. **Wide aisles** between the islands, about the length of a person lying down: room to walk, with stools pushed
   under.
4. **A tiled ceiling** of square panel lights and vents, evenly lit.
5. **Windows along one side wall.** None are behind the benches.
6. **The end wall:** a red fire cabinet, plus a balance and reagent bottles at an island's end.

## The proposal

### 1. Open the room (scenery only)

The room becomes a teaching lab of about **8.4 × 9 m**, keeping its height (2.9 m floor to ceiling). Our bench is
one island in it:

- **Our island**, seen from its working side:
  - about 3.0 m long and 1.5 m deep, double-sided as in the photos;
  - our working side at the front; the far side empty and clean, a second student's station;
  - the toe kick and lockable cabinets on both sides.

  The worktop stays black-charcoal (your choice, 2026-10-12) rather than the photos' white, because the equipment
  stands out against it. Its 0.9 m height is unchanged.
- **The centre-spine rack** replaces the back-of-bench shelf, down the island's middle:
  - its tiers keep their heights (300 and 520 mm) and depth (180 mm), so every spot rule and test still holds;
  - its length grows to about 2.6 m (decision 3);
  - the uprights carry the photos' services as scenery: sockets, gas and water valves with yellow handles, a blue
    hose looped on a tap. Nothing there is interactive, and nothing is added to the runtime or the catalogue.
- **A front aisle** of about 2.0 m in front of the bench: the "comfortable area to move around". The camera stands
  in it. The front wall is beyond the camera's farthest reach, as now.
- **Behind our island:**
  - a second island at the same height, past a 1.6 m aisle, in plain scenery: no equipment, a few stools and a
    bottle rack;
  - then the wall run: base cabinets with a worktop and a sink, wall cabinets with glass doors above, a fume hood
    at one end, and the "CHEMISTRY · TEACHING LAB" lettering moved to this wall.
- **The left wall** carries the windows. Their view of trees (`windowView.ts`) moves there from behind the shelf,
  and the daylight comes from the side.
- **The right wall** carries the red fire cabinet, an eyewash sign and a door.
- **The ceiling** is a 600 mm grid of panel lights and vents, as in the photos. `ROOM_LIGHTS` keeps its key light
  from above and retunes the fill for the larger room.

**What you would see from Home.** The bench and its spine rack fill the lower two thirds of the screen. Above and
through the open tiers you look across the far side of our island to the second island and the cabinet wall, with
the windows' light coming from the left. You never see a wall a hand's width behind the shelf again.

**Cost.** This is the largest scenery change since the natural room, but it is scenery: no runtime, catalogue, 2D
or Studio data changes.

- The new objects are boxes and quads from the room's existing helpers and materials (`textures.ts`), merged into a
  few meshes. Repeats (cabinet doors, ceiling panels, stools) are instanced.
- Only our island and its rack cast shadows. The far scenery receives light and does not cast, so the shadow map
  stays sized to the bench.
- The occlusion pass (`roomOcclusion.ts`) and the reflections (`roomReflections.ts`) are screen- or
  probe-based. The probe is re-captured once for the new room. One frame-time reading is taken at each G1 look; that
  is a note, not the G2 performance gate, which stays closed.

### 2. A longer working area (decision 2)

You asked for a larger area for placing equipment. The working area is `BENCH_MM`, a 3D-only mapping, so it can
widen without touching the runtime:

- the runtime keeps its 760 × 520 bench and its units;
- a saved run loads in either player, as now (G-3);
- 2D's slot grid simply spreads further apart in 3D.

At **2000 × 700 mm** (recommended):

- the slots stand about 375 mm apart across, not 257 (2D's 148 px slot pitch);
- beakers, the oven and the stands get clear space between them;
- the oven no longer crowds its neighbours.

The depth stays 700 mm, the working depth of a real bench side, so reach and the hand's mapping keep their scale.

**The trade-off is the size of things at Home.** Fitting a bench 43 % wider into the same screen would draw
everything about 30 % smaller, the very complaint Home's fit answered on 2026-10-12. So Home changes with it. It
fits **what the run uses**:

- the slots its items own;
- the rack spots in use;
- the side station when it holds items (your rule of 2026-10-12).

It does not fit the whole working area. A run's slots and spots are fixed for the whole run, so Home stays steady
during it and is decided once at the start. A run with five items comes about as close as today; a run with 15 takes
in more bench.

**Other things that follow `BENCH_MM`:**

- the contact shadows;
- the keyboard's bench steps, already in millimetres (10 mm, 50 mm with Shift), so they keep their size; at about
  2.5 mm per runtime pixel across, a 10 mm step is still four pixels;
- the camera's sideways reach (`MANUAL.atX*`, `FRAME_REACH`), widened to the new island;
- the Studio's 3D bench setup (`studio/BenchSetupView.tsx`), which draws the same, wider bench.

Each is a constant or reads `BENCH_MM` already.

### 3. Nothing tall in front of the shelf (decision 3, the shelf build's first question)

The longer rack is what makes this easy: at 2.6 m against a 2.0 m working area, it has spans to spare beside any
tall item. Whether the widest start load (13 items) fits beside the hidden spans in every route is checked in
phase 3, not assumed. The rule:

- **A rack spot is never placed behind a tall bench item.** A tall item is one higher than the lower tier's top
  (300 mm), measured from its built bounds, which the registry carries.
- The run's tall items are known at the start from their stable slots, so the rule works there and every spot
  still holds for the whole run.
- In the spans behind a tall item, the lower tier stays empty. The upper tier is used there only for items whose
  top, seen from Home, clears the tall item; spots outside those spans are used first.
- If a tall item is moved later in the run, no spot moves (the stable rule). It can then hide an item, as any
  object on a real bench can; orbiting, Overhead and the Shelf list still reach it.

This answers the hard-water lab and Dry and Weigh without moving the oven from its 2D slot. The other session's
alternative, starting the oven elsewhere on the bench in 3D only, is less faithful: the runtime's position would no
longer match where 2D shows it.

The longer rack also gives Pack 3b's brass content more room: 29 items are already in sight (the shelf proposal's
"Notes after approval", note 8). Whether all 29 fit on two tiers of 2.6 m is tested in phase 3; if not, the rack
gets a third tier at its top (about 800 mm), as some spines in the photos have.

### 4. Auto view's two open questions (decision 4, the shelf build's second and third questions)

These do not depend on the room, but they are small and touch the same framing code, so they ride along in
phase 4:

- **A step whose items are all on the shelf:** Auto view goes to Home (recommended by the other session). Today it
  keeps the previous view.
- **Examine, the Selected view and Bench list picks** use Auto view's steadier framing (`fitSteady`), so they stop
  hopping when a model loads.

## What stays

- **The runtime, its units and saved states;** the catalogue; the 2D player (`src/player/**`, `src/styles/app.css`);
  the 2D generators; `public/techniques/` and `public/labs/`.
- **The microarray lab** and its room, which Lab Studio 3D adopted from. Only Lab Studio 3D's room is changed, as
  with the natural room.
- **The shelf's tier heights, depth, spot rules and the side station.** The side station moves with the island's
  right end: it stays the bench's continuation past the working area.
- **The hand's mapping** (screen-space targets) and the carry.
- **The step card, the dock and both themes.**

## Phases (each ends with one G1 look in the browser, then stops for you)

1. **The open room.** Scenery only:
   - the room's new size;
   - our island double-sided at its current 1400 mm working area;
   - the spine rack at its current 1200 mm, now down the island's middle, with its service fittings;
   - the second island, the cabinet wall and fume hood, the left-wall windows, the fire cabinet and door, the
     ceiling grid;
   - lights retuned.

   *Tests:* the room's bounds contain the bench, the camera's reach and Home; no scenery sits inside the camera's
   reach; a dispose test. *G1:* Home in the hard-water lab and Paper Chromatography at 1024 × 700 and 1920 × 1080, in
   both themes, plus the frame-time note.
2. **The longer working area and Home fitting what is used:**
   - `BENCH_MM` 2000 × 700;
   - the island and the rack lengthened to fit;
   - the camera's reach, the contact shadows and the Studio follow.

   *Tests:* `toBench` and `fromBench` round-trip over the runtime bench; a saved 2D state loads unchanged; Home fits
   each route's used slots and stays fixed through it. *G1:* the same views as phase 1, with a slide and a zoom.
3. **The rack's sight-line rule:**
   - spots kept clear of tall items;
   - the capacity test at 29 items.

   *Tests:* in all 14 routes, no start item's spot is hidden at Home (by projection, the method the shelf build's
   check used); spots stay stable and distinct. *G1:* the hard-water lab and Dry and Weigh at Home.
4. **Auto view's two follow-ups**, per decision 4. *Tests:* the framing unit tests. *G1:* Auto view on a step whose
   items are all on the shelf.
5. **Records:** `DECISIONS.md`, the evidence file with renders, and `SESSION_HANDOFF.md`.

Phases 1 and 2 can be built as one if you prefer a single look, but kept apart the room's look is judged before
the bench's scale changes.

## Risks

- **Equipment smaller at Home.** This is the main risk of the wider working area. It is answered by Home fitting
  what is used and checked at phase 2's look. If it still reads small, a 1700 mm working area is the fallback.
- **A busier background.** Detail behind the rack could compete with the equipment. The far scenery is kept lower
  in contrast: light walls, plain cabinet fronts, slightly softer light. The bench keeps the strongest light and the
  charcoal worktop.
- **Frame time.** The room is about four times the area. The far scenery is static, merged, instanced and
  shadow-free. If the frame-time note shows a drop at 1920 × 1080, the second island is the first thing to simplify.
- **The view through the rack.** The open tiers show what is behind them, as in the photos. If the far side reads
  as clutter, the rack can take a solid back panel on its lower tier, a small change.
- **The waiting looks.** Five builds still wait for your look (the HUD, the natural room, the themes, the Home fit,
  right-drag). Phase 1 changes the room they were built in. Your look at phase 1 can cover the room and the themes
  together.

## Decisions for you

1. **The layout:**
   - an island bench in an open teaching lab, as above (recommended);
   - the bench kept against a back wall, with the side walls removed and the room opened in front;
   - the closed room kept, only made larger.
2. **The working area:**
   - widened to 2000 × 700 mm, with Home fitting what the run uses (recommended);
   - widened to 1700 mm;
   - kept at 1400 mm, with the longer island as scenery and room for the rack only.
3. **Tall items in front of the shelf:**
   - rack spots kept clear of tall items' sight lines on the longer rack (recommended);
   - tall items started elsewhere on the bench in 3D;
   - left as built.
4. **Auto view's two follow-ups:**
   - both: Home for a step whose items are all on the shelf, and steady framing for Examine, Selected and Bench
     list picks (recommended);
   - only Home for shelf-only steps;
   - both left as built.
