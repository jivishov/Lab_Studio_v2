# M0 evidence note

Branch `claude/lab-studio-3d`, created from `1d28429`. Worktree `Lab_studio\tmp\lab-studio-3d`, a checkout of the `jivishov/Lab_Studio_v2` repository. Nothing has been pushed.

## Commits

| Commit | Content |
|---|---|
| `e59b397` | Plan and handoff copies, `DECISIONS.md`, `M0_BASELINE.md` |
| `ca2eb0b` | Shell hooks: `studio3dV1` flag (also recorded in `buildInfo`, and pinned off in the item3 profile), the `#/3d…` routes through `src/studio3d/routes3d.ts`, and the lazy full-window `Studio3DApp` placeholder |
| `bd646e6` | `tools/blender/inventory_pack.ts` and the Pack 1 inventory results |
| `fba6ed6` | `src/studio3d/styles/tokens.css`, `scripts/studio3d/checkTokenContrast.mjs` and the computed contrast table |
| `0b061a3` | Bundled IBM Plex Sans (variable) and Mono, the SIL OFL text and provenance (U1) |
| `c68ae2a` | M0 mock-ups: 22 frames. Private review page: https://claude.ai/artifact/FPmL37sYkDDKWkwypmkhFp |

## M0 static exit (plan §7)

| Item | State |
|---|---|
| Reconciliation decision and baseline recorded | Done. D1: main `1d28429` as is (`M0_BASELINE.md`). |
| Shell hooks (plan §4.7) | Done: `routes.ts`, `App.tsx`, `featureFlags.ts`. `buildInfo.ts` and `scripts/buildItem3HumanTest.mjs` gain the same flag entry for parity. |
| Typecheck with the flag on and off | `npx tsc -b` exits 0. The flag is read at runtime from `import.meta.env`, so the typecheck cannot differ between on and off. Both paths are typed by `AppRoute` and covered by the route tests. |
| Pack 1 inventory run against the baseline | Done. It confirms plan §2.6 and §2.7 (`M0_PACK1_INVENTORY.md`). |
| Design tokens and contrast | All 34 pairs pass (`M0_TOKEN_CONTRAST.md`). |
| Mock-ups approved | **Approved on 2026-09-23** (see `DECISIONS.md`). |

## Written but not run (AGENTS.md validation policy)

- `src/__tests__/routes.test.ts`: two new cases, for flag off and flag on.
- `src/studio3d/__tests__/routes3d.test.ts`: new.
- `src/platform/__tests__/featureFlags.test.tsx`: updated for the ninth flag.
- `npm run content:check` was not run. M0 changes no content, and the check is compared only against its baseline in M8.

## Findings that refine the plan

1. **§2.8.** The runtime seam differs from main only in the committed `c32ba48`. The working copy's uncommitted edits already match main for the seam files. Main is the newer line for every file listed.
2. **§2.6 precision.** The catalogue's precision units do not always match the item: analytical balance `0.001 mL`, volumetric flask `0.1 g`, wash bottle `5 g`, test tube `0.5 g`, reagent bottle `1 g`. The reducer reads precision only when the unit is `mL`. For M2, `validate_equipment3d.py` checks graduations against catalogue precision only where the unit is `mL`. The catalogue is not changed. Presentation is open question **U9**.
3. **Fonts.** The microarray project's three "Sans" files are one variable font. The Mono subset lacks the thin space, so a value's unit spacer is set in the Sans face.
4. **Setup slot labels.** The core exposes slot ids (`finalVolumeMl`), not teacher-facing labels. Open question **U10**.
