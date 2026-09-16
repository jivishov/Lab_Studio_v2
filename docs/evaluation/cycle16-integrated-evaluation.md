# Cycle 16 Integrated Evaluation

**Evaluation date:** 2026-07-27
**Boundary:** permitted source review, TypeScript checks, deterministic schema/security/package lint, and diff review only

## Evidence status

Cycle 16 adds a version-neutral `causalyst.qti-companion-model` `1.0`, a conservative
`qti22-companion` serializer, deterministic store-only ZIP packaging, a
`causalyst.qti-package-report` `1.0`, and a default-off authoring export. The checked fixture
covers single choice, multiple response, exact numeric response with authored tolerance, and
extended text. Assets are restricted to PNG/JPEG with required alternative text.

The internal deterministic audit verifies item/model validation, exact source-assessment pinning,
manifest/test/item/resource completeness, relative traversal-free paths, XML escaping, DTD/entity/
script rejection, asset references, deterministic ZIP bytes, and an explicit companion-only
report. It does not substitute for QTI XSD validation or an LMS import.

## Integrated boundary review

| Layer | Source/static evidence | Detailed evidence intentionally not run | Cycle 16 decision |
|---|---|---|---|
| Studio Core and chemistry | Version-pinned contracts, current manifest lint, source/diff review | Full chemistry regression, build, browser matrix | Retain accepted foundation; no expanded release claim |
| Assay Studio | Cycle 10–12 deterministic lints, checked profiles and bounded release services | Property tests, conformance, browser/accessibility runtime, educator/researcher pilot | Retain limited release candidate |
| Causalyst local | Cycle 13/14 deterministic package, trace, privacy, and provisional-score lints | Full learner/teacher browser flow, screen reader, formative pilot | Limited local candidate; default off |
| LTI 1.3 | Learning typecheck and Cycle 15 static security/persistence lint | Live PostgreSQL, named LMS launch, Deep Linking, key rotation | Implementation candidate; default off |
| AGS | Static teacher-approval/idempotency boundary | Live token exchange, line item, score post, retry | Disabled for release |
| QTI 2.2 companion | Deterministic model/XML/ZIP/security/accessibility-source lint | XSD, named LMS import, independent validator | Disabled pending interoperability validation |
| QTI 3.0 | None | All implementation and validation | Not implemented |

## Scientific and capability audit

- QTI does not serialize an executable chemistry or assay artifact and does not claim portable
  simulation behavior.
- Causalyst continues to validate and pin the executable artifact through the registered domain
  pack; QTI item generation does not define domain semantics.
- XTT remains a protocol-dependent metabolic-activity proxy, never a direct cell count.
- MIC/inhibition remains profile-bound, educational/research-oriented, and non-clinical.
- No wavelength, incubation, endpoint, threshold, breakpoint, susceptibility category,
  calibration, safety conclusion, or unsupported fidelity is introduced.
- No raw model-authored executable artifact is accepted.

## Privacy, security, authorization, and retention audit

- The QTI package contains no identity, submission, trace, grade, credential, key, token, local
  path, hash, provider handle/response, hidden reasoning, pointer coordinate, or camera/gesture
  data.
- The exporter accepts no archive path from authored content; file names are flat, allowlisted,
  and regenerated from validated identifiers.
- XML active content, DTDs, entities, unsafe activity URLs, and SVG assets are rejected.
- MCP remains stateless and student-data-free.
- LTI registrations remain administrator-controlled and deployment-scoped.
- AGS remains separately gated and requires explicit teacher approval.
- QTI is deterministic export only and adds no persistence or retention obligation.

## Accessibility source review

- Every image asset requires non-empty alternative text.
- Standard QTI interactions retain textual prompts and labels.
- QTI status and limitations are text, not color-only.
- The existing structured manual Causalyst path remains available.
- Runtime keyboard, screen-reader, zoom/reflow, and named-LMS rendering checks were intentionally
  not run and are not claimed as passed.

## Blockers and deferred evidence

The repository policy prohibited the detailed checks prescribed by the plan. No target LMS was
provided or exercised, no independent QTI validator was run, and no teacher/reviewer pilot was
conducted. These are release blockers for QTI enablement and for broadening the existing limited
product decisions, but they do not block completion of the additive default-off implementation
and honest release decision.
