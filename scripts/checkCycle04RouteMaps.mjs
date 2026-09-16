import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const path = "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_04_ROUTE_ADAPTER_FEASIBILITY.json";
const stored = JSON.parse(readFileSync(path, "utf8"));
const generated = JSON.parse(execFileSync(process.execPath, ["scripts/generateCycle04RouteMaps.mjs"], { encoding: "utf8" }));
if (JSON.stringify(stored) !== JSON.stringify(generated)) throw new Error("Route map evidence is not deterministic/current.");
if (stored.adapter.sharedGap !== null) throw new Error("Route adapter evidence retains an open shared gap.");
if (stored.routes.length !== 2) throw new Error("Both specialized routes are required.");
const controls = stored.routes.flatMap((route) => route.controls.map((control) => ({ route: route.route, ...control })));
if (controls.length !== 19) throw new Error(`Expected 19 control groups; found ${controls.length}.`);
let adapterTargets = 0;
for (const control of controls) {
  if (!control.id || !control.disposition || !control.prerequisite || !control.rejectPolicy || !control.feedbackOwner || !control.recovery || !control.reset || !control.access) {
    throw new Error(`${control.route}/${control.id ?? "unknown"} lacks prerequisite/rejection/feedback/recovery/reset/access detail.`);
  }
  if (!Array.isArray(control.orderedAtomicTargets)) throw new Error(`${control.route}/${control.id} lacks an ordered target array.`);
  if (control.disposition === "route-local-projection") {
    if (control.orderedAtomicTargets.length || !control.completionRule) throw new Error(`${control.route}/${control.id} has an unsafe projection boundary.`);
    continue;
  }
  if (control.disposition === "configuration-binding" && !control.techniqueId) throw new Error(`${control.route}/${control.id} lacks an exact technique binding.`);
  for (const target of control.orderedAtomicTargets) {
    adapterTargets += 1;
    for (const key of ["techniqueId", "techniqueVersion", "instanceId", "actionId", "nodeId", "payloadBindings", "evidenceOutputIds"]) {
      if (target[key] === undefined || target[key] === null) throw new Error(`${control.route}/${control.id} target lacks ${key}.`);
    }
  }
}
if (adapterTargets !== 64) throw new Error(`Expected 64 exact adapter targets; found ${adapterTargets}.`);
console.log(`Cycle 04 route maps: ${controls.length} controls, ${adapterTargets} exact ordered targets, 0 shared gaps.`);
