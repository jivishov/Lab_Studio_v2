import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ClipboardCheck,
  Flame,
  FlaskConical,
  Leaf,
  LockKeyhole,
  RotateCcw,
  Scale,
  ShieldAlert,
  Thermometer,
} from "lucide-react";
import {
  calculateAtomEconomyPercent,
  compositionFromMassLoss,
  within,
} from "./model";
import type {
  LabDefinition,
  RouteTechniqueExecutionIntent,
} from "../../domain/types";
import { compileConfiguredGreenChemistry } from "./configuredComposition";
import {
  assertConfigured,
  GREEN_CHEMISTRY_INSTANCE_ID,
  parseGreenChemistrySetup,
  type GreenChemistryApprovedConfiguration,
  type GreenChemistryTareConvention,
} from "../../data/greenChemistrySetup";
import {
  createGreenChemistryRouteAdapter,
  createInitialGreenChemistryRouteState,
  currentGreenChemistryReplicate,
  GREEN_CHEMISTRY_APPROVAL_PLAN_FIELDS,
  GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID,
  greenChemistryClosedReplicateSetBinding,
  greenChemistryHoldersFromCompiled,
  greenChemistryRulesFromCompiled,
  type GreenChemistryBalanceId,
  type GreenChemistryLidPosition,
} from "./routeAdapter";
import "./purify-mixture-green-chemistry.css";

type Phase =
  | "inquiry"
  | "experiment"
  | "analysis"
  | "recovery"
  | "review"
  | "complete";
type LidPosition = GreenChemistryLidPosition;
type BalanceId = GreenChemistryBalanceId;

interface TeacherReport {
  text: string;
  desiredProduct: string;
  desiredProductStoichiometricMassG: string;
  totalReactantStoichiometricMassG: string;
}

interface TeacherConfiguration {
  constantMassToleranceG: number;
  maximumHeatCycles: number;
  warmDurationMin: number;
  heatingDurationMin: number;
  coolingEndpointC: number;
  coolingSurface: string;
  ppeRequirements: string;
  /**
   * S and W: the prepared stock the class may draw on, and the working portion each replicate is
   * issued from it. Teacher setup values held here in the browser, not compiled configuration
   * slots - the technique's ten slots are unchanged, and neither quantity comes from the source.
   */
  masterStockMassG: number;
  workingPortionMassG: number;
  tareConvention: GreenChemistryTareConvention | "";
  minimumReplicates: number;
  acceptableCompositionUncertaintyPercent: number;
  calculationToleranceG: number;
  reportAssignment: 1 | 2 | 3;
  reports: [TeacherReport, TeacherReport, TeacherReport];
  reheatSharedProductAfterSession: boolean;
}

interface InquiryPlan {
  rationale: string;
  sampleMassG: number;
  heatingIntensity: string;
  heatingDurationMin: number;
  constantMassRule: string;
  replicates: number;
  apparatusAndObservations: string;
  calculations: string;
  uncertainty: string;
  safety: string;
  recovery: string;
}

interface AnalysisSubmission {
  massLossG: string;
  finalSodiumCarbonateMassG: string;
  sodiumBicarbonateMassG: string;
  sodiumCarbonateMassG: string;
  sodiumBicarbonatePercent: string;
  sodiumCarbonatePercent: string;
  uncertainty: string;
}

interface ReviewSubmission {
  investigationQuality: string;
  communicationQuality: string;
  desiredProduct: string;
  atomEconomyPercent: string;
  additionalGreenPrinciple: string;
  recommendations: string;
  personStyle: "second" | "third";
}

const blankReport = (): TeacherReport => ({
  text: "",
  desiredProduct: "",
  desiredProductStoichiometricMassG: "",
  totalReactantStoichiometricMassG: "",
});

const initialTeacherConfiguration = (): TeacherConfiguration => ({
  constantMassToleranceG: 0,
  maximumHeatCycles: 0,
  warmDurationMin: 0,
  heatingDurationMin: 0,
  coolingEndpointC: 0,
  coolingSurface: "",
  ppeRequirements: "",
  masterStockMassG: 0,
  workingPortionMassG: 0,
  tareConvention: "",
  minimumReplicates: 0,
  acceptableCompositionUncertaintyPercent: 0,
  calculationToleranceG: 0,
  reportAssignment: 1,
  reports: [blankReport(), blankReport(), blankReport()],
  reheatSharedProductAfterSession: false,
});

const initialInquiryPlan = (configuration: TeacherConfiguration): InquiryPlan => ({
  rationale: "",
  sampleMassG: 0,
  heatingIntensity: "",
  heatingDurationMin: configuration.heatingDurationMin,
  constantMassRule: "",
  replicates: configuration.minimumReplicates,
  apparatusAndObservations: "",
  calculations: "",
  uncertainty: "",
  safety: "",
  recovery: "",
});

const emptyAnalysis: AnalysisSubmission = {
  massLossG: "",
  finalSodiumCarbonateMassG: "",
  sodiumBicarbonateMassG: "",
  sodiumCarbonateMassG: "",
  sodiumBicarbonatePercent: "",
  sodiumCarbonatePercent: "",
  uncertainty: "",
};

const emptyReview: ReviewSubmission = {
  investigationQuality: "",
  communicationQuality: "",
  desiredProduct: "",
  atomEconomyPercent: "",
  additionalGreenPrinciple: "",
  recommendations: "",
  personStyle: "second",
};

const assetPath = (file: string): string => {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}assets/equipment-realistic/v1/${file}`;
};

const Field = ({
  children,
  hint,
  label,
}: {
  children: ReactNode;
  hint?: string;
  label: string;
}) => (
  <label className="ig7-field">
    <span>{label}</span>
    {children}
    {hint ? <small>{hint}</small> : null}
  </label>
);

const PhaseRail = ({ phase }: { phase: Phase }) => {
  const phases: { id: Phase; label: string }[] = [
    { id: "inquiry", label: "Design" },
    { id: "experiment", label: "Heat / cool / weigh" },
    { id: "analysis", label: "Composition" },
    { id: "recovery", label: "Recovery" },
    { id: "review", label: "Peer review" },
    { id: "complete", label: "Complete" },
  ];
  const activeIndex = phases.findIndex((item) => item.id === phase);
  return (
    <ol className="ig7-phase-rail" aria-label="Investigation progress">
      {phases.map((item, index) => (
        <li
          className={
            index < activeIndex
              ? "is-complete"
              : index === activeIndex
                ? "is-current"
                : ""
          }
          key={item.id}
        >
          <span>{index < activeIndex ? <Check size={13} /> : index + 1}</span>
          {item.label}
        </li>
      ))}
    </ol>
  );
};

export const PurifyMixtureGreenChemistryPlayer = () => {
  const [phase, setPhase] = useState<Phase>("inquiry");
  const [configuration, setConfiguration] = useState(
    initialTeacherConfiguration,
  );
  const [plan, setPlan] = useState(() =>
    initialInquiryPlan(initialTeacherConfiguration()),
  );
  const [configuredDefinition, setConfiguredDefinition] =
    useState<LabDefinition>();
  const [routeState, setRouteState] = useState(
    createInitialGreenChemistryRouteState,
  );
  const [balanceReadingInput, setBalanceReadingInput] = useState("");
  const [notice, setNotice] = useState(
    "Execution remains locked until the inquiry plan and safety precautions receive teacher approval.",
  );
  const [analysis, setAnalysis] = useState<AnalysisSubmission>(emptyAnalysis);
  const [analysisErrors, setAnalysisErrors] = useState<string[]>([]);
  const [review, setReview] = useState<ReviewSubmission>(emptyReview);
  const approvalEpochRef = useRef(0);
  const nextApprovalRequestRef = useRef(0);
  const activeApprovalRequestRef = useRef<number | undefined>(undefined);
  const mountedRef = useRef(false);
  const [isApproving, setIsApproving] = useState(false);

  const invalidatePendingApproval = () => {
    approvalEpochRef.current += 1;
    if (activeApprovalRequestRef.current !== undefined) {
      activeApprovalRequestRef.current = undefined;
      setIsApproving(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      approvalEpochRef.current += 1;
      activeApprovalRequestRef.current = undefined;
    };
  }, []);
  useEffect(() => {
    approvalEpochRef.current += 1;
    if (activeApprovalRequestRef.current !== undefined) {
      activeApprovalRequestRef.current = undefined;
      setIsApproving(false);
    }
  }, [configuration, plan]);

  // The adapter and this projection both read the approved method out of the teacher-configured
  // compiled definition, so no second copy of the quantities that govern execution is kept here.
  const routeAdapter = useMemo(
    () => createGreenChemistryRouteAdapter(configuredDefinition),
    [configuredDefinition],
  );
  const approvedRules = useMemo(
    () => greenChemistryRulesFromCompiled(configuredDefinition).rules,
    [configuredDefinition],
  );
  const compiledHolders = useMemo(
    () => greenChemistryHoldersFromCompiled(configuredDefinition).holders,
    [configuredDefinition],
  );
  const closedSetPayload = (): RouteTechniqueExecutionIntent["payload"] => ({
    runId: routeState.runId,
    closedReplicateSet: greenChemistryClosedReplicateSetBinding(routeState) ?? "",
  });

  const executeRouteSequence = (
    steps: Array<{
      actionId: string;
      instanceId?: string;
      payload?: RouteTechniqueExecutionIntent["payload"];
    }>,
    startingState = routeState,
  ) => {
    let next = startingState;
    for (const step of steps) {
      const result = routeAdapter.execute(next, {
        instanceId: step.instanceId ?? GREEN_CHEMISTRY_INSTANCE_ID,
        actionId: step.actionId,
        payload: step.payload ?? {},
      });
      if (!result.ok) {
        setRouteState(routeAdapter.recover(result.state, result.rejection));
        setNotice(`${result.rejection.message} ${result.rejection.recovery}`);
        return undefined;
      }
      next = result.state;
    }
    setRouteState(next);
    return next;
  };

  const {
    approved,
    selectedBalance,
    pendingMassReading,
    emptyMassRecorded,
    emptyMassG,
    loadedMassRecorded,
    loadedMassG,
    assemblySteps,
    lidPosition,
    crucibleState,
    cycles,
    completedReplicates,
    finalMassRecorded,
    productRecovered,
  } = routeState;
  const assignedReport =
    configuration.reports[configuration.reportAssignment - 1];
  // What this run has actually returned unheated: each completed replicate's excess plus the
  // remainder handed back when the run closed. Never the configured total minus an allocation.
  const unheatedReturnedG =
    (routeState.material?.completed ?? []).reduce(
      (total, entry) => total + entry.excessReturnedG,
      0,
    ) + (routeState.material?.closure?.masterRemainderReturnedG ?? 0);
  const constantMassReached =
    cycles.length >= 2 &&
    cycles[cycles.length - 1]?.constant === true &&
    finalMassRecorded;
  const apparatusOrder = [
    "Ring stand and iron ring",
    "Ceramic triangle",
    "Bunsen burner",
    "Crucible",
  ];
  const currentReplicate = completedReplicates.length + 1;
  const requiredReplicates = approvedRules?.minimumReplicates ?? plan.replicates;
  const activeReplicateEvidence = currentGreenChemistryReplicate(routeState);
  const allReplicateEvidence = [
    ...completedReplicates,
    ...(activeReplicateEvidence ? [activeReplicateEvidence] : []),
  ];
  const meanSampleMassG = allReplicateEvidence.length
    ? allReplicateEvidence.reduce(
        (sum, replicate) =>
          sum + (replicate.loadedMassG - replicate.emptyMassG),
        0,
      ) / allReplicateEvidence.length
    : undefined;
  const meanFinalCrucibleMassG = allReplicateEvidence.length
    ? allReplicateEvidence.reduce(
        (sum, replicate) =>
          sum +
          replicate.cycles[replicate.cycles.length - 1].crucibleAndLidMassG,
        0,
      ) / allReplicateEvidence.length
    : undefined;

  const approvedConfigurationInput = () => ({
    sampleMassG: plan.sampleMassG,
    warmDurationMin: configuration.warmDurationMin,
    heatingDurationMin: configuration.heatingDurationMin,
    heatingIntensity: plan.heatingIntensity,
    constantMassToleranceG: configuration.constantMassToleranceG,
    maximumHeatCycles: configuration.maximumHeatCycles,
    coolingEndpointC: configuration.coolingEndpointC,
    coolingSurface: configuration.coolingSurface,
    tareConvention: configuration.tareConvention,
    minimumReplicates: plan.replicates,
  });
  const configurationErrors = assertConfigured(approvedConfigurationInput());
  const teacherMinimumReplicatesReady =
    Number.isSafeInteger(configuration.minimumReplicates) &&
    configuration.minimumReplicates > 0;
  const teacherConfigurationReady =
    configurationErrors.length === 0 &&
    teacherMinimumReplicatesReady &&
    configuration.ppeRequirements.trim().length > 0 &&
    // The stock has to be able to supply a full working portion to every planned replicate, and a
    // working portion has to be at least the portion each replicate loads. The adapter enforces
    // both again against the compiled values; this only stops an approval that cannot run.
    Number.isFinite(configuration.masterStockMassG) &&
    configuration.masterStockMassG > 0 &&
    Number.isFinite(configuration.workingPortionMassG) &&
    configuration.workingPortionMassG > 0 &&
    configuration.workingPortionMassG >= plan.sampleMassG &&
    configuration.masterStockMassG >=
      plan.replicates * configuration.workingPortionMassG &&
    configuration.acceptableCompositionUncertaintyPercent > 0 &&
    configuration.calculationToleranceG > 0 &&
    assignedReport.text.trim().length > 0 &&
    assignedReport.desiredProduct.trim().length > 0 &&
    Number(assignedReport.desiredProductStoichiometricMassG) > 0 &&
    Number(assignedReport.totalReactantStoichiometricMassG) > 0 &&
    Number(assignedReport.desiredProductStoichiometricMassG) <=
      Number(assignedReport.totalReactantStoichiometricMassG);
  const planReady =
    plan.rationale.trim().length > 0 &&
    plan.sampleMassG > 0 &&
    plan.heatingIntensity.trim().length > 0 &&
    plan.heatingDurationMin === configuration.heatingDurationMin &&
    plan.constantMassRule.trim().length > 0 &&
    Number.isSafeInteger(plan.replicates) &&
    plan.replicates > 0 &&
    plan.replicates >= configuration.minimumReplicates &&
    plan.apparatusAndObservations.trim().length > 0 &&
    plan.calculations.trim().length > 0 &&
    plan.uncertainty.trim().length > 0 &&
    plan.safety.trim().length > 0 &&
    plan.recovery.trim().length > 0;

  const updateReport = (
    index: number,
    key: keyof TeacherReport,
    value: string,
  ) => {
    setConfiguration((current) => {
      const reports = [...current.reports] as TeacherConfiguration["reports"];
      reports[index] = { ...reports[index], [key]: value };
      return { ...current, reports };
    });
  };

  const approvedConfiguration = (): GreenChemistryApprovedConfiguration =>
    parseGreenChemistrySetup(approvedConfigurationInput());

  /**
   * Approval compiles the composition with the approved configuration bound to the technique
   * instance and records approval against that compiled definition. Nothing physical can run
   * against the public lab's unconfigured placeholder.
   */
  const approvePlan = async () => {
    const approvalEpoch = approvalEpochRef.current;
    if (configurationErrors.length > 0) {
      setNotice(`Approval remains locked: ${configurationErrors.join(" ")}`);
      return;
    }
    if (!teacherConfigurationReady || !planReady) {
      setNotice(
        "Approval remains locked. Complete every inquiry field, teacher configuration, and the assigned report boundary.",
      );
      return;
    }
    const approved = approvedConfiguration();
    const requestId = nextApprovalRequestRef.current + 1;
    nextApprovalRequestRef.current = requestId;
    activeApprovalRequestRef.current = requestId;
    setIsApproving(true);
    const isCurrentApproval = () =>
      mountedRef.current
      && approvalEpochRef.current === approvalEpoch
      && activeApprovalRequestRef.current === requestId;
    let compiled: LabDefinition;
    try {
      compiled = await compileConfiguredGreenChemistry(approved);
    } catch (error) {
      if (!isCurrentApproval()) return;
      activeApprovalRequestRef.current = undefined;
      setIsApproving(false);
      setNotice(
        `Approval remains locked: ${error instanceof Error ? error.message : "the approved configuration did not compile"}.`,
      );
      return;
    }
    if (!isCurrentApproval()) return;
    const adapter = createGreenChemistryRouteAdapter(compiled);
    const result = adapter.execute(createInitialGreenChemistryRouteState(), {
      instanceId: GREEN_CHEMISTRY_INSTANCE_ID,
      actionId: "approve-thermal-decomposition-plan",
      payload: {
        ...approved,
        ...Object.fromEntries(
          GREEN_CHEMISTRY_APPROVAL_PLAN_FIELDS.map((field) => [field, plan[field]]),
        ),
      },
    });
    if (!result.ok) {
      activeApprovalRequestRef.current = undefined;
      setIsApproving(false);
      setNotice(`${result.rejection.message} ${result.rejection.recovery}`);
      return;
    }
    // The stock is issued as part of approval, so no run can reach a load without a finite,
    // teacher-set quantity behind it. A refusal here leaves the run unapproved rather than
    // approved-but-unsupplied.
    const stocked = adapter.execute(result.state, {
      instanceId: GREEN_CHEMISTRY_INSTANCE_ID,
      actionId: "configure-unheated-stock",
      payload: {
        stockMassG: configuration.masterStockMassG,
        workingPortionMassG: configuration.workingPortionMassG,
      },
    });
    if (!stocked.ok) {
      activeApprovalRequestRef.current = undefined;
      setIsApproving(false);
      setNotice(`${stocked.rejection.message} ${stocked.rejection.recovery}`);
      return;
    }
    if (!isCurrentApproval()) return;
    activeApprovalRequestRef.current = undefined;
    setConfiguredDefinition(compiled);
    setRouteState(stocked.state);
    setPhase("experiment");
    setIsApproving(false);
    setNotice(
      `Teacher approval recorded against the compiled technique instance. ${configuration.masterStockMassG} g of prepared mixture is available, issued ${configuration.workingPortionMassG} g at a time; the approved sample, cycle, safety, and evidence choices now govern this run.`,
    );
  };

  const readEmptyMass = (balanceId: BalanceId) => {
    const valueG = balanceReadingInput.trim()
      ? Number(balanceReadingInput)
      : Number.NaN;
    const next = executeRouteSequence([
      { actionId: "place-balance", payload: { balanceId } },
      { actionId: "place-empty-crucible" },
      {
        actionId: "read-empty-crucible",
        payload: { balanceId, valueG },
      },
    ]);
    if (!next) return;
    setBalanceReadingInput("");
    setNotice(
      `${balanceId === "balance-a" ? "Balance A" : "Balance B"} is locked for every weighing. The entered ${valueG.toFixed(4)} g display is acquired but not yet recorded.`,
    );
  };

  const loadSample = () => {
    if (!approvedRules) return;
    const next = executeRouteSequence([
      {
        actionId: "add-carbonate-sample",
        payload: { massG: approvedRules.sampleMassG },
      },
    ]);
    if (!next) return;
    setNotice(
      `The approved ${approvedRules.sampleMassG.toFixed(4)} g target was used for transfer. The next balance display—not the target—will establish actual loaded mass.`,
    );
  };

  const readLoadedMass = (balanceId: BalanceId) => {
    const valueG = balanceReadingInput.trim()
      ? Number(balanceReadingInput)
      : Number.NaN;
    const next = executeRouteSequence([
      {
        actionId: "weigh-initial-crucible",
        payload: { balanceId, valueG },
      },
    ]);
    if (!next) return;
    setBalanceReadingInput("");
    setNotice(
      `Entered balance display: ${valueG.toFixed(4)} g. Record it as a separate evidence action before proceeding.`,
    );
  };

  const recoverUnusedSample = () => {
    const next = executeRouteSequence([
      {
        actionId: "recover-unused-sample",
        payload: {
          sourceInstanceId: compiledHolders?.workingPortionInstanceId ?? "",
          targetInstanceId: compiledHolders?.unusedRecoveryInstanceId ?? "",
        },
      },
    ]);
    if (!next) return;
    setNotice("Unused mixture recovered in the correctly labeled container.");
  };

  const changeLidPosition = (position: LidPosition) => {
    const next = executeRouteSequence([
      { actionId: "set-crucible-lid", payload: { position } },
    ]);
    if (!next) return;
    setNotice(
      position === "askew"
        ? "Lid positioned askew with a visible vent gap."
        : position === "closed"
          ? "Lid fully seated. Ignition will remain blocked."
          : "Lid removed.",
    );
  };

  const addAssemblyStep = (step: string) => {
    const actionIdByStep: Record<string, string> = {
      "Ring stand and iron ring": "place-ring-stand",
      "Ceramic triangle": "add-clay-triangle",
      Crucible: "place-crucible-on-support",
      "Bunsen burner": "place-bunsen-burner",
    };
    const next = executeRouteSequence([
      { actionId: actionIdByStep[step] ?? "" },
    ]);
    if (!next) return;
    setNotice(`${step} placed and checked.`);
  };

  const heatCrucible = () => {
    if (!approvedRules) return;
    const firstCycle = cycles.length === 0;
    const next = executeRouteSequence(
      firstCycle
        ? [
            {
              actionId: "warm-gently",
              payload: { durationMin: approvedRules.warmDurationMin },
            },
            {
              actionId: "heat-carbonate-mixture",
              payload: { durationMin: approvedRules.heatingDurationMin },
            },
          ]
        : [
            {
              actionId: "repeat-heat-to-constant-mass",
              payload: { cycleIndex: cycles.length + 1 },
            },
          ],
    );
    if (!next) return;
    setNotice(
      `Cycle ${cycles.length + 1}: heating for the approved ${approvedRules.heatingDurationMin} min at ${approvedRules.heatingIntensity}. Extinguish the burner before moving the hot crucible.`,
    );
  };

  const extinguishBurner = () => {
    const next = executeRouteSequence([{ actionId: "turn-off-burner" }]);
    if (!next) return;
    setNotice(
      "Burner extinguished. The crucible remains hot; move it only with tongs to the approved cooling location.",
    );
  };

  const coolCrucible = () => {
    if (!approvedRules) return;
    const next = executeRouteSequence([
      {
        actionId:
          cycles.length === 0
            ? "cool-crucible"
            : "cool-constant-mass-crucible",
      },
    ]);
    if (!next) return;
    setNotice(
      `Crucible moved with tongs to ${approvedRules.coolingSurface} and cooled to the approved endpoint (at or below ${approvedRules.coolingEndpointC} °C).`,
    );
  };

  const readCycleMass = (balanceId: BalanceId) => {
    const valueG = balanceReadingInput.trim()
      ? Number(balanceReadingInput)
      : Number.NaN;
    const next = executeRouteSequence([
      {
        actionId:
          cycles.length === 0
            ? "weigh-preliminary-final-mass"
            : "weigh-final-crucible",
        payload: { balanceId, valueG },
      },
    ]);
    if (!next) return;
    setBalanceReadingInput("");
    setNotice(
      `Entered cooled balance display: ${valueG.toFixed(4)} g. Record it before making the constant-mass decision.`,
    );
  };

  const recordCurrentMassReading = () => {
    if (!pendingMassReading) {
      setNotice("Take a permitted balance reading before recording mass evidence.");
      return;
    }
    if (!approvedRules) {
      setNotice("Record mass evidence only after the configured route has been approved.");
      return;
    }
    if (pendingMassReading.kind === "empty") {
      const next = executeRouteSequence([
        { actionId: "record-empty-crucible" },
      ]);
      if (!next) return;
      setNotice(
        `${approvedRules.tareConvention === "record-crucible-plus-lid" ? "Empty crucible-plus-lid mass" : "Tared balance baseline"} recorded from the entered display: ${pendingMassReading.valueG.toFixed(4)} g.`,
      );
      return;
    }
    if (pendingMassReading.kind === "loaded") {
      const next = executeRouteSequence([
        { actionId: "record-initial-crucible-mass" },
      ]);
      if (!next) return;
      setNotice(
        `Loaded mass recorded: ${pendingMassReading.valueG.toFixed(4)} g.`,
      );
      return;
    }
    const afterCycle = executeRouteSequence([
      { actionId: "record-cycle-mass" },
    ]);
    if (!afterCycle) return;
    const latest = afterCycle.cycles[afterCycle.cycles.length - 1];
    const afterFinal = latest?.constant
      ? executeRouteSequence(
          [{ actionId: "record-final-crucible-mass" }],
          afterCycle,
        )
      : afterCycle;
    if (!afterFinal) return;
    setNotice(
      latest?.constant
        ? `Consecutive cooled readings differ by ${latest.differenceG?.toFixed(4)} g, within the approved ${(approvedRules?.constantMassToleranceG ?? configuration.constantMassToleranceG).toFixed(4)} g criterion. The final mass is separately recorded.`
        : "Fresh cooled mass recorded. Compare it with the preceding cooled mass, then repeat the full heat-cool-weigh loop.",
    );
  };

  /**
   * Close the run, then analyse it.
   *
   * Whatever mixture the class never used goes back to Unused Sample here, and the completed
   * replicate set is frozen at that moment. The composition and the final confirmation bind to
   * that frozen set, so analysis can never be derived from a replicate the run never closed out.
   */
  const beginAnalysis = () => {
    if (completedReplicates.length < requiredReplicates) {
      setNotice(
        `Complete and recover every approved replicate first: ${completedReplicates.length} of ${requiredReplicates} are closed.`,
      );
      return;
    }
    const next = executeRouteSequence([
      {
        actionId: "finalize-unused-master-stock",
        payload: {
          sourceInstanceId: compiledHolders?.masterStockInstanceId ?? "",
          targetInstanceId: compiledHolders?.unusedRecoveryInstanceId ?? "",
        },
      },
    ]);
    if (!next) return;
    setPhase("analysis");
    setNotice(
      "The remaining unheated mixture is back in Unused Sample and this run's replicates are frozen. Use your recorded masses and the independently atom-checked decomposition equation; the arithmetic is evaluated only after submission.",
    );
  };

  const submitAnalysis = () => {
    const frozenReplicates = routeState.material?.closure?.frozenReplicates ?? [];
    const replicateRecords = completedReplicates.filter((replicate) =>
      frozenReplicates.includes(replicate.replicate),
    );
    if (
      frozenReplicates.length < requiredReplicates
      || replicateRecords.length !== frozenReplicates.length
      || replicateRecords.length === 0
    ) {
      setAnalysisErrors([
        "Every approved replicate needs recorded empty, loaded, and constant final masses.",
      ]);
      setNotice("Complete the approved replicate evidence before analysis.");
      return;
    }
    const meanSampleMassG =
      replicateRecords.reduce(
        (sum, replicate) =>
          sum + (replicate.loadedMassG - replicate.emptyMassG),
        0,
      ) / replicateRecords.length;
    const meanMassLossG =
      replicateRecords.reduce((sum, replicate) => {
        const finalMassG =
          replicate.cycles[replicate.cycles.length - 1].crucibleAndLidMassG;
        return sum + (replicate.loadedMassG - finalMassG);
      }, 0) / replicateRecords.length;
    const finalResidueMassG = meanSampleMassG - meanMassLossG;
    let expected;
    try {
      expected = compositionFromMassLoss(meanSampleMassG, meanMassLossG);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Recorded masses are invalid.";
      setAnalysisErrors([message]);
      setNotice(
        "The recorded measurement set is not physically compatible with the stoichiometric model.",
      );
      return;
    }
    const massTolerance = configuration.calculationToleranceG;
    const percentTolerance =
      configuration.acceptableCompositionUncertaintyPercent;
    const checks: {
      key: Exclude<keyof AnalysisSubmission, "uncertainty">;
      label: string;
      target: number;
      tolerance: number;
    }[] = [
      {
        key: "massLossG",
        label: "Mass lost",
        target: expected.massLossG,
        tolerance: massTolerance,
      },
      {
        key: "finalSodiumCarbonateMassG",
        label: "Final Na2CO3 product mass",
        target: expected.finalResidueMassG,
        tolerance: massTolerance,
      },
      {
        key: "sodiumBicarbonateMassG",
        label: "NaHCO3 mass",
        target: expected.sodiumBicarbonateMassG,
        tolerance: massTolerance,
      },
      {
        key: "sodiumCarbonateMassG",
        label: "Initial Na2CO3 mass",
        target: expected.sodiumCarbonateMassG,
        tolerance: massTolerance,
      },
      {
        key: "sodiumBicarbonatePercent",
        label: "NaHCO3 percent",
        target: expected.sodiumBicarbonatePercent,
        tolerance: percentTolerance,
      },
      {
        key: "sodiumCarbonatePercent",
        label: "Na2CO3 percent",
        target: expected.sodiumCarbonatePercent,
        tolerance: percentTolerance,
      },
    ];
    const errors = checks.flatMap(({ key, label, target, tolerance }) => {
      const raw = analysis[key].trim();
      if (!raw) return [`${label} is required.`];
      return within(Number(raw), target, tolerance)
        ? []
        : [`${label} is outside the configured ±${tolerance} tolerance.`];
    });
    if (!analysis.uncertainty.trim()) {
      errors.push("Explain uncertainty or limitations in the composition result.");
    }
    if (finalResidueMassG <= 0) {
      errors.push("Final residue mass is not physically valid.");
    }
    setAnalysisErrors(errors);
    if (errors.length > 0) {
      setNotice("Revise the composition work using the recorded evidence and units.");
      return;
    }
    const next = executeRouteSequence([
      {
        actionId: "calculate-carbonate-composition",
        payload: {
          ...closedSetPayload(),
          calculationId: "composition-analysis",
          validated: true,
        },
      },
      {
        actionId: "record-composition-uncertainty",
        payload: { ...closedSetPayload(), note: analysis.uncertainty },
      },
    ]);
    if (!next) return;
    setPhase("recovery");
    setNotice(
      "Composition analysis accepted. Recover the heated Na2CO3-containing product separately for reuse.",
    );
  };

  /**
   * Close the active replicate. The final replicate closes the same way as any other, so the
   * compiled replicate-recovery and replicate-completion evidence is produced for every approved
   * replicate rather than only for the ones before the last.
   */
  const recoverReplicateProduct = () => {
    const next = executeRouteSequence([
      {
        actionId: "recover-replicate-product",
        payload: {
          sourceInstanceId: compiledHolders?.crucibleInstanceId ?? "",
          targetInstanceId: compiledHolders?.productRecoveryInstanceId ?? "",
        },
      },
      {
        actionId: "complete-replicate",
      },
    ]);
    if (!next) return;
    setNotice(
      next.completedReplicates.length >= requiredReplicates
        ? `Replicate ${currentReplicate} product recovered separately. Every approved replicate is complete; continue to composition analysis.`
        : `Replicate ${currentReplicate} product recovered separately. Begin replicate ${currentReplicate + 1} on the same locked balance.`,
    );
  };

  /**
   * Confirm the run's recoveries. Every replicate already moved its own product when it closed,
   * and the master remainder went back when the run closed, so this step chooses no destination
   * and moves nothing: it either reconciles against the run's own records or it is refused.
   */
  const confirmRecoveries = () => {
    const next = executeRouteSequence([{
      actionId: "recover-final-product",
      payload: closedSetPayload(),
    }]);
    if (!next) return;
    setPhase("review");
    setNotice(
      configuration.reheatSharedProductAfterSession
        ? "Every recovery is accounted for. The teacher-configured post-session reheating remains a teacher-managed follow-up, not a student claim of completion."
        : "Every recovery is accounted for: each replicate product is in Product Made from Heating Samples and all unheated mixture is in Unused Sample. Open only the teacher-assigned report.",
    );
  };

  const submitPeerReview = () => {
    const requiredText = [
      review.investigationQuality,
      review.communicationQuality,
      review.desiredProduct,
      review.additionalGreenPrinciple,
      review.recommendations,
    ];
    if (requiredText.some((value) => !value.trim())) {
      setNotice(
        "Complete every peer-review section with evidence from the assigned report.",
      );
      return;
    }
    if (
      review.desiredProduct.trim().toLocaleLowerCase() !==
      assignedReport.desiredProduct.trim().toLocaleLowerCase()
    ) {
      setNotice(
        "Recheck the desired product against the teacher-provided convention for this assigned report.",
      );
      return;
    }
    const expectedAtomEconomy = calculateAtomEconomyPercent(
      Number(assignedReport.desiredProductStoichiometricMassG),
      Number(assignedReport.totalReactantStoichiometricMassG),
    );
    if (
      !within(
        Number(review.atomEconomyPercent),
        expectedAtomEconomy,
        configuration.acceptableCompositionUncertaintyPercent,
      )
    ) {
      setNotice(
        "Recheck atom economy using the teacher-provided stoichiometric mass contributions.",
      );
      return;
    }
    const labOrchestration = GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID;
    const next = executeRouteSequence([
      {
        actionId: "review-assigned-green-chemistry-report",
        instanceId: labOrchestration,
        payload: {
          ...closedSetPayload(),
          assignedReport: assignedReport.text,
          review: `${review.investigationQuality} ${review.communicationQuality}`,
        },
      },
      {
        actionId: "calculate-assigned-report-atom-economy",
        instanceId: labOrchestration,
        payload: {
          ...closedSetPayload(),
          atomEconomyPercent: Number(review.atomEconomyPercent),
          validated: true,
        },
      },
      {
        actionId: "complete-green-chemistry-peer-review",
        instanceId: labOrchestration,
        payload: {
          ...closedSetPayload(),
          additionalGreenPrinciple: review.additionalGreenPrinciple,
          recommendations: review.recommendations,
        },
      },
    ]);
    if (!next) return;
    setPhase("complete");
    setNotice(
      "Investigation complete: approved inquiry, safe constant-mass evidence, composition, separate recovery, and assigned peer review are all recorded.",
    );
  };

  const resetInvestigation = () => {
    invalidatePendingApproval();
    const nextConfiguration = initialTeacherConfiguration();
    setConfiguration(nextConfiguration);
    setPlan(initialInquiryPlan(nextConfiguration));
    setRouteState(routeAdapter.reset(routeState));
    setConfiguredDefinition(undefined);
    setBalanceReadingInput("");
    setAnalysis(emptyAnalysis);
    setAnalysisErrors([]);
    setReview(emptyReview);
    setPhase("inquiry");
    setNotice(
      "Investigation reset. Complete a new inquiry plan and teacher configuration before execution.",
    );
  };

  return (
    <main className="ig7-player">
      <header className="ig7-header">
        <div>
          <span className="ig7-eyebrow">Chemistry · Mixture Purification</span>
          <h1>
            <FlaskConical size={26} aria-hidden="true" />
            Purifying a Mixture with Green Chemistry
          </h1>
          <p>
            Determine the relative amounts of NaHCO<sub>3</sub> and Na
            <sub>2</sub>CO<sub>3</sub> by a teacher-approved selective-heating
            method.
          </p>
        </div>
        <button type="button" onClick={resetInvestigation}>
          <RotateCcw size={15} aria-hidden="true" /> Reset investigation
        </button>
      </header>

      <PhaseRail phase={phase} />

      <div className="ig7-notice" role="status" aria-live="polite">
        {notice}
      </div>

      {phase === "inquiry" ? (
        <div
          className="ig7-two-column"
          onChangeCapture={invalidatePendingApproval}
        >
          <section className="ig7-panel">
            <div className="ig7-panel-heading">
              <div>
                <span>Student inquiry</span>
                <h2>Devise the analytical method</h2>
              </div>
              <LockKeyhole size={21} aria-hidden="true" />
            </div>
            <div className="ig7-form-grid">
              <Field label="Selective-heating rationale">
                <textarea
                  value={plan.rationale}
                  onChange={(event) =>
                    setPlan({ ...plan, rationale: event.currentTarget.value })
                  }
                  placeholder="Explain which component changes on heating and how mass evidence distinguishes the mixture."
                />
              </Field>
              <Field label="Proposed sample mass (g)">
                <input
                  step="any"
                  type="number"
                  value={plan.sampleMassG}
                  onChange={(event) =>
                    setPlan({
                      ...plan,
                      sampleMassG: Number(event.currentTarget.value),
                    })
                  }
                />
              </Field>
              <Field label="Heating intensity">
                <input
                  value={plan.heatingIntensity}
                  onChange={(event) =>
                    setPlan({
                      ...plan,
                      heatingIntensity: event.currentTarget.value,
                    })
                  }
                  placeholder="Student choice, subject to approval"
                />
              </Field>
              <Field label="Heating time per cycle (min)">
                <input
                  step="any"
                  type="number"
                  value={plan.heatingDurationMin}
                  onChange={(event) =>
                    setPlan({
                      ...plan,
                      heatingDurationMin: Number(event.currentTarget.value),
                    })
                  }
                />
              </Field>
              <Field label="Proposed constant-mass rule">
                <textarea
                  value={plan.constantMassRule}
                  onChange={(event) =>
                    setPlan({
                      ...plan,
                      constantMassRule: event.currentTarget.value,
                    })
                  }
                  placeholder="State how consecutive cooled masses will be compared."
                />
              </Field>
              <Field label="Replicates">
                <input
                  min="1"
                  step="1"
                  type="number"
                  value={plan.replicates}
                  onChange={(event) =>
                    setPlan({
                      ...plan,
                      replicates: Number(event.currentTarget.value),
                    })
                  }
                />
              </Field>
              <Field label="Apparatus, observations, and evidence">
                <textarea
                  value={plan.apparatusAndObservations}
                  onChange={(event) =>
                    setPlan({
                      ...plan,
                      apparatusAndObservations: event.currentTarget.value,
                    })
                  }
                />
              </Field>
              <Field label="Calculation approach">
                <textarea
                  value={plan.calculations}
                  onChange={(event) =>
                    setPlan({
                      ...plan,
                      calculations: event.currentTarget.value,
                    })
                  }
                />
              </Field>
              <Field label="Uncertainty plan">
                <textarea
                  value={plan.uncertainty}
                  onChange={(event) =>
                    setPlan({
                      ...plan,
                      uncertainty: event.currentTarget.value,
                    })
                  }
                />
              </Field>
              <Field label="Safety precautions">
                <textarea
                  value={plan.safety}
                  onChange={(event) =>
                    setPlan({ ...plan, safety: event.currentTarget.value })
                  }
                  placeholder="Include lid position, cooling, tongs, balance, and instructor-required PPE."
                />
              </Field>
              <Field label="Recovery plan">
                <textarea
                  value={plan.recovery}
                  onChange={(event) =>
                    setPlan({ ...plan, recovery: event.currentTarget.value })
                  }
                  placeholder="Keep unheated mixture and heated product in their separate labeled containers."
                />
              </Field>
            </div>
          </section>

          <section className="ig7-panel ig7-teacher-panel">
            <div className="ig7-panel-heading">
              <div>
                <span>Teacher configuration · C choices</span>
                <h2>Resolve manual-open parameters</h2>
              </div>
              <ClipboardCheck size={21} aria-hidden="true" />
            </div>
            <p className="ig7-source-note">
              These values are configuration choices, not claims from the
              manual. The assigned report must be supplied by the teacher.
            </p>
            <div className="ig7-compact-grid">
              <Field label="Constant-mass tolerance (g)">
                <input
                  step="any"
                  type="number"
                  value={configuration.constantMassToleranceG}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      constantMassToleranceG: Number(event.currentTarget.value),
                    })
                  }
                />
              </Field>
              <Field label="Maximum heat cycles">
                <input
                  min="1"
                  step="1"
                  type="number"
                  value={configuration.maximumHeatCycles}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      maximumHeatCycles: Number(event.currentTarget.value),
                    })
                  }
                />
              </Field>
              <Field
                label="Approved gentle warm-up duration (min)"
                hint="The separate low-intensity stage before the first full heat. No default is supplied."
              >
                <input
                  step="any"
                  type="number"
                  value={configuration.warmDurationMin}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      warmDurationMin: Number(event.currentTarget.value),
                    })
                  }
                />
              </Field>
              <Field label="Approved cycle duration (min)">
                <input
                  step="any"
                  type="number"
                  value={configuration.heatingDurationMin}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      heatingDurationMin: Number(event.currentTarget.value),
                    })
                  }
                />
              </Field>
              <Field
                label="Teacher-approved cool endpoint (°C)"
                hint="Enter the finite teacher-approved endpoint for safe handling; no source range is implied."
              >
                <input
                  step="any"
                  type="number"
                  value={configuration.coolingEndpointC}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      coolingEndpointC: Number(event.currentTarget.value),
                    })
                  }
                />
              </Field>
              <Field label="Approved cooling location">
                <input
                  value={configuration.coolingSurface}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      coolingSurface: event.currentTarget.value,
                    })
                  }
                />
              </Field>
              <Field label="Baseline PPE / local safety policy">
                <input
                  value={configuration.ppeRequirements}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      ppeRequirements: event.currentTarget.value,
                    })
                  }
                  placeholder="Teacher-provided; not enumerated by source"
                />
              </Field>
              <Field label="Tare convention">
                <select
                  value={configuration.tareConvention}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      tareConvention: event.currentTarget
                        .value as TeacherConfiguration["tareConvention"],
                    })
                  }
                >
                  <option value="">Select a tare convention</option>
                  <option value="record-crucible-plus-lid">
                    Record crucible + lid mass
                  </option>
                  <option value="tare-balance-with-crucible-plus-lid">
                    Tare balance with crucible + lid
                  </option>
                </select>
              </Field>
              <Field label="Minimum replicates">
                <input
                  min="1"
                  step="1"
                  type="number"
                  value={configuration.minimumReplicates}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      minimumReplicates: Number(event.currentTarget.value),
                    })
                  }
                />
              </Field>
              <Field
                label="Prepared mixture available to the class (g)"
                hint="The finite stock every replicate draws on. Whatever is left goes back to Unused Sample when the run closes."
              >
                <input
                  min="0"
                  step="0.0001"
                  type="number"
                  value={configuration.masterStockMassG}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      masterStockMassG: Number(event.currentTarget.value),
                    })
                  }
                />
              </Field>
              <Field
                label="Working portion issued per replicate (g)"
                hint="At least the approved sample mass. The excess this leaves is what EX-08 returns unheated, before any heating."
              >
                <input
                  min="0"
                  step="0.0001"
                  type="number"
                  value={configuration.workingPortionMassG}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      workingPortionMassG: Number(event.currentTarget.value),
                    })
                  }
                />
              </Field>
              <Field
                label="Percentage tolerance (percentage points)"
                hint="Bounds both the composition percentages and the assigned-report atom economy. No default is supplied."
              >
                <input
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={
                    configuration.acceptableCompositionUncertaintyPercent
                  }
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      acceptableCompositionUncertaintyPercent: Number(
                        event.currentTarget.value,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Mass-calculation tolerance (g)">
                <input
                  min="0.0001"
                  step="0.0001"
                  type="number"
                  value={configuration.calculationToleranceG}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      calculationToleranceG: Number(event.currentTarget.value),
                    })
                  }
                />
              </Field>
              <Field label="Assigned peer report">
                <select
                  value={configuration.reportAssignment}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      reportAssignment: Number(
                        event.currentTarget.value,
                      ) as 1 | 2 | 3,
                    })
                  }
                >
                  <option value={1}>Report 1</option>
                  <option value={2}>Report 2</option>
                  <option value={3}>Report 3</option>
                </select>
              </Field>
            </div>

            <div className="ig7-report-config">
              <h3>
                Teacher-provided report {configuration.reportAssignment}
              </h3>
              <Field label="Assigned report content">
                <textarea
                  value={assignedReport.text}
                  onChange={(event) =>
                    updateReport(
                      configuration.reportAssignment - 1,
                      "text",
                      event.currentTarget.value,
                    )
                  }
                  placeholder="Paste the assigned report. Lab Studio does not generate or infer it."
                />
              </Field>
              <Field label="Desired product convention">
                <input
                  value={assignedReport.desiredProduct}
                  onChange={(event) =>
                    updateReport(
                      configuration.reportAssignment - 1,
                      "desiredProduct",
                      event.currentTarget.value,
                    )
                  }
                />
              </Field>
              <div className="ig7-compact-grid">
                <Field
                  label="Desired-product stoichiometric mass contribution (g)"
                  hint="Stoichiometric coefficient × molar mass for the desired product in the reaction as written."
                >
                  <input
                    min="0.0001"
                    step="0.0001"
                    type="number"
                    value={assignedReport.desiredProductStoichiometricMassG}
                    onChange={(event) =>
                      updateReport(
                        configuration.reportAssignment - 1,
                        "desiredProductStoichiometricMassG",
                        event.currentTarget.value,
                      )
                    }
                  />
                </Field>
                <Field
                  label="Total-reactant stoichiometric mass contribution (g)"
                  hint="Sum of coefficient × molar mass for every reactant in the reaction as written."
                >
                  <input
                    min="0.0001"
                    step="0.0001"
                    type="number"
                    value={assignedReport.totalReactantStoichiometricMassG}
                    onChange={(event) =>
                      updateReport(
                        configuration.reportAssignment - 1,
                        "totalReactantStoichiometricMassG",
                        event.currentTarget.value,
                      )
                    }
                  />
                </Field>
              </div>
              <label className="ig7-check">
                <input
                  checked={configuration.reheatSharedProductAfterSession}
                  type="checkbox"
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      reheatSharedProductAfterSession:
                        event.currentTarget.checked,
                    })
                  }
                />
                Teacher manages post-session reheating of the shared product
                container
              </label>
            </div>

            <button
              className="ig7-primary"
              disabled={
                isApproving ||
                !teacherConfigurationReady ||
                !planReady
              }
              type="button"
              onClick={() => {
                void approvePlan();
              }}
            >
              <ClipboardCheck size={16} aria-hidden="true" />
              {isApproving
                ? "Compiling approved route…"
                : "Teacher approve and unlock execution"}
            </button>
          </section>
        </div>
      ) : null}

      {phase === "experiment" && approved ? (
        <div className="ig7-lab-layout">
          <section className="ig7-panel ig7-bench">
            <div className="ig7-panel-heading">
              <div>
                <span>Approved bench run</span>
                <h2>Selective thermal decomposition</h2>
              </div>
              <Flame size={21} aria-hidden="true" />
            </div>

            <div className="ig7-apparatus-stage">
              <img
                className="ig7-apparatus-assembly"
                alt="Ring stand, ceramic triangle, and crucible with lid visibly askew"
                src={assetPath(
                  "mixture-purification-ring-stand-clay-triangle-crucible-lid-askew.svg",
                )}
              />
              <img
                className="ig7-burner"
                alt=""
                aria-hidden="true"
                src={assetPath("bunsen-burner.svg")}
              />
              <div className={`ig7-flame is-${crucibleState}`} aria-hidden="true" />
              <div className="ig7-stage-label">
                <strong>
                  {crucibleState === "heating"
                    ? "Heating — flame on"
                    : crucibleState === "hot"
                      ? "Burner off — hot"
                    : crucibleState === "cooled-residue"
                      ? "Cooled — reading required"
                      : crucibleState === "cooled-recorded"
                        ? "Cooled mass recorded"
                        : crucibleState === "loaded-cool"
                          ? "Loaded, cool"
                          : "Cool, empty"}
                </strong>
                <span>
                  Replicate {currentReplicate}/{requiredReplicates} · lid:{" "}
                  {lidPosition} · assembly {assemblySteps.length}/
                  {apparatusOrder.length}
                </span>
              </div>
            </div>

            <div className="ig7-control-group">
              <h3>1. Same-balance mass evidence</h3>
              <Field
                label="Observed balance display (g)"
                hint="Enter the physical or classroom-simulated display. Lab Studio does not generate a reading or expected composition."
              >
                <input
                  min="0"
                  step="0.0001"
                  type="number"
                  inputMode="decimal"
                  value={balanceReadingInput}
                  onChange={(event) =>
                    setBalanceReadingInput(event.currentTarget.value)
                  }
                  placeholder="Enter the current display"
                />
              </Field>
              <div className="ig7-button-row">
                {(["balance-a", "balance-b"] as BalanceId[]).map((balanceId) => (
                  <button
                    type="button"
                    key={`empty-${balanceId}`}
                    onClick={() => readEmptyMass(balanceId)}
                  >
                    <Scale size={15} aria-hidden="true" />
                    Read empty on {balanceId === "balance-a" ? "A" : "B"}
                  </button>
                ))}
                <button type="button" onClick={loadSample}>
                  Transfer approved sample
                </button>
                {(["balance-a", "balance-b"] as BalanceId[]).map((balanceId) => (
                  <button
                    type="button"
                    key={`loaded-${balanceId}`}
                    onClick={() => readLoadedMass(balanceId)}
                  >
                    Read loaded on {balanceId === "balance-a" ? "A" : "B"}
                  </button>
                ))}
                <button
                  disabled={!pendingMassReading}
                  type="button"
                  onClick={recordCurrentMassReading}
                >
                  Record displayed reading
                </button>
              </div>
              <dl className="ig7-evidence-strip">
                <div>
                  <dt>Locked balance</dt>
                  <dd>
                    {selectedBalance
                      ? selectedBalance === "balance-a"
                        ? "Balance A"
                        : "Balance B"
                      : "Not selected"}
                  </dd>
                </div>
                <div>
                  <dt>Empty / tared baseline</dt>
                  <dd>
                    {emptyMassRecorded && emptyMassG !== undefined
                      ? `${emptyMassG.toFixed(4)} g`
                      : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Loaded mass</dt>
                  <dd>
                    {loadedMassRecorded && loadedMassG !== undefined
                      ? `${loadedMassG.toFixed(4)} g`
                      : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Unrecorded display</dt>
                  <dd>
                    {pendingMassReading
                      ? `${pendingMassReading.valueG.toFixed(4)} g`
                      : "None"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="ig7-control-group">
              <h3>2. Recover excess unheated mixture</h3>
              <div className="ig7-container-row">
                <button type="button" onClick={recoverUnusedSample}>
                  Return to Unused Sample
                </button>
              </div>
            </div>

            <div className="ig7-control-group">
              <h3>3. Assemble the heating apparatus</h3>
              <div className="ig7-button-row">
                {apparatusOrder.map((step) => (
                  <button
                    disabled={assemblySteps.includes(step)}
                    key={step}
                    type="button"
                    onClick={() => addAssemblyStep(step)}
                  >
                    {assemblySteps.includes(step) ? <Check size={15} /> : null}
                    {step}
                  </button>
                ))}
              </div>
            </div>

            <div className="ig7-control-group ig7-safety-gate">
              <h3>
                <ShieldAlert size={17} aria-hidden="true" />
                4. Lid safety gate
              </h3>
              <div className="ig7-segmented" role="group" aria-label="Crucible lid position">
                {(["off", "closed", "askew"] as LidPosition[]).map((position) => (
                  <button
                    aria-pressed={lidPosition === position}
                    className={lidPosition === position ? "is-active" : ""}
                    key={position}
                    type="button"
                    onClick={() => changeLidPosition(position)}
                  >
                    {position === "closed" ? "Fully seated" : position}
                  </button>
                ))}
              </div>
              <p>
                Ignition is permitted only with a visible vent gap. A fully
                covered crucible can build gas pressure and eject the lid.
              </p>
            </div>

            <div className="ig7-control-group">
              <h3>5. Repeat the full heat / cool / weigh loop</h3>
              <div className="ig7-button-row">
                <button type="button" onClick={heatCrucible}>
                  <Flame size={15} aria-hidden="true" /> Heat cycle{" "}
                  {cycles.length + 1}
                </button>
                <button type="button" onClick={extinguishBurner}>
                  Extinguish burner
                </button>
                <button type="button" onClick={coolCrucible}>
                  <Thermometer size={15} aria-hidden="true" /> Move with tongs
                  and cool
                </button>
                {(["balance-a", "balance-b"] as BalanceId[]).map((balanceId) => (
                  <button
                    type="button"
                    key={`cycle-${balanceId}`}
                    onClick={() => readCycleMass(balanceId)}
                  >
                    Read cooled on {balanceId === "balance-a" ? "A" : "B"}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="ig7-panel ig7-data-panel">
            <div className="ig7-panel-heading">
              <div>
                <span>Mass history</span>
                <h2>Constant-mass evidence</h2>
              </div>
              <Scale size={21} aria-hidden="true" />
            </div>
            <p>
              Replicate {currentReplicate} of {requiredReplicates}. Only cooled
              readings from{" "}
              {selectedBalance
                ? selectedBalance === "balance-a"
                  ? "Balance A"
                  : "Balance B"
                : "the locked balance"}{" "}
              count.
            </p>
            <div className="ig7-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cycle</th>
                    <th>Heat</th>
                    <th>Mass (g)</th>
                    <th>Δ (g)</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.length ? (
                    cycles.map((cycle) => (
                      <tr key={cycle.cycle}>
                        <td>{cycle.cycle}</td>
                        <td>{cycle.durationMin} min</td>
                        <td>{cycle.crucibleAndLidMassG.toFixed(4)}</td>
                        <td>
                          {cycle.differenceG === undefined
                            ? "—"
                            : cycle.differenceG.toFixed(4)}
                        </td>
                        <td>{cycle.constant ? "constant" : "reheat"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>No cooled cycle readings yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="ig7-criterion">
              <span>Teacher criterion</span>
              <strong>
                |m<sub>n</sub> − m<sub>n−1</sub>| ≤{" "}
                {(
                  approvedRules?.constantMassToleranceG ??
                  configuration.constantMassToleranceG
                ).toFixed(4)}{" "}
                g
              </strong>
            </div>
            {constantMassReached ? (
              <div className="ig7-control-group">
                <h3>
                  Empty the crucible to close replicate {currentReplicate}
                </h3>
                <div className="ig7-container-row">
                  <button type="button" onClick={recoverReplicateProduct}>
                    Recover into Product Made from Heating Samples
                  </button>
                </div>
              </div>
            ) : null}
            <button
              className="ig7-primary"
              disabled={completedReplicates.length < requiredReplicates}
              type="button"
              onClick={beginAnalysis}
            >
              Return remaining stock and continue to composition analysis
            </button>
          </aside>
        </div>
      ) : null}

      {phase === "analysis" ? (
        <section className="ig7-panel ig7-analysis-panel">
          <div className="ig7-panel-heading">
            <div>
              <span>Stoichiometry workspace</span>
              <h2>Determine the starting composition</h2>
            </div>
            <Scale size={21} aria-hidden="true" />
          </div>
          <div className="ig7-equation">
            <strong>
              2 NaHCO<sub>3</sub>(s) → Na<sub>2</sub>CO<sub>3</sub>(s) + CO
              <sub>2</sub>(g) + H<sub>2</sub>O(g)
            </strong>
            <span>
              Independently checked for Na, H, C, and O atom balance; not copied
              from corrupted extraction.
            </span>
          </div>
          <dl className="ig7-evidence-strip">
            <div>
              <dt>Mean measured sample</dt>
              <dd>
                {meanSampleMassG === undefined
                  ? "Not available"
                  : `${meanSampleMassG.toFixed(4)} g`}
              </dd>
            </div>
            <div>
              <dt>Current loaded crucible + lid</dt>
              <dd>
                {loadedMassG === undefined
                  ? "Not recorded"
                  : `${loadedMassG.toFixed(4)} g`}
              </dd>
            </div>
            <div>
              <dt>Mean final crucible + lid</dt>
              <dd>
                {meanFinalCrucibleMassG === undefined
                  ? "Not available"
                  : `${meanFinalCrucibleMassG.toFixed(4)} g (${allReplicateEvidence.length} replicates)`}
              </dd>
            </div>
          </dl>
          <p className="ig7-source-note">
            Measurement boundary: these values are the balance displays entered
            by the learner. Lab Studio has not generated missing readings,
            inferred an experimental result, or inserted an expected
            composition. Balance precision and classroom instrument provenance
            remain part of the evidence and uncertainty analysis.
          </p>
          <p className="ig7-formula">
            m(NaHCO<sub>3</sub>) = Δm × 2M(NaHCO<sub>3</sub>) ÷ [M(CO
            <sub>2</sub>) + M(H<sub>2</sub>O)]
          </p>
          <div className="ig7-compact-grid">
            {(
              [
                ["massLossG", "Mass lost (g)"],
                [
                  "finalSodiumCarbonateMassG",
                  "Final Na2CO3 product mass (g)",
                ],
                ["sodiumBicarbonateMassG", "Starting NaHCO3 mass (g)"],
                ["sodiumCarbonateMassG", "Starting Na2CO3 mass (g)"],
                ["sodiumBicarbonatePercent", "NaHCO3 (%)"],
                ["sodiumCarbonatePercent", "Na2CO3 (%)"],
              ] as const
            ).map(([key, label]) => (
              <Field label={label} key={key}>
                <input
                  step="0.0001"
                  type="number"
                  value={analysis[key]}
                  onChange={(event) =>
                    setAnalysis({
                      ...analysis,
                      [key]: event.currentTarget.value,
                    })
                  }
                />
              </Field>
            ))}
          </div>
          <Field label="Uncertainty and limitations">
            <textarea
              value={analysis.uncertainty}
              onChange={(event) =>
                setAnalysis({
                  ...analysis,
                  uncertainty: event.currentTarget.value,
                })
              }
              placeholder="Address balance precision, constant-mass evidence, transfer loss, and model limitations."
            />
          </Field>
          {analysisErrors.length ? (
            <ul className="ig7-error-list" role="alert">
              {analysisErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
          <button className="ig7-primary" type="button" onClick={submitAnalysis}>
            Submit composition
          </button>
        </section>
      ) : null}

      {phase === "recovery" ? (
        <section className="ig7-panel ig7-recovery-panel">
          <div className="ig7-panel-heading">
            <div>
              <span>Material stewardship</span>
              <h2>Confirm every recovery is accounted for</h2>
            </div>
            <Leaf size={21} aria-hidden="true" />
          </div>
          <p>
            Each replicate already emptied its cooled Na<sub>2</sub>CO<sub>3</sub>
            -containing product into Product Made from Heating Samples, and the
            mixture the class never heated is back in Unused Sample. Nothing is
            moved here and there is no destination to choose: confirming checks
            the two labeled containers against this run&rsquo;s own records.
          </p>
          <dl className="ig7-evidence-strip">
            <div>
              <dt>Replicate products collected</dt>
              <dd>
                {routeState.material?.productRecords.length ?? 0} of{" "}
                {routeState.material?.closure?.frozenReplicates.length ??
                  completedReplicates.length}
              </dd>
            </div>
            <div>
              <dt>Unheated mixture returned</dt>
              <dd>
                {unheatedReturnedG.toFixed(4)} g of the{" "}
                {configuration.masterStockMassG} g prepared
              </dd>
            </div>
          </dl>
          <div className="ig7-container-row">
            <button type="button" onClick={confirmRecoveries}>
              Confirm all recoveries
            </button>
          </div>
          {productRecovered ? (
            <p>Every recovery is accounted for.</p>
          ) : null}
        </section>
      ) : null}

      {phase === "review" ? (
        <div className="ig7-review-layout">
          <article className="ig7-panel ig7-assigned-report">
            <div className="ig7-panel-heading">
              <div>
                <span>Teacher-provided artifact</span>
                <h2>Assigned report {configuration.reportAssignment}</h2>
              </div>
              <ClipboardCheck size={21} aria-hidden="true" />
            </div>
            <pre>{assignedReport.text}</pre>
            <dl className="ig7-evidence-strip">
              <div>
                <dt>Desired-product mass contribution</dt>
                <dd>
                  {assignedReport.desiredProductStoichiometricMassG} g per
                  reaction as written
                </dd>
              </div>
              <div>
                <dt>Total-reactant mass contribution</dt>
                <dd>
                  {assignedReport.totalReactantStoichiometricMassG} g per
                  reaction as written
                </dd>
              </div>
            </dl>
            <p className="ig7-formula">
              Atom economy = desired-product stoichiometric mass contribution
              ÷ total-reactant stoichiometric mass contribution × 100%
            </p>
          </article>
          <section className="ig7-panel">
            <div className="ig7-panel-heading">
              <div>
                <span>Green chemistry peer review</span>
                <h2>Evaluate evidence and reporting</h2>
              </div>
              <Leaf size={21} aria-hidden="true" />
            </div>
            <div className="ig7-form-grid">
              <Field label="Investigation quality">
                <textarea
                  value={review.investigationQuality}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      investigationQuality: event.currentTarget.value,
                    })
                  }
                  placeholder="Assess design, trials, data care, chemistry, calculations, and problems."
                />
              </Field>
              <Field label="Reporting quality">
                <textarea
                  value={review.communicationQuality}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      communicationQuality: event.currentTarget.value,
                    })
                  }
                  placeholder="Assess reproducibility, materials, organization, calculations, and weak sections."
                />
              </Field>
              <Field label="Desired product identified from the report">
                <input
                  value={review.desiredProduct}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      desiredProduct: event.currentTarget.value,
                    })
                  }
                />
              </Field>
              <Field
                label="Atom economy (%)"
                hint="Use the teacher-provided convention and reaction contributions."
              >
                <input
                  step="0.01"
                  type="number"
                  value={review.atomEconomyPercent}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      atomEconomyPercent: event.currentTarget.value,
                    })
                  }
                />
              </Field>
              <Field label="One additional green-chemistry principle">
                <textarea
                  value={review.additionalGreenPrinciple}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      additionalGreenPrinciple: event.currentTarget.value,
                    })
                  }
                />
              </Field>
              <Field label="Concise improvement recommendations">
                <textarea
                  value={review.recommendations}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      recommendations: event.currentTarget.value,
                    })
                  }
                />
              </Field>
              <Field label="Recommendation voice">
                <select
                  value={review.personStyle}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      personStyle: event.currentTarget
                        .value as ReviewSubmission["personStyle"],
                    })
                  }
                >
                  <option value="second">Second person</option>
                  <option value="third">Third person</option>
                </select>
              </Field>
            </div>
            <button
              className="ig7-primary"
              type="button"
              onClick={submitPeerReview}
            >
              Submit assigned peer review
            </button>
          </section>
        </div>
      ) : null}

      {phase === "complete" ? (
        <section className="ig7-panel ig7-complete">
          <div className="ig7-complete-icon">
            <Check size={30} aria-hidden="true" />
          </div>
          <span>Investigation complete</span>
          <h2>Evidence remained traceable from inquiry to recovery.</h2>
          <p>
            The run used one balance, blocked unsafe heating and hot weighing,
            required consecutive constant-mass evidence, calculated composition
            from balanced stoichiometry, kept recovery streams separate, and
            reviewed only the teacher-assigned report.
          </p>
        </section>
      ) : null}
    </main>
  );
};
