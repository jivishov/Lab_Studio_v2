# Assay Protocol Profiles v1

Cycle 11 adds two immutable checked profile artifacts:

- `assay.profile.xtt-metabolic-activity@1.0.0`
- `assay.profile.educational-broth-microdilution@1.0.0`

Profiles are closed data. They contain source references, allowed readouts and sources, required
control roles, a bounded arithmetic expression AST, optional endpoint rules, rounding, validity
statements, material requirements, and limitations. The registry uses exact ID/version resolution;
it does not scan files, load remote code, or silently select a profile.

## Scientific boundary

The XTT workflow reports blank/reference-normalized metabolic activity and metabolic inhibition.
It never reports a direct cell count. Wavelength or image channel, incubation, reagent conditions,
linear range, and acceptance criteria must come from the supplying protocol; none are global
constants.

The broth-microdilution workflow accepts reviewed binary growth/no-growth values, explicit
concentrations, and valid growth/sterility controls. It reports the lowest monotonic no-growth
concentration under the checked educational profile. It does not emit clinical breakpoints,
susceptibility categories, treatment advice, automatic species/drug selection, or a standards
conformity claim.

An optional XTT-assisted inhibition endpoint is represented only by the
`lowest-metric-threshold-concentration` rule. Its threshold must be visible profile data and its
result is called a `protocol-defined inhibition endpoint`; the core supplies no threshold.

## Determinism and provenance

The expression evaluator supports only named inputs, decimal constants, addition, subtraction,
multiplication, and division over the existing exact rational engine. No arbitrary code or formula
string is executed. Analysis requires reviewed observations, preserves instrument/image/manual/
synthetic source types, records safe formula traces, and returns `indeterminate` for invalid
controls, mixed readouts, conflicting replicates, missing concentrations, zero references,
non-monotonic outcomes, or endpoints outside the tested range.

The checked public JSON profiles are drift-checked against the source registry. The Cycle 11
goldens are explicitly synthetic and do not constitute calibration, wet-lab validation, clinical
evidence, or safety approval.

## Planning boundary

Profile material entries intentionally use `protocol-supplied-required`. They name resource
classes but contain no guessed amounts, dead volume, incubation, wavelength, endpoint threshold,
instrument capacity, or safety metadata. The Cycle 09 planner remains authoritative: a complete
run plan still requires an explicit planning profile, accepted operation graph, quantities,
inventory, capacities, and timing. Missing values remain review-blocking rather than inferred.
