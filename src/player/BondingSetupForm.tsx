import { useState, type FormEvent } from "react";
import type { BondingSetup } from "../data/labSetup";
import {
  SetupApproval,
  SetupCallout,
  SetupError,
  SetupField,
  SetupSection,
  SetupSubmit,
  TeacherSetupPage,
} from "./TeacherSetupLayout";

const fields: Array<{
  key: keyof BondingSetup;
  label: string;
  hint: string;
  min?: number;
  max?: number;
  step?: number;
}> = [
  { key: "knownCount", label: "Assigned known samples", hint: "Choose 4–6 samples.", min: 4, max: 6, step: 1 },
  { key: "blindCount", label: "Assigned blind samples", hint: "Choose 4–6 samples.", min: 4, max: 6, step: 1 },
  { key: "conductivityThresholds", label: "Conducting decision threshold", hint: "Enter the approved threshold in µS/cm.", min: 0 },
  { key: "phThresholds", label: "pH classification boundary", hint: "Enter a value from 0 to 14.", min: 0, max: 14 },
  { key: "meltingApparatusLimits", label: "Melting apparatus upper limit", hint: "Enter the approved positive temperature in °C." },
];

export const BondingSetupForm = ({
  onStart,
  error,
}: {
  onStart: (setup: BondingSetup) => void;
  error?: string;
}) => {
  const [procedure, setProcedure] = useState("");
  const [values, setValues] = useState<Partial<Record<keyof BondingSetup, string>>>({});
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart({
      ...Object.fromEntries(fields.map(({ key }) => [key, Number(values[key])])),
      selectedProcedure: procedure,
    } as unknown as BondingSetup);
  };

  return (
    <TeacherSetupPage
      title="Bonding classroom setup"
      description="Choose the approved evidence panel, sample counts and instrument boundaries for the unknown-solids investigation."
      context={<p><strong>Evidence boundary</strong><br />Instrument readings remain externally acquired classroom evidence. The simulation does not predict material properties.</p>}
    >
      <form className="teacher-setup-form" onSubmit={submit}>
        <SetupSection
          number={1}
          title="Test panel"
          description="List at least four supported tests in the order students will perform them."
        >
          <SetupField
            label="Selected tests in execution order"
            hint="Use comma-separated test IDs. Magnetism must come before melting when both use the dry specimen."
            wide
          >
            <input
              placeholder="appearance,water,conductivity,ph"
              required
              value={procedure}
              onChange={(event) => setProcedure(event.target.value)}
            />
          </SetupField>
          <SetupCallout>
            <p><strong>Available tests:</strong> appearance, water, conductivity, ph, ethanol, hexanes, magnet, melting, hcl and naoh.</p>
            <p>Conductivity, pH and melting provide quantitative evidence; the remaining tests are qualitative.</p>
          </SetupCallout>
        </SetupSection>

        <SetupSection
          number={2}
          title="Samples and thresholds"
          description="Set the sample allocation and classroom instrument decision limits."
        >
          {fields.map(({ key, label, hint, min, max, step }) => (
            <SetupField key={key} label={label} hint={hint} wide={key === "meltingApparatusLimits"}>
              <input
                inputMode="decimal"
                max={max}
                min={min}
                required
                step={step ?? "any"}
                type="number"
                value={values[key] ?? ""}
                onChange={(event) => setValues({ ...values, [key]: event.target.value })}
              />
            </SetupField>
          ))}
        </SetupSection>

        <SetupApproval>
          I approve this panel and order, instrument calibration, microscale quantities, hood controls and waste routes for the assigned materials.
        </SetupApproval>
        <SetupError message={error} />
        <SetupSubmit label="Use approved setup and start" />
      </form>
    </TeacherSetupPage>
  );
};
