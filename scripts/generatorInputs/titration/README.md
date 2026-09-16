# Cycle 07 inputs

The four `*-source.json` files capture the reconciled pre-migration definitions at `055d766`. They are build-time inputs, never imported into the player. `build.mjs` owns the Cycle 07 procedure transformations and explicit source/configuration decisions.

Regenerate with `scripts/migrateCycle07Titration.mjs`; document with `scripts/documentCycle07Titration.mjs`; check with the TypeScript-loader invocation of `scripts/checkCycle07Titration.mjs`. The AP generator family hook delegates to this same builder for its owned titration definitions. Do not hand-edit generated public JSON or regenerate unrelated families.

The source/manual disposition, limitations and exact interface handoff are in `planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-07/IMPLEMENTATION_HANDOFF.md`.
