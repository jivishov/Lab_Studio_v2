import { useState, type FormEvent } from "react";
import type { QuickAcheSetup } from "../data/labSetup";
import {
  SetupApproval,
  SetupCallout,
  SetupError,
  SetupField,
  SetupSection,
  SetupSubmit,
  TeacherSetupPage,
} from "./TeacherSetupLayout";

export const QuickAcheSetupForm = ({
  onStart,
  error,
}: {
  onStart: (setup: QuickAcheSetup) => void;
  error?: string;
}) => {
  const [count, setCount] = useState("");
  const [order, setOrder] = useState("");
  const [method, setMethod] = useState<"gravity" | "vacuum">("vacuum");
  const [criterion, setCriterion] = useState("");
  const [temperature, setTemperature] = useState("");
  const [ph, setPh] = useState("");
  const [organicDensity, setOrganicDensity] = useState("");
  const [aqueousDensity, setAqueousDensity] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart({
      extractionCount: Number(count),
      recoveryOrder: order,
      filtrationMethod: method,
      organicRecoveryMethod: "external-unheated-evaporation",
      aqueousRecoveryMethod: "external-unheated-evaporation",
      drynessCriterion: criterion,
      coolingLimitC: Number(temperature),
      acidEndpointPh: Number(ph),
      organicDensity: Number(organicDensity),
      aqueousDensity: Number(aqueousDensity),
    });
  };

  return (
    <TeacherSetupPage
      title="Quick Ache classroom recovery"
      description="Approve the extraction sequence, filtration method and recovery evidence before students begin the separation."
      context={<p><strong>Supported recovery</strong><br />This route records externally supervised, unheated solvent removal. A heating-based recovery requires a separately supported procedure.</p>}
    >
      <form className="teacher-setup-form" onSubmit={submit}>
        <SetupSection
          number={1}
          title="Separation plan"
          description="These choices determine the canonical subflows the learner will execute."
        >
          <SetupField label="Total approved extractions" hint="Choose 1–5. Five is a software bound, not a recommendation.">
            <input
              inputMode="numeric"
              max="5"
              min="1"
              required
              step="1"
              type="number"
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
          </SetupField>
          <SetupField label="Approved solid filtration" hint="Applied to the acidic and aqueous recovery steps.">
            <select value={method} onChange={(event) => setMethod(event.target.value as "gravity" | "vacuum")}>
              <option value="vacuum">Vacuum filtration</option>
              <option value="gravity">Gravity filtration</option>
            </select>
          </SetupField>
          <SetupField
            label="Recovery order"
            hint="Use all three fraction IDs once. Acidic filtration must occur before aqueous-filtrate recovery."
            wide
          >
            <input
              placeholder="organic,acidic,aqueous"
              required
              value={order}
              onChange={(event) => setOrder(event.target.value)}
            />
          </SetupField>
          <SetupCallout>
            Every extra wash collects fresh mixing, venting, layer and drain evidence. Unresolved emulsions retain the further-standing recovery path.
          </SetupCallout>
        </SetupSection>

        <SetupSection
          number={2}
          title="Recovery evidence"
          description="Define the externally observed endpoints and the supplied phase densities."
        >
          <SetupField label="Approved dryness criterion" hint="Describe the observation that confirms solvent removal is complete." wide>
            <textarea
              required
              rows={4}
              value={criterion}
              onChange={(event) => setCriterion(event.target.value)}
            />
          </SetupField>
          <SetupField label="Cooled weighing temperature" hint="Approved classroom endpoint in °C.">
            <input
              inputMode="decimal"
              required
              step="any"
              type="number"
              value={temperature}
              onChange={(event) => setTemperature(event.target.value)}
            />
          </SetupField>
          <SetupField label="Acidification endpoint" hint="Enter the maximum approved pH, from 0 to 14.">
            <input
              inputMode="decimal"
              max="14"
              min="0"
              required
              step="any"
              type="number"
              value={ph}
              onChange={(event) => setPh(event.target.value)}
            />
          </SetupField>
          <SetupField label="Organic-phase density" hint="Supplied density in g/mL; must be positive.">
            <input
              inputMode="decimal"
              min="0"
              required
              step="any"
              type="number"
              value={organicDensity}
              onChange={(event) => setOrganicDensity(event.target.value)}
            />
          </SetupField>
          <SetupField label="Aqueous-phase density" hint="Supplied density in g/mL; must exceed the organic-phase density.">
            <input
              inputMode="decimal"
              min="0"
              required
              step="any"
              type="number"
              value={aqueousDensity}
              onChange={(event) => setAqueousDensity(event.target.value)}
            />
          </SetupField>
        </SetupSection>

        <SetupApproval>
          I approve unheated solvent removal, ventilation and waste handling for both retained fractions.
        </SetupApproval>
        <SetupError message={error} />
        <SetupSubmit label="Use approved setup and start" />
      </form>
    </TeacherSetupPage>
  );
};
