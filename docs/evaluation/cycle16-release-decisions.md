# Cycle 16 Release Decisions

**Decision date:** 2026-07-27

## Studio Core and chemistry

**Decision:** retain the completed foundation contracts and compatibility boundary. Do not make a
new broad release claim from Cycle 16. Existing chemistry source/runtime behavior was not changed,
and the detailed regression/browser baseline was intentionally not rerun.

## Assay Studio

**Decision:** retain the Cycle 12 **limited release candidate** decision. The bounded 96-well,
profile-driven XTT metabolic-activity proxy and educational/research inhibition workflows remain
default off. Do not claim calibration, clinical use, universal protocol values, or completed
formative/browser validation.

## Causalyst local mode

**Decision:** **limited local candidate, default off**. Portable identity-free assessment and
submission packages, semantic replay, provisional rubric mapping, structured manual authoring,
and teacher review remain available behind `causalystLocalV1`. No final automatic/model score is
authorized.

## LTI 1.3

**Decision:** **implementation candidate, default off**. Keep `causalystLtiV1` disabled until a
named platform, live PostgreSQL deployment, launch/Deep Linking security, iframe behavior, key
rotation, retention, and deletion are explicitly validated.

## AGS

**Decision:** **disabled for release**. Keep `causalystAgsV1` false until a named platform's token,
scope, line-item, explicit approval, idempotency, retry, and score-post behavior are validated.
Teacher approval remains mandatory and separate from return.

## QTI 2.2 companion

**Decision:** **implementation candidate, disabled pending interoperability validation**. The
`qti22-companion` exporter supports the conservative standard-item subset and produces a package
report, but `causalystQtiExportV1` remains false. Enablement requires QTI 2.2 XSD/profile
validation, import/render in a named target LMS, and an independent validator/test platform.
The package never embeds the simulation or rich Causalyst evidence.

## QTI 3.0 companion

**Decision:** **not implemented**. No target support was available to test; no flag, serializer,
or portability claim was added.

## Final program decision

The sixteen-cycle implementation program is complete as an additive, conservative, default-off
set of candidates with explicit limited decisions. It is not a universal LMS release, clinical
product, calibrated wet-lab substitute, autonomous grading system, or evidence of learning
efficacy. There is no Cycle 17 in the authoritative plan.
