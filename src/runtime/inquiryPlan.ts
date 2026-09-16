export interface InquirySolidPlan {
  solidId: string;
  solidLabel: string;
  massG: number;
  trials: number;
  disposalMethod: string;
}

export interface InquiryPlan {
  waterVolumeMl: number;
  volumeEquipmentId: string;
  weighingEquipmentId: string;
  calorimeterEquipmentId: string;
  startingTemperatureMethod: string;
  endingTemperatureCriterion: string;
  controlledVariables: string[];
  safetyPrecautions: string[];
  measurements: string[];
  solids: InquirySolidPlan[];
}

export interface InquiryTeacherRules {
  requiredWaterVolumeMl?: number;
  waterVolumeToleranceMl?: number;
  requireEqualMasses?: boolean;
  minimumTrials?: number;
  allowedEndingCriteria?: string[];
}

export interface InquiryPlanFinding {
  field: string;
  classification: "manual" | "teacher" | "scientific-warning";
  message: string;
}

export interface InquiryPlanValidation {
  accepted: boolean;
  findings: InquiryPlanFinding[];
}

const requiredMeasurements = [
  "water amount",
  "solid amount",
  "starting temperature",
  "ending temperature",
];

export const validateInquiryPlan = (
  plan: InquiryPlan,
  teacherRules: InquiryTeacherRules = {},
): InquiryPlanValidation => {
  const findings: InquiryPlanFinding[] = [];
  if (!Number.isFinite(plan.waterVolumeMl) || plan.waterVolumeMl <= 0) {
    findings.push({
      field: "waterVolumeMl",
      classification: "manual",
      message: "Select and record a positive water amount.",
    });
  }
  if (!plan.volumeEquipmentId || !plan.weighingEquipmentId || !plan.calorimeterEquipmentId) {
    findings.push({
      field: "equipment",
      classification: "manual",
      message: "Select equipment for volume, mass, and calorimetry measurements.",
    });
  }
  if (!plan.startingTemperatureMethod.trim() || !plan.endingTemperatureCriterion.trim()) {
    findings.push({
      field: "temperatureMethods",
      classification: "manual",
      message: "Define both the starting-temperature method and the ending-temperature criterion.",
    });
  }
  if (plan.controlledVariables.length === 0) {
    findings.push({
      field: "controlledVariables",
      classification: "manual",
      message: "State the variables that will remain constant.",
    });
  }
  if (plan.safetyPrecautions.length === 0) {
    findings.push({
      field: "safetyPrecautions",
      classification: "manual",
      message: "Add the required safety precautions.",
    });
  }
  for (const measurement of requiredMeasurements) {
    if (!plan.measurements.some((value) => value.toLowerCase() === measurement)) {
      findings.push({
        field: "measurements",
        classification: "manual",
        message: `Include ${measurement} in the recorded measurements.`,
      });
    }
  }
  if (plan.solids.length !== 3) {
    findings.push({
      field: "solids",
      classification: "manual",
      message: "The investigation plan must include all three assigned solids.",
    });
  }
  const normalizedSolidIds = plan.solids.map((solid) => solid.solidId.trim().toLowerCase());
  if (normalizedSolidIds.some((solidId) => !solidId) || new Set(normalizedSolidIds).size !== normalizedSolidIds.length) {
    findings.push({
      field: "solids",
      classification: "manual",
      message: "Select three distinct assigned solids.",
    });
  }
  for (const solid of plan.solids) {
    if (!Number.isInteger(solid.trials) || solid.trials <= 0) {
      findings.push({
        field: `solids.${solid.solidId}.trials`,
        classification: "manual",
        message: `${solid.solidLabel} must use a positive whole-number trial count.`,
      });
    }
    if (
      !Number.isFinite(solid.massG) ||
      solid.massG <= 0 ||
      !Number.isInteger(solid.trials) ||
      solid.trials <= 0 ||
      solid.massG * solid.trials > 10
    ) {
      findings.push({
        field: `solids.${solid.solidId}.massG`,
        classification: "manual",
        message: `${solid.solidLabel} must use a positive amount without exceeding 10 g total.`,
      });
    }
    if (!solid.disposalMethod.trim()) {
      findings.push({
        field: `solids.${solid.solidId}.disposalMethod`,
        classification: "manual",
        message: `Add disposal instructions for ${solid.solidLabel}.`,
      });
    }
  }

  if (
    teacherRules.requiredWaterVolumeMl !== undefined &&
    Math.abs(plan.waterVolumeMl - teacherRules.requiredWaterVolumeMl) >
      (teacherRules.waterVolumeToleranceMl ?? 0.1)
  ) {
    findings.push({
      field: "waterVolumeMl",
      classification: "teacher",
      message: `Teacher configuration requires ${teacherRules.requiredWaterVolumeMl} mL water.`,
    });
  }
  if (teacherRules.requireEqualMasses && new Set(plan.solids.map((solid) => solid.massG)).size > 1) {
    findings.push({
      field: "solids.massG",
      classification: "teacher",
      message: "Teacher configuration requires equal solid masses.",
    });
  }
  if (
    teacherRules.minimumTrials !== undefined &&
    plan.solids.some((solid) => solid.trials < teacherRules.minimumTrials!)
  ) {
    findings.push({
      field: "solids.trials",
      classification: "teacher",
      message: `Teacher configuration requires at least ${teacherRules.minimumTrials} trials per solid.`,
    });
  }
  if (
    teacherRules.allowedEndingCriteria?.length &&
    !teacherRules.allowedEndingCriteria.includes(plan.endingTemperatureCriterion)
  ) {
    findings.push({
      field: "endingTemperatureCriterion",
      classification: "teacher",
      message: "The ending-temperature criterion is not permitted by the teacher configuration.",
    });
  }
  if (plan.solids.some((solid) => Number.isInteger(solid.trials) && solid.trials === 1)) {
    findings.push({
      field: "solids.trials",
      classification: "scientific-warning",
      message: "A single trial is allowed by the manual but provides weak repeatability evidence.",
    });
  }
  return {
    accepted: !findings.some((finding) => finding.classification !== "scientific-warning"),
    findings,
  };
};

export interface InquiryExecutionScope {
  id: string;
  solidId: string;
  trial: number;
  waterVolumeMl: number;
  solidMassG: number;
  endingTemperatureCriterion: string;
  disposalMethod: string;
  actionIds: string[];
}

export const generateInquiryExecutionScopes = (
  plan: InquiryPlan,
): InquiryExecutionScope[] => {
  const validation = validateInquiryPlan(plan);
  if (!validation.accepted) {
    throw new Error("Inquiry execution cannot be generated from an invalid plan.");
  }
  return plan.solids.flatMap((solid) =>
    Array.from({ length: solid.trials }, (_, index) => ({
      id: `${solid.solidId}-trial-${index + 1}`,
      solidId: solid.solidId,
      trial: index + 1,
      waterVolumeMl: plan.waterVolumeMl,
      solidMassG: solid.massG,
      endingTemperatureCriterion: plan.endingTemperatureCriterion,
      disposalMethod: solid.disposalMethod,
      actionIds: Array.from({ length: 12 }, (__, actionIndex) =>
        `INV-X${String(actionIndex + 1).padStart(2, "0")}`,
      ),
    })),
  );
};
