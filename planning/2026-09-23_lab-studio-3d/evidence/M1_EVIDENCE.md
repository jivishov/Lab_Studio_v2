# M1 evidence note: the Blender pipeline

Branch `claude/lab-studio-3d`. Blender 5.2.2 LTS (`C:\Program Files\Blender Foundation\Blender 5.2`), gltfpack 1.2 (MIT, WASM, copied from the 3D demo's `node_modules` and declared as `"gltfpack": "latest"`).

## Deliverables (plan §7, M1)

| Item | Where |
|---|---|
| Procedural library, ported from the prototype | `tools/blender/labeq/`: `geometry.py` (profiles, lathes, boxes, physical-unit UVs, tubes, profile volumes), `markings.py`, `materials.py`, `export.py`, `render.py` |
| Per-definition module | `tools/blender/equipment/wash_bottle.py` |
| Build, pack and validate tools | `tools/blender/build_equipment3d.py`, `pack_models.py`, `validate_equipment3d.py` (plus `inventory_pack.ts` from M0); npm scripts `equipment3d:*` |
| Registry schema | `src/studio3d/equipment3d/types.ts`, the generated `registry.json`, and `readiness.ts` (runtime parser and 3D readiness) |
| Viewer contracts | `viewerMaterials.json` (allowed model materials by role) and `displayPolicies.json` (measurement-neutral policies) |
| Proposed `AGENTS.md` section | `proposals/AGENTS_3D_ASSETS_SECTION.md`, **awaiting your approval** |

## Static exit: "wash bottle rebuilt through the pipeline, matching the prototype; validator passes"

- **Geometry.** The same profile, wall, dip tube, 72-rib cap, tube boss and delivery tube as the prototype's `build_wash_bottle` (review render: `renders/M1_wash-bottle_review.jpg`).
- **Deliberate differences from the prototype, each for fidelity:**
  1. **No baked water.** Contents are runtime state (plan §4.4, G-3). The registry carries the inner fill profile, which holds 710.6 mL, and the capacity (500 mL).
  2. **No "DEIONIZED WATER" print.** Across the catalogue the same definition holds deionized, distilled or rinse water, a teacher-approved rinse, plain water, or nothing, so a contents label would be false for some techniques. Only the true "500 mL" print remains.
  3. **Body tessellation reduced from 192 to 160 segments.** The profile is unchanged. This brings the packed model to 235,984 bytes, under the 250 KB item budget; the prototype's packed model was 288,564 bytes.
- **Marking font.** Inter, loaded explicitly from Blender's datafiles (SIL OFL 1.1 per Blender's `license.md`). Blender's built-in text font is anonymous (`Bfont Regular`, `<builtin>`), so its licence could not be recorded.
- **Validator.** `py tools/blender/validate_equipment3d.py --pack 1 --only wash-bottle` gives **PASS** (0 failures). As a negative check, the full-pack run fails, as it should, with 13 "no registry entry" failures.
- **Typecheck.** `npx tsc -b` exits 0.

## Written but not run

- `src/studio3d/__tests__/equipment3dRegistry.test.ts`

## Notes for M2

- The build writes 256 × 256 thumbnails (51 KB for the wash bottle). Review renders (1200 × 1500) go to the git-ignored `tools/blender/.build/review/`, and reduced copies are kept in `evidence/renders/`.
- An item counts as an instrument, with the 600 KB budget, when its registry entry declares a display. The catalogue's `category` has no instrument class: `cuvette` and `graduated-cylinder` are "measurement" too.
