import { Download, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import {
  createCycle09AssayPlanningRequest,
  createCycle09PlanningArtifact,
} from "../../domain-packs/assay/planning/__fixtures__/cycle09PlanningFixture";
import {
  planAssayRun,
  type AssayOperationLiquidPolicy,
  type AssayPlanningExports,
  type AssayRunPlanningRequest,
} from "../../domain-packs/assay/planning";

const downloadText = (
  fileName: string,
  content: string,
  type: string,
): void => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const overageValue = (policy: AssayOperationLiquidPolicy): string =>
  policy.overage?.kind === "percent" ? policy.overage.percent : "0";

const deadVolumeValue = (policy: AssayOperationLiquidPolicy): string =>
  policy.deadVolume?.value ?? "0";

const positiveInteger = (value: number, fallback: number): number =>
  Number.isSafeInteger(value) && value > 0 ? value : fallback;

const updateOperationLiquid = (
  request: AssayRunPlanningRequest,
  resourceId: string,
  update: (policy: AssayOperationLiquidPolicy) => AssayOperationLiquidPolicy,
): AssayRunPlanningRequest => ({
  ...request,
  profile: {
    ...request.profile,
    operationLiquids: request.profile.operationLiquids.map((policy) =>
      policy.resourceId === resourceId ? update(policy) : policy),
  },
});

export const AssayRunPlanner = () => {
  const [request, setRequest] = useState(createCycle09AssayPlanningRequest);
  const artifact = useMemo(createCycle09PlanningArtifact, []);
  const result = useMemo(
    () => planAssayRun(
      artifact,
      request,
      request.resourceContext.requestId,
    ),
    [artifact, request],
  );

  const updateParticipants = (participants: number) => {
    setRequest((current) => {
      const safeParticipants = positiveInteger(
        participants,
        current.resourceContext.participants,
      );
      return {
        ...current,
        resourceContext: {
          ...current.resourceContext,
          participants: safeParticipants,
          sections: [{ id: "section-a", participantCount: safeParticipants }],
        },
      };
    });
  };

  const updateCapacity = (resourceId: string, unitsAvailable: number) => {
    setRequest((current) => ({
      ...current,
      resourceContext: {
        ...current.resourceContext,
        instrumentCapacities: current.resourceContext.instrumentCapacities.map(
          (capacity) => capacity.resourceId === resourceId
            ? {
                ...capacity,
                unitsAvailable: positiveInteger(
                  unitsAvailable,
                  capacity.unitsAvailable,
                ),
              }
            : capacity,
        ),
      },
    }));
  };

  const downloads: Array<{
    key: keyof AssayPlanningExports;
    label: string;
    fileName: string;
    type: string;
  }> = [
    {
      key: "requirementsCsv",
      label: "Requirements CSV",
      fileName: "cycle09-assay-requirements.csv",
      type: "text/csv;charset=utf-8",
    },
    {
      key: "formulaTraceCsv",
      label: "Formula trace CSV",
      fileName: "cycle09-assay-formulas.csv",
      type: "text/csv;charset=utf-8",
    },
    {
      key: "scheduleCsv",
      label: "Schedule CSV",
      fileName: "cycle09-assay-schedule.csv",
      type: "text/csv;charset=utf-8",
    },
    {
      key: "checklistMarkdown",
      label: "Checklist",
      fileName: "cycle09-assay-checklist.md",
      type: "text/markdown;charset=utf-8",
    },
  ];

  return (
    <section className="assay-run-planner" aria-labelledby="assay-run-planner-title">
      <header>
        <div>
          <span className="assay-eyebrow">Cycle 09 · operational planning</span>
          <h2 id="assay-run-planner-title">Materials, capacity, and run schedule</h2>
          <p>
            This is the source-controlled Cycle 09 planning fixture, not an inferred plan for the
            open draft. Edit declared inputs below; absent metadata remains blocking.
          </p>
        </div>
        <strong className={`assay-plan-status is-${result.status}`}>
          {result.status === "complete" ? "Complete plan" : "Review required"}
        </strong>
      </header>

      <aside className="assay-plan-boundary" role="note">
        <TriangleAlert aria-hidden="true" size={17} />
        <p>
          Fixture values are synthetic operational inputs. This plan performs no purchase,
          reservation, substitution, safety approval, clinical interpretation, or hardware
          command.
        </p>
      </aside>

      <div className="assay-plan-layout">
        <form className="assay-plan-assumptions" onSubmit={(event) => event.preventDefault()}>
          <fieldset>
            <legend>Declared run context</legend>
            <label>
              Participants
              <input
                min={1}
                onChange={(event) => updateParticipants(event.currentTarget.valueAsNumber)}
                type="number"
                value={request.resourceContext.participants}
              />
            </label>
            <label>
              Group size
              <input
                min={1}
                onChange={(event) => setRequest((current) => ({
                  ...current,
                  resourceContext: {
                    ...current.resourceContext,
                    grouping: {
                      kind: "group-size",
                      groupSize: positiveInteger(
                        event.currentTarget.valueAsNumber,
                        current.resourceContext.grouping.kind === "group-size"
                          ? current.resourceContext.grouping.groupSize
                          : 1,
                      ),
                    },
                  },
                }))}
                type="number"
                value={request.resourceContext.grouping.kind === "group-size"
                  ? request.resourceContext.grouping.groupSize
                  : 1}
              />
            </label>
            <label>
              Repeats
              <input
                min={1}
                onChange={(event) => setRequest((current) => ({
                  ...current,
                  resourceContext: {
                    ...current.resourceContext,
                    repeats: positiveInteger(
                      event.currentTarget.valueAsNumber,
                      current.resourceContext.repeats,
                    ),
                  },
                }))}
                type="number"
                value={request.resourceContext.repeats}
              />
            </label>
            <label>
              Technical-replicate plate runs
              <input
                min={1}
                onChange={(event) => setRequest((current) => ({
                  ...current,
                  resourceContext: {
                    ...current.resourceContext,
                    technicalReplicates: positiveInteger(
                      event.currentTarget.valueAsNumber,
                      current.resourceContext.technicalReplicates,
                    ),
                  },
                }))}
                type="number"
                value={request.resourceContext.technicalReplicates}
              />
            </label>
            <label>
              Plate readers available
              <input
                min={1}
                onChange={(event) => updateCapacity(
                  "cycle09-plate-reader",
                  event.currentTarget.valueAsNumber,
                )}
                type="number"
                value={request.resourceContext.instrumentCapacities.find(
                  ({ resourceId }) => resourceId === "cycle09-plate-reader",
                )?.unitsAvailable ?? 1}
              />
            </label>
            <label>
              Incubators available
              <input
                min={1}
                onChange={(event) => updateCapacity(
                  "cycle09-incubator",
                  event.currentTarget.valueAsNumber,
                )}
                type="number"
                value={request.resourceContext.instrumentCapacities.find(
                  ({ resourceId }) => resourceId === "cycle09-incubator",
                )?.unitsAvailable ?? 1}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Declared liquid policies</legend>
            {request.profile.operationLiquids.map((policy) => (
              <div className="assay-plan-liquid-policy" key={policy.resourceId}>
                <strong>{policy.label}</strong>
                <label>
                  Overage (%)
                  <input
                    min={0}
                    onChange={(event) => setRequest((current) =>
                      updateOperationLiquid(current, policy.resourceId, (entry) => ({
                        ...entry,
                        overage: {
                          kind: "percent",
                          percent: event.currentTarget.value || "0",
                        },
                      })))}
                    step="0.1"
                    type="number"
                    value={overageValue(policy)}
                  />
                </label>
                <label>
                  Dead volume (uL/batch)
                  <input
                    min={0}
                    onChange={(event) => setRequest((current) =>
                      updateOperationLiquid(current, policy.resourceId, (entry) => ({
                        ...entry,
                        deadVolume: {
                          value: event.currentTarget.value || "0",
                          unit: "uL",
                        },
                      })))}
                    step="1"
                    type="number"
                    value={deadVolumeValue(policy)}
                  />
                </label>
              </div>
            ))}
          </fieldset>

          <label>
            User-declared planning note
            <textarea
              onChange={(event) => setRequest((current) => ({
                ...current,
                declaredAssumptions: event.currentTarget.value.trim()
                  ? [event.currentTarget.value]
                  : [],
              }))}
              rows={3}
              value={request.declaredAssumptions[0] ?? ""}
            />
          </label>
        </form>

        <div className="assay-plan-summary">
          <dl>
            <div>
              <dt>Plate runs</dt>
              <dd>{result.operationSummary.plateRuns}</dd>
            </div>
            <div>
              <dt>Operations / plate</dt>
              <dd>{result.operationSummary.operationCount}</dd>
            </div>
            <div>
              <dt>Requirements</dt>
              <dd>{result.plan.requirements.length}</dd>
            </div>
            <div>
              <dt>Bottlenecks</dt>
              <dd>{result.bottlenecks.length}</dd>
            </div>
          </dl>
          <div className="assay-plan-downloads" aria-label="Review-only planning exports">
            {downloads.map((download) => (
              <button
                key={download.key}
                onClick={() => downloadText(
                  download.fileName,
                  result.exports[download.key],
                  download.type,
                )}
                type="button"
              >
                <Download aria-hidden="true" size={14} />
                {download.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="assay-plan-table-scroll">
        <table>
          <caption>Exact requirements and inventory comparison</caption>
          <thead>
            <tr>
              <th scope="col">Resource</th>
              <th scope="col">Class</th>
              <th scope="col">Required</th>
              <th scope="col">Inventory status</th>
              <th scope="col">Formula</th>
            </tr>
          </thead>
          <tbody>
            {result.plan.requirements.map((line) => {
              const inventory = result.inventoryComparison.find(
                ({ resourceId }) => resourceId === line.resourceId,
              );
              return (
                <tr key={line.resourceId}>
                  <th scope="row">{line.label}</th>
                  <td>{line.resourceClass}</td>
                  <td>{line.required.value} {line.required.unit}</td>
                  <td>
                    {inventory?.status === "shortage"
                      ? `${inventory.available?.value} ${inventory.available?.unit} available; short ${inventory.shortage?.value} ${inventory.shortage?.unit}`
                      : inventory?.status === "available"
                        ? `${inventory.available?.value} ${inventory.available?.unit} available`
                        : inventory?.status === "incompatible-unit"
                          ? `${inventory.available?.value} ${inventory.available?.unit}; incompatible unit`
                          : "Inventory not declared"}
                  </td>
                  <td>
                    <details>
                      <summary>{line.formulaTrace.length} step formula</summary>
                      <ol>
                        {line.formulaTrace.map((step) => (
                          <li key={`${step.label}:${step.expression}`}>
                            <strong>{step.label}:</strong> {step.expression} ={" "}
                            {step.result.value} {step.result.unit}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="assay-plan-review-grid">
        <section>
          <h3>Master-mix batches</h3>
          <ol>
            {result.masterMixBatches.map((batch) => (
              <li key={`${batch.masterMixId}:${batch.batchNumber}`}>
                <strong>{batch.masterMixLabel}, batch {batch.batchNumber}</strong>
                <span>{batch.plateCount} plates</span>
                <small>
                  {batch.components.map((component) =>
                    `${component.label}: ${component.required.value} ${component.required.unit}`)
                    .join(" · ")}
                </small>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h3>Capacity bottlenecks</h3>
          {result.bottlenecks.length ? (
            <ul>
              {result.bottlenecks.map((bottleneck) => (
                <li key={bottleneck.resourceId}>{bottleneck.message}</li>
              ))}
            </ul>
          ) : <p>No multi-wave capacity bottleneck in the declared context.</p>}
        </section>
      </div>

      <div className="assay-plan-table-scroll">
        <table>
          <caption>Sequential operational phases</caption>
          <thead>
            <tr>
              <th scope="col">Phase</th>
              <th scope="col">Kind</th>
              <th scope="col">Starts after</th>
              <th scope="col">Duration</th>
              <th scope="col">Capacity waves</th>
            </tr>
          </thead>
          <tbody>
            {result.phaseSchedule.map((phase) => (
              <tr key={phase.phaseId}>
                <th scope="row">{phase.label}</th>
                <td>{phase.kind}</td>
                <td>{phase.startsAfter.value} {phase.startsAfter.unit}</td>
                <td>{phase.duration.value} {phase.duration.unit}</td>
                <td>{phase.waves ?? "Fixed phase"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.diagnostics.length > 0 && (
        <details className="assay-plan-diagnostics">
          <summary>{result.diagnostics.length} planning note(s) or issue(s)</summary>
          <ul>
            {result.diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.path}:${diagnostic.code}:${index}`}>
                <strong>{diagnostic.severity}: {diagnostic.code}</strong> {diagnostic.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};
