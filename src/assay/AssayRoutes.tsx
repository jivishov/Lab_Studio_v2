import { useMemo, useState } from "react";
import type { AssayDefinition } from "../domain-packs/assay/types";
import { getAssayLayoutGoldenArtifact } from "../domain-packs/assay/__fixtures__/assay-layout.v1";
import { getComplete96WellSerialDilutionPlan } from "../domain-packs/assay/dilution/__fixtures__/complete96WellPlan";
import { create96WellPlateState } from "../domain-packs/assay/plate";
import {
  EIGHT_CHANNEL_P200,
  SINGLE_CHANNEL_P200,
  UNIVERSAL_200_UL_TIP,
} from "../domain-packs/assay/pipetting";
import { createAssayRuntimeState } from "../domain-packs/assay/runtime";
import {
  createAssayQcChartProjection,
  createAssayQcTableProjection,
} from "../domain-packs/assay/qc";
import {
  assayReleaseServices,
  type AssayReleaseTemplateId,
} from "../domain-packs/assay/services";
import { getCycle08QcGoldenFixture } from "../domain-packs/assay/qc/__fixtures__/cycle08QcFixture";
import { getCycle11ProtocolGoldenWorkflows } from "../domain-packs/assay/profiles/__fixtures__/cycle11ProtocolFixtures";
import { AssayLibrary } from "./AssayLibrary";
import { AssayStudioSkeleton } from "./AssayStudioSkeleton";
import { downloadAssay, parseImportedAssayJson } from "./importExport";
import { AssayProtocolAnalysisPanel, AssayQcDashboard } from "./results";
import "./assay.css";

const transientAssayArtifacts = new Map<string, AssayDefinition>();

const createRehearsalRuntime = (artifact: AssayDefinition) => createAssayRuntimeState({
  runId: `${artifact.id}:cycle07-rehearsal`,
  plate: create96WellPlateState(artifact.plate),
  pipetteDefinitions: [SINGLE_CHANNEL_P200, EIGHT_CHANNEL_P200],
  tipDefinitions: [UNIVERSAL_200_UL_TIP],
  liquidSources: [
    {
      id: "illustrative-stock",
      kind: "reagent",
      volume: { value: "800", unit: "uL" },
      components: [{
        resourceRef: "illustrative-compound",
        volume: { value: "800", unit: "uL" },
        concentration: { value: "10000", unit: "uM" },
        sourceRefs: ["illustrative-stock"],
      }],
      mixed: true,
      contaminationTags: [],
    },
    {
      id: "illustrative-diluent",
      kind: "reservoir",
      volume: { value: "10000", unit: "uL" },
      components: [{
        resourceRef: "illustrative-diluent",
        volume: { value: "10000", unit: "uL" },
        sourceRefs: ["illustrative-diluent"],
      }],
      mixed: true,
      contaminationTags: [],
    },
  ],
  tipReusePolicy: { mode: "single-aspiration" },
  selectedPipetteId: SINGLE_CHANNEL_P200.id,
});

const routeArtifact = (assayId?: string): AssayDefinition => {
  const imported = assayId ? transientAssayArtifacts.get(assayId) : undefined;
  if (imported) return structuredClone(imported);
  const artifact = getAssayLayoutGoldenArtifact();
  if (!assayId || assayId === artifact.id) return artifact;
  return {
    ...artifact,
    id: assayId,
    title: "Untitled 96-well assay",
    metadata: {
      ...artifact.metadata,
      author: "Local Assay Studio author",
      tags: ["assay", "layout-only", "local-draft"],
    },
  };
};

export const AssayLibraryRoute = () => {
  const fixture = useMemo(() => getAssayLayoutGoldenArtifact(), []);
  const [artifacts, setArtifacts] = useState<AssayDefinition[]>([fixture]);
  const [message, setMessage] = useState<string>();

  const importFile = async (file: File) => {
    try {
      const imported = parseImportedAssayJson(await file.text());
      transientAssayArtifacts.set(imported.id, structuredClone(imported));
      setArtifacts((current) => [
        imported,
        ...current.filter(({ id }) => id !== imported.id),
      ]);
      setMessage(`Imported and validated ${imported.title}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import assay JSON.");
    }
  };

  return (
    <>
      {message && <div className="assay-route-message" role="status">{message}</div>}
      <AssayLibrary
        assays={artifacts.map((artifact) => ({
          description: artifact.description,
          id: artifact.id,
          title: artifact.title,
          updatedAt: artifact.metadata.updatedAt.slice(0, 10),
          useBoundary: artifact.useBoundary,
          wellsConfigured: artifact.plate.wells.filter(({ role }) => role !== "unused").length,
        }))}
        onCreate={(templateId: AssayReleaseTemplateId) => {
          const createdAt = new Date().toISOString();
          const id = `assay-${templateId}-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
          const composition = assayReleaseServices.composeAssay({
            templateId,
            id,
            title: templateId === "blank-96"
              ? "Untitled 96-well assay"
              : templateId === "xtt-metabolic-activity"
                ? "Untitled XTT metabolic-activity assay"
                : "Untitled educational broth-microdilution assay",
            updatedAt: createdAt,
          });
          if (!composition.ok) {
            setMessage(composition.diagnostics.map(({ message }) => message).join(" "));
            return;
          }
          transientAssayArtifacts.set(composition.artifact.id, structuredClone(composition.artifact));
          window.location.hash = `#/assay/${composition.artifact.id}`;
        }}
        onImport={(file) => { void importFile(file); }}
        onOpen={(assayId) => { window.location.hash = `#/assay/${assayId}`; }}
      />
    </>
  );
};

export const AssayStudioRoute = ({ assayId }: { assayId?: string }) => {
  const initialArtifact = useMemo(() => routeArtifact(assayId), [assayId]);
  const initialRuntimeState = useMemo(() => createRehearsalRuntime(initialArtifact), [initialArtifact]);
  const dilutionPlan = useMemo(() => getComplete96WellSerialDilutionPlan(), []);
  const [artifact, setArtifact] = useState(initialArtifact);
  const [candidateAssay, setCandidateAssay] = useState<AssayDefinition>();
  const [message, setMessage] = useState<string>();
  const [importRevision, setImportRevision] = useState(0);

  const updateAssay = (nextAssay: AssayDefinition) => {
    setArtifact(nextAssay);
    setMessage(undefined);
  };

  const importFile = async (file: File) => {
    try {
      const imported = parseImportedAssayJson(await file.text());
      setCandidateAssay(imported);
      setMessage(`Validated ${imported.title}. Review semantic changes before applying.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import assay JSON.");
    }
  };

  const exportArtifact = (assay: AssayDefinition) => {
    try {
      downloadAssay(assay);
      setMessage(`Exported ${assay.id}.assay.json.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to export assay JSON.");
    }
  };

  return (
    <>
      {message && <div className="assay-route-message" role="status">{message}</div>}
      <AssayStudioSkeleton
        assayTitle={artifact.title}
        candidateAssay={candidateAssay}
        onCandidateApplied={() => {
          setCandidateAssay(undefined);
          setImportRevision((revision) => revision + 1);
          setMessage("Applied validated assay candidate.");
        }}
        initialAssay={artifact}
        initialRuntimeState={initialRuntimeState}
        dilutionPlan={dilutionPlan}
        key={`${artifact.id}:${importRevision}`}
        onBack={() => { window.location.hash = "#/assays"; }}
        onExport={exportArtifact}
        onImport={(file) => { void importFile(file); }}
        onAssayChange={updateAssay}
        onOpenResults={() => { window.location.hash = `#/assay-results/${artifact.id}`; }}
      />
    </>
  );
};

export const AssayResultsRoute = ({ assayId }: { assayId: string }) => {
  const fixture = useMemo(() => getCycle08QcGoldenFixture(), []);
  const protocolWorkflows = useMemo(() => getCycle11ProtocolGoldenWorkflows(), []);
  const [profileId, setProfileId] = useState<"xtt" | "mic">("xtt");
  const table = useMemo(
    () => createAssayQcTableProjection(fixture.observationSet, fixture.evaluation),
    [fixture],
  );
  const chart = useMemo(() => createAssayQcChartProjection(table), [table]);
  return (
    <main className="assay-results-route">
      <div className="assay-results-route__back">
        <a href={`#/assay/${assayId}`}>← Return to {assayId}</a>
        <p>
          This page demonstrates source-controlled synthetic QC and Cycle 11 profile workflows. It
          does not claim observations for the current assay.
        </p>
      </div>
      <AssayQcDashboard
        chart={chart}
        evaluation={fixture.evaluation}
        ruleSet={fixture.ruleSet}
        table={table}
      />
      <div className="assay-protocol-selector">
        <label htmlFor="assay-protocol-example">Checked protocol example</label>
        <select
          id="assay-protocol-example"
          onChange={(event) => setProfileId(event.currentTarget.value as "xtt" | "mic")}
          value={profileId}
        >
          <option value="xtt">XTT metabolic-activity proxy</option>
          <option value="mic">Educational broth-microdilution endpoint</option>
        </select>
        <p>Switching examples changes only the explicit source-controlled fixture shown below.</p>
      </div>
      <AssayProtocolAnalysisPanel
        analysis={protocolWorkflows[profileId].analysis}
        profile={protocolWorkflows[profileId].profile}
      />
    </main>
  );
};
