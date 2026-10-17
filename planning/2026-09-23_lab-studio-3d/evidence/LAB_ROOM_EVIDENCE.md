# The lab room, phase 1: evidence (2026-10-16)

You asked: "Implement the plan here: …LAB_ROOM_BUILD_PROMPT.md". The build met four questions, and you answered them: "Shelf model + rods model (Recommended)", "5 windows, one light (Recommended)", "Empty (Recommended)" and "600 mm warm pale, satin; benchtop hood (Recommended)" (`DECISIONS.md`, the "phase 1 built" row).

This is phase 1 of `proposals/LAB_ROOM_LAYOUT.md` revision 2, for Lab Studio 3D only. The closed room becomes a teaching hall around our bench. The hall is scenery. No slot, shelf spot, the side station, `BENCH_MM` or Home moved; the 1700 mm working area is phase 2. Nothing in 2D changed.

**Commits:** `aa21b14` (the spine's models), `481af48` (the hall), `f609a2a` (the cutaway and the spines), `8c9cc20` (our shelf section merged, and the probes).

**Renders** (headless Chromium with SwiftShader). They show `8c9cc20` and nothing later. Camera work went on in this worktree while they were taken, so:
- the 1024 × 700 shots and the HUD Homes at 1920 × 1080 came from this worktree's server before any of that work reached it. Its Home at 1920 matches the separate checkout's pixel for pixel;
- the rest came from `8c9cc20` checked out on its own;
- the "before" shots came from `60ea47e` checked out on its own.

The files:
- `renders/LR_before_after_1024.jpg`: Home, Overhead, an orbit behind the bench and one from its left end, before (`60ea47e`, the closed room) and after. Water hardness, HUD, Balanced, 1024 × 700.
- `renders/LR_home_tiers_1024.jpg`: Home in both labs, both themes and the three tiers, 1024 × 700. Its last row is `play-steps.cjs` with `HOMESHOT`: Paper Chromatography on High, Light, at Home after step 1, then at step 2.
- `renders/LR_1920.jpg`: 1920 × 1080, Balanced: Home in both labs and themes, then Overhead and the two orbits.
- `renders/LR_studio.jpg`: `#/3d/studio`'s Starting bench at 1024 × 700 and 1920 × 1080. The Studio opens on an empty draft, so the bench is empty.
- Every shot is in `lab-room/`, named by lab, theme, size and tier.

## What was built

| # | Step | Built | Where |
|---|---|---|---|
| 1 | **The hall's shell** | A hall 12.0 × 10.15 m. The floor is 0.9 m under the worktop. The ceiling is 2.1 m over it, 3.0 m above the floor. The front wall is 4.3 m out, 0.5 m beyond Home's eye on a portrait tablet. The back wall is 5.85 m behind the working area's centre. The right end wall is 2.0 m past the island's free end, and the left wall 2.25 m past the island's far left end, out of Home's frame. Walls, floor and ceiling stay single-sided, facing in. The camera's far clip is now `182 · S`, 17.0 m (it was `80 · S`, 7.5 m); `NEAR` is unchanged. | `look/hall.ts` (new: every place in the hall); `look/room.ts`; `camera/benchCamera.ts` (`FAR`) |
| 2 | **Our island** | The worktop runs back past the shelf to a far working side 700 mm deep, so the island is 1.72 m deep (the plan said about 1.65 m). It is 7.7 m long: past our station it runs on to the left as a clean, empty neighbouring station. Its front edge and its right end (the side station) are where the worktop ended before. Under it, on both sides: cabinets in about 600 mm modules, a drawer over a door, with C handles standing 28 mm proud and a key cylinder beside each. Beyond the free end: a 0.4 m column with the bench-number sign "3", clear of the side station. | `look/hall.ts` (`ISLAND`, `COLUMN`); `look/room.ts` (`islandBase`) |
| 3 | **The spine** | The `reagent-shelf` model keeps its 1200 × 180 mm footprint, its tiers and its spots. Its four black posts are now perforated uprights in mid-grey powder coat, each with two sockets on its face. A service bar at its foot carries yellow-handled gas and water valves with short blue hoses, and a gooseneck tap stands at the spine. All of it stays inside the 180 mm band; the sockets and the tap stand past the boards' ends, inside the 1300 mm section pitch. The model went from 32,096 to 100,464 bytes (budget 250,000). A new scenery model, `spine-rods` (41,460 bytes, 1180 mm tall), carries the lattice rods and an iron ring. The neighbouring station has four more sections of the shelf at a 1.3 m pitch, each with the rods. The far island has six sections, without rods. No rods stand over our bays. | `tools/blender/equipment/reagent_shelf.py`, `spine_rods.py`; `tools/blender/labeq/materials.py`; `public/assets/equipment-3d/v1/`; `look/spines.ts` (new) |
| 4 | **Beyond the island** | **Behind it:** a 1.5 m aisle, a far island of the same kind, empty, and a second aisle of 1.38 m. **The back wall:** five windows, each 1.8 m wide and 0.9 to 2.4 m above the floor, 2.3 m apart. Each shows the window view, with the "CHEMISTRY · TEACHING LAB" lettering above them. **The right end wall:** a red fire hose cabinet with a glazed strip and a latch, a red alarm bell, and a door with its frame, a lever handle and a kick plate. These are in the photos. Tall storage cabinets (1.8 m along the wall, 2.0 m tall) and a fume cupboard are extrapolation (finding 14). The fume cupboard is a 1.5 m benchtop unit on a base cabinet, its sash half open and its light off. **By the windows:** a stool. | `look/hall.ts` (`FAR_ISLAND`, `WINDOWS`, `END_WALL`, `STOOL`); `look/room.ts` |
| 5 | **Surfaces and light** | **Floor:** 600 mm porcelain tiles, warm pale grey (#d9d6cf), with thin grout and a satin glaze (roughness about 0.35); they replace the vinyl. **Ceiling:** a 600 mm grid across the hall, with 600 × 1200 mm LED troffers and 600 mm square swirl vents, all single-sided and facing down. **Key light:** still overhead, in the same direction. Its shadow box was re-fitted to our station and the side station: 2.3 × 1.86 m (was 2.7 × 1.9 m). The far scenery receives light and casts no shadows. **Daylight:** one area light across the whole window run, intensity 2.9 (was 2.2 for one window), so a face turned to the windows gets about what the one window gave. It stays under the bloom threshold, as does the window view. **Reflections:** captured in the same two places as before, now with the hall and every scenery group in the set. The probe is over the worktop, and its far plane is 12 m, past the hall's farthest corner. **Far details:** the troffers' glow sits 9 mm and the vents 6 mm under the ceiling, both with a polygon offset. | `look/textures.ts` (`TILE_M.floorTile` 0.6); `look/room.ts` (`ROOM_LIGHTS`, `SHADOW_BOX`); `look/roomReflections.ts` |
| 6 | **The room's occlusion** | Rewritten for the hall. It takes the hall's faces and five free-standing blocks, passed as a uniform array: our island, the far island, the column, the tall cabinets and the fume cupboard's base. The cabinet fronts' overhang term is kept. `roomOcclusionAt` is still the CPU mirror, and the tests run against it. | `look/roomOcclusion.ts`; `look/hall.ts` (`BLOCKS`) |
| 7 | **The cutaway** | Seven groups can be cut away: the far island, the column, the neighbouring station's spine, the tall cabinets, the fume cupboard, the end wall's fittings (fire hose cabinet, bell and door) and the stool. Each has its own box. **Never cut away:** our island, its bays over our station and the side station. **The test:** whenever the camera moves (the manual controls, a tween, the turntable), a group is in the way while its box meets a segment from the eye to the look-at point, or to a corner of the working area or of the shelf's top, or while it holds the eye. **The fade:** 200 ms, through `alphaHash` opacity, so it needs no sorting against the glass. Under reduced motion it switches at once. While it fades, the tick reports `animating`. A group that has faded out is hidden, so it costs nothing. **What it leaves alone:** the reflection captures see the room whole (`Cutaway.whole()`). The contact-shadow pass hides the room anyway. | `look/cutaway.ts` (new); `look/hall.ts` (`CUT_BOXES`, `SIGHT_TARGETS`); `BenchEngine.ts` |
| 8 | **Cost** | Each scenery group's static meshes are merged by material (`mergeGeometries`), one draw call per material per group. The spines are merged from the loaded models. So is our own shelf section, since its new fittings made the model 50 meshes. The draw calls are below. | `look/room.ts` (`Batch`); `look/spines.ts` (`mergeByMaterial`) |
| 9 | **Tests** | **New, `labRoom.test.ts`:** scenery keeps out of the working area, the side station and the shelf's band; nothing stands in the front zone; the hall is never picked. `BENCH_MM`, the shelf, the side station, the default view, and the shelf spots and Home of two labs are unchanged (a snapshot). Every cut group is built, and our island is in none. From eight yaws at Home's distance, eight more zoomed out and low, and Overhead, the cutaway hides every group a sight line meets (by ray against the groups' triangles) and nothing else. The fade, reduced motion and the whole room for captures. One disposal test for everything the hall and the spines make. **Rewritten, `naturalRoom.test.ts`:** the hall's size and walls; Home's eye inside it from 16:9 to a 0.75 portrait; `FAR` beyond the farthest corner from the farthest eye; one soft shadow light; the probe; the occlusion. **Changed, `shelfSpots.test.ts`:** the shelf model's bounds may pass its boards' ends, but stay under the 1300 mm pitch. | `src/studio3d/__tests__/` |
| 10 | **Look (G1)** | This note and the renders above. | `evidence/` |

## Interpretations the build met

These are recorded in `DECISIONS.md`'s "phase 1 built" row.

- **Your four answers:**
  - **(a)** The spine is the reagent shelf's model with its fittings, plus a separate `spine-rods` model over the neighbouring station only.
  - **(b)** Five 1.8 m windows, lit by one area light across the run.
  - **(c)** The far island is empty.
  - **(d)** 600 mm warm pale grey porcelain tiles, and a 1.5 m benchtop fume cupboard on a base cabinet.
- **The end wall's fittings and the stool** are cut-away groups of their own. The plan's list did not name them, but the camera may pass the right end wall, and the stool can come between the eye and the bench.
- **Merged, not instanced.** The plan said to merge each group by material and instance what repeats. Merged, each group already draws once per material, so instancing the doors, panels and uprights would add no saving.
- **Our own shelf section is merged too.** Its fittings made it 50 meshes. Merged, Home draws fewer calls than before the hall.
- **Daylight raised from 2.2 to 2.9,** because one area light now spans five windows about 6 m away.
- **`FAR` is 182 room units (17.0 m).**
- **The tall cabinets and the fume cupboard are extrapolation** (finding 14). The photos do not show them.
- **The commits combine steps.** The plan asked for each change in its own commit. Steps 1, 2, 4, 5 and 6 all rewrite `room.ts` and its tests, so they went into one commit (`481af48`). The cutaway and the spines' placement share `BenchEngine.ts` (`f609a2a`).

## Cost

Draw calls in one whole frame at Home, counted with `probes/count-draws.cjs`: Water hardness, Balanced, 1024 × 700, over 30 frames, with `renderer.info.autoReset` off and `reset()` first.

| | Before (`60ea47e`, the closed room) | After (`8c9cc20`, the hall) |
|---|---|---|
| Draw calls per frame | 771 | **754** |
| The calls of each of the frame's two scene renders | 475 + 253 | 470 + 242 |
| The room's meshes | 55 | 43 |
| The bench furniture's meshes (the shelf and, after, the spines) | 18 | 26 |

- **Shadows:** still one shadow-casting light. The far scenery casts none.
- **The cutaway:** a box test against nine segments when the camera moves. A faded-out group is not drawn.
- **Frame time: pending.** It is to be read once in the app's browser pane at your look. The pane was hidden during this build, and SwiftShader's frame times mean nothing. It is a note, not the G2 gate, which stays closed.

## Checks (2026-10-16, at `8c9cc20`)

- **Type-check:** `npx tsc -p tsconfig.app.json --noEmit` is clean.
- **Tests:** `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d`: 36 files and 392 tests pass. On the first run, 34 files passed with 379 tests. Two files, `makingSolutionScene.test.ts` and `teacherPreparedReadings.test.ts`, never ran: their workers timed out starting under load. Run alone, they pass with 13 tests.
- **Content check:** `npm run content:check` exits 1 with "violations: 22", the baseline.
- **Practice build check:** `node scripts/practice3d/build.mjs --check` exits 0.
- **Models:** `py tools/blender/validate_equipment3d.py --pack 3` passes.
- **2D:** `git status` shows no 2D path. Nothing under `src/player/`, `src/styles/app.css`, `public/techniques/` or `public/labs/` changed.
- **Console:** the looks logged no page errors and no console errors.

## Fidelity review

What was built, against revision 2 and the seven photos:

| Finding | Revision 2 | Built | Verdict |
|---|---|---|---|
| 7 | Windows along the long back wall, past the far island | Five along the back wall, past the far island | As planned |
| 8 | A long island with several stations; the spine stops at our working area's right end; the free end is the side station | As planned. The neighbouring station is clean and empty | As planned |
| 9 | Perforated uprights, two sockets, a service bar with yellow valves and blue hoses, gooseneck taps, rods and rings over the neighbouring station only | All of these, inside the 180 mm band. The rods are a model of their own | As planned |
| 10 | Tiers kept at 300 and 520 mm (decision 7); the photos' are about 450 and 800 mm | Kept | **A known difference from the photos** |
| 11 | Large pale glossy floor tiles | 600 mm, #d9d6cf, satin (roughness about 0.35), as you chose | Close: satin rather than the photos' gloss |
| 12 | One column at our island's free end, with a bench sign | As planned, with the sign "3" | As planned |
| 13 | A hall of about 12 × 10 m; the fire hose cabinet, bell and door on the end wall; a stool by the windows | 12.0 × 10.15 m, with all of these | As planned |
| 14 | A fume cupboard and tall cabinets, labelled extrapolation | Built, and labelled so here and in `hall.ts` | **Extrapolation** |

**What the looks show** (`LR_before_after_1024.jpg`; Water hardness, HUD, Balanced, 1024 × 700):

- **Home:** the bench, its items and the shelf are where they were, and keep the strongest light. Behind and through the shelf the hall now shows:
  - the far island's spine, with its valves and hoses;
  - the neighbouring station's uprights and rods at our shelf's left end;
  - the end wall's tall cabinets at the top right;
  - our island's cabinet fronts, with their handles, along the bottom edge.
- **A busy background, the proposal's first risk, is visible.** The far spine's service bar stands at about the height of our lower tier, and it shows through that tier's open back. If it competes with the items, the proposal's remedy is a back panel on the lower tier.
- **The windows have left Home's frame.** The closed room's window stood just behind the shelf. The window run is now about 6 m back, above the far spine, at the top edge of the picture. The trees are seen by tilting up or orbiting.
- **Behind the bench (yaw 180):** the far island is cut away, so the bench is seen across open floor. Our shelf's back shows the service bar with its valves and hoses.
- **From the left end (yaw −90):** the neighbouring station's spine is cut away, so the eye sees our section's end: the sockets on the upright and the gooseneck tap. The end wall's door and fire hose cabinet stand beyond.
- **Overhead:** as before, apart from the hoses at the shelf's foot and the scenery at the frame's edges.

## Known limits

- **Yaw is unbounded,** as before. The walls are single-sided. An orbit can take the eye out past a wall, and the hall is then seen through it, as a cutaway.
- **The eye can pass the front wall.** The fixed Home stays 0.5 m inside it on a portrait tablet. A manual zoom-out with the bench's front turned to the viewer can still take the eye beyond it.
- **The oven still hides lower-tier items** from Home. That is phase 3's sight-line rule.
- **Looks at 1920 × 1080 are slow under SwiftShader.** A frame takes seconds, and the engine clamps a frame's dt to 0.1 s, so a 650 ms tween takes many seconds of wall time. Screenshots took minutes, the Light theme's most. Shots run alongside another browser or a Blender build timed out at 180 s. `look-room.cjs` now has these settings:
  - it waits for the route's start button;
  - it clicks `LOOK_CLICK`'s button or tab from the page, without waiting on the Studio's bench build;
  - `LOOK_SETTLE` scales its waits;
  - `LOOK_SHOT_TIMEOUT` sets a screenshot's timeout, and a failed screenshot is retried once.

  The 1920 shots were taken one at a time, each orbit in its own run.
- **Frame time is unread,** as above.
- **The 1700 mm working area, the stagger and the camera's reach** wait for phase 2.
