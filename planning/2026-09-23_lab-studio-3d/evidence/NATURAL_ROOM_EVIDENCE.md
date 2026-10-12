# A natural lab room in 3D: evidence (2026-10-12)

You asked: "What else can be done for the realistic natural lab environment visibility? Currently it is more of artificial view than natural." You then approved the proposed first pass: "I like the first pass and the black/charcoal epoxy worktops for better equipment stand out. Lower hime camera."

This revises the microarray-look adoption of 2026-10-03/04 (`MICROARRAY_ADOPTION_EVIDENCE.md`) for Lab Studio 3D only. The microarray lab itself was not touched. The microarray look's final composite is unchanged: the ACES curve, the vignette, the gamma and the bloom.

Renders: `renders/NR_before_after_wide.jpg` (five views at 1280 × 800: Home, a side view, the bench preset, the top preset and a selected item) and `renders/NR_before_after_tablet.jpg` (Home on an 834 × 1112 tablet). Each is the same view before and after, on Balanced, in headless Chromium (SwiftShader).

## Why it looked artificial

- **Scale:** the room was built around the microarray's 15-unit bench and never closed. The floor sat 0.31 m under the worktop.
- **Grey void:** it showed past the walls' ends and under the floor.
- **Lighting:** one light from the side lit everything evenly, and the reflections came from an analytic room that did not match the one on screen.
- **Contact and texture:** nothing darkened where surfaces meet, and the walls and floor were flat colour.

## What was built

| Part | Built | Where |
|---|---|---|
| **Closed room** | A room at real scale round the bench: floor 0.9 m under the worktop; a 2.0 m high ceiling of 600 mm acoustic tiles in their T-bar grid, with six LED panels; side walls; a front wall 5.2 m out; coved skirting. The base cabinets were rebuilt at real scale: four modules of a drawer over a door, a toe kick and steel pulls. Every surface faces in, so an orbiting eye still sees into the room. | `look/room.ts` (`ROOM`, `buildRoom`) |
| **The room's own occlusion, every tier** | Inside corners darken. So do the wall just above the worktop, the floor at the toe kick, and the cabinet fronts under the worktop's edge. The darkening is worked out from the room's box in the shader, so it costs no pass. | `look/roomOcclusion.ts` |
| **Live AO, High and Balanced only** | three.js's GTAO, sized for equipment (radius 0.07 m, blend 0.85), for a bottle's foot on the shelf or a cuvette in its holder. Glass, liquids, labels and other see-through things are left out of its depth and normals. Low has none. | `look/composer.ts` (`AO`, `BenchAOPass`); `BenchEngine.ts` (`QUALITY.ao`) |
| **Lighting** | Still one shadow-casting light, now nearly overhead (direction −0.15, 1, 0.45; was −6, 9, 3.5), with short shadows softened by `shadow.radius` 4. `PCFSoftShadowMap` is deprecated in three r184, so the shadows use `PCFShadowMap` with a radius. The fill now comes from the front right (0.45, 0.5, 1; was 6, 4, −2). Daylight from the window is an unshadowed area light filling the opening, tilted a little down (intensity 2.2). The light colours, the hemisphere ambient, the shadow's 0.22 left over and the clear colour are unchanged. | `look/room.ts` (`ROOM_LIGHTS`) |
| **Reflections of the room** | The built room, its lights and, once it loads, the reagent shelf are rendered once into a cube from above the bench and prefiltered. Glass and the worktop then reflect the window, the ceiling panels and the shelf. The second capture renders into the same target, so materials keep their map. Cube size: 256 on High and Balanced, 128 on Low. | `look/roomReflections.ts`; `BenchEngine.ts` |
| **Surfaces** | All procedural, nothing downloaded. **Plaster:** a roller mottle and an orange-peel stipple. **Floor:** 300 mm vinyl composition tiles with fine chips, laid quarter-turned, with seams. **Ceiling:** tiles with fissures. **Cabinets:** a faint laminate mottle. Textures keep their real size in metres. | `look/textures.ts` (`TILE_M`) |
| **Window view** | A lawn, a treeline 12 m out and trees 45 m out, under the sky, out of focus. Each pixel follows the eye's ray to the ground, the treeline, the trees or the sky, so the view keeps its depth as the camera moves, with no backdrop edges and nothing past the far plane. The lab is on the ground floor. All values stay under the bloom threshold, as the window has since 2026-10-05. | `look/windowView.ts` |
| **Black-charcoal epoxy worktop** (approved) | It replaces the slate-blue resin: #2a2c2e with a faint cloudy mottle, sparse fine specks, and a satin sheen (roughness 0.36) with a few fine scratches. It is a 28 mm slab with eased edges. | `look/textures.ts`; `look/room.ts` |
| **Lower Home camera** (approved) | Home's pitch is 0.45 rad, was 0.66; the look-at point and distance are unchanged. The eye is about 1.3 m over the worktop at 16:9, 1.8 m on an 834 × 1112 tablet and 1.9 m at a 0.75 portrait, under the 2.0 m ceiling. The existing Home framing tests (shelf right of the step card and below the top bar, front edge above the dock) pass at 0.45. | `camera/benchCamera.ts` (`DEFAULT_VIEW`) |

## Not done, as agreed

- **Tone curve:** no change.
- **No new furniture or set dressing:** no sink, fume hood, eyewash, poster or gas outlets. The cabinets were already under the bench and were only rebuilt to the room's scale.
- **Nothing downloaded.** Every texture and the window view are procedural.

## Tuning after the first render

| # | Seen | Changed |
|---|---|---|
| 1 | **The window read as frosted glass.** Home looks down through the window, about 9° to 13° below the horizon. A view laid out by elevation showed only an even pale green there. | The view now casts the eye's ray onto real distances. Home sees the lawn and the foot of the treeline; lower views see the trees and the sky. |
| 2 | **No sky at the window's top from Home or the side view.** The trees filled it. | The treeline was lowered (1.4 m plus crowns up to 1.3 m) and the trees moved back (45 m). |
| 3 | **Wipe marks on the worktop read as loops, and then, once blurred, as a stamp repeating every 0.5 m.** | Removed. The sheen is plain satin with the fine scratches. |
| 4 | **The floor's chips looked like camouflage on the tablet**, 40 mm blobs at high contrast. | The chips were made finer (about 5 to 15 mm) and their contrast halved. |

## Cost

- **Shadows:** one shadow-casting light, as before.
- **Occlusion:** the room's occlusion is a few instructions per pixel on the room's own materials.
- **GTAO:** on High and Balanced only, it renders the scene's normals and depth once more per drawn frame. Frames are drawn on demand.
- **Reflections:** the cube is rendered twice per lab load: once at start and once when the shelf arrives.

## Checks (2026-10-12)

- **Type-check:** `npx tsc -p tsconfig.app.json --noEmit` is clean.
- **Tests:** `npx vitest run src/studio3d --maxWorkers=2` passes 32 files and 329 tests. This includes the new `__tests__/naturalRoom.test.ts`, which covers:
  - the room's bounds;
  - Home's eye inside the room and under the ceiling, from 16:9 to a 0.75 portrait;
  - one soft, near-overhead shadow light;
  - the probe inside the room;
  - corner, bench and overhang occlusion and the shader patch;
  - the window's values under the bloom threshold, sky brighter than lawn brighter than trees;
  - the AO size.

  The default worker count timed out starting workers on this machine; every file passed.
- **HUD contrast:** `node scripts/studio3d/checkTokenContrast.mjs` passes 71 of 71. The worktop renders between about #383a3b and #565a5f, lighter than the check's dark stage (#2b302c), so the dark-stage case is still the worse one.
- **Practice build check:** `node scripts/practice3d/build.mjs --check` exits 0.
- **Content check:** `npm run content:check` reports 22 violations, the same as before this change.
- **Console:** the renders logged no page errors or console errors or warnings.

## Known limits

- **Yaw is unbounded,** as before. An orbit can take the eye behind the back wall or out past a side wall. The walls face in, so from outside the room is seen through them, as a cutaway.
- **Steep zoom-out on a narrow screen:** at the steepest manual pitch and the longest distance on a portrait screen, the eye can rise above the ceiling. The ceiling faces down, so it is not drawn from above.
- **The window view is fixed:** it does not change with the time of day, and it is not reflected in the glass of the window itself.
