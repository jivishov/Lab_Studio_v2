# Proposal: an open teaching lab around a longer island bench (3D only)

Status: **revision 2, 2026-10-16, not built.**

Revision 1 was decided the same day, all four decisions as recommended:
1. "Island in open lab";
2. "2000 × 700, Home fits use";
3. "Keep spots clear";
4. "Both".

Revision 2 answers your request: "Evaluate possibility increasing the size of the glassware to offset the related
issues you mentioned. Along with it, critically review your lab room layout for fidelity and refine where needed."

- **Decisions 1, 3 and 4 stand**, refined below.
- **Decision 2 is reopened.** Measuring Home showed that the 2000 mm bench costs more than revision 1 said, and that
  its remedy does not work (review finding 1).
- **New decisions 5 to 7** come from the review.

Asked for first on 2026-10-16, with seven photos of a real teaching lab: "I propose to remove the immediate walls
the bench has, extend the front view with lab view with maybe some cabinets by the wall, extend the bench
horizontally and allow larger area for shelving, equipment placing and hence preventing the view blocked by any
equipment. Just like in any lab there must be some comfortable area to move around, hence the front of the bench may
be some large place."

## Where the room is today

- **The room is closed tight around the bench** (`bench/look/room.ts`, the natural room of 2026-10-12):
  - side walls at the ends of the bench run;
  - the back wall just behind the reagent shelf, with a window onto trees over the shelf;
  - a front wall 5.2 m out, at the farthest the camera reaches (a portrait tablet at the manual limits);
  - a ceiling 2.9 m above the floor (2.0 m above the worktop), and a vinyl tile floor.

  The walls, floor and ceiling are single-sided, so a camera outside the room sees in through them.
- **The working area** is `BENCH_MM`, 1400 × 700 mm (`adapters/benchCoordinates.ts`), the one mapping from the
  runtime's 760 × 520 bench. Runtime units are never rewritten. Items the runtime gives no position stand in 2D's
  default grid (`stableBench.ts`): three rows of five, 257 mm apart across and 191 mm apart in depth, each column
  directly behind the next.
- **The reagent shelf** (`adapters/shelfSpots.ts`) is 1200 mm long, with tiers at 300 and 520 mm, each 1132 mm
  usable. The side station at its right holds the large stations.
- **Home** fits, from pitch 0.45:
  - the whole working area;
  - the shelf to its top;
  - the spots of the items now on the shelf or at the side station (`camera/home.ts`).

  It is limited to the wheel's farthest distance, 3.17 m (`MANUAL.distanceMax`), and falls back to the fixed Home
  when nothing fits within it.

## Measured: what the working area's width costs at Home

Home was fitted with its own code (`fitSteady`, with the step card and dock as in the Home tests) to the working area and a
rack whose loaded tops reach 750 mm. The table gives how large 100 mm at the bench's middle is drawn. A temporary
probe was used; it was not committed.

| Working area | 1920 × 1080 | 1024 × 700 | Home's distance at 1024 × 700 |
|---|---|---|---|
| 1400 mm (today) | 84 px | 38.5 px | 2.97 m |
| 1700 mm, rack 1600 mm | 75 px (−11 %) | 32.4 px (−16 %) | 3.41 m |
| 2000 mm, rack 2000 mm | 65 px (−22 %) | 28.0 px (−27 %) | 3.85 m |
| 2000 mm, rack 2600 mm (revision 1) | 61 px (−27 %) | 24.3 px (−37 %) | 4.18 m |

- **At 1024 × 700, both wider benches lie past the wheel's limit.** Without a change to `MANUAL.distanceMax`,
  Home would fall back to the fixed view, which does not show the whole bench.
- **A rack longer than the working area costs size too.** It widens what Home must show.

## Evaluated: making the glassware larger

**What it would take.** Every model is built at real size in millimetres. The validator ties each vessel's inner
profile to its catalogue capacity (`validate_equipment3d.py`, rule 3), so the registry itself cannot be scaled.
Scaling could only happen when drawing: each item drawn s times larger. Inside one item, everything would stay
consistent, because they are model-local and scale with the item:
- the liquid level from its volume;
- the graduations, the calibration ring and the meniscus;
- its displays, its anchors and its pour lip.

**Why it does not help:**

1. **Uniform scaling only undoes the widening.** Make every item s times larger on a bench W wide, and the picture
   is a real-size bench W / s wide, with a larger room around it. Every gap and every overlap scales the same way.
   To give back today's size at Home, the 2000 mm bench needs s of about 1.3 (from the table: 84 / 65 and
   38.5 / 28). That is the same bench, as crowded and as blocked, as a real-size bench of about 1540 mm. A partial
   s of 1.15 is a real-size bench of about 1740 mm. Choosing the width directly gives the same result without the
   costs below.
2. **It teaches the wrong sizes.** At s = 1.3:
   - a 100 mL cylinder stands as tall as a real 250 mL one;
   - a 250 mL beaker looks like a 600 mL beaker;
   - the 25 mm worktop edge, the 900 mm bench, the shelf and the room stay real around them.

   Students learn what a 10 mL pipette or a cuvette looks like beside the rest, so the relation of size to volume is
   part of the lesson.
3. **The rest must scale with it.** All of these work in real millimetres today and would need the factor:
   - the footprints, which the shared overlap classifier works on (`footprints.ts`);
   - the shelf's tier clearance (202 mm; at s = 1.3 every item over 155 mm tall would have to go to the upper tier);
   - the side station's packing;
   - the carry and pour heights;
   - the contact shadows.

   Scaling only the glassware would also break every fit with an unscaled instrument: a beaker on the balance pan, a
   cuvette in the photometer's slot, a funnel in the ring, a crucible in the triangle.
4. **Enlarging only the small items** (capillary, pencil, Beral pipette, cuvette, watch glass) also breaks
   measurement:
   - the ruler's printed millimetres no longer match the strip's distances (`scaleMm` in the registry);
   - the capillary's spot sizes no longer match the strip;
   - the pump no longer seats on the pipette.

**Recommendation: keep real sizes** (decision 5). Meet size at Home by choosing the width (decision 2), and meet the
small items' visibility with what already exists:
- Home fitted to the screen;
- Auto view, which frames a step's items closer;
- hover labels;
- the "needed now" ring;
- the Shelf list;
- Examine.

If a thin glass item still reads faintly at Home after the room is built, a modest rim or edge highlight would follow
the standing policy of modestly boosting faint visuals. That would be its own decision, and it is not part of this
plan.

## Fidelity review of revision 1

Checked against the code and against your seven photos. Each finding is folded into the refined plan below.

**The bench and Home:**

1. **"Home fits what the run uses" does not work, and was described wrongly.**
   - Each of a run's first 15 items owns its slot, whether or not it is on the bench yet. So once a run has five
     items, its slots span the grid's whole width: at 2000 mm, slot centres run from −798 to +697 mm.
   - Revision 1 said Home would be "decided once at the start". In fact Home already counts the items now on the
     shelf, and is worked out each time it is pressed.
   - The remedy is dropped. Home fits the working area and the rack's bays in use, as today.
2. **The view is also blocked on the bench, not only at the shelf.** Revision 1 said nothing else was hidden at Home;
   only shelf spots were checked. The grid's columns stand directly behind each other, 191 mm apart. From Home's
   pitch (sight lines fall 0.48 mm per mm going back), an item hides the bottom h − 92 mm of the item behind it:
   - a 250 mL beaker (about 120 mm tall) hides the bottom 28 mm;
   - a 100 mL cylinder (250 mm) hides 158 mm;
   - the oven (420 mm) hides 328 mm.

   A wider bench does not help with this, because the columns stay aligned. **Staggering the middle row by half a
   column** does: an item no wider than half a column (130 to 190 mm) no longer stands in front of one in the next
   row. The front and back rows still line up, but 382 mm apart, so only an item over about 185 mm tall hides
   anything of the one behind it. Slots are
   already a 3D-only layout (decided 2026-10-11, "Yes, all 3D"), so the runtime is unaffected. This is part of
   decision 2.
3. **The camera does not stand in a 2 m aisle.**
   - Today, Home's eye is 2.0 to 2.7 m out from the point it looks at, and 1.0 to 1.3 m above the worktop (1.9 to
     2.2 m above the floor).
   - At 1700 mm, it is 3.1 m out and 1.5 m up at 1024 × 700.
   - Right-drag raises it by up to 0.5 m more, which reaches today's 2.0 m ceiling over the worktop.
   - The wheel's farthest reach must rise with any wider bench (above).

   Refined:
   - the floor in front of our island is kept clear of anything standing, to the front wall;
   - the front wall stands about 4 m out, a real room's size, and the camera may pass it, seeing in through it as it
     already does through the side walls;
   - the ceiling rises to 3.0 m above the floor (2.1 m over the worktop), a real lab's height and about what the
     photos show;
   - ceiling fittings are single-sided panels, so a camera above the ceiling sees through them.
4. **The camera orbits all the way round.** Yaw is unbounded. The camera reaches 3.17 m from the look-at point today
   (more once the reach is raised, and 1.47 times that on a portrait tablet), and the look-at point itself slides
   along and across the bench. A second island 1.5 m behind ours, columns, or the spine continuing past our
   station would stand between the camera and the bench when it orbits behind or to the side. Revision 1's test that
   "no scenery sits inside the camera's reach" cannot hold with real aisle widths. **Decision 6:**
   - cut away scenery that stands in the way, hiding a scenery object while it lies between the eye and the bench, as
     the single-sided walls already vanish from outside (recommended);
   - or limit the orbit to the front half;
   - or set the scenery beyond the camera's reach, which needs aisles of 4 m or more.
5. **The room's occlusion is worked out, not rendered.** Revision 1 called it screen-space. `roomOcclusion.ts` is an
   analytic model of "a box with the bench run against its back wall"; only GTAO (`composer.ts`, High and Balanced
   tiers) is screen-space. An island in the open breaks that model, so it is rewritten for a free-standing block
   (and the other blocks) in phase 1.
6. **The key light's shadow box is fixed** at 2.7 × 1.9 m (`room.ts`), with a 1024² map by default. It is
   re-fitted to our station and the side station. At 1700 mm that is about the same size, so shadows keep their
   sharpness. At 2000 mm the box grows by about 15 %, and shadows soften by as much.

**The room against the photos:**

7. **The windows are on a long wall, parallel to the islands** (photo 6), not on an end wall as revision 1 put them.
   Refined: the windows run along the back wall, beyond the far island, so the trees are still seen past the rack,
   now across the room.
8. **The islands are long, with several stations** (photos 4 and 6), and the spine stops short of the island's end,
   where a balance and reagent bottles stand (photo 6). Refined:
   - our station is one section of a long island that runs on to the left: a neighbouring station, clean and empty,
     with the spine continuing over it as scenery;
   - the spine stops at our working area's right end;
   - the island's free end beyond it is the side station, as the photo shows.

   Shelf spots stay in our station's bays, so Home does not have to take in the whole spine.
9. **The spine's details** (photos 1, 2, 4 and 5):
   - perforated uprights;
   - two sockets on each upright's face;
   - a service bar at the spine's foot with yellow-handled gas and water valves and blue hoses;
   - gooseneck taps (photos 2 and 5);
   - lattice rods and iron rings hung on the shelves (photos 1, 2 and 5).

   All of these are scenery, kept inside the rack's 180 mm band so nothing reaches into the working area. The rods
   and rings are left out of our station's bays, so they are not mistaken for the runtime's ring stand; they appear
   over the neighbouring station.
10. **The photos' tiers stand higher than ours.** Estimated from the photos at about 450 and 800 mm above the
    worktop; ours are 300 and 520 mm, as decided for the shelf.
    - **For:** a lower tier at 450 mm would clear the oven (420 mm) on its own.
    - **Against:** the rack would be taller in Home, and measured with loaded tops at 1030 mm instead of 750 mm, it
      draws 100 mm at 66 px instead of 84 px at 1920 × 1080 (−21 %).
    - It would also change the shelf's decided geometry.

    Recommended: keep the decided heights and record this as a known difference (decision 7).
11. **The floor** in the photos is large pale glossy tiles (photos 4 and 6), not vinyl. Refined: large pale floor tiles.
12. **Columns** stand at the islands' ends, with bench-number signs (photos 3 and 6). Refined: one column at our
    island's free end, with a bench sign. It is scenery, cut away like the rest (finding 4).
13. **The room is a large hall** (photos 4 and 6), with rows of long islands. Its end wall carries the red fire hose
    cabinet, an alarm bell and a door (photos 3 and 4), and a stool stands by the windows (photo 6). Refined: about
    12 × 10 m, with these on the right end wall and by the windows.
14. **What the photos do not show**, kept as extrapolation from teaching labs and labelled so: a fume cupboard and
    tall storage cabinets on the right end wall (your "cabinets by the wall"). Revision 1's wall sink run and
    glass-fronted wall cabinets are dropped. The photos show taps on the islands instead (finding 9).

**Capacity:**

15. **Measured** from each route's start state. Shelf spots take about 124 mm each, gaps included. The fullest
    route, the hard-water lab, uses 639 mm of the lower tier and 727 mm of the upper.

    At that average, two tiers hold about:

    | Rack | Items |
    |---|---|
    | 1200 mm | 18 |
    | 1600 mm | 25 |
    | 1700 mm | 26 |
    | 2000 mm | 31 |

    Pack 3b's 29 would need about 1.85 m, or a third tier at the top. That is for Pack 3b's own plan; Pack 3b is not
    started. With the oven's hidden span kept clear (about 550 mm of the lower tier), the hard-water lab still fits
    a rack of 1600 mm or more.

## The refined proposal

### 1. The open room (decision 1, refined by findings 3 to 9 and 11 to 14)

The room is a hall of about 12 × 10 m with a 3.0 m ceiling.

**Our island:**
- one double-sided island, about 1.65 m deep, the working depth of 700 mm on each side of the spine;
- it runs on to the left as a neighbouring station, past the frame of Home;
- the spine stops at our working area's right end, and the free end beyond it is the side station, with a column
  and a bench sign;
- the worktop stays black-charcoal (your choice, 2026-10-12) where the photos have white, because the equipment
  stands out against it;
- under it, lockable cabinets with C handles, as in the photos.

**The spine:**
- the shelf, at its decided tiers and depth, on perforated uprights;
- the sockets, the service bar with yellow-handled valves and blue hoses, and a gooseneck tap.

**Around the island:**
- **In front:** clear floor to a front wall about 4 m out. Nothing stands in it, and the camera may pass the wall.
- **Behind:** a 1.5 m aisle, then a second long island of the same kind, empty of equipment. Beyond it, the
  windows along the back wall with their view of trees, and the "CHEMISTRY · TEACHING LAB" lettering.
- **The right end wall:** the fire hose cabinet, an alarm bell, the door, a fume cupboard and tall storage cabinets.
- **The floor:** large pale tiles.
- **The ceiling:** a 600 mm grid with recessed light panels and square vents, all single-sided.

**Seen from Home:** the bench and the spine fill the lower part of the screen. Above and through the open tiers you
look across the aisle to the second island and the bright window wall beyond, with the island running on to the left
and the column and end wall at the right.

**What changes in the look's code:**
- the room's analytic occlusion, for free-standing blocks (finding 5);
- the shadow box, re-fitted (finding 6);
- the reflection cube, re-captured, its 12 m reach covering the hall;
- the cutaway for scenery in the camera's way (decision 6).

The far scenery is merged, instanced where it repeats (cabinet doors, ceiling panels, uprights) and casts no shadows.
One frame-time reading is taken at each look; that is a note, not the G2 performance gate, which stays closed.

### 2. The working area (decision 2, reopened)

The options:
- **1700 × 700 mm with the middle row staggered** (recommended):
  - slots 315 mm apart instead of 257;
  - the rack's bays in use about 1600 mm long;
  - things drawn 11 to 16 % smaller at Home;
  - the wheel's farthest reach raised to about 3.6 m.
- **2000 × 700 mm** (decided in revision 1), staggered as well:
  - 22 to 27 % smaller at Home;
  - the farthest reach raised to about 4.0 m;
  - the camera can rise through the ceiling with right-drag (it sees through it).
- **1400 × 700 mm with the middle row staggered:** no size cost. The longer island is scenery, and the extra rack
  length comes only from the neighbouring bays, which would have to hold spots, so Home would widen anyway.

**What follows `BENCH_MM` in each case:**
- the contact shadows;
- the camera's sideways reach (`MANUAL.atX*`, `FRAME_REACH`);
- the Studio's 3D bench setup (`studio/BenchSetupView.tsx`);
- the keyboard steps, which are already in millimetres (10 mm, 50 mm with Shift) and so keep their size; at about
  2.1 mm per runtime pixel across (1700 mm), a 10 mm step is about five pixels.

The runtime keeps its 760 × 520 bench and units, and a saved run loads in either player (G-3).

**The stagger:**
- the middle row moves half a column right;
- an item that would then pass the bench's right margin is held at it, as `toBench` already clamps;
- only drawing positions change, for items the runtime has none for.

### 3. Nothing tall in front of the shelf (decision 3, as decided, made precise)

No start spot is placed where a tall bench item hides it from Home.

- **A tall item** is one higher than the lower tier's top (300 mm), measured from its built bounds.
- **The span it hides** is cast back onto the rack along Home's direction (pitch 0.45, yaw 0). It is widened by a
  margin for the perspective of an item standing off the middle, so it does not depend on the screen.
- **What is checked:** the side station's items as well as the working area's, although with the spine ending
  before the side station they stand clear of it.
- **If a tall item is moved later in the run,** no spot moves (the stable rule).

The oven keeps its 2D slot. Proven in phase 3 by projection through Home in all 14 routes, at 1024 × 700 and
1920 × 1080.

### 4. Auto view's two follow-ups (decision 4, as decided)

- A step whose items are all on the shelf goes to Home.
- Examine, the Selected view and Bench list picks use Auto view's steady framing.

## What stays

- **The runtime, its units and saved states;** the catalogue and the registry's real sizes (decision 5); the 2D
  player (`src/player/**`, `src/styles/app.css`); the 2D generators; `public/techniques/` and `public/labs/`.
- **The microarray lab and its room.**
- **The shelf's tier heights, depth and spot rules,** unless decision 7 says otherwise.
- **The hand's screen-space targets and the carry.**
- **The step card, the dock and both themes.**

## Phases (each ends with one G1 look in the browser, then stops for you)

1. **The open room** at today's working area: the room, the island, the spine and its fittings, the far island, the
   walls, the floor, the ceiling and the column, with the occlusion model, the shadow box, the reflections and the
   cutaway. *Tests:*
   - scenery stays out of the working area and the rack's band;
   - nothing stands in the front zone;
   - the cutaway hides each object that lies on the line from the eye to the bench, from eight yaws;
   - the occlusion model's values at sample points;
   - a dispose test.

   *G1:* Home in the hard-water lab and Paper Chromatography, at 1024 × 700 and 1920 × 1080, in both themes, plus one
   orbit behind the bench, with the frame-time note.
2. **The working area,** per decision 2, with the stagger and the camera's reach. *Tests:*
   - `toBench` and `fromBench` round-trip over the runtime bench;
   - a saved 2D state loads unchanged;
   - Home fits at 1024 × 700 without the fallback;
   - no start item in the 14 routes stands directly behind one in the next row;
   - how much of each start item is hidden at Home, before and after the stagger, is reported in the evidence.

   *G1:* the same views, with a slide and a zoom.
3. **The sight-line rule.** *Tests:*
   - in all 14 routes, no start item's spot is hidden at Home;
   - spots stay stable and distinct.

   *G1:* the hard-water lab and Dry and Weigh at Home.
4. **Auto view's two follow-ups.** *Tests:* the framing unit tests. *G1:* Auto view on a step whose items are all on
   the shelf.
5. **Records:** `DECISIONS.md`, the evidence file with renders, and `SESSION_HANDOFF.md`.

## Risks

- **Size at Home.** The width is now chosen with measured costs. If 1700 mm still reads small at phase 2's look,
  1400 mm with the stagger is the fallback.
- **A busy background.** The far island and the window wall are kept lower in contrast than the bench, and the
  bench keeps the strongest light. If the far side reads as clutter through the tiers, the lower tier can take a
  back panel.
- **The cutaway.** Objects appearing and vanishing as the camera orbits may draw the eye. They fade over about
  200 ms rather than popping, and with reduced motion they switch at once. If it still distracts, the orbit limit
  is the alternative (decision 6).
- **Frame time.** The hall is several times the closed room's area, but the far scenery is static, merged and casts
  no shadows. If the note shows a drop at 1920 × 1080, the far island is simplified first.
- **The waiting looks.** Five builds still wait for your look (the HUD, the natural room, the themes, the Home fit,
  right-drag). Phase 1 changes the room the natural room built. Your look at phase 1 can cover the room and the
  themes together.

## Decisions for you (revision 2)

Already decided and standing: 1 (island in an open lab, refined as above), 3 (spots kept clear) and 4 (both Auto
view follow-ups).

2. **The working area (reopened):**
   - 1700 × 700 mm with the middle row staggered (recommended);
   - 2000 × 700 mm, staggered;
   - 1400 × 700 mm, staggered.
5. **The glassware's size:**
   - keep real sizes (recommended);
   - enlarge all equipment uniformly, about 1.15×;
   - enlarge only the small items.
6. **Scenery in the camera's way:**
   - cut it away while it is in the way (recommended);
   - limit the orbit to the front half;
   - set scenery beyond the camera's reach.
7. **The photos' corrections:**
   - apply findings 7 to 14 and keep the tier heights (recommended);
   - apply them and also raise the tiers to about 450 and 800 mm;
   - keep revision 1's layout.

## Revision 1 (superseded where revision 2 differs)

Revision 1 put:
- a 2 m front aisle with the camera in it;
- windows on the left wall;
- a 3.0 × 1.5 m island with a 2.6 m rack;
- a wall run of sink and glass-fronted cabinets;
- a 2.9 m ceiling;
- Home fitting the slots a run uses, decided once at the start.

Findings 1, 3, 7, 8 and 14 replace these.
