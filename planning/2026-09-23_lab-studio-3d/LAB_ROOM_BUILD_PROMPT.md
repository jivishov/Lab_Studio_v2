# Prompt for the next thread (2026-10-16: the open lab room, phase 1)

**How to use it.** Paste everything between the two lines into a fresh Claude Code thread, or start it with:

"Implement the plan here: C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d\planning\2026-09-23_lab-studio-3d\LAB_ROOM_BUILD_PROMPT.md".

**How it was checked.** Every fact in it was checked against the repository on 2026-10-16 (at `9a68edd`), then
reviewed for fidelity the same day; the corrections are listed at the end, under "Fidelity review". Re-check before
relying on a line number.

---

Continue Lab Studio 3D. The next step is **phase 1 of the open lab room**: build `proposals/LAB_ROOM_LAYOUT.md`,
revision 2, as I decided it on 2026-10-16. Every decision was answered as recommended, in two rounds:

1. **Layout:** the closed room opens into a teaching hall around our bench, as one long, double-sided island with a
   centre spine (from seven photos of a real lab; the proposal's findings cite them).
2. **Working area:** 1700 × 700 mm, with the middle slot row staggered by half a column, and Home fitting the
   working area and the rack's bays in use. This is phase 2, not this build.
3. **Sight lines:** no start shelf spot is placed behind a bench item taller than the lower tier (300 mm); the oven
   keeps its 2D slot. This is phase 3.
4. **Auto view:** Home for a step whose items are all on the shelf, and steady framing for Examine, the Selected
   view and Bench list picks. This is phase 4.
5. **Real sizes:** no display scale for equipment.
6. **Scenery in the camera's way is cut away:** it fades out while it lies between the eye and the bench; the orbit
   stays free.
7. **The photos' corrections, with the shelf's tier heights kept** (300 and 520 mm).

Read the proposal's "Fidelity review of revision 1" with it. Revision 1's parts (a 2 m aisle with the camera in it,
windows on the left wall, a 2.6 m rack, a 2000 mm bench) are superseded. So is the first of the two lab room rows
in `DECISIONS.md` where the second differs.

**What phase 1 is.** The hall is scenery: nothing in it is a runtime object or pickable (G-8, D9). Phase 1 changes
the room around today's working area only. It must not move a slot, a shelf spot, the side station, `BENCH_MM` or
Home. Build what was decided; don't redesign it.

**Where.** Work only in the worktree `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`.
- **Branch:** `claude/lab-studio-3d`; the remote is https://github.com/jivishov/Lab_Studio_v2.git.
- **Unpushed commits:** `origin/claude/lab-studio-3d` is at `713c248`; every later commit is local. Push only when I
  ask.
- **Live site:** Pack 1 and Pack 2 at https://virtuallab.az/experiments/lab-studio-3d/. Don't republish unless I ask
  (then `PAGES_3D_PUBLISH.md`, section 9).

**Read first, in this order** (all under `planning/2026-09-23_lab-studio-3d/`):
1. `proposals/LAB_ROOM_LAYOUT.md`, in full: revision 2 and its fidelity review.
2. `DECISIONS.md`:
   - the two "lab room" rows (2026-10-16);
   - "A natural lab room in 3D" (2026-10-12), whose room this replaces;
   - "Home fitted to the screen, and charcoal shelf boards";
   - "The shelf build's interpretations";
   - D9 (the visual-only test-tube rack, the precedent for scenery).
3. `SESSION_HANDOFF.md`: "State on 2026-10-04", "Open decisions and items for the user", "Running the app" and
   "Gotchas learned the hard way".
4. `evidence/TRAY_SHELF_EVIDENCE.md`: the shelf as built, and its Home renders.
5. `UI_UX_HANDOFF.md`: the guardrail table (G-1 to G-13; read only, never edit).
6. `proposals/MODEL_REFINEMENT.md`: the standard for new or changed models.
7. `probes/README.md`: `look-room.cjs` and `play-steps.cjs` (`HOMESHOT`, `SEQSHOT`).

**What exists today, with where:**
- **The room** (`src/studio3d/bench/look/room.ts`, LF, 325 lines).
  - `ROOM_SCALE = 1.4 / 15`. The worktop is built in the microarray source's units inside the group `units`
    (`packedBevelBox`, `microarrayGeometry.ts`). The room around it is in metres, with the worktop's top at y = 0,
    x to the right and −z away from the viewer. The working area's centre is the world's origin
    (`toWorld`, `BenchEngine.ts:107`: bench y in millimetres becomes −z).
  - `WORKTOP = { left: -10.5, right: 14.25, front: 5, back: -6.1 }` (room units). Around the 1400 × 700 mm working
    area it runs:
    - 280 mm past its left end;
    - 630 mm past its right end, the side station (`SIDE_STATION`, x 740 to 1300 mm);
    - 117 mm in front of it;
    - 219 mm behind it, under the shelf, whose back is at 550 mm.
  - `WALL_FACE = -6.0`, 10 mm behind the shelf.
  - `ROOM` (metres):
    - floor −0.9 and ceiling 2.0;
    - the side walls at `WORKTOP.left/right × ROOM_SCALE`, the back wall at `WALL_FACE × ROOM_SCALE` (about −0.56)
      and the front wall at 5.2;
    - `window: { left: -0.8, right: 0.5, sill: 0.62, head: 1.62 }`;
    - `cabinetFace`, `toeKick`, `worktopThickness`.
  - `ROOM_BOX`, for the occlusion: the room's box plus `benchMin`/`benchMax`, the bench run as a block from the floor
    to the worktop, wall to wall.
  - `buildRoom()` builds, in order:
    - the worktop slab, named `"bench"`;
    - the floor, the ceiling and four walls, as single-sided quads facing in (a camera outside sees in through them);
    - the back wall around the window's opening, its reveals, and a coved skirting;
    - the window: `windowViewMaterial({ wall, floor })` (`windowView.ts`, a ray-traced lawn and trees, unlit, under
      the bloom threshold) behind a white three-light frame;
    - 600 × 1200 mm ceiling troffers, as quads;
    - the under-bench cabinets: a dark carcass on a toe kick, four modules of laminate drawers over doors, with steel
      bar pulls;
    - the wall text "CHEMISTRY · TEACHING LAB", a canvas texture over the side station
      (`text.position.set(10.9, 6.6, WALL_FACE + 0.015)`, units);
    - the lights.
  - **Materials** come from `mat()`, each patched by `roomOccludedMaterial` ("room", "bench" or "none"). The worktop
    is black-charcoal epoxy (`T.benchC`, `T.benchR`).
  - **Meshes** come from `place()`: `raycast` off, `receiveShadow` on, cast only when asked (the bar pulls).
- **The lights** (`room.ts`):
  - `ROOM_LIGHTS`: the key nearly overhead (`keyDirection`), the fill, the hemisphere (the only ambient) and the
    window's daylight;
  - the key's shadow box is fixed at `left: -14.5 * s, right: 14.5 * s, top: 10 * s, bottom: -10 * s`, about
    2.7 × 1.9 m, with the map at `QUALITY.shadowMap` (2048 on High and Balanced, 1024 on Low);
  - the daylight is a `RectAreaLight` filling the window's opening.
- **The room's occlusion** (`roomOcclusion.ts`, LF) is analytic, not rendered: "a box with the bench run against its
  back wall". It darkens towards the room's six faces and towards one bench block (`benchMin`/`benchMax`), with
  `roomOcclusionAt` as the tested CPU mirror of its GLSL. GTAO (`composer.ts`, `BenchAOPass`) is the screen-space
  part, on High and Balanced only.
- **The reflections** (`roomReflections.ts`, LF): a cube at `REFLECTION_PROBE.position` (0.1, 0.32, 0), `far: 12`,
  prefiltered (PMREM). They are captured in the `BenchEngine` constructor (`BenchEngine.ts`, CRLF, around
  lines 272–286) and again in `loadFurniture()` once the shelf model has loaded (around lines 317–335). Each capture
  draws only the objects it is passed (`room.group`, `room.lights`, then `furniture` too), so scenery outside
  `room.group` is missing from the reflections unless it is added to that set.
- **The shelf model** is the scenery `reagent-shelf` (`tools/blender/equipment/reagent_shelf.py`, LF, `SCENERY =
  True`):
  - 1200 × 180 mm, tiers at 300 and 520 mm;
  - four black powder-coat posts with end rails, phenolic boards with label rails, and a back rod;
  - 32,096 bytes, against the 250,000-byte item budget (`validate_equipment3d.py`, `BUDGET_ITEM`);
  - loaded once by `loadFurniture()` into `this.furniture`, at `SHELF.centre` (`adapters/shelfSpots.ts`, LF: `SHELF`,
    `SIDE_STATION`, `LARGE_STATION_IDS`).

  The spots and the shelf's tags (`bench/scene/shelfTags.ts`) read `SHELF`'s numbers. Phase 1 keeps them.
- **The frame loop** (`BenchEngine.renderFrame`, around line 360) draws on demand. A tick returns `animating` to ask
  for the next frame, and `updateCamera()` (around line 2622) poses the camera through `applyView`.
- **The contact shadows** are re-rendered when `shadowsDirty`. The room, the furniture, the shelf layer and the tags
  are hidden for that pass, so only bench equipment casts them.
- **Quality tiers:** `QUALITY` (`BenchEngine.ts:144–147`) sets the shadow map, AO, bloom, the reflection cube and the
  textures.
- **The camera** (`bench/camera/benchCamera.ts`, LF).
  - `MANUAL`:
    - pitch 0.35 to 1.55;
    - distance 0.30 to 3.17 m;
    - `atXMin −7 · S`, `atXMax 14 · S`, `atZ 9 · S`;
    - `atY −0.3 to 0.5`.
  - **Yaw is unbounded** (`clampManual`).
  - **The clip planes:** `NEAR = 0.04 · S` (3.7 mm) and `FAR = 80 · S` (7.47 m), the source's. The camera sees
    nothing farther than 7.47 m, so the hall's back would be cut off at Home (at 1920 × 1080 the back wall is about
    8 m from Home's eye, and 10 m at its corners).
  - `effectiveDistance` steps back by 1.1 / aspect under 1.1:1, so a portrait tablet's eye is 1.47 times as far.
  - `DEFAULT_VIEW` (the fixed Home): at (−3.2, 0, −2.4) · S, pitch 0.45, distance 32 · S.
  - **Home** is fitted to the screen in `camera/home.ts` (LF), within `distanceMax`.
- **Tests that pin the room** (`src/studio3d/__tests__/naturalRoom.test.ts`, LF):
  - the bench runs wall to wall, on a floor and under a ceiling, with the window's sill above the shelf;
  - the fixed Home's eye (`DEFAULT_VIEW`) stays inside the room and under the ceiling for aspects 16:9 to 0.75, with
    the front wall at least 0.5 m beyond it;
  - one shadow-casting light, nearly overhead, with soft shadows;
  - the probe is inside the room, and its far plane exceeds the room's depth;
  - the occlusion's values at sample points, and its shader patched once;
  - the window view under the bloom threshold, and the live occlusion (GTAO) sized for bench equipment.

  `microarrayLook.test.ts`, `benchCamera.test.ts` and `home.test.ts` pin the look, the camera and Home.
- **The 3D Studio** (`#/3d/studio`, `studio/BenchSetupView.tsx`) uses the same `BenchEngine` and room, so the hall
  shows there too.
- **The theme** is UI only (`ui/theme.ts`, `localStorage` key `lab-studio:3d:v1:theme`, `"hud"` or `"light"`); the
  room is the same in both.
- **Graphics quality** is chosen through `lab-studio:3d:v1:player-ui` (`{ quality, beacon }`), as `look-room.cjs`
  sets it.
- **three.js is 0.184:** `alphaHash` is available for a fade that needs no transparency sorting.

**The work.** Commit each change on its own, with its tests. The mouse, touch, the keyboard and hand control must
each still work at every commit, and every route must still load.

1. **The hall's shell** (`room.ts`). The room becomes a hall of about 12 × 10 m:
   - **the ceiling** at 2.1 m over the worktop (3.0 m above the floor);
   - **the front wall** about 4 m out, as decided; at about 4.3 m it keeps the test's 0.5 m margin for the fixed
     Home's eye on a portrait tablet (that eye is at z ≈ 3.7 m, 1.9 m above the worktop);
   - **the back wall** about 6 m behind the bench's front edge, carrying the windows;
   - **the right end wall** about 2 m past the island's free end;
   - **the left wall** far enough that the island runs on to the left out of Home's frame.

   Walls, floor and ceiling stay single-sided, facing in, so a camera past them sees in through them (the policy
   today). **Nothing may stand in the front zone**, between our bench and the front wall.

   **Raise the camera's far clip** (`FAR`, `benchCamera.ts`) to take in the hall from the farthest the camera
   reaches, about 17 m; `NEAR` stays. This is a 3D camera constant, not a shared change; the proposal missed it.

   Rewrite `ROOM`, `ROOM_BOX` and their tests for the hall:
   - Home's eye stays under the ceiling, and inside the front wall, for the fixed Home at the test's aspects;
   - nothing standing lies in the front zone;
   - the probe's far plane reaches the hall's farthest corner;
   - `FAR` exceeds the distance from the farthest eye the manual limits allow to the hall's farthest corner.
2. **Our island.**
   - **The worktop** runs back past the shelf to a far working side 700 mm deep, so the island is about 1.65 m deep.
   - **It runs on to the left** as a neighbouring station, clean and empty, past Home's frame.
   - **Its right end stays where it is today** (`WORKTOP.right`): the free end, which is the side station.
   - **Under it,** lockable cabinets on both sides, with C handles and key cylinders, as in the photos.
   - **Beyond the free end,** a column with a bench-number sign, clear of the side station.
   - **The working area, its front edge and the side station do not move.**
3. **The spine.** The shelf keeps `SHELF`'s centre, length, depth and tier heights, so no spot moves. To be like
   the photos:
   - its four black posts become perforated grey uprights;
   - the uprights carry two sockets on their faces;
   - a service bar at the spine's foot carries yellow-handled gas and water valves with short blue hoses;
   - a gooseneck tap stands at the spine.

   All of it stays inside the shelf's 180 mm band, so nothing reaches into the working area. These belong in the
   `reagent-shelf` model (Blender; `MODEL_REFINEMENT.md`; within the 250,000-byte budget).

   **Over the neighbouring station,** the spine continues as more instances of the same model. Lattice rods and an
   iron ring hang from it there, never over our bays, so they are not mistaken for the runtime's ring stand.
4. **Beyond the island:**
   - **Behind it:** a 1.5 m aisle, then a second long island of the same kind, empty of equipment. Then another
     aisle, and the back wall with a run of windows. Each window uses the window view (`windowView.ts`), with its
     daylight. The "CHEMISTRY · TEACHING LAB" lettering moves to the back wall.
   - **On the right end wall:** the red fire hose cabinet, a red alarm bell, a door, a fume cupboard and tall
     storage cabinets. The photos show the first three; the fume cupboard and the tall cabinets are extrapolation
     from teaching labs (the proposal's finding 14), and the evidence labels them so.
   - **By the windows:** a stool.
5. **Surfaces and light.**
   - **The floor** becomes large pale glossy tiles, about 600 mm (`textures.ts` floor maps), in place of the natural
     room's vinyl.
   - **The ceiling** becomes a 600 mm grid across the hall, with the troffers and square swirl vents, all
     single-sided quads, so a camera above the ceiling sees through them.
   - **The key light** stays overhead. Re-fit its shadow box to our station and the side station (at 1400 mm it is
     about today's size). The far scenery receives light and casts no shadows.
   - **The daylight** comes from the window run. Keep it and the window view under the bloom threshold (1.05), as
     today.
   - **The reflections** are re-captured with the hall in the two places they are captured now, with every new
     scenery group in the capture's set.
   - **Coplanar details far away:** the troffers sit 1 and 2 mm under the ceiling today. With a 3.7 mm near plane,
     a 24-bit depth buffer resolves only about 2 mm at 10 m, so offsets that small flicker across the hall. Give
     far details at least 5 mm, or a polygon offset.
6. **The room's occlusion** (`roomOcclusion.ts`). Rewrite the analytic model for the hall:
   - the room's faces;
   - a small fixed number of free-standing blocks (our island, the far island, the wall cabinets), passed as a
     uniform array;
   - the cabinet fronts' overhang term kept.

   `roomOcclusionAt` stays the CPU mirror, and the occlusion tests are rewritten against it.
7. **The cutaway** (decision 6).
   - **What can be cut away:** each scenery object that can come between the camera and the bench is its own group:
     the far island, the column, the neighbouring station's spine, and the tall cabinets and the fume cupboard.
   - **What is never cut away:** our island, its bays over our station and the side station.
   - **The test:** whenever the camera moves (`updateCamera`, the tween, the turntable), a group is in the way while
     its bounding box meets a segment from the eye to the look-at point or to a corner of the working area or of the
     shelf's top, or while it contains the eye.
   - **The fade:** about 200 ms, through `alphaHash` opacity, so it needs no transparency sorting against the glass.
     Under reduced motion it switches at once. While it fades, the tick returns `animating`.
   - **What it leaves alone:** the reflection captures and the contact-shadow pass see the room whole, whatever is
     cut away.
8. **Cost.**
   - Merge each group's static meshes by material (`BufferGeometryUtils.mergeGeometries`), and instance what
     repeats (cabinet doors, ceiling panels, uprights).
   - Record the draw calls of one whole frame at Home before and after, in the evidence. The composer renders
     several passes and `renderer.info` resets on each, so set `renderer.info.autoReset = false` and call
     `renderer.info.reset()` before the frame.
   - Take one frame-time reading in the browser pane, never under SwiftShader. It is a note, not the G2 gate, which
     stays closed.
9. **Tests** (beyond those named above):
   - scenery stays out of the working area, the side station and the shelf's band;
   - from eight yaws around the bench, every group the cutaway hides lies on a segment from the eye to the bench,
     and no group that lies on one stays shown;
   - Home, the slots, the shelf spots and `BENCH_MM` are unchanged (the Home, stable bench and shelf tests pass as
     they are);
   - a dispose test for everything the hall adds.
10. **Look (G1)**, with `look-room.cjs` and `play-steps.cjs HOMESHOT`, at 1024 × 700 and 1920 × 1080:
    - `#/3d/play/hard-water-demo` and `#/3d/play/paper-chromatography` at Home, in both themes and on the three
      quality tiers;
    - Overhead;
    - one orbit behind the bench and one from the left end, to show the cutaway;
    - `#/3d/studio`, the bench setup.

    Write `evidence/LAB_ROOM_EVIDENCE.md`, with the renders and a fidelity review of what was built, then **stop for
    my look.** Don't start phase 2.

**The later phases** (the proposal's; for orientation only, each on my go-ahead):
2. The working area at 1700 × 700 mm, with the middle row staggered half a column. This includes:
   - the rack's bays in use, about 1600 mm;
   - `MANUAL.distanceMax` raised to about 3.6 m, so Home fits at 1024 × 700 without the fallback;
   - the contact shadows, the camera's sideways reach and the Studio following `BENCH_MM`.
3. The sight-line rule for shelf spots, proven by projection through Home in all 14 routes.
4. Auto view's two follow-ups.
5. The records.

**Risks to watch** (the proposal's): a busy background competing with the equipment; the cutaway drawing the eye;
frame time; and the room the five waiting looks were built in. Report them; don't build past them without asking.

**Stop and ask** (AskUserQuestion, recommended option first), and record my answers in `DECISIONS.md`:
- any shared change: a catalogue definition, a reducer branch or a runtime parameter. Bring a test proving 2D
  unchanged;
- any effect on 2D;
- any change that would move a slot, a shelf spot, the side station, `BENCH_MM` or Home in phase 1;
- any departure from the proposal's revision 2 or the decided sequences;
- any interpretation the build meets. Expect at least these:
  - where the spine's fittings live: in the `reagent-shelf` model, or as their own scenery models;
  - the windows: how many, how large, and how the daylight reaches the bench from about 6 m;
  - the far island and the neighbouring station: empty, or with a few bottles on their spines;
  - the floor tiles' size, colour and gloss, and the fume cupboard's form;
  - a cutaway rule that hides too much or too little.

**Check and record:**
- `npx tsc -p tsconfig.app.json --noEmit`;
- `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d`: 358 pass in 35 files on 2026-10-16. A worker
  start timeout under CPU load is the machine; re-run;
- `npm run content:check`: exits 1 with "violations: 22" ("baseline: 22 new"), the expected baseline. Anything beyond
  it is the build's;
- `node scripts/practice3d/build.mjs --check`;
- `py tools/blender/validate_equipment3d.py --pack 3`;
- `git status` shows no 2D paths;
- one G1 look per change;
- the evidence note, with its fidelity review;
- a "built" row in `DECISIONS.md`;
- `SESSION_HANDOFF.md` brought up to date.

**Tooling:**
- **Blender.** Scenery is built and packed like any model:
  ```bash
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tools/blender/build_equipment3d.py -- --only <ids> --review
  py tools/blender/pack_models.py --only <ids>
  py tools/blender/validate_equipment3d.py --pack 3
  ```
  - `pack_models.py` regenerates `registry.json`; never edit it by hand.
  - Materials go in `tools/blender/labeq/materials.py`.
  - A new viewer role goes in `viewerMaterials.json` and `src/studio3d/bench/look/materials.ts`.
- **The preview for G1.** The desktop app's preview reads `.claude/launch.json` in the thread's working directory.
  Create it for the look and delete it afterwards:
  ```json
  { "version": "0.0.1", "configurations": [ { "name": "lab-studio-3d-dev", "runtimeExecutable": "pwsh",
    "runtimeArgs": ["-NoProfile", "-Command", "Set-Location 'C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d'; npx vite --host 127.0.0.1 --port $env:PORT --strictPort"],
    "port": 5182, "autoPort": true } ] }
  ```
  Use the port the preview reports.
- **Headless looks** with Playwright, from `probes/`. Set
  `export NODE_PATH=C:/Users/EmilJivishov/Projects/Lab_studio/node_modules`. Things to know:
  - `look-room.cjs <prefix> [low balanced high]` shoots each quality tier, then Whole bench and Overhead. It is fixed
    to `http://localhost:5182/#/3d/technique/dilution` (Dilute a Stock Solution) at 1280 × 800, with no theme.
  - `play-steps.cjs <url> <outdir> [shot steps] [stop after]` takes the URL, at a fixed 1024 × 700. `HOMESHOT` shoots
    Home. The camera tweens, so use `SEQSHOT` before calling anything missing.
  - For this look's routes, sizes, themes and tiers, extend the probes with optional settings whose defaults keep
    today's behaviour (the URL, the viewport, the theme through `localStorage` `lab-studio:3d:v1:theme` in an init
    script, as `look-room.cjs` sets the quality), and note them in `probes/README.md`. Use the port the preview
    reports.
  - A whole lab replay takes more than 10 minutes under SwiftShader. Run it in the background, not under a 600 s
    timeout.

**Standing constraints:**
- **Gates:** G1, one browser look per change. G3 (webcam hand control) is set aside. No G2. No publishing unless I
  ask.
- **Git:**
  - Never use a bare `git stash`; the stash is shared with the main checkout.
  - Never run `git clean -x`, a recursive `reset --hard`, or a whole-worktree checkout from the Projects root.
  - The branch `claude/lab-studio-3d` is the final, authoritative code for the 3D version, kept completely separate
    from the 2D version. Never merge, fast-forward or push it into `main`, local or on GitHub, which is the 2D version.
  - Commit locally. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Scope:**
  - The 2D player must not change: nothing under `src/player/**` or `src/styles/app.css`.
  - Nothing writes `public/techniques/` or `public/labs/`.
  - The 2D generators are not touched.
  - Tablet, laptop and larger only; no mobile layouts (G-12).
  - Core or content changes beyond the decisions need my decision first.
- **Hands off:**
  - the authoritative `C:\Users\EmilJivishov\Projects\Lab_studio`, apart from its git-ignored `tmp\` worktrees;
  - the main checkout `...\tmp\github-export\Lab_Studio_v2`;
  - the microarray lab's folders: its room stays as it is, and only Lab Studio 3D's room changes;
  - `AP_CHEM_LABS` (read only);
  - `virtual_lab`, except the temporary `.claude/launch.json` above and publishing when I ask;
  - unselected projects (the Projects `AGENTS.md` sync boundary);
  - `IMPLEMENTATION_PLAN.md` and `UI_UX_HANDOFF.md` (never edit).
- **Policies:**
  - Atomize to real physical actions within reason, with gestures that reproduce the real action.
  - Modestly boost faint visuals.
  - Keep the science guardrails G-1, G-3, G-8, G-9 and G-11; for this build also mind G-6, G-7, G-10 and G-12.
  - The hall and everything in it is scenery (G-8, D9): never picked, listed or selectable.
- **Line endings:** git keeps each file's own (`* -text`). Count bytes before editing:
  `py -I -c "b=open(r'<file>','rb').read(); print(b.count(b'\r\n'), b.count(b'\n'))"`.
  - **CRLF** (byte-counted 2026-10-16):
    - `src/studio3d/bench/BenchEngine.ts`;
    - `src/studio3d/equipment3d/viewerMaterials.json`;
    - `tools/blender/labeq/materials.py`;
    - `DECISIONS.md`.
  - **LF:**
    - `src/studio3d/bench/look/`: `room.ts`, `roomOcclusion.ts`, `roomLighting.ts`, `roomReflections.ts`,
      `windowView.ts`, `textures.ts`, `composer.ts`, `contactShadows.ts` and `materials.ts`;
    - `src/studio3d/bench/camera/`: `benchCamera.ts` and `home.ts`;
    - `src/studio3d/adapters/`: `stableBench.ts`, `shelfSpots.ts` and `benchCoordinates.ts`;
    - `src/studio3d/studio/BenchSetupView.tsx`;
    - `src/studio3d/__tests__/`: `naturalRoom.test.ts`, `microarrayLook.test.ts`, `benchCamera.test.ts`,
      `home.test.ts`, `stableBench.test.ts` and `shelfSpots.test.ts`;
    - `tools/blender/equipment/reagent_shelf.py`;
    - `SESSION_HANDOFF.md`, `probes/README.md`, the evidence notes and the proposals.
  - Edit CRLF files with a byte-aware script (normalize to LF, assert one match per edit, restore CRLF). Git Bash's
    `sed -i` turns a CRLF file into LF.

**Open items outside this task.** Don't start any of them:
- publishing;
- G3;
- Pack 3b (brass);
- the glass draw-order issue (the polish pass);
- Heat and Reweigh's composition step accepting any typed value (shared runtime, my decision);
- the runtime's duplicate derived attachment (`withResolvedAttachments`, `src/runtime/attachments.ts`; 3D keeps
  each child's first relation in `adapters/heldRelations.ts`; a shared fix is my decision);
- a rim or edge highlight for faint glass (the proposal leaves it for its own decision).

Start by reading the files above. Then confirm the facts under "What exists today", and build phase 1.

---

## Fidelity review (2026-10-16)

The prompt was checked against the repository after it was written. Corrected:

1. **The camera's far clip.** The draft did not mention it, and neither does the proposal. `FAR` is `80 · S`
   (7.47 m), and at 1920 × 1080 the hall's back wall is about 8 m from Home's eye (10 m at its corners), so the
   windows would be cut off. Step 1 now raises it to about 17 m, with a test.
2. **The headless probes.** The draft said to point the scripts at the preview's port. `look-room.cjs` is fixed to
   `http://localhost:5182/#/3d/technique/dilution` at 1280 × 800, with no theme. `play-steps.cjs` takes the URL but
   fixes 1024 × 700. The prompt now says to extend both with optional settings whose defaults keep today's behaviour.
3. **The worktop's margins.** The draft repeated `room.ts`'s comment ("about 130 mm further back", "620 mm past its
   right end"). Measured from `WORKTOP` and `toWorld`, the worktop runs 219 mm behind the working area (19 mm past
   the shelf's back) and 630 mm past its right end. The prompt now gives the measured margins on all four sides.
4. **Decision 3's wording.** The draft said only "behind a tall bench item". The decided rule, from the first lab
   room row, is "taller than the lower tier (300 mm)", with the oven keeping its 2D slot.
5. **The front wall.** The draft gave 4.3 m as if it were decided. The decision is "about 4 m out, which the camera
   may pass"; 4.3 m is now given as the value that keeps the room test's 0.5 m margin for the fixed Home's eye on a
   portrait tablet (z ≈ 3.7 m, computed from `eyeOf`).
6. **The reflection captures** draw only the objects they are passed (`BenchEngine.ts:283` and `:329`). A
   scenery group outside `room.group` would be missing from the reflections, so the prompt now says so.
7. **Counting draw calls.** `renderer.info` resets on every render, and the composer renders several passes, so a
   reading taken after a frame counts only the last pass. The prompt now says to turn off `autoReset` for the count.
8. **Depth precision.** The troffers sit 1 and 2 mm under the ceiling. Seen 8 to 13 m away across the hall, offsets
   that small flicker. Step 5 now asks for at least 5 mm, or a polygon offset.
9. **The room tests.** `naturalRoom.test.ts` has ten. The draft's list missed the shadow light, the shader patched
   once and the GTAO sizing, and called the window view's test one of colours (it is the bloom threshold). The
   list now covers all ten.
10. **Smaller corrections:**
    - D9 is the visual-only test-tube rack, the precedent for scenery, not a general scenery rule;
    - the shelf's tags are in `bench/scene/shelfTags.ts`;
    - the fume cupboard and tall cabinets are extrapolation (the proposal's finding 14), and the evidence labels them
      so.

Confirmed as written:
- `room.ts` is 325 lines;
- the constants `WORKTOP`, `WALL_FACE` and `ROOM`, the shadow box (±14.5 · s by ±10 · s), `BLOOM.threshold` 1.05,
  `OCCLUSION` and `REFLECTION_PROBE`;
- the `QUALITY` tiers at `BenchEngine.ts:144–147`, `loadFurniture()` at 317, `renderFrame` at 360, the shadow pass
  hiding the room, the furniture, the shelf layer and the tags (433–440), and `updateCamera()` at 2622;
- the `MANUAL` limits and `DEFAULT_VIEW`;
- `SIDE_STATION` and `LARGE_STATION_IDS`;
- the storage keys;
- three.js 0.184.0;
- the files named under "Read first", and the decision rows and handoff sections by their titles.

The checks on 2026-10-16 at `9a68edd`:
- `tsc`: clean;
- vitest: 358 pass in 35 files;
- `content:check`: "violations: 22", "baseline: 22 new, 0 changed fingerprint, 478 resolved", exit 1;
- the practice build check: exit 0;
- the model validator: Pack 3 passes, 12 definitions, 0 failures, models 729,280 bytes.
