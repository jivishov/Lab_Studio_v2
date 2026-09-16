# Lab Studio

> This is an independent private repair checkout exported from the live Lab Studio working tree. It is a source snapshot for subsequent work, not a release or readiness claim. See [export provenance](docs/export-handoff/PROVENANCE.md), [setup notes](docs/export-handoff/SETUP.md), and [verification boundaries](docs/export-handoff/VERIFICATION_BOUNDARIES.md).

Lab Studio is a client-side React + TypeScript platform for chemistry lab authoring and simulator-style student practice. It uses static Vite output and hash routes so it can be hosted without a backend.

## Grounded Experiment Composer

The WebMCP challenge extension supports one bounded family: estimating the molarity of a **synthetic monoprotic-acid sample** by titration with standardized NaOH and a phenolphthalein endpoint. A browser agent can inspect the supported family and current simulation inventory, replace that reversible inventory profile, compile a staged experiment, rehearse it through the ordinary Student Player resolver/reducer, and run a ten-case Protocol Check.

WebMCP is essential because the work crosses live application state that is difficult and unreliable to infer from DOM text or canvas interactions: inventory revisions, compiler validation, staged-versus-current drafts, current simulator steps, evidence prerequisites, and deterministic Protocol Check results. The app exposes those operations directly with `document.modelContext.registerTool()` while the teacher keeps final authority.

The agent cannot Apply, Discard, Save, Export, or Publish. **Apply to Studio** and **Discard** are visible human-only controls. Previewing and rehearsing do not change the current Studio draft.

### Local WebMCP test setup

Requirements: Node.js 24, npm, and either ChatGPT's in-app browser or a current Google Chrome build with `chrome://flags/#enable-webmcp-testing` enabled and Chrome restarted. Record the exact client and version in final evidence rather than treating one Chrome version as timeless.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5175/#/studio` in the WebMCP-capable client. In a normal browser the Studio remains usable, but browser-agent tools are unavailable by design.

Copy this prompt:

> Build a 45-minute guided pre-lab for estimating the molarity of a synthetic unknown monoprotic acid with standardized 0.100 M NaOH. We have a 50 mL burette, ring stand and clamp, graduated cylinder, 250 mL Erlenmeyer flask, phenolphthalein, waste beaker, splash goggles, eyewash, spill-response materials, and a compatible base-waste container. Inspect Lab Studio first, use only supported inventory IDs, stage the experiment without changing my current draft, rehearse one invalid attempt and recover, run Protocol Check, and stop for me to review and click Apply or Discard.

The currently supported tool surfaces are documented in [WebMCP integration](docs/WEBMCP.md). A final authorized local Codex in-app Browser journey passed on 2026-08-29 at `1440x900`: all seven Studio and six rehearsal tools were observed, the rehearsal completed `12/12` with one deliberate rejection/recovery, Protocol Check passed `10/10`, the accessibility bridge remained visually hidden, and human Apply/Discard were untouched. This is one E10 sample against the current uncommitted checkout, not deployed-origin, normal-browser fallback, broad viewport/client, or release proof; E1-E9 remain **UNRUN**.

### Scientific and platform limits

- Supported: one synthetic acid/NaOH family with 10 verified modules and a 12-node indicator-only execution sequence.
- Modeled: deterministic 1:1 titration planning, evidence prerequisites, qualitative endpoint state, and evidence-derived molarity calculation.
- Procedural only: mirroring handling steps for an external physical unknown; the simulation does not characterize that sample.
- Unsupported: arbitrary chemistry, a full pH/equilibrium model, analytical certification, comprehensive safety review, regulatory qualification, or authorization for physical work.
- The optional pH confirmation P1 module is omitted.
- Ordinary liquid/solution content conservation is implemented in source for the bounded paths described in [Fidelity](docs/FIDELITY.md); its focused runtime regressions are authored but **UNRUN**.
- Hidden answer fields are omitted from learner UI and WebMCP results, but a static client cannot make bundled model state cryptographically secret. This is training/practice software, not secure high-stakes assessment.

## Development commands

```bash
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
npm run smoke:e2e
```

Repository policy permits only basic static checks unless a later prompt authorizes detailed execution. See the current Cycle 06 handoff for the exact run/unrun ledger.

## Routes

- `#/studio` opens Lab Design Studio and the WebMCP Composer surface.
- `#/labs` opens the bundled lab catalog.
- `#/techniques` opens the bundled technique catalog.
- `#/play/acid-base-titration` opens the schema-backed reference titration lab.
- `#/play/hard-water-demo` and `#/play/intro-filtration-demo` open reference labs.

## Architecture

- `src/experimentComposer` contains the bounded inventory, verified family/module catalog, compiler, fidelity manifest, staging, and human-approval guards.
- `src/webmcp` contains direct progressive-enhancement registration and the exact Studio/rehearsal tool adapters.
- `src/protocolCheck` contains the isolated ten-case driver and report contract.
- `src/runtime` remains the pure interaction resolver/reducer boundary used by humans, rehearsal tools, and Protocol Check.
- `src/player` and `src/studio` contain the visible rehearsal and human review/apply surfaces.
- `public/labs` and `public/techniques` remain the bundled source for published activity content.

Runtime-only local paths, hashes, stage fingerprints, and provider handles are not serialized into client-visible durable state.

## Challenge lineage and evidence

Lab Studio, Teacher Studio, Student Player, the titration runtime, validators, and the local Assistant pre-date this WebMCP extension. The challenge work adds the direct WebMCP registry, bounded Composer/compiler, staged human-control workflow, guided rehearsal tools, bounded ordinary-solution conservation, and Protocol Check. The only tracked checkpoint in the current repository is a broad August 29 snapshot; it is evidence of the pre-extension tree, not proof that every file in that snapshot was challenge-new. Current WebMCP work is still uncommitted and must not be described as dated commit evidence.

- [WebMCP integration and exact tools](docs/WEBMCP.md)
- [Scientific fidelity and Protocol Check boundary](docs/FIDELITY.md)
- [Agent evaluation ledger — E10 PASS; E1-E9 UNRUN](docs/AGENT_EVALS.md)
- [Pre-existing versus challenge extension lineage](docs/CHALLENGE_LINEAGE.md)
- [Devpost description and judge instructions draft](docs/DEVPOST_SUBMISSION_DRAFT.md)
- [Under-three-minute demo storyboard](docs/DEMO_STORYBOARD.md)
- [Truthful final-delivery report template](docs/FINAL_DELIVERY_REPORT.md)

The original source documentation is preserved byte-for-byte at [SOURCE_README.md](docs/export-handoff/SOURCE_README.md). No license was invented or changed for this export. This private repair checkout has no deployment or automatic CI workflow; see the export handoff notes for the exact scope and unrun verification layers.
