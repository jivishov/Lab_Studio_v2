import { useEffect, useMemo, useState } from "react";
import type { RouteTechniqueExecutionIntent } from "../../domain/types";
import {
  acidBaseCompiledWitnesses,
  type AcidBaseCompiledWitnesses,
} from "./compiledWitnesses";
import {
  analysisTargets,
  combinationById,
  generateTitrationCurve,
  isAnalysisValueWithinTolerance,
  practiceMixturePh,
  practicePh,
  sampleById,
  type AnalysisTargets,
  type CurveResult,
  type TitrationInvestigationConfig,
  validateInvestigationConfig,
} from "./model";
import {
  clearRetriedAttempt,
  createAcidBaseRouteAdapter,
  createInitialAcidBaseRouteState,
  isAcidBaseRouteContext,
  isPlanApproved,
  CONTINUE_DELIVERY,
  DISPOSE_AND_RESTART_TRIAL,
  FINISH_AFTER_STABILITY_REVIEW,
  FORMAL_INSTANCE_ID,
  LAB_ORCHESTRATION_INSTANCE_ID,
  type AcidBaseRouteState,
} from "./routeAdapter";
import "./acid-base-titration-curves.css";

type SectionId = "brief" | "practice" | "plan" | "run" | "analyze" | "class-data";

interface ApprovedPlan {
  question: string;
  hypothesis: string;
  selectedCombinationIds: string[];
  aliquotMl: number;
  coarseIncrementMl: number;
  fineIncrementMl: number;
  replicates: number;
  teacherInitials: string;
  approvedAt: string;
}

interface RunState {
  prepared: boolean;
  recordedCount: number;
  initialBuretReadingMl: string;
}

interface ClassDatum {
  id: string;
  sourceGroup: string;
  combinationId: string;
  replicate: number;
  equivalenceVolumeMl: number;
  points: { volumeMl: number; ph: number }[];
  note: string;
  addedAt: string;
}

const sectionLabels: { id: SectionId; label: string }[] = [
  { id: "brief", label: "Mission & safety" },
  { id: "practice", label: "Qualitative practice" },
  { id: "plan", label: "Inquiry approval" },
  { id: "run", label: "Formal titration" },
  { id: "analyze", label: "Landmarks & calculations" },
  { id: "class-data", label: "Class comparison & disposal" },
];

/**
 * Once-per-context bench assembly. The compiled trial's rejected-attempt edge re-enters at the
 * funnel/fill segment, so filling belongs to each attempt's preflight rather than to this
 * checklist.
 */
const benchSteps = [
  "Place the utility stand upright and attach the buret clamp at a usable height.",
  "Seat the buret vertically with the stopcock accessible; center the receiving vessel below the tip.",
  "Condition the buret with the selected titrant, drain residual liquid, and discard the rinsate.",
];

const benchActionSequences = [
  ["formal-trial-place-ring-stand"],
  ["formal-trial-mount-burette"],
  [
    "formal-trial-condition-burette-drain-residual",
    "formal-trial-condition-burette",
    "formal-trial-condition-burette-discard-rinsate",
  ],
] as const;

/** Route-control identities for the assembly checklist, mirrored by the lane control map. */
const benchControlIds = [
  "bench-place-ring-stand",
  "bench-mount-burette",
  "bench-condition-burette",
] as const;

/** Ordered compiled preflight for one attempt, from the funnel/fill segment to the initial row. */
const preflightActionIds = [
  "formal-trial-seat-burette-funnel",
  "formal-trial-fill-burette",
  "formal-trial-fill-burette-purge-tip",
  "formal-trial-fill-burette-check-tip",
  "formal-trial-remove-burette-funnel",
  "formal-trial-read-initial-burette",
  "formal-trial-record-initial-burette",
  "formal-trial-measure-analyte",
  "formal-trial-transfer-analyte-to-receiver",
  "formal-trial-position-flask-under-burette",
  "formal-trial-probe-ready",
  "formal-trial-place-ph-meter-on-workbench",
  "formal-trial-immerse-endpoint-ph-probe",
  "formal-trial-inspect-prepared-analyte",
  "formal-trial-initial-ph",
  "formal-trial-initial-row",
] as const;

/** Ordered compiled per-trial disposal chain that closes the technique instance. */
const disposalActionIds = [
  "formal-trial-dispose",
  "formal-trial-dispose-rinse",
  "formal-trial-dispose-discard-rinse",
] as const;

/** Ordered compiled rejected-attempt recovery chain. */
const retryActionIds = [
  "formal-trial-deliver-titrant-retry-dispose",
  "formal-trial-deliver-titrant-retry-dispose-rinse",
  "formal-trial-deliver-titrant-retry-dispose-discard-rinse",
  "formal-trial-deliver-titrant-retry-reset",
] as const;

/**
 * Volume recorded after the steepest observed interval of the recorded rows. This is the quantity
 * the compiled endpoint decision compares with its configured minimum; it is read from the rows
 * the route has actually recorded, never from the model's own verdict.
 */
const postSteepVolumeMl = (points: { volumeMl: number; ph: number }[]): number => {
  if (points.length < 2) return 0;
  let steepestIndex = 1;
  let steepestDelta = -1;
  for (let index = 1; index < points.length; index += 1) {
    const delta = Math.abs(points[index].ph - points[index - 1].ph);
    if (delta > steepestDelta) {
      steepestDelta = delta;
      steepestIndex = index;
    }
  }
  return points[points.length - 1].volumeMl - points[steepestIndex].volumeMl;
};

const publicAsset = (file: string): string => {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}assets/equipment-realistic/v1/${file}`;
};

const configPath = (): string => {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}labs/acid-base-titration-curves-config.json`;
};

const parseClassCurve = (
  raw: string,
): { points: { volumeMl: number; ph: number }[]; error?: string } => {
  const rows = raw
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  const points = rows.map((row) => {
    const [volumeText, phText, ...extra] = row.split(/[\t,]/).map((value) => value.trim());
    return {
      volumeMl: Number(volumeText),
      ph: Number(phText),
      validColumns: extra.length === 0 && volumeText !== "" && phText !== "",
    };
  });
  if (points.length < 5) {
    return { points: [], error: "Paste at least five pH-volume rows from the independent curve." };
  }
  if (
    points.some(
      (point) =>
        !point.validColumns ||
        !Number.isFinite(point.volumeMl) ||
        point.volumeMl < 0 ||
        !Number.isFinite(point.ph) ||
        point.ph < 0 ||
        point.ph > 14,
    )
  ) {
    return { points: [], error: "Each row must contain only volume (mL), pH with pH from 0 through 14." };
  }
  if (Math.abs(points[0].volumeMl) > 0.05) {
    return { points: [], error: "The independent curve must include its initial reading at 0.00 mL." };
  }
  if (points.some((point, index) => index > 0 && point.volumeMl <= points[index - 1].volumeMl)) {
    return { points: [], error: "Independent-curve volumes must increase strictly without duplicate rows." };
  }
  return {
    points: points.map(({ volumeMl, ph }) => ({ volumeMl, ph })),
  };
};

const curvePath = (curve: CurveResult): string => {
  const maxVolume = Math.max(curve.points.at(-1)?.volumeMl ?? 1, 1);
  return curve.points
    .map((point, index) => {
      const x = 42 + (point.volumeMl / maxVolume) * 406;
      const y = 18 + ((14 - point.ph) / 14) * 236;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
};

const CurveChart = ({
  curve,
  label,
  recordedCount = curve.points.length,
}: {
  curve: CurveResult;
  label: string;
  recordedCount?: number;
}) => {
  const visiblePoints = curve.points.slice(0, recordedCount);
  const visibleCurve = { ...curve, points: visiblePoints };
  const maxVolume = Math.max(curve.points.at(-1)?.volumeMl ?? 1, 1);
  return (
    <svg
      aria-label={`${label}. pH versus titrant volume. ${visiblePoints.length} recorded points.`}
      className="inv14-curve"
      role="img"
      viewBox="0 0 480 290"
    >
      {[0, 2, 4, 6, 8, 10, 12, 14].map((ph) => (
        <g key={ph}>
          <line className="inv14-curve-grid" x1="42" x2="448" y1={18 + ((14 - ph) / 14) * 236} y2={18 + ((14 - ph) / 14) * 236} />
          <text x="18" y={22 + ((14 - ph) / 14) * 236}>{ph}</text>
        </g>
      ))}
      <line className="inv14-curve-axis" x1="42" x2="448" y1="254" y2="254" />
      <line className="inv14-curve-axis" x1="42" x2="42" y1="18" y2="254" />
      <path className="inv14-curve-line" d={curvePath(visibleCurve)} />
      {visiblePoints.map((point) => (
        <circle
          className={`inv14-curve-point is-${point.region}`}
          cx={42 + (point.volumeMl / maxVolume) * 406}
          cy={18 + ((14 - point.ph) / 14) * 236}
          key={`${point.volumeMl}-${point.ph}`}
          r={point.region === "equivalence" || point.region === "half-equivalence" ? 4.4 : 2.6}
        />
      ))}
      <text className="inv14-axis-label" x="220" y="282">Titrant added (mL)</text>
      <text className="inv14-axis-label" transform="rotate(-90 10 144)" x="10" y="144">pH</text>
    </svg>
  );
};

const sampleDescription = (
  config: TitrationInvestigationConfig,
  sampleId: string,
  revealUnknown = false,
): string => {
  const sample = sampleById(config, sampleId);
  const concentration =
    sample.concentrationStatus === "known" || revealUnknown
      ? `${sample.molarityM.toFixed(4)} M`
      : "molarity withheld";
  return `${sample.formula} · ${sample.strength} ${sample.role} · ${concentration}`;
};

const expectedFields = (targets: AnalysisTargets) => [
  { id: "equivalenceVolumeMl", label: "Equivalence volume (mL)", expected: targets.equivalenceVolumeMl },
  { id: "equivalencePh", label: "Equivalence-point pH", expected: targets.equivalencePh },
  ...(targets.halfEquivalencePh !== undefined
    ? [{ id: "halfEquivalencePh", label: "Half-equivalence pH", expected: targets.halfEquivalencePh }]
    : []),
  ...(targets.unknownMolarityM !== undefined
    ? [{
        id: "unknownMolarityM",
        label: `${targets.unknownSampleLabel ?? "Unknown sample"} molarity (M)`,
        expected: targets.unknownMolarityM,
      }]
    : []),
  ...(targets.percentIonization !== undefined
    ? [{ id: "percentIonization", label: "Initial percent ionization (%)", expected: targets.percentIonization }]
    : []),
  ...(targets.equilibriumConstant !== undefined
    ? [{ id: "equilibriumConstant", label: `${targets.constantLabel} from curve`, expected: targets.equilibriumConstant }]
    : []),
  ...(targets.percentError !== undefined
    ? [{ id: "percentError", label: `${targets.constantLabel} percent error (%)`, expected: targets.percentError }]
    : []),
];

export const AcidBaseTitrationCurvesInvestigation = () => {
  const [config, setConfig] = useState<TitrationInvestigationConfig>();
  const [loadError, setLoadError] = useState<string>();
  const [witnesses, setWitnesses] = useState<AcidBaseCompiledWitnesses>();
  const [routeStates, setRouteStates] = useState<Record<string, AcidBaseRouteState>>({});
  const [routeNotice, setRouteNotice] = useState<string>(
    "Loading the compiler-issued acid-base composition manifest.",
  );
  const [section, setSection] = useState<SectionId>("brief");
  const [ppeAcknowledged, setPpeAcknowledged] = useState<string[]>([]);
  const [hazardsAcknowledged, setHazardsAcknowledged] = useState(false);
  const [practiceStep, setPracticeStep] = useState(0);
  const [selectedCombinationIds, setSelectedCombinationIds] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [aliquotMl, setAliquotMl] = useState(25);
  const [coarseIncrementMl, setCoarseIncrementMl] = useState(2);
  const [fineIncrementMl, setFineIncrementMl] = useState(0.25);
  const [replicates, setReplicates] = useState(1);
  const [teacherInitials, setTeacherInitials] = useState("");
  const [planFeedback, setPlanFeedback] = useState<string[]>([]);
  const [approvedPlan, setApprovedPlan] = useState<ApprovedPlan>();
  const [benchProgress, setBenchProgress] = useState(0);
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [analysisInputs, setAnalysisInputs] = useState<Record<string, Record<string, string>>>({});
  const [analysisChecked, setAnalysisChecked] = useState<Record<string, boolean>>({});
  const [particulateExplanation, setParticulateExplanation] = useState("");
  const [uncertaintyReflection, setUncertaintyReflection] = useState("");
  const [classData, setClassData] = useState<ClassDatum[]>([]);
  const [classGroup, setClassGroup] = useState("");
  const [classCombination, setClassCombination] = useState("");
  const [classReplicate, setClassReplicate] = useState(1);
  const [classEquivalence, setClassEquivalence] = useState("");
  const [classCurveText, setClassCurveText] = useState("");
  const [classCurveError, setClassCurveError] = useState("");
  const [classNote, setClassNote] = useState("");
  const [noClassDataAvailable, setNoClassDataAvailable] = useState(false);
  const [wastePh, setWastePh] = useState("");
  const [disposalConfirmed, setDisposalConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(configPath())
      .then(async (response) => {
        if (!response.ok) throw new Error(`Teacher configuration returned ${response.status}.`);
        return (await response.json()) as TitrationInvestigationConfig;
      })
      .then((loaded) => {
        const errors = validateInvestigationConfig(loaded);
        if (errors.length) throw new Error(errors.join(" "));
        if (!active) return;
        setConfig(loaded);
        setSelectedCombinationIds(loaded.requiredCombinationIds);
        setQuestion(loaded.assignedQuestion);
        setAliquotMl(loaded.settings.aliquotMl);
        setCoarseIncrementMl(loaded.settings.coarseIncrementMl);
        setFineIncrementMl(loaded.settings.fineIncrementMl);
        setReplicates(loaded.minimumReplicates);
        setClassCombination(loaded.combinations[0]?.id ?? "");
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Unable to load investigation configuration.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void acidBaseCompiledWitnesses()
      .then((compiled) => {
        if (!active) return;
        setWitnesses(compiled);
        setRouteNotice(
          `Compiled ${compiled.size} configured context${compiled.size === 1 ? "" : "s"}. Complete the inquiry plan before physical acquisition.`,
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRouteNotice(
          `Execution remains locked: ${error instanceof Error ? error.message : "the compiled acid-base contexts could not be loaded"}.`,
        );
      });
    return () => {
      active = false;
    };
  }, []);

  // One adapter per compiled witness: each configured combination executes the root process whose
  // resolved configuration actually carries its context and chemistry model.
  const routeAdapters = useMemo(() => {
    const adapters = new Map<string, ReturnType<typeof createAcidBaseRouteAdapter>>();
    for (const [context, definition] of witnesses ?? []) {
      adapters.set(context, createAcidBaseRouteAdapter(definition));
    }
    return adapters;
  }, [witnesses]);

  const routeStateFor = (contextId: string): AcidBaseRouteState =>
    routeStates[contextId] ?? createInitialAcidBaseRouteState();

  const dispatchRouteSequenceFor = (
    contextId: string,
    steps: Array<{
      instanceId: string;
      actionId: string;
      payload?: RouteTechniqueExecutionIntent["payload"];
    }>,
  ): boolean => {
    const adapter = routeAdapters.get(contextId);
    if (!adapter) {
      setRouteNotice(
        `Execution remains locked: no compiled witness is available for ${contextId}. Reload the compiled acid-base composition.`,
      );
      return false;
    }
    let next = routeStateFor(contextId);
    for (const step of steps) {
      const result = adapter.execute(next, {
        instanceId: step.instanceId,
        actionId: step.actionId,
        payload: { ...(step.payload ?? {}), contextId },
      });
      if (!result.ok) {
        const recovered = adapter.recover(result.state, result.rejection);
        setRouteStates((current) => ({ ...current, [contextId]: recovered }));
        setRouteNotice(`${result.rejection.message} ${result.rejection.recovery}`);
        return false;
      }
      next = result.state;
    }
    setRouteStates((current) => ({ ...current, [contextId]: next }));
    setRouteNotice(
      `Compiled ${contextId} evidence recorded for ${steps.map((step) => step.actionId).join(", ")}.`,
    );
    return true;
  };

  /** Every selected context is its own compiled root traversal, so a lab-owned node runs in each. */
  const dispatchLabNodeToSelectedContexts = (
    contextIds: string[],
    steps: Array<{ actionId: string; payload: RouteTechniqueExecutionIntent["payload"] }>,
  ): boolean =>
    contextIds.every((contextId) =>
      dispatchRouteSequenceFor(
        contextId,
        steps.map((step) => ({
          instanceId: LAB_ORCHESTRATION_INSTANCE_ID,
          actionId: step.actionId,
          payload: step.payload,
        })),
      ),
    );

  const resetInvestigation = (): void => {
    // Each context's own adapter clears its recorded evidence; teacher configuration and the
    // assigned question live outside route state and stay loaded.
    setRouteStates((current) =>
      Object.fromEntries(
        Object.entries(current).map(([contextId, state]) => [
          contextId,
          routeAdapters.get(contextId)?.reset(state) ?? createInitialAcidBaseRouteState(),
        ]),
      ),
    );
    setApprovedPlan(undefined);
    setRuns({});
    setBenchProgress(0);
    setPlanFeedback([]);
    setAnalysisInputs({});
    setAnalysisChecked({});
    setParticulateExplanation("");
    setUncertaintyReflection("");
    setClassData([]);
    setNoClassDataAvailable(false);
    setWastePh("");
    setDisposalConfirmed(false);
    setSection("brief");
    setRouteNotice("Compiled route state reset; teacher configuration and question remain loaded.");
  };

  const recordAnalysisProjection = (contextIds: string[]): boolean =>
    dispatchLabNodeToSelectedContexts(contextIds, [
      { actionId: "ACID-ANALYSIS-01", payload: { note: particulateExplanation.trim() } },
      { actionId: "ACID-UNCERTAINTY-01", payload: { note: uncertaintyReflection.trim() } },
    ]);

  const safetyComplete = Boolean(
    config &&
      ppeAcknowledged.length === config.safety.requiredPpe.length &&
      hazardsAcknowledged,
  );
  const practiceComplete = practiceStep >= 5;
  const configuredForPlan = useMemo(() => {
    if (!config || !approvedPlan) return config;
    return {
      ...config,
      settings: {
        ...config.settings,
        aliquotMl: approvedPlan.aliquotMl,
        coarseIncrementMl: approvedPlan.coarseIncrementMl,
        fineIncrementMl: approvedPlan.fineIncrementMl,
      },
    };
  }, [approvedPlan, config]);

  const runKeys = useMemo(() => {
    if (!approvedPlan) return [];
    return approvedPlan.selectedCombinationIds.flatMap((combinationId) =>
      Array.from({ length: approvedPlan.replicates }, (_, index) => ({
        key: `${combinationId}:replicate-${index + 1}`,
        combinationId,
        replicate: index + 1,
      })),
    );
  }, [approvedPlan]);

  const curves = useMemo(() => {
    if (!configuredForPlan || !approvedPlan) return new Map<string, CurveResult>();
    return new Map(
      runKeys.map((run) => [
        run.key,
        generateTitrationCurve(configuredForPlan, run.combinationId),
      ]),
    );
  }, [approvedPlan, configuredForPlan, runKeys]);

  // Analysis is derived from the rows that the route has actually recorded. The
  // generated curve remains the simulator's source for the next observation, but
  // the analysis projection never reads an unrecorded tail or a hidden answer
  // independently of the formal evidence gate.
  const recordedCurves = useMemo(() => {
    const result = new Map<string, CurveResult>();
    for (const run of runKeys) {
      const curve = curves.get(run.key);
      const recordedCount = runs[run.key]?.recordedCount ?? 0;
      if (!curve || recordedCount < curve.points.length) continue;
      result.set(run.key, {
        ...curve,
        points: curve.points.slice(0, recordedCount),
      });
    }
    return result;
  }, [curves, runKeys, runs]);

  const selectedContextIds = useMemo(
    () => (approvedPlan?.selectedCombinationIds ?? []).filter(isAcidBaseRouteContext),
    [approvedPlan],
  );
  const planApproved =
    selectedContextIds.length > 0 &&
    selectedContextIds.every((contextId) => isPlanApproved(routeStateFor(contextId)));

  // Every selected context must have traversed its own compiled trial, including the technique's
  // per-trial disposal chain, before the compiled interpretation node becomes reachable.
  const formalComplete =
    planApproved &&
    runKeys.length > 0 &&
    selectedContextIds.every((contextId) => {
      const completed = routeStateFor(contextId).completedActionIds;
      return [
        "formal-trial-initial-row",
        "formal-trial-deliver-titrant-decide",
        "formal-trial-record-final-burette",
        ...disposalActionIds,
      ].every((actionId) => completed.includes(actionId));
    }) &&
    runKeys.every((run) => {
      const curve = curves.get(run.key);
      return Boolean(
        curve?.stabilityReached &&
          runs[run.key]?.recordedCount >= curve.points.length,
      );
    });

  const calculationsComplete =
    formalComplete &&
    runKeys.every((run) => {
      if (!analysisChecked[run.key]) return false;
      const curve = recordedCurves.get(run.key);
      if (!curve || !configuredForPlan) return false;
      return expectedFields(analysisTargets(configuredForPlan, curve)).every((field) =>
        isAnalysisValueWithinTolerance(
          Number(analysisInputs[run.key]?.[field.id]),
          field.expected,
          field.id === "equilibriumConstant" ? 0.08 : 0.03,
          field.id === "equilibriumConstant" ? 1e-7 : 0.02,
        ),
      );
    });
  const analysisComplete =
    calculationsComplete &&
    Boolean(particulateExplanation.trim()) &&
    Boolean(uncertaintyReflection.trim());

  if (loadError) {
    return (
      <main className="inv14-load-state" role="alert">
        <h1>Acid-Base Titration Curves configuration unavailable</h1>
        <p>{loadError}</p>
      </main>
    );
  }
  if (!config) {
    return (
      <main className="inv14-load-state" aria-live="polite">
        <h1>Loading Acid-Base Titration Curves</h1>
      </main>
    );
  }

  const sectionUnlocked = (id: SectionId): boolean => {
    if (id === "brief") return true;
    if (id === "practice") return safetyComplete;
    if (id === "plan") return practiceComplete;
    if (id === "run") return Boolean(approvedPlan);
    if (id === "analyze") return formalComplete;
    return analysisComplete;
  };

  const submitPlan = () => {
    const feedback: string[] = [];
    if (!question.trim()) feedback.push("State the approved research question.");
    if (!hypothesis.trim()) feedback.push("Commit to a testable prediction before collecting curves.");
    if (selectedCombinationIds.length === 0) {
      feedback.push("Select at least one acid-base comparison.");
    }
    for (const id of config.requiredCombinationIds) {
      if (!selectedCombinationIds.includes(id)) {
        feedback.push(`Teacher configuration requires ${combinationById(config, id).label}.`);
      }
    }
    if (
      !Number.isFinite(aliquotMl) ||
      aliquotMl < config.settings.allowedAliquotMl.min ||
      aliquotMl > config.settings.allowedAliquotMl.max
    ) {
      feedback.push(
        `Aliquot must be ${config.settings.allowedAliquotMl.min}-${config.settings.allowedAliquotMl.max} mL.`,
      );
    }
    for (const [label, value] of [
      ["Coarse increment", coarseIncrementMl],
      ["Fine increment", fineIncrementMl],
    ] as const) {
      if (
        !Number.isFinite(value) ||
        value < config.settings.allowedIncrementMl.min ||
        value > config.settings.allowedIncrementMl.max
      ) {
        feedback.push(
          `${label} must be ${config.settings.allowedIncrementMl.min}-${config.settings.allowedIncrementMl.max} mL.`,
        );
      }
    }
    if (fineIncrementMl >= coarseIncrementMl) {
      feedback.push("The near-equivalence increment must be smaller than the coarse increment.");
    }
    if (
      !Number.isFinite(replicates) ||
      !Number.isInteger(replicates) ||
      replicates < config.minimumReplicates
    ) {
      feedback.push(`At least ${config.minimumReplicates} replicate(s) are required.`);
    }
    if (!teacherInitials.trim()) feedback.push("Instructor initials are required before execution.");
    const proposedConfig: TitrationInvestigationConfig = {
      ...config,
      settings: {
        ...config.settings,
        aliquotMl,
        coarseIncrementMl,
        fineIncrementMl,
      },
    };
    if (feedback.length === 0) {
      for (const combinationId of selectedCombinationIds) {
        const label = combinationById(config, combinationId).label;
        const definition = isAcidBaseRouteContext(combinationId)
          ? witnesses?.get(combinationId)
          : undefined;
        if (!definition) {
          feedback.push(
            `${label} has no compiled reachability witness. The compiled composition must declare this configured context before it can be executed.`,
          );
          continue;
        }
        // The compiled trial's own delivery contract bounds each student-selected increment, so a
        // teacher configuration whose schedule cannot be delivered is rejected before acquisition.
        const deliver = definition.actions.find((action) => action.id === "formal-trial-deliver-titrant");
        const minimumIncrementMl = typeof deliver?.parameters.minimumIncrementMl === "number"
          ? deliver.parameters.minimumIncrementMl
          : Number.NaN;
        const maximumIncrementMl = typeof deliver?.parameters.maximumIncrementMl === "number"
          ? deliver.parameters.maximumIncrementMl
          : Number.NaN;
        try {
          const proposedCurve = generateTitrationCurve(proposedConfig, combinationId);
          if (!proposedCurve.stabilityReached) {
            feedback.push(
              `${label} does not reach the configured post-equivalence stability criterion before the maximum volume. Revise the approved increments/aliquot or teacher settings.`,
            );
          }
          const illegal = proposedCurve.points
            .slice(1)
            .map((point, index) => Number((point.volumeMl - proposedCurve.points[index].volumeMl).toFixed(6)))
            .find((increment) =>
              !Number.isFinite(minimumIncrementMl) ||
              !Number.isFinite(maximumIncrementMl) ||
              increment < minimumIncrementMl ||
              increment > maximumIncrementMl ||
              Math.abs(increment * 100 - Math.round(increment * 100)) > 1e-6);
          if (illegal !== undefined) {
            feedback.push(
              `${label} requires a ${illegal} mL addition, which the compiled trial cannot deliver (${minimumIncrementMl}-${maximumIncrementMl} mL at 0.01 mL resolution). Revise the approved increments or aliquot.`,
            );
          }
        } catch (error) {
          feedback.push(
            error instanceof Error ? error.message : `Unable to generate ${label}.`,
          );
        }
      }
    }
    setPlanFeedback(feedback);
    if (feedback.length) return;
    const plan: ApprovedPlan = {
      question: question.trim(),
      hypothesis: hypothesis.trim(),
      selectedCombinationIds,
      aliquotMl,
      coarseIncrementMl,
      fineIncrementMl,
      replicates,
      teacherInitials: teacherInitials.trim(),
      approvedAt: new Date().toISOString(),
    };
    const planNote = `${plan.question} | ${plan.hypothesis} | ${plan.selectedCombinationIds.join(", ")} | aliquot ${plan.aliquotMl} mL | increments ${plan.coarseIncrementMl}/${plan.fineIncrementMl} mL | ${plan.replicates} replicate(s) | approved by ${plan.teacherInitials}`;
    if (
      !dispatchLabNodeToSelectedContexts(
        plan.selectedCombinationIds.filter(isAcidBaseRouteContext),
        [{ actionId: "ACID-PLAN-01", payload: { note: planNote } }],
      )
    ) {
      return;
    }
    setApprovedPlan(plan);
    setRuns(
      Object.fromEntries(
        plan.selectedCombinationIds.flatMap((combinationId) =>
          Array.from({ length: plan.replicates }, (_, index) => [
            `${combinationId}:replicate-${index + 1}`,
            { prepared: false, recordedCount: 0, initialBuretReadingMl: "" },
          ]),
        ),
      ),
    );
    setRouteNotice("Approved plan recorded in every configured context; the compiled formal trials are unlocked.");
    setSection("run");
  };

  const addClassDatum = () => {
    const equivalence = Number(classEquivalence);
    const parsedCurve = parseClassCurve(classCurveText);
    if (
      !classGroup.trim() ||
      !classCombination ||
      !Number.isInteger(classReplicate) ||
      classReplicate < 1 ||
      !Number.isFinite(equivalence) ||
      equivalence <= 0
    ) {
      setClassCurveError("Source group, combination, positive integer replicate, and positive equivalence volume are required.");
      return;
    }
    if (parsedCurve.error) {
      setClassCurveError(parsedCurve.error);
      return;
    }
    if (
      equivalence <= parsedCurve.points[0].volumeMl ||
      equivalence >= parsedCurve.points.at(-1)!.volumeMl
    ) {
      setClassCurveError("The pasted curve must include measured points both before and after its equivalence volume.");
      return;
    }
    setClassData((current) => [
      ...current,
      {
        id: `class-${Date.now()}`,
        sourceGroup: classGroup.trim(),
        combinationId: classCombination,
        replicate: classReplicate,
        equivalenceVolumeMl: equivalence,
        points: parsedCurve.points,
        note: classNote.trim(),
        addedAt: new Date().toISOString(),
      },
    ]);
    setNoClassDataAvailable(false);
    setClassGroup("");
    setClassEquivalence("");
    setClassCurveText("");
    setClassCurveError("");
    setClassNote("");
  };

  const acid = sampleById(config, config.practice.acidSampleId);
  const base = sampleById(config, config.practice.baseSampleId);
  const mixedPh = practiceMixturePh(acid, base, config.practice.portionMl, 1);
  const wasteValue = Number(wastePh);
  const wasteInRange =
    Number.isFinite(wasteValue) &&
    wasteValue >= config.safety.neutralizationPhRange.min &&
    wasteValue <= config.safety.neutralizationPhRange.max;
  const cleanupComplete =
    selectedContextIds.length > 0 &&
    selectedContextIds.every((contextId) =>
      routeStateFor(contextId).completedActionIds.includes("ACID-CLEANUP-01"));
  const lastRejection = selectedContextIds
    .map((contextId) => routeStateFor(contextId).lastRejection)
    .find(Boolean);

  return (
    <main className="inv14-shell">
      <header className="inv14-hero">
        <div>
          <span className="inv14-kicker">Chemistry · Acid-Base Titration Curves</span>
          <h1>Structure, concentration, and pH during acid-base titration</h1>
          <p>
            Build defensible pH-volume curves for a known/unknown, strong/weak sample set.
            The curve—not an indicator color—determines the analytical landmarks.
          </p>
        </div>
        <div className="inv14-hero-status" aria-label="Investigation status">
          <span>{approvedPlan ? `Approved by ${approvedPlan.teacherInitials}` : "Inquiry not yet approved"}</span>
          <strong>{formalComplete ? "Curves complete" : `${runKeys.filter((run) => runs[run.key]?.recordedCount).length}/${runKeys.length || "—"} trials started`}</strong>
          <button data-route-action="reset-investigation" onClick={resetInvestigation} type="button">Reset investigation</button>
        </div>
      </header>
      <p className="inv14-route-notice" role="status">{routeNotice}</p>
      {lastRejection && (
        <p className="inv14-feedback" role="alert">
          <strong>{lastRejection.code}:</strong> {lastRejection.message} {lastRejection.recovery}
        </p>
      )}

      <nav className="inv14-section-nav" aria-label="Investigation sections">
        {sectionLabels.map((item, index) => {
          const unlocked = sectionUnlocked(item.id);
          return (
            <button
              aria-current={section === item.id ? "step" : undefined}
              className={section === item.id ? "is-active" : ""}
              disabled={!unlocked}
              key={item.id}
              onClick={() => setSection(item.id)}
              type="button"
            >
              <span>{index + 1}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {section === "brief" && (
        <section className="inv14-section">
          <div className="inv14-section-heading">
            <div>
              <span className="inv14-kicker">Mission brief</span>
              <h2>Four samples, three comparisons, one evidence chain</h2>
            </div>
            <p>{config.assignedQuestion}</p>
          </div>
          <div className="inv14-sample-grid">
            {config.samples.map((sample) => (
              <article className={`inv14-sample-card is-${sample.role}`} key={sample.id}>
                <span>{sample.concentrationStatus}</span>
                <h3>{sample.label}</h3>
                <strong>{sample.formula}</strong>
                <p>{sample.strength} {sample.role}</p>
                <small>
                  {sample.concentrationStatus === "known"
                    ? `${sample.molarityM.toFixed(4)} M`
                    : "Concentration withheld from students"}
                </small>
              </article>
            ))}
          </div>
          <div className="inv14-two-column">
            <article className="inv14-panel">
              <h3>Safety gate</h3>
              <p>Review sample-specific SDS information supplied by the instructor before handling.</p>
              <div className="inv14-check-stack">
                {config.safety.requiredPpe.map((item, index) => (
                  <label key={item}>
                    <input
                      checked={ppeAcknowledged.includes(item)}
                      data-route-action={`ppe-${index + 1}`}
                      onChange={(event) =>
                        setPpeAcknowledged((current) =>
                          event.target.checked
                            ? [...current, item]
                            : current.filter((value) => value !== item),
                        )
                      }
                      type="checkbox"
                    />
                    <span><strong>{item}</strong> is on and correctly fitted.</span>
                  </label>
                ))}
                <label>
                  <input
                    checked={hazardsAcknowledged}
                    data-route-action="hazard-acknowledgement"
                    onChange={(event) => setHazardsAcknowledged(event.target.checked)}
                    type="checkbox"
                  />
                  <span>I reviewed the corrosive hazard, spill response, dilution rule, and instructor disposal procedure.</span>
                </label>
              </div>
              <button disabled={!safetyComplete} onClick={() => setSection("practice")} type="button">
                Enter qualitative practice
              </button>
            </article>
            <article className="inv14-panel is-safety">
              <h3>Non-negotiable handling</h3>
              <ul>
                {config.safety.hazardSummary.map((item) => <li key={item}>{item}</li>)}
                <li><strong>{config.safety.dilutionRule}</strong></li>
                <li>{config.safety.spillResponse}</li>
                <li>{config.safety.disposalProcedure}</li>
              </ul>
            </article>
          </div>
        </section>
      )}

      {section === "practice" && (
        <section className="inv14-section">
          <div className="inv14-section-heading">
            <div>
              <span className="inv14-kicker">Qualitative practice</span>
              <h2>Separate classification from measurement</h2>
            </div>
            <p>Use fresh portions for the indicator trial. This slow pour is practice; the formal investigation uses a conditioned buret.</p>
          </div>
          <div className="inv14-practice-layout">
            <div className="inv14-apparatus-stage" aria-label="Qualitative acid-base practice apparatus">
              <img alt="pH paper strips" src={publicAsset("ph-paper.png")} />
              <img alt="graduated cylinder" src={publicAsset("graduated-cylinder-100ml.png")} />
              <img alt="Erlenmeyer flask" src={publicAsset("erlenmeyer-flask-250ml.png")} />
              <img alt="indicator dropper bottle" src={publicAsset("dropper-bottle.png")} />
            </div>
            <ol className="inv14-practice-steps">
              <li className={practiceStep >= 1 ? "is-complete" : ""}>
                <strong>Litmus classification</strong>
                <p>Test {acid.label} and {base.label}; observe and record before interpreting.</p>
                {practiceStep >= 1 && <small>Acid: blue litmus → red. Base: red litmus → blue. Qualitative class only.</small>}
                <button data-route-action="practice-litmus" disabled={practiceStep !== 0} onClick={() => setPracticeStep(1)} type="button">Test and record litmus</button>
              </li>
              <li className={practiceStep >= 2 ? "is-complete" : ""}>
                <strong>Hydrion/pH paper</strong>
                <p>Compare the color against the scale and record the estimated pH.</p>
                {practiceStep >= 2 && <small>{acid.label}: pH ≈ {practicePh(acid, 1)}. {base.label}: pH ≈ {practicePh(base, 1)}.</small>}
                <button data-route-action="practice-paper-ph" disabled={practiceStep !== 1} onClick={() => setPracticeStep(2)} type="button">Read and record paper pH</button>
              </li>
              <li className={practiceStep >= 3 ? "is-complete" : ""}>
                <strong>Equal-volume reaction</strong>
                <p>Measure {config.practice.portionMl.toFixed(1)} mL acid and {config.practice.portionMl.toFixed(1)} mL base separately, then combine.</p>
                {practiceStep >= 3 && <small>Clear mixture; neutralization releases heat. Modeled mixed pH ≈ {mixedPh}.</small>}
                <button data-route-action="practice-measure-mix" disabled={practiceStep !== 2} onClick={() => setPracticeStep(3)} type="button">Measure, combine, observe</button>
              </li>
              <li className={practiceStep >= 4 ? "is-complete" : ""}>
                <strong>Indicator color change</strong>
                <p>With fresh portions, add one drop {config.practice.indicator} to acid and slowly pour base until the first persistent pale pink.</p>
                {practiceStep >= 4 && <small>Color change is qualitative endpoint-like evidence; this step does not infer or supply a numeric pH.</small>}
                <button data-route-action="practice-indicator-endpoint" disabled={practiceStep !== 3} onClick={() => setPracticeStep(4)} type="button">Pour to color change; read pH</button>
              </li>
              <li className={practiceStep >= 5 ? "is-complete" : ""}>
                <strong>Excess-base comparison</strong>
                <p>Add the remaining base and record both the darker color and final pH.</p>
                {practiceStep >= 5 && <small>Excess base produces deeper pink and pH {practicePh(base, 1)}.</small>}
                <button data-route-action="practice-excess-base" disabled={practiceStep !== 4} onClick={() => setPracticeStep(5)} type="button">Add excess; read and record</button>
              </li>
            </ol>
          </div>
          <button className="inv14-next" disabled={!practiceComplete} onClick={() => setSection("plan")} type="button">
            Write inquiry procedure
          </button>
        </section>
      )}

      {section === "plan" && (
        <section className="inv14-section">
          <div className="inv14-section-heading">
            <div>
              <span className="inv14-kicker">Inquiry design</span>
              <h2>Approval precedes execution</h2>
            </div>
            <p>The teacher configuration defines safe bounds and mandatory comparisons; you still commit to a question, prediction, and measurement plan.</p>
          </div>
          <div className="inv14-plan-grid">
            <div className="inv14-panel inv14-form-stack">
              <label>
                <span>Research question</span>
                <textarea data-route-action="plan-question" onChange={(event) => setQuestion(event.target.value)} rows={3} value={question} />
              </label>
              <label>
                <span>Prediction with structural reasoning</span>
                <textarea
                  data-route-action="plan-hypothesis"
                  onChange={(event) => setHypothesis(event.target.value)}
                  placeholder="Predict how strong/weak structure will affect initial pH, buffer region, equivalence pH, and steepness."
                  rows={4}
                  value={hypothesis}
                />
              </label>
              <fieldset>
                <legend>Approved sample combinations</legend>
                {config.combinations.map((combination) => (
                  <label className="inv14-combination-choice" key={combination.id}>
                    <input
                      checked={selectedCombinationIds.includes(combination.id)}
                      data-route-action="plan-combinations"
                      onChange={(event) =>
                        setSelectedCombinationIds((current) =>
                          event.target.checked
                            ? [...current, combination.id]
                            : current.filter((id) => id !== combination.id),
                        )
                      }
                      type="checkbox"
                    />
                    <span>
                      <strong>{combination.label}</strong>
                      <small>Analyte: {sampleDescription(config, combination.analyteId)}<br />Titrant: {sampleDescription(config, combination.titrantId)}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            </div>
            <div className="inv14-panel inv14-form-stack">
              <div className="inv14-number-grid">
                <label><span>Analyte aliquot (mL)</span><input min={config.settings.allowedAliquotMl.min} max={config.settings.allowedAliquotMl.max} data-route-action="plan-aliquot" onChange={(event) => setAliquotMl(Number(event.target.value))} step="0.1" type="number" value={aliquotMl} /></label>
                <label><span>Coarse increment (mL)</span><input min={config.settings.allowedIncrementMl.min} max={config.settings.allowedIncrementMl.max} data-route-action="plan-coarse-increment" onChange={(event) => setCoarseIncrementMl(Number(event.target.value))} step="0.1" type="number" value={coarseIncrementMl} /></label>
                <label><span>Near-equivalence increment (mL)</span><input min={config.settings.allowedIncrementMl.min} max={config.settings.allowedIncrementMl.max} data-route-action="plan-fine-increment" onChange={(event) => setFineIncrementMl(Number(event.target.value))} step="0.05" type="number" value={fineIncrementMl} /></label>
                <label><span>Replicates per combination</span><input min={config.minimumReplicates} data-route-action="plan-replicates" onChange={(event) => setReplicates(Number(event.target.value))} step="1" type="number" value={replicates} /></label>
              </div>
              <div className="inv14-constraint-note">
                <strong>Configured run rule</strong>
                <p>Use smaller increments within ±{config.settings.fineWindowMl} mL of the steep region. Continue at least {config.settings.minimumPostEquivalenceMl} mL past equivalence until ΔpH ≤ {config.settings.stabilityDeltaPh.toFixed(2)} for {config.settings.stabilityConsecutiveReadings} consecutive readings.</p>
                <p>{config.settings.indicatorInFormalTrials ? "Indicator is authorized in formal trials." : "Indicator is practice-only; formal landmarks come from the pH curve."}</p>
              </div>
              <label>
                <span>Instructor initials</span>
                <input data-route-action="plan-teacher-initials" onChange={(event) => setTeacherInitials(event.target.value)} placeholder="Required approval" value={teacherInitials} />
              </label>
              {planFeedback.length > 0 && (
                <ul className="inv14-feedback" role="alert">
                  {planFeedback.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
              <button data-route-action="ACID-PLAN-01" onClick={submitPlan} type="button">Validate and approve procedure</button>
              {approvedPlan && <small>Approval captured {new Date(approvedPlan.approvedAt).toLocaleString()} by {approvedPlan.teacherInitials}.</small>}
            </div>
          </div>
        </section>
      )}

      {section === "run" && approvedPlan && configuredForPlan && (
        <section className="inv14-section">
          <div className="inv14-section-heading">
            <div>
              <span className="inv14-kicker">Formal titration</span>
              <h2>Condition, measure, stabilize, record</h2>
            </div>
            <p>Reading and recording remain separate. No trial may stop at the first color change or at the steep region.</p>
          </div>
          <div className="inv14-run-setup">
            <figure className="inv14-titration-rig" aria-label="Buret and pH probe titration assembly">
              <img
                alt="One complete titration rig: a vertical buret over a stirred Erlenmeyer flask with a supported pH probe immersed clear of the stir bar"
                className="is-composite"
                src={publicAsset("titration-curves-rig.png")}
              />
              <figcaption>
                Static assembly reference. Use each trial card’s stabilized live-pH readout; the pictured meter display is not trial data.
              </figcaption>
            </figure>
            <div className="inv14-panel">
              <h3>Assembly checkpoint</h3>
              <ol className="inv14-assembly-list">
                {benchSteps.map((step, index) => (
                  <li className={benchProgress > index ? "is-complete" : ""} key={step}>
                    <span>{index + 1}</span><p>{step}</p>
                    <button
                      data-route-action={benchControlIds[index]}
                      disabled={benchProgress !== index}
                      onClick={() => {
                        const sequence = benchActionSequences[index].map((actionId) => ({
                          instanceId: FORMAL_INSTANCE_ID,
                          actionId,
                        }));
                        // The bench is shared, but each configured context is its own compiled
                        // traversal and its buret is conditioned with that context's titrant.
                        if (
                          selectedContextIds.every((contextId) =>
                            dispatchRouteSequenceFor(contextId, sequence))
                        ) {
                          setBenchProgress(index + 1);
                        }
                      }}
                      type="button"
                    >
                      Confirm
                    </button>
                  </li>
                ))}
              </ol>
              <div className="inv14-probe-rules">
                <strong>Teacher-configured probe rules</strong>
                <ul>{config.settings.probeRules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
              </div>
            </div>
          </div>

          <div className="inv14-run-list">
            {runKeys.map((run) => {
              const combination = combinationById(configuredForPlan, run.combinationId);
              const curve = curves.get(run.key)!;
              const state = runs[run.key] ?? {
                prepared: false,
                recordedCount: 0,
                initialBuretReadingMl: "",
              };
              const recorded = curve.points.slice(0, state.recordedCount);
              const nextPoint = curve.points[state.recordedCount];
              const lastPoint = recorded.at(-1);
              // The compiled trial delivers one student-selected increment, not a cumulative
              // volume, so the control sends the difference from the last recorded row.
              const incrementMl = nextPoint
                ? Number((nextPoint.volumeMl - (lastPoint?.volumeMl ?? 0)).toFixed(2))
                : 0;
              const initialBuretReading = Number(state.initialBuretReadingMl);
              const finalRequiredReading =
                initialBuretReading + (curve.points.at(-1)?.volumeMl ?? 0);
              const validInitialBuretReading =
                state.initialBuretReadingMl !== "" &&
                Number.isFinite(initialBuretReading) &&
                initialBuretReading >= 0 &&
                finalRequiredReading <= config.settings.buretCapacityMl;
              return (
                <article className="inv14-run-card" key={run.key}>
                  <header>
                    <div>
                      <span>Replicate {run.replicate}</span>
                      <h3>{combination.label}</h3>
                      <p>{sampleById(configuredForPlan, combination.analyteId).label} ({approvedPlan.aliquotMl.toFixed(2)} mL) · titrant {sampleById(configuredForPlan, combination.titrantId).label}</p>
                    </div>
                    <strong>{state.recordedCount}/{curve.points.length} pH-volume pairs</strong>
                  </header>
                  {!state.prepared ? (
                    <div className="inv14-preflight">
                      <div>
                        <p><strong>Fresh-run preflight:</strong> set and read the conditioned buret meniscus to {config.settings.buretPrecisionMl.toFixed(2)} mL. Then transfer a fresh analyte aliquot, position the flask and probe, wait for the configured stability criterion, and record the initial pH.</p>
                        <label className="inv14-meniscus-input">
                          <span>Initial buret reading (mL)</span>
                          <input
                            data-route-action="formal-trial-initial-buret-reading"
                            max={config.settings.buretCapacityMl}
                            min="0"
                            onChange={(event) =>
                              setRuns((current) => ({
                                ...current,
                                [run.key]: {
                                  ...state,
                                  initialBuretReadingMl: event.target.value,
                                },
                              }))
                            }
                            step={config.settings.buretPrecisionMl}
                            type="number"
                            value={state.initialBuretReadingMl}
                          />
                          {state.initialBuretReadingMl && !validInitialBuretReading && (
                            <small>
                              This starting reading leaves insufficient capacity for the approved full curve. Refill and reread before starting.
                            </small>
                          )}
                        </label>
                      </div>
                      <button
                        data-route-action="formal-trial-preflight"
                        disabled={benchProgress < benchSteps.length || !validInitialBuretReading}
                          onClick={() => {
                            const preflightPayloads: Record<string, RouteTechniqueExecutionIntent["payload"]> = {
                              "formal-trial-fill-burette-check-tip": { note: "No visible air bubbles" },
                              "formal-trial-read-initial-burette": { value: initialBuretReading },
                              "formal-trial-record-initial-burette": { value: initialBuretReading },
                              "formal-trial-measure-analyte": { value: approvedPlan.aliquotMl },
                              "formal-trial-transfer-analyte-to-receiver": { value: approvedPlan.aliquotMl },
                              "formal-trial-initial-ph": { value: curve.points[0]?.ph ?? 0 },
                              "formal-trial-initial-row": { note: "Initial pH-volume pair recorded from the stabilized probe." },
                            };
                            if (!dispatchRouteSequenceFor(run.combinationId, preflightActionIds.map((actionId) => ({
                              instanceId: FORMAL_INSTANCE_ID,
                              actionId,
                              payload: preflightPayloads[actionId] ?? {},
                            })))) return;
                          setRuns((current) => ({
                            ...current,
                            // The ordered preflight already records the initial
                            // zero-volume row; the next control must deliver a
                            // positive increment through the formal graph.
                            [run.key]: { ...state, prepared: true, recordedCount: Math.min(1, curve.points.length) },
                          }));
                        }}
                        type="button"
                      >
                        Record initial buret reading and prepare trial
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="inv14-live-readout" aria-live="polite">
                        <div><span>Cumulative titrant</span><strong>{lastPoint ? lastPoint.volumeMl.toFixed(2) : "—"} mL</strong></div>
                        <div><span>Buret reading</span><strong>{lastPoint ? (initialBuretReading + lastPoint.volumeMl).toFixed(2) : initialBuretReading.toFixed(2)} mL</strong></div>
                        <div><span>Stable pH</span><strong>{lastPoint ? lastPoint.ph.toFixed(config.settings.phPrecision) : "—"}</strong></div>
                        <div><span>Region</span><strong>{lastPoint?.region.replace("-", " ") ?? "initial reading pending"}</strong></div>
                      </div>
                      <CurveChart curve={curve} label={combination.label} recordedCount={state.recordedCount} />
                      {nextPoint ? (
                        <div className="inv14-record-control">
                          <p>
                            Deliver {incrementMl.toFixed(2)} mL to reach {nextPoint.volumeMl.toFixed(2)} mL cumulative volume,
                            mix gently, wait for stability, read pH, record the pair, then take the authored curve decision.
                          </p>
                          <button
                            data-route-action="formal-trial-record-curve-point"
                            onClick={() => {
                              const recordedPoints = [...recorded, nextPoint];
                              const finalPoint = state.recordedCount + 1 >= curve.points.length;
                              // The compiled loop closes on the endpoint decision after every
                              // recorded row; only the accepted curve continues to the final
                              // burette reading and the per-trial disposal chain.
                              const recordedOk = dispatchRouteSequenceFor(run.combinationId, [
                                { instanceId: FORMAL_INSTANCE_ID, actionId: "formal-trial-deliver-titrant", payload: { value: incrementMl } },
                                { instanceId: FORMAL_INSTANCE_ID, actionId: "formal-trial-deliver-titrant-mix", payload: { value: incrementMl } },
                                { instanceId: FORMAL_INSTANCE_ID, actionId: "formal-trial-deliver-titrant-observe", payload: { note: "Mixed gently and waited for the configured stability criterion." } },
                                { instanceId: FORMAL_INSTANCE_ID, actionId: "formal-trial-deliver-titrant-read-ph", payload: { value: nextPoint.ph } },
                                { instanceId: FORMAL_INSTANCE_ID, actionId: "formal-trial-deliver-titrant-record-point", payload: { value: nextPoint.ph } },
                                {
                                  instanceId: FORMAL_INSTANCE_ID,
                                  actionId: "formal-trial-deliver-titrant-decide",
                                  payload: finalPoint
                                    ? {
                                        note: FINISH_AFTER_STABILITY_REVIEW,
                                        recordedPointCount: recordedPoints.length,
                                        postSteepVolumeMl: postSteepVolumeMl(recordedPoints),
                                      }
                                    : { note: CONTINUE_DELIVERY },
                                },
                                ...(finalPoint
                                  ? [
                                      { instanceId: FORMAL_INSTANCE_ID, actionId: "formal-trial-deliver-titrant-read-final", payload: { value: finalRequiredReading } },
                                      { instanceId: FORMAL_INSTANCE_ID, actionId: "formal-trial-record-final-burette", payload: { value: finalRequiredReading } },
                                      ...disposalActionIds.map((actionId) => ({
                                        instanceId: FORMAL_INSTANCE_ID,
                                        actionId,
                                        payload: { note: "Emptied, rinsed, and routed to the configured acid-base waste receiver." },
                                      })),
                                    ]
                                  : []),
                              ]);
                              if (recordedOk) {
                                setRuns((current) => ({
                                  ...current,
                                  [run.key]: { ...state, recordedCount: state.recordedCount + 1 },
                                }));
                              }
                            }}
                            type="button"
                          >
                            Record stable pH-volume pair
                          </button>
                          <button
                            className="inv14-secondary"
                            data-route-action="formal-trial-retry-trial"
                            onClick={() => {
                              if (!dispatchRouteSequenceFor(run.combinationId, [
                                {
                                  instanceId: FORMAL_INSTANCE_ID,
                                  actionId: "formal-trial-deliver-titrant-decide",
                                  payload: { note: DISPOSE_AND_RESTART_TRIAL },
                                },
                                ...retryActionIds.map((actionId) => ({
                                  instanceId: FORMAL_INSTANCE_ID,
                                  actionId,
                                  payload: { note: `Rejected attempt for ${combination.label}; its recorded rows stay documented.` },
                                })),
                              ])) return;
                              setRouteStates((current) => ({
                                ...current,
                                [run.combinationId]: clearRetriedAttempt(
                                  current[run.combinationId] ?? createInitialAcidBaseRouteState(),
                                ),
                              }));
                              setRuns((current) => ({
                                ...current,
                                [run.key]: { prepared: false, recordedCount: 0, initialBuretReadingMl: "" },
                              }));
                            }}
                            type="button"
                          >
                            Dispose and restart this trial
                          </button>
                        </div>
                      ) : curve.stabilityReached ? (
                        <p className="inv14-success">
                          Full curve accepted: steep region passed and the configured post-equivalence stability criterion was met.
                        </p>
                      ) : (
                        <p className="inv14-feedback" role="alert">
                          This curve reached its configured maximum volume without satisfying the post-equivalence stability criterion. Do not accept it; dispose and restart the trial, or ask the instructor to revise the approved range or settings.
                        </p>
                      )}
                      {recorded.length > 0 && (
                        <details>
                          <summary>Recorded raw table ({recorded.length} rows)</summary>
                          <div className="inv14-table-scroll">
                            <table>
                              <thead><tr><th scope="col">Buret reading (mL)</th><th scope="col">Cumulative titrant (mL)</th><th scope="col">pH</th><th scope="col">Region flag</th></tr></thead>
                              <tbody>{recorded.map((point) => <tr key={point.volumeMl}><td>{(initialBuretReading + point.volumeMl).toFixed(2)}</td><td>{point.volumeMl.toFixed(2)}</td><td>{point.ph.toFixed(config.settings.phPrecision)}</td><td>{point.region}</td></tr>)}</tbody>
                            </table>
                          </div>
                        </details>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
          <button className="inv14-next" disabled={!formalComplete} onClick={() => setSection("analyze")} type="button">
            Analyze curve landmarks
          </button>
        </section>
      )}

      {section === "analyze" && configuredForPlan && (
        <section className="inv14-section">
          <div className="inv14-section-heading">
            <div>
              <span className="inv14-kicker">Curve analysis</span>
              <h2>Turn pH-volume evidence into chemical quantities</h2>
            </div>
            <p>Use equivalence stoichiometry for the configured unknown. For weak analytes, use initial ionization and the half-equivalence relationship to evaluate Ka or Kb.</p>
          </div>
          <div className="inv14-analysis-list">
            {runKeys.map((run) => {
              const curve = curves.get(run.key)!;
              const combination = combinationById(configuredForPlan, run.combinationId);
              const recordedCurve = recordedCurves.get(run.key) ?? curve;
              const targets = analysisTargets(configuredForPlan, recordedCurve);
              const fields = expectedFields(targets);
              const checked = analysisChecked[run.key];
              const values = analysisInputs[run.key] ?? {};
              const allCorrect =
                checked &&
                fields.every((field) =>
                  isAnalysisValueWithinTolerance(
                    Number(values[field.id]),
                    field.expected,
                    field.id === "equilibriumConstant" ? 0.08 : 0.03,
                    field.id === "equilibriumConstant" ? 1e-7 : 0.02,
                  ),
                );
              return (
                <article className="inv14-analysis-card" key={run.key}>
                  <header>
                    <div><span>Replicate {run.replicate}</span><h3>{combination.label}</h3></div>
                    <strong>{allCorrect ? "Analysis accepted" : "Analysis pending"}</strong>
                  </header>
                  <div className="inv14-analysis-body">
                    <CurveChart curve={curve} label={combination.label} />
                    <div className="inv14-analysis-form">
                      {fields.map((field) => {
                        const submitted = Number(values[field.id]);
                        const correct =
                          checked &&
                          isAnalysisValueWithinTolerance(
                            submitted,
                            field.expected,
                            field.id === "equilibriumConstant" ? 0.08 : 0.03,
                            field.id === "equilibriumConstant" ? 1e-7 : 0.02,
                          );
                        return (
                          <label className={checked ? (correct ? "is-correct" : "is-incorrect") : ""} key={field.id}>
                            <span>{field.label}</span>
                            <input
                              data-route-action="curve-analysis-calculation-input"
                              onChange={(event) => {
                                setAnalysisChecked((current) => ({ ...current, [run.key]: false }));
                                setAnalysisInputs((current) => ({
                                  ...current,
                                  [run.key]: { ...current[run.key], [field.id]: event.target.value },
                                }));
                              }}
                              step="any"
                              type="number"
                              value={values[field.id] ?? ""}
                            />
                            {checked && !correct && <small>Recheck the plotted landmark, units, stoichiometric ratio, and significant figures.</small>}
                          </label>
                        );
                      })}
                      <div className="inv14-equation-note">
                        <p><strong>Molarity:</strong> MₐVₐ / coefficientₐ = MₜVₜ / coefficientₜ</p>
                        {targets.constantLabel && (
                          <>
                            <p><strong>Percent ionization:</strong> [ionized]₀ / [weak analyte]₀ × 100</p>
                            <p><strong>{targets.constantLabel}:</strong> x² / (C − x); half-equivalence pH gives {targets.constantLabel === "Ka" ? "pKa" : "pOH = pKb"}.</p>
                            <p>Compare the submitted {targets.constantLabel} with the teacher-assigned value only after recording the full curve and its uncertainty; no expected answer is revealed here.</p>
                          </>
                        )}
                      </div>
                      <button
                        data-route-action="analysis-check-calculation"
                        onClick={() => {
                          // Route-local checking of the student's arithmetic against the recorded
                          // rows. The compiled evidence for this section is the lab-owned
                          // interpretation node, recorded once the reflections are written.
                          setAnalysisChecked((current) => ({ ...current, [run.key]: true }));
                          setRouteNotice(
                            `Landmark calculations checked against the recorded ${combination.label} rows.`,
                          );
                        }}
                        type="button"
                      >
                        Check landmark calculations
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="inv14-two-column">
            <label className="inv14-panel inv14-form-stack">
              <span><strong>Particulate explanation</strong></span>
              <textarea
                data-route-action="analysis-explanation" onChange={(event) => setParticulateExplanation(event.target.value)}
                placeholder="Compare dominant particles at the start, half-equivalence (if present), equivalence, and beyond equivalence. Connect structure to proton transfer and the observed pH."
                rows={6}
                value={particulateExplanation}
              />
            </label>
            <label className="inv14-panel inv14-form-stack">
              <span><strong>Uncertainty and error reflection</strong></span>
              <textarea
                data-route-action="analysis-uncertainty" onChange={(event) => setUncertaintyReflection(event.target.value)}
                placeholder="Explain how conditioning, tip bubbles, meniscus reading, increment size, probe calibration/rinsing, mixing, or stability rules could shift the curve or calculated constant."
                rows={6}
                value={uncertaintyReflection}
              />
            </label>
          </div>
          <button
            className="inv14-next"
            data-route-action="record-analysis-interpretation"
            disabled={!analysisComplete}
            onClick={() => {
              if (recordAnalysisProjection(selectedContextIds)) setSection("class-data");
            }}
            type="button"
          >
            Compare independent class curves
          </button>
        </section>
      )}

      {section === "class-data" && configuredForPlan && (
        <section className="inv14-section">
          <div className="inv14-section-heading">
            <div>
              <span className="inv14-kicker">Class evidence & cleanup</span>
              <h2>Compare without overwriting provenance</h2>
            </div>
            <p>Imported class values are separate comparison records. Your group’s raw pH-volume tables remain unchanged.</p>
          </div>
          <div className="inv14-two-column">
            <article className="inv14-panel inv14-form-stack">
              <h3>Add an independent class result</h3>
              <label><span>Source group or team ID</span><input data-route-action="class-source-group" onChange={(event) => setClassGroup(event.target.value)} value={classGroup} /></label>
              <label><span>Sample combination</span><select data-route-action="class-combination" onChange={(event) => setClassCombination(event.target.value)} value={classCombination}>{config.combinations.map((combination) => <option key={combination.id} value={combination.id}>{combination.label}</option>)}</select></label>
              <div className="inv14-number-grid">
                <label><span>Replicate</span><input min="1" data-route-action="class-replicate" onChange={(event) => setClassReplicate(Number(event.target.value))} type="number" value={classReplicate} /></label>
                <label><span>Equivalence volume (mL)</span><input min="0" data-route-action="class-equivalence" onChange={(event) => setClassEquivalence(event.target.value)} step="0.01" type="number" value={classEquivalence} /></label>
              </div>
              <label>
                <span>Independent pH-volume curve (volume mL, pH; one row per reading)</span>
                <textarea
                  data-route-action="class-curve"
                  onChange={(event) => {
                    setClassCurveText(event.target.value);
                    setClassCurveError("");
                  }}
                  placeholder={"0.00, 2.91\n2.00, 3.12\n...\n30.00, 11.80"}
                  rows={6}
                  value={classCurveText}
                />
              </label>
              <label><span>Comparison note</span><textarea data-route-action="class-note" onChange={(event) => setClassNote(event.target.value)} rows={3} value={classNote} /></label>
              {classCurveError && <p className="inv14-feedback" role="alert">{classCurveError}</p>}
              <button data-route-action="add-class-record" onClick={addClassDatum} type="button">Add class record with provenance</button>
            </article>
            <article className="inv14-panel">
              <h3>Provenance ledger</h3>
              <div className="inv14-table-scroll">
                <table>
                  <thead><tr><th scope="col">Source</th><th scope="col">Combination</th><th scope="col">Replicate</th><th scope="col">Curve evidence</th><th scope="col">Veq (mL)</th><th scope="col">Note</th></tr></thead>
                  <tbody>
                    {classData.length === 0 && <tr><td colSpan={6}>No class records added. Your group data remain the only evidence.</td></tr>}
                    {classData.map((datum) => (
                      <tr key={datum.id}>
                        <td>{datum.sourceGroup}<small>{new Date(datum.addedAt).toLocaleString()}</small></td>
                        <td>{combinationById(config, datum.combinationId).label}</td>
                        <td>{datum.replicate}</td>
                        <td>
                          <details>
                            <summary>{datum.points.length} raw pairs, 0.00-{datum.points.at(-1)!.volumeMl.toFixed(2)} mL</summary>
                            <table>
                              <thead><tr><th scope="col">mL</th><th scope="col">pH</th></tr></thead>
                              <tbody>{datum.points.map((point) => <tr key={point.volumeMl}><td>{point.volumeMl.toFixed(2)}</td><td>{point.ph.toFixed(2)}</td></tr>)}</tbody>
                            </table>
                          </details>
                        </td>
                        <td>{datum.equivalenceVolumeMl.toFixed(2)}</td>
                        <td>{datum.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label className="inv14-inline-check">
                <input
                  checked={noClassDataAvailable}
                  disabled={classData.length > 0}
                  data-route-action="no-class-data" onChange={(event) => setNoClassDataAvailable(event.target.checked)}
                  type="checkbox"
                />
                <span>No independent class curve was available; record this provenance limitation instead of inventing or copying data.</span>
              </label>
            </article>
          </div>
          <article className="inv14-panel inv14-disposal">
            <div>
              <span className="inv14-kicker">Waste checkpoint</span>
              <h3>Neutralize, test, and follow the instructor procedure</h3>
              <p>{config.safety.disposalProcedure}</p>
            </div>
            <label><span>Measured waste pH</span><input max="14" min="0" data-route-action="waste-ph" onChange={(event) => setWastePh(event.target.value)} step="0.1" type="number" value={wastePh} /><small>Configured release range: pH {config.safety.neutralizationPhRange.min.toFixed(1)}-{config.safety.neutralizationPhRange.max.toFixed(1)}</small></label>
            <label className="inv14-inline-check"><input checked={disposalConfirmed} data-route-action="waste-disposal-confirmation" onChange={(event) => setDisposalConfirmed(event.target.checked)} type="checkbox" /><span>The instructor confirmed the posted disposal route for this neutralized waste.</span></label>
            <button
              data-route-action="ACID-CLEANUP-01"
              disabled={!wasteInRange || !disposalConfirmed || !(classData.length > 0 || noClassDataAvailable)}
              onClick={() => {
                dispatchLabNodeToSelectedContexts(selectedContextIds, [{
                  actionId: "ACID-CLEANUP-01",
                  payload: {
                    wasteWithinConfiguredRange: wasteInRange,
                    instructorRouteConfirmed: disposalConfirmed,
                    value: wasteValue,
                    note: `Measured waste pH ${wasteValue} is inside the configured release range and the instructor disposal route is confirmed.`,
                  },
                }]);
              }}
              type="button"
            >
              Record compiled cleanup evidence
            </button>
            {wastePh && !wasteInRange && <p className="inv14-feedback" role="alert">Waste is outside the configured neutralization range. Continue the instructor-directed neutralization process and retest; do not dispose.</p>}
            {wasteInRange && disposalConfirmed && cleanupComplete && (classData.length > 0 || noClassDataAvailable) && (
              <p className="inv14-success">
                Investigation complete. Class-data provenance, neutralization evidence, and instructor disposal confirmation are recorded.
              </p>
            )}
            {wasteInRange && disposalConfirmed && classData.length === 0 && !noClassDataAvailable && (
              <p className="inv14-feedback" role="alert">
                Add an independent class record or document that no class curve was available before closing the investigation.
              </p>
            )}
          </article>
        </section>
      )}
    </main>
  );
};
