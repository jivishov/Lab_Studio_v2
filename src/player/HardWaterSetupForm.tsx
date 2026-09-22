import { useState, type FormEvent } from "react";
import type { HardWaterSetup } from "../data/labSetup";
import {
  SetupApproval,
  SetupError,
  SetupField,
  SetupSection,
  SetupSubmit,
  TeacherSetupPage,
} from "./TeacherSetupLayout";

const fields = [
  ["ovenTemperatureC", "Oven temperature", "110–120 °C", 110, 120],
  ["firstDurationMinutes", "First drying stage", "10–15 minutes", 10, 15],
  ["coolingTemperatureC", "Weighing endpoint", "Approved room temperature in °C", undefined, undefined],
] as const;

export const HardWaterSetupForm = ({
  onStart,
  error,
}: {
  onStart: (setup: HardWaterSetup) => void;
  error?: string;
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart(Object.fromEntries(fields.map(([key]) => [key, Number(values[key])])) as unknown as HardWaterSetup);
  };

  return (
    <TeacherSetupPage
      title="Hard-water classroom setup"
      description="Set the approved drying and cooling conditions before students begin the gravimetric analysis."
      context={<p><strong>Procedure note</strong><br />The second drying stage remains fixed at five minutes. Rinse volumes and constant-mass criteria are recorded during the activity.</p>}
    >
      <form className="teacher-setup-form" onSubmit={submit}>
        <SetupSection
          number={1}
          title="Drying conditions"
          description="Use the source-supported oven range and classroom weighing endpoint."
        >
          {fields.map(([key, label, hint, min, max]) => (
            <SetupField key={key} label={label} hint={hint}>
              <input
                inputMode="decimal"
                max={max}
                min={min}
                required
                step="any"
                type="number"
                value={values[key] ?? ""}
                onChange={(event) => setValues({ ...values, [key]: event.target.value })}
              />
            </SetupField>
          ))}
        </SetupSection>
        <SetupApproval>
          I approve the drying temperatures, timing, cooling endpoint and classroom handling plan for this run.
        </SetupApproval>
        <SetupError message={error} />
        <SetupSubmit label="Use approved setup and start" />
      </form>
    </TeacherSetupPage>
  );
};
