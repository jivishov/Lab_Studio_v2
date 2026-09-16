import type { ActionEffectContract, ActionVerb } from "./types";

export const titrationOperations: Record<string, { verb: ActionVerb; effect: ActionEffectContract }> = Object.fromEntries([
  ["read-initial", "observe", "measurement-direct-observation-acquisition"],
  ["record-initial", "record", "evidence-recording"],
  ["deliver", "transfer", "apparatus-material-instrument-state"],
  ["mix", "mix", "apparatus-material-instrument-state"],
  ["observe", "observe", "measurement-direct-observation-acquisition"],
  ["read-ph", "observe", "measurement-direct-observation-acquisition"],
  ["record-point", "record", "evidence-recording"],
  ["decide", "observe", "evidence-recording"],
  ["decide-curve", "observe", "evidence-recording"],
  ["read-final", "observe", "measurement-direct-observation-acquisition"],
  ["record-final", "record", "evidence-recording"],
  ["calculate-curve", "calculate", "calculation-analysis"],
  ["select-equivalence", "observe", "evidence-recording"],
  ["approve-equivalence", "observe", "evidence-recording"],
  ["archive-retry", "observe", "apparatus-material-instrument-state"],
  ["review-standardization", "observe", "evidence-recording"],
].map(([operation, verb, effect]) => [operation, { verb: verb as ActionVerb, effect: {
  classes: Array.from(new Set([effect, "evidence-recording"])) as ActionEffectContract["classes"],
  targets: (effect === "calculation-analysis" ? ["analysis", "evidence"] :
    effect === "apparatus-material-instrument-state" ? ["equipment", "material", "evidence"] :
    effect === "measurement-direct-observation-acquisition" ? ["measurement-observation", "evidence"] :
    ["evidence"]).map(domain => ({domain})) as ActionEffectContract["targets"],
} }]));

for (const operation of ["read-initial", "deliver", "mix", "observe", "record-point", "decide", "archive-retry"]) titrationOperations[`practice-${operation}`] = titrationOperations[operation];
