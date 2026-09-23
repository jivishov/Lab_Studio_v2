# Lab Studio 3D: decision record

Governing documents: `IMPLEMENTATION_PLAN.md` (revision 2.1) and `UI_UX_HANDOFF.md` (revision 1), copied byte-for-byte into this folder from `C:\Users\EmilJivishov\Projects\Lab_studio\planning\2026-09-23_lab-studio-3d` (SHA-1 `6500137…` and `e5ace8d…`).

## Decided by the user (2026-09-23)

| # | Decision | Choice | Evidence |
|---|---|---|---|
| D1 | Core baseline | **Adopt GitHub main `1d28429b14b5d6c02ec48048ae1a2ef84dee6a6a` as the core baseline.** No file-by-file merge: for every plan §2.8 file, main is the newer line. | `evidence/M0_BASELINE.md` |
| — | Location | A new branch, `claude/lab-studio-3d`, from `1d28429` in the `jivishov/Lab_Studio_v2` repository. It is a git worktree at `Lab_studio\tmp\lab-studio-3d`, which `Lab_studio/.gitignore` (`tmp/`) keeps out of the Projects repository. The authoritative working copy (`Lab_studio`, Projects branch `codex/Lab_Studio`) is not modified. | `evidence/M0_BASELINE.md` |
| D9 | Test-tube support | **(a) A visual-only rack, shown as bench scenery.** It is not an equipment instance, cannot be selected, is not listed, and is labelled "Scenery" in Examine (handoff G-8). | Plan D9 |
| U1 | Font family | **IBM Plex Sans and IBM Plex Mono** (SIL OFL), bundled locally. The licence is checked when the fonts are added (plan §6.3). | Handoff §3.3 |
| M0 | Mock-ups | **Approved** (2026-09-23): all 22 frames at https://claude.ai/artifact/FPmL37sYkDDKWkwypmkhFp (`mockups/lab-studio-3d-mockups.html`, commit `c68ae2a`). This closes M0; M3 and later presentation work may start. | `evidence/M0_EVIDENCE.md` |
| U9 | Catalogue precision units | **Show capacity and precision only when the unit matches the item's measure:** mL for volumetric ware, g for a balance. Values that don't match are omitted from Examine and the library cards. The catalogue itself is never changed. | `evidence/M0_EVIDENCE.md`, finding 2 |
| U10 | Setup slot labels | **Show friendlier teacher-facing labels**, from a label map in the 3D presentation layer keyed by slot id. The core slot id stays visible to the Studio author, in a tooltip or in mono text; the core itself is unchanged. | `evidence/M0_EVIDENCE.md`, finding 4 |
| G1 | Browser checks while building | **Spot visual checks authorised** (2026-09-23): one built-in-browser look per change while building M3–M5; no test suites or matrices. Full G1 playthroughs remain for M8 acceptance. | — |
| — | AGENTS.md 3D asset rules | **Adopted** (2026-09-23), commit `399c86f`. | `proposals/AGENTS_3D_ASSETS_SECTION.md` |

## Open decisions, with the plan's recommendation used provisionally

Work that depends on these stays reversible until you confirm.

| # | Decision | Provisional default | Blocks |
|---|---|---|---|
| D8 | How experiments are compiled from techniques | (a) flattening append from M6; (b) composition-source authoring as Phase B's main deliverable | Phase B only |
| Q4 | Pack grouping | Catalog order, in packs of five | Pack 2 onward |
| Q5 | Visual direction | The handoff's design system, proposed in the M0 mock-ups for your approval | M3 onward (through mock-up approval) |
| Q6 | Gates G1–G4 and a linter | None authorised. No linter is added. Under `AGENTS.md`, validation is source review plus typecheck; tests are written but not run. | Authorised exits only |
| U2 | One design system for both apps | Yes | — |
| U3 | Starting bench view in Studio 3D | Yes (M6); starting items in seated positions wait for the M6 verification | M6 |
| U4 | Weighing display wording | One neutral line from the display policy: "This simulation does not generate balance readings." | M5 |
| U5 | Returning items to the tray | Parity: only when a step expects it | M4 |
| U6 | Turning items | Examine only | M4 |
| U7 | Overlap ring in assessment mode | Shown (parity) | M4 |
| U8 | Resuming a run | Not in Pack 1 | — |

## Gates that remain closed

- **G1 playthroughs, G2–G4.** Full browser playthroughs, performance, webcam and publishing. None is exercised without your go-ahead; only G1 spot checks are authorised.
