# M3 evidence note: the live bench and the adapters

Branch `claude/lab-studio-3d`. three.js 0.184, rendering with Khronos PBR Neutral tone mapping and no bloom.

## Deliverables (plan §7, M3)

| Item | Where |
|---|---|
| Adapters | `src/studio3d/adapters/benchCoordinates.ts`, `runtimeToScene.ts`, `instrumentDisplay.ts` (commit `b368d8c`) |
| Look layer, ported from the prototype's `look.js` | `src/studio3d/bench/look/`: `environment.ts` (a synthetic lab rendered into a PMREM), `textures.ts` (procedural and tileable), `materials.ts` (settings by viewer role from `viewerMaterials.json`), `contactShadows.ts`, `composer.ts` (multisampled HDR, Neutral tone mapping, vignette) |
| BenchEngine and BenchView | `src/studio3d/bench/BenchEngine.ts` (imperative; renders on demand; syncs from `runtimeToScene`) and `BenchView.tsx` (a thin React wrapper; falls back to navigation when WebGL 2 is missing) |
| Scene builders | `bench/scene/contents.ts` (liquids lathed from the model's fill profile, coloured only by `resolveLiquidStyle`; powder heaps at `solidRest`), `displays.ts` (a canvas face drawn only from `instrumentDisplay` lines, with a learner's value labelled "Your entry"), `signals.ts` (beacon, selection, valid and invalid rings with stroked ✓ and ✕, dashed footprint) |
| Model loading | `equipment3d/loadModels.ts`: GLTFLoader with the bundled MeshoptDecoder; one load per definition; the URL versioned by source hash |
| Bench preview | `#/3d/technique/:id` (`bench/BenchPreview.tsx`) draws the technique's real runtime state, with tray items free-moved onto the bench through the runtime's own `benchMove`. Player3D (M5) replaces it. |

## Static exit

- `npx tsc -b`: exit 0.
- Adapter tests for each technique's initial state, weighing's final state through the real runtime, and the display-policy tests (`src/studio3d/__tests__/adapters.test.ts`): written, **not run**.

## G1 spot checks (authorised 2026-09-23: one look per change in the built-in browser)

| Look | Finding | Action |
|---|---|---|
| `#/3d/technique/transmittance-dilution`, first render | Renders with no console errors, 9 items and 0 missing models; liquid colours from the registry palette. The camera started too close. | Frame the whole bench once models load |
| Same, framed | The photometer housing was blown out to white; the background read dull | Housing base colour set to linear 0.62 at source; background intensity raised |
| `#/3d/technique/weighing` | The balance's glass draft shield was nearly invisible, so its top frame appeared to float | Frame posts and a door rail added to the model, as real draft shields have |
| Reload after the model change | The browser served the cached GLB | Model URLs are now versioned by source hash |
| `#/3d/technique/weighing`, final | The draft shield is legible, the powder heap shows in the reagent bottle, and the watch glass and spatula are correct | — |

## Known limitations recorded

- **Items can overlap in 3D.** Runtime positions are 2D picture coordinates. A state laid out by the 2D player, or by this preview's grid (272 mm pitch against a 320 mm photometer), can therefore overlap in 3D. Placements made in 3D go through `nearestFreeSpot` (M4). A state saved by the 2D player is drawn as the runtime has it and is never silently moved (G-3).
- **Flat glass reads faintly** in real-time rendering. It shows at glancing reflections, not as in Cycles. Frame posts keep the balance's draft shield legible.
