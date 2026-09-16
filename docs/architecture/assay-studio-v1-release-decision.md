# Assay Studio v1 Cycle 12 Release Decision

**Decision date:** 2026-07-26

**Decision:** Limited release candidate

**Supported boundary:** build-flagged, local, 96-well education and non-clinical research planning

## Decision

Assay Studio is suitable for continued internal integration and for Causalyst to consume its
versioned artifact and evidence contracts. It is not approved as a clinical product, calibrated
instrument model, hosted shared-project service, wet-lab authority, or general plate-format
platform.

The decision is deliberately **limited**, not an unrestricted go. The repository policy permits
source review, typechecking, and deterministic manifest/schema linting but forbids detailed test,
browser, build, conformance, and formative-review execution unless the user later authorizes it.
Those checks were not run and are not represented as passed.

## Stable contracts available to Causalyst

- `assay-studio.assay-definition` schema `1.0`
- `AssayDomainPack` `1.0.0`
- `studio.evidence-bundle` and `studio.run-trace` schema `1.0`
- versioned assay observation, QC, planning, ingestion, protocol-profile, and protocol-analysis contracts
- deterministic validated artifact packaging and canonical `.assay.json` reopen
- semantic compare/apply transaction with artifact-id and current-version conflict gates
- six stateless `assaystudio.*` MCP tools using the same pure services as the direct app

## Direct-app release surface

The build-flagged direct app provides:

1. assay library and proof-backed capability explorer;
2. bounded 96-well blank, XTT metabolic-activity, and educational broth-microdilution templates;
3. plate, pipetting/dilution, controls/replicates, planning, ingestion, QC, and profile-analysis surfaces;
4. schema validation and semantic candidate comparison before apply;
5. downloadable canonical assay JSON, sanitized artifact package, plate-map CSV, and release-limit report.

The authoritative information paths use native controls, text status, semantic tables, and
keyboard-operable disclosures. Color and charts are supplementary. Detailed runtime keyboard,
screen-reader, zoom/reflow, and browser verification remains intentionally unrun.

## Assay MCP boundary

The server registers:

- `assaystudio.search_capabilities`
- `assaystudio.assess_protocol`
- `assaystudio.compose_assay`
- `assaystudio.validate_assay`
- `assaystudio.plan_run`
- `assaystudio.ingest_observations`

All tools are read-only, non-destructive, idempotent, closed-world, payload-bounded, output-checked,
and request-scoped. Composition uses only registered source-controlled templates plus caller-supplied
descriptive metadata. Observation ingestion returns an uncommitted review candidate.

The tools do not fetch arbitrary URLs, run image analysis, store drafts or student data, expose
local paths/provider handles, purchase or reserve materials, control hardware, or make clinical
decisions.

## Scientific decision

- XTT remains a protocol-dependent metabolic-activity proxy, never a direct cell count.
- Broth-microdilution and inhibition endpoints remain profile-bound, educational/non-clinical, and
  indeterminate when prerequisites fail.
- No universal wavelength, incubation, threshold, material amount, endpoint, breakpoint, S/I/R
  category, susceptibility category, treatment advice, safety approval, or calibration is supplied.
- No assay capability is F4.

## Permitted release evidence

- Node `v24.18.0` TypeScript project typecheck.
- deterministic Capability Manifest generation and drift check;
- Cycle 10 ingestion schema/semantic/canonical-round-trip lint;
- Cycle 11 protocol/profile/artifact/package lint;
- Cycle 12 bounded-template, package, compare/apply, output-boundary, and six-tool schema invocation lint;
- focused source and diff review.

## Explicitly unrun and required before broader release

- Vitest, focused test execution, property tests, pack conformance execution, and full test suites;
- Vite/MCP broad builds and built stdio/client probes;
- Playwright, browser matrices, screenshots, keyboard-only runtime walkthroughs, screen-reader runs,
  and zoom/reflow runtime checks;
- formative educator/researcher task-completion sessions;
- wet-lab, plate-reader, raw-image, clinical, calibration, safety, biosafety, performance, and
  external-service evaluation.

These are release-expansion gates, not hidden passes. A later authorized evaluation may promote,
retain, or reverse the limited decision without changing the stable artifact/evidence contract.
