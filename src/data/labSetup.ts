import type { BundledLabSourceDefinition } from "../domain/types";
import { equipmentById } from "../equipment/catalog";
import {
  bindGreenChemistrySetup,
  GREEN_CHEMISTRY_LAB_ID,
  type GreenChemistryApprovedConfiguration,
} from "./greenChemistrySetup";

/** Classroom choices, frozen before compilation. None are measured outcomes. */
export interface PaperSetup {
  trials?: Array<{ solvent: string; bands?: Array<{ label: string; color: string; distanceMm: number }> }>;
  baselineHeightMm: number;
  solventDepthMm: number;
  spotVolumeMl: number;
  solventVolumeMl: number;
  spotterLoadVolumeMl: number;
  paperLengthMm: number;
  stopFrontMm: number;
}
export interface BondingSetup {
  selectedProcedure?: string;
  knownCount: number;
  blindCount: number;
  conductivityThresholds: number;
  phThresholds: number;
  meltingApparatusLimits: number;
}
export interface HardWaterSetup { ovenTemperatureC: number; firstDurationMinutes: number; coolingTemperatureC: number }
export interface QuickAcheSetup { extractionCount?: number; recoveryOrder?: string; filtrationMethod?: "gravity" | "vacuum"; organicRecoveryMethod: "external-unheated-evaporation"; aqueousRecoveryMethod: "external-unheated-evaporation"; drynessCriterion: string; coolingLimitC: number; acidEndpointPh: number; organicDensity: number; aqueousDensity: number }
export interface TitrationSetup {
  titrationSetup: true; endpointWindowMl: number; persistenceSeconds: number; maximumIncrementMl: number; indicatorVolumeMl?: number; conditioningVolumeMl: number; tipPurgeMl: number; rinseVolumeMl: number;
  wasteProtocol: string; preparationProtocol: string; indicatorStartPh?: number; indicatorStrongPh?: number; standardizationRangeM?: number; sampleAMolarityM?: number; sampleBMolarityM?: number; beverageAliquotMl?: number; naohMolarityM?: number;
}
export type LabSetup =
  | TitrationSetup
  | PaperSetup
  | BondingSetup
  | HardWaterSetup
  | QuickAcheSetup
  | GreenChemistryApprovedConfiguration;

export class LabSetupRequired extends Error {
  constructor() { super("Enter the instructor-approved investigation setup before starting."); }
}

export const applyLabSetup = <T extends BundledLabSourceDefinition>(source: T, setup?: LabSetup): T => {
  if (source.id === GREEN_CHEMISTRY_LAB_ID) {
    if (setup === undefined) throw new LabSetupRequired();
    return bindGreenChemistrySetup(source, setup);
  }
  if (["acid-base-titration", "beverage-acidity", "hydrogen-peroxide-redox-titration"].includes(source.id) && source.techniqueInstances?.length) {
    if (!setup || !("titrationSetup" in setup)) throw new LabSetupRequired();
    for (const key of ["endpointWindowMl", "persistenceSeconds", "maximumIncrementMl", "conditioningVolumeMl", "tipPurgeMl", "rinseVolumeMl"] as const) if (!Number.isFinite(setup[key]) || setup[key] <= 0) throw new Error("Enter positive instructor-approved titration settings.");
    if (setup.conditioningVolumeMl > 5 || setup.tipPurgeMl >= 1 || setup.rinseVolumeMl > 10) throw new Error("This apparatus configuration supports conditioning up to 5 mL, a tip purge below 1 mL, and receiver rinsing up to 10 mL.");
    if (setup.endpointWindowMl < 0.01 || setup.maximumIncrementMl < 0.05) throw new Error("Use an endpoint window at least 0.01 mL and an increment limit at least 0.05 mL for this apparatus and practice-drop model.");
    if (setup.maximumIncrementMl > 5 || (source.id !== "hydrogen-peroxide-redox-titration" && (!setup.indicatorVolumeMl || !Number.isFinite(setup.indicatorVolumeMl) || setup.indicatorVolumeMl > 1)) || setup.endpointWindowMl > setup.maximumIncrementMl || !setup.wasteProtocol.trim() || !setup.preparationProtocol.trim()) throw new Error("Provide approved preparation/waste protocols, an indicator amount at most 1 mL, and an increment at most 5 mL containing the endpoint window.");
    const configured = structuredClone(source);
    if (source.id !== "hydrogen-peroxide-redox-titration" && (!Number.isFinite(setup.indicatorStartPh) || !Number.isFinite(setup.indicatorStrongPh) || setup.indicatorStartPh! <= 7 || setup.indicatorStrongPh! <= setup.indicatorStartPh! || setup.indicatorStrongPh! > 14)) throw new Error("Provide the approved indicator color-onset and strong-color pH thresholds, between 7 and 14, for the supported phenolphthalein model.");
    if (source.id === "hydrogen-peroxide-redox-titration" && (!Number.isFinite(setup.standardizationRangeM) || setup.standardizationRangeM! <= 0)) throw new Error("Supply the instructor-approved standardization concordance range in mol/L.");
    const values = { endpointWindowMl: setup.endpointWindowMl, persistenceSeconds: setup.persistenceSeconds, maximumIncrementMl: setup.maximumIncrementMl, indicatorVolumeMl: setup.indicatorVolumeMl ?? 0, conditioningVolumeMl: setup.conditioningVolumeMl, tipPurgeMl: setup.tipPurgeMl, rinseVolumeMl: setup.rinseVolumeMl, wasteProtocol: setup.wasteProtocol, preparationProtocol: setup.preparationProtocol };
    for (const instance of configured.techniqueInstances ?? []) Object.assign(instance.bindings.configuration, values);
    if (source.id !== "hydrogen-peroxide-redox-titration") for (const instance of configured.techniqueInstances ?? []) Object.assign(instance.bindings.configuration,{indicatorStartPh:setup.indicatorStartPh!,indicatorStrongPh:setup.indicatorStrongPh!});
    if (source.id === "hydrogen-peroxide-redox-titration") for (const instance of configured.techniqueInstances ?? []) instance.bindings.configuration.standardizationRangeM = setup.standardizationRangeM!;
    if (source.id === "beverage-acidity") {
      if (![setup.sampleAMolarityM, setup.sampleBMolarityM, setup.beverageAliquotMl].every(v => typeof v === "number" && Number.isFinite(v) && v > 0) || setup.beverageAliquotMl! > 10 || ![0.1,0.25].includes(setup.naohMolarityM!)) throw new Error("Supply positive beverage proxy concentrations, an aliquot at most 10 mL, and 0.10 or 0.25 M NaOH.");
      for (const model of configured.titrationModels ?? []) if (model.id.startsWith("beverage-")) {
        model.analyteMolarityM = model.id === "beverage-a-sample" ? setup.sampleAMolarityM! : setup.sampleBMolarityM!;
        model.analyteVolumeMl = setup.beverageAliquotMl!; model.titrantMolarityM = setup.naohMolarityM!;
        if (model.analyteMolarityM * model.analyteVolumeMl / model.titrantMolarityM + setup.maximumIncrementMl >= 45) throw new Error("The approved sample model and aliquot must permit a complete curve within this apparatus allocation. Revise the prepared sample or aliquot before starting.");
      }
      for (const instance of configured.techniqueInstances ?? []) instance.bindings.configuration.beverageAliquotMl = setup.beverageAliquotMl!;
      const titrant = configured.initialState?.equipment.find(e=>e.id === "quantitative-naoh-010");
      if (titrant) {titrant.label = `${setup.naohMolarityM} M standardized NaOH`; titrant.contents.concentration = {value:setup.naohMolarityM!,unit:"M"};}
    }
    return configured;
  }
  if (source.id === "quick-ache-relief-separation") {
    if (!setup || !("organicRecoveryMethod" in setup)) throw new LabSetupRequired();
    if (setup.organicRecoveryMethod !== "external-unheated-evaporation" || setup.aqueousRecoveryMethod !== "external-unheated-evaporation" || !setup.drynessCriterion.trim() || !Number.isFinite(setup.coolingLimitC) || !Number.isFinite(setup.acidEndpointPh) || setup.acidEndpointPh < 0 || setup.acidEndpointPh > 14 || !Number.isFinite(setup.organicDensity) || !Number.isFinite(setup.aqueousDensity) || setup.organicDensity <= 0 || setup.aqueousDensity <= setup.organicDensity) throw new Error("Supply the supported unheated recovery method, dryness criterion, acidification pH endpoint and classroom weighing temperature.");
    const configured = structuredClone(source);
    const extractionCount = setup.extractionCount ?? 1;
    const method = setup.filtrationMethod ?? "vacuum";
    const order = (setup.recoveryOrder ?? "acidic,organic,aqueous").split(",").map((id) => id.trim());
    if (!Number.isInteger(extractionCount) || extractionCount < 1 || extractionCount > 5 || !["gravity", "vacuum"].includes(method) || order.length !== 3 || new Set(order).size !== 3 || order.some((id) => !["acidic", "organic", "aqueous"].includes(id)) || order.indexOf("aqueous") < order.indexOf("acidic")) throw new Error("Choose 1–5 total extractions and order all three recoveries, with acidic filtration before aqueous-filtrate recovery.");
    const selectedProcedure = [...Array.from({ length: extractionCount - 1 }, (_, index) => `wash-${index + 2}`), ...order.map((id) => id === "organic" ? id : `${id}-${method}`)].join(",");
    for (const instance of configured.techniqueInstances ?? []) if (instance.techniqueId === "quick-ache-extraction-recovery") Object.assign(instance.bindings.configuration, Object.fromEntries(Object.entries(setup).filter(([key]) => !["filtrationMethod", "recoveryOrder"].includes(key))), { selectedProcedure, extractionCount, recoverySetupApproved: true });
    return configured;
  }
  if (source.id === "hard-water-analysis") {
    if (!setup || !("ovenTemperatureC" in setup)) throw new LabSetupRequired();
    if (!Number.isFinite(setup.ovenTemperatureC) || setup.ovenTemperatureC < 110 || setup.ovenTemperatureC > 120 || !Number.isFinite(setup.firstDurationMinutes) || setup.firstDurationMinutes < 10 || setup.firstDurationMinutes > 15 || !Number.isFinite(setup.coolingTemperatureC) || setup.coolingTemperatureC >= setup.ovenTemperatureC) throw new Error("Use the source oven range 110–120 °C, first stage 10–15 minutes, and a lower classroom cooling endpoint.");
    const configured = structuredClone(source);
    for (const instance of configured.techniqueInstances ?? []) if (["two-stage-precipitate-drying", "hard-water-two-sample-inquiry"].includes(instance.techniqueId)) Object.assign(instance.bindings.configuration, setup);
    return configured;
  }
  if (source.id === "bonding-unknown-solids") {
    if (!setup || !("knownCount" in setup)) throw new LabSetupRequired();
    if (![setup.knownCount, setup.blindCount].every((count) => Number.isInteger(count) && count >= 4 && count <= 6)) throw new Error("Select 4–6 known and 4–6 blind samples independently.");
    if (!Number.isFinite(setup.conductivityThresholds) || setup.conductivityThresholds < 0 || !Number.isFinite(setup.phThresholds) || setup.phThresholds < 0 || setup.phThresholds > 14 || !Number.isFinite(setup.meltingApparatusLimits) || setup.meltingApparatusLimits <= 0) throw new Error("Supply valid conductivity, pH and apparatus limits.");
    const configured = structuredClone(source);
    const selectedWitness = `${setup.knownCount}-known-and-${setup.blindCount}-blind`;
    configured.reachabilityWitnesses?.sort((left, right) => Number(right.id === selectedWitness) - Number(left.id === selectedWitness));
    for (const instance of configured.techniqueInstances ?? []) if (instance.techniqueId === "bonding-solids-tests") {
      Object.assign(instance.bindings.configuration, { conductivityThresholds: setup.conductivityThresholds, phThresholds: setup.phThresholds, meltingApparatusLimits: setup.meltingApparatusLimits, selectedProcedure: setup.selectedProcedure ?? "appearance,water,conductivity,ph,ethanol,hexanes,magnet,melting,hcl,naoh", selectedTestPanel: `approved-panel:${instance.instanceId.startsWith("known") ? setup.knownCount : setup.blindCount}-samples` });
    }
    return configured;
  }
  if (source.id !== "paper-chromatography") return source;
  if (!setup || !("baselineHeightMm" in setup)) throw new LabSetupRequired();
  const keys = ["baselineHeightMm", "solventDepthMm", "spotVolumeMl", "solventVolumeMl", "spotterLoadVolumeMl", "paperLengthMm", "stopFrontMm"] as const;
  if (keys.some((key) => !Number.isFinite(setup[key]) || setup[key] <= 0)) throw new Error("All setup quantities must be positive finite numbers.");
  if (setup.baselineHeightMm <= setup.solventDepthMm) throw new Error("The pencil origin must be above the solvent layer.");
  if (setup.baselineHeightMm + setup.stopFrontMm >= setup.paperLengthMm) throw new Error("The solvent front must stop below the top of the paper.");
  if (setup.spotVolumeMl > setup.spotterLoadVolumeMl) throw new Error("The spot cannot exceed the loaded sample volume.");
  if (setup.solventVolumeMl > (equipmentById.get("chromatography-chamber")?.capacity.amount ?? 0) || setup.spotterLoadVolumeMl > (equipmentById.get("capillary-spotter")?.capacity.amount ?? 0)) throw new Error("The configured volume exceeds the chamber or spotter capacity.");
  // These are supplied illustrative datasets, not a kinetic or solvent chemistry predictor.

  const configured = structuredClone(source);
  const trials = setup.trials ?? [{ solvent: "water" }, { solvent: "propanol" }];
  if (new Set(trials.map((trial) => trial.solvent)).size < 2 || trials.some((trial) => !["water", "propanol", "ethanol", "acetone", "chromatography-solvent"].includes(trial.solvent))) throw new Error("Select at least two distinct source solvents.");
  if (new Set(trials.map((trial) => trial.solvent)).size !== trials.length) throw new Error("Select each solvent once for this approved trial plan.");
  const selected = trials.map((trial) => {
    const count = trial.bands?.length ?? (trial.solvent === "water" ? 2 : trial.solvent === "propanol" ? 3 : 0);
    if (count < 1 || count > 3) throw new Error("Supply one to three observed regions for each classroom dataset; do not split unresolved regions into assumed dyes.");
    const groupId = !trial.bands && trial.solvent === "water" && count === 2 ? "water" : !trial.bands && trial.solvent === "propanol" && count === 3 ? "propanol" : `choice-${trial.solvent}-${count}`;
    const stock = configured.initialState?.equipment.find((item) => item.id === `${groupId}-solvent-bottle`);
    if (!stock || (stock.contents.volumeMl ?? 0) < setup.solventVolumeMl) throw new Error("The approved chamber portion exceeds its available solvent stock.");
    const model = configured.chromatographyModels?.find((item) => item.id === `${groupId}-food-dyes-paper`);
    if (!model) throw new Error("The canonical trial dataset slot is missing.");
    if (trial.bands) {
      if (trial.bands.some((band) => !band.label.trim() || !/^#[0-9a-f]{6}$/i.test(band.color) || !Number.isFinite(band.distanceMm) || band.distanceMm < 0 || band.distanceMm > setup.stopFrontMm)) throw new Error("Dataset regions need labels, #RRGGBB colors and measured distances within the front.");
      model.bands = trial.bands.map((band, index) => ({ ...band, id: model.bands[index].id, expectedRf: band.distanceMm / setup.stopFrontMm }));
      model.solventFrontMm = setup.stopFrontMm; model.requiresClassroomDataset = false;
    } else if (model.requiresClassroomDataset || model.solventFrontMm !== setup.stopFrontMm) throw new Error("Supply an instructor/classroom dataset for this solvent and endpoint. No solvent chemistry is predicted.");
    return groupId;
  });
  const dye = configured.initialState?.equipment.find((item) => item.id === "food-dye-sample");
  if ((dye?.contents.volumeMl ?? 0) < trials.length * setup.spotterLoadVolumeMl) throw new Error("The shared dye stock is insufficient for all selected trial loads.");
  for (const [receiverId, count] of [["sink-disposal-receiver", trials.filter((trial) => trial.solvent === "water").length], ["organic-waste-receiver", trials.filter((trial) => trial.solvent !== "water").length]] as const) {
    const receiver = configured.initialState?.equipment.find((item) => item.id === receiverId);
    if (!receiver || (receiver.contents.volumeMl ?? 0) + count * setup.solventVolumeMl > (equipmentById.get(receiver.definitionId)?.capacity.amount ?? 0)) throw new Error("The selected trial waste exceeds its assigned receiver capacity.");
  }
  for (const instance of configured.techniqueInstances ?? []) {
    if (instance.techniqueId !== "paper-chromatography") continue;
    instance.bindings.configuration = {
      ...instance.bindings.configuration,
      selectedProcedure: selected.join(","),
      baselineHeightMm: setup.baselineHeightMm, solventDepthMm: setup.solventDepthMm,
      spotVolumeMl: setup.spotVolumeMl, solventVolumeMl: setup.solventVolumeMl,
      spotterLoadVolumeMl: setup.spotterLoadVolumeMl,
      stopCondition: `front-mm:${setup.stopFrontMm}`,
    };
  }
  return configured;
};
