import type { LabCompositionSourceDefinition } from "../domain/types";
import { applyLabSetup, type LabSetup } from "./labSetup";
import type { PreparedCompiledWitnessResult } from "./collectCompiledWitnesses";

/**
 * Selected classroom setup values used only by the static Cycle 12/F02 witness collector.
 * They are named evidence inputs, not authored lab defaults or learner-generated measurements.
 */
const setupFixtures: Record<string, LabSetup> = {
  "paper-chromatography": {
    baselineHeightMm: 15,
    solventDepthMm: 5,
    spotVolumeMl: 0.01,
    solventVolumeMl: 10,
    spotterLoadVolumeMl: 0.1,
    paperLengthMm: 120,
    stopFrontMm: 80,
  },
  "hard-water-analysis": {
    ovenTemperatureC: 115,
    firstDurationMinutes: 12,
    coolingTemperatureC: 25,
  },
  "bonding-unknown-solids": {
    knownCount: 4,
    blindCount: 4,
    conductivityThresholds: 10,
    phThresholds: 7,
    meltingApparatusLimits: 150,
  },
  "quick-ache-relief-separation": {
    organicRecoveryMethod: "external-unheated-evaporation",
    aqueousRecoveryMethod: "external-unheated-evaporation",
    drynessCriterion: "Instructor-approved observed dry endpoint",
    coolingLimitC: 25,
    acidEndpointPh: 3,
    organicDensity: 0.9,
    aqueousDensity: 1,
  },
  // The collector prepares this source once and then compiles every declared witness against it,
  // so this fixture cannot be what varies the tare convention between witnesses. It supplies the
  // teacher setup the green route requires; the convention each compilation actually carries comes
  // from the witness that pins `thermal-decomposition.tareConvention`. `tareConvention` here only
  // selects which approved witness is first, which is the one the production loader would compile.
  "green-chemistry-mixture-purification": {
    sampleMassG: 1.5,
    warmDurationMin: 1,
    heatingDurationMin: 5,
    heatingIntensity: "gentle-blue-cone",
    constantMassToleranceG: 0.005,
    maximumHeatCycles: 4,
    coolingEndpointC: 25,
    coolingSurface: "wire-gauze-on-bench",
    tareConvention: "record-crucible-plus-lid",
    minimumReplicates: 2,
  },
};

const titrationFixture: LabSetup = {
  titrationSetup: true,
  endpointWindowMl: 0.05,
  persistenceSeconds: 5,
  maximumIncrementMl: 1,
  indicatorVolumeMl: 0.1,
  conditioningVolumeMl: 1,
  tipPurgeMl: 0.2,
  rinseVolumeMl: 2,
  wasteProtocol: "Instructor-defined waste route required before running",
  preparationProtocol: "Instructor-defined sample preparation required before running",
  indicatorStartPh: 8.2,
  indicatorStrongPh: 10,
  standardizationRangeM: 0.002,
  sampleAMolarityM: 0.1,
  sampleBMolarityM: 0.1,
  beverageAliquotMl: 5,
  naohMolarityM: 0.1,
};

const titrationLabIds = new Set([
  "acid-base-titration",
  "beverage-acidity",
  "hydrogen-peroxide-redox-titration",
  "acid-base-titration-curves",
]);

const fixtureFor = (source: LabCompositionSourceDefinition): {
  fixture?: LabSetup;
  fixtureId: string;
} => {
  const direct = setupFixtures[source.id];
  if (direct) return { fixture: direct, fixtureId: `cycle12-${source.id}-setup-v1` };
  if (titrationLabIds.has(source.id)) return { fixture: titrationFixture, fixtureId: "cycle12-titration-setup-v1" };
  return { fixtureId: "none" };
};

/**
 * Prepare one source with the same production setup behavior used by the historical Cycle 12
 * command. This module performs no catalog I/O and deliberately leaves unsupported setup as data.
 */
export const prepareCycle12WitnessSource = (
  source: LabCompositionSourceDefinition,
): PreparedCompiledWitnessResult => {
  const { fixture, fixtureId } = fixtureFor(source);
  let prepared: LabCompositionSourceDefinition;
  try {
    prepared = applyLabSetup(structuredClone(source), fixture);
  } catch (error) {
    return {
      status: "unsupported-setup",
      setupFixtureId: fixtureId,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    status: "prepared",
    source: prepared,
    setupFixtureId: fixtureId,
    setupDescription: fixture
      ? "Production applyLabSetup with a named illustrative Cycle 12 fixture."
      : "No setup fixture was required by the collector.",
  };
};
