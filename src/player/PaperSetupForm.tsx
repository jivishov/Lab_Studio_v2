import { useState, type FormEvent } from "react";
import type { PaperSetup } from "../data/labSetup";
import {
  SetupApproval,
  SetupCallout,
  SetupError,
  SetupField,
  SetupSection,
  SetupSubmit,
  TeacherSetupPage,
} from "./TeacherSetupLayout";

const fields: Array<[keyof PaperSetup, string, string]> = [
  ["baselineHeightMm", "Pencil origin above lower edge", "Millimetres; must remain above the solvent layer."],
  ["solventDepthMm", "Solvent depth", "Millimetres."],
  ["solventVolumeMl", "Solvent per chamber", "Millilitres; must fit the authored chamber capacity."],
  ["spotterLoadVolumeMl", "Sample loaded per trial", "Millilitres; must fit the capillary spotter."],
  ["spotVolumeMl", "Sample applied per spot", "Millilitres; cannot exceed the loaded sample volume."],
  ["paperLengthMm", "Paper length", "Millimetres."],
  ["stopFrontMm", "Stop distance from origin", "Millimetres; the front must stop below the top of the paper."],
];

export const PaperSetupForm = ({
  onStart,
  error,
}: {
  onStart: (setup: PaperSetup) => void;
  error?: string;
}) => {
  const [solvents, setSolvents] = useState("");
  const [datasets, setDatasets] = useState("");
  const [parseError, setParseError] = useState("");
  const [values, setValues] = useState<Partial<Record<keyof PaperSetup, string>>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const rows = datasets.trim() ? datasets.trim().split("\n").map((line) => {
        const [solvent, label, color, distance] = line.split("|").map((part) => part.trim());
        if (!solvent || !label || !color || distance === undefined || distance === "") {
          throw new Error("Use solvent | observed region label | #RRGGBB | distance in mm for each row.");
        }
        return { solvent, label, color, distanceMm: Number(distance) };
      }) : [];
      const trials = solvents.split(",").map((solvent) => {
        const name = solvent.trim();
        const bands = rows
          .filter((row) => row.solvent === name)
          .map(({ label, color, distanceMm }) => ({ label, color, distanceMm }));
        return { solvent: name, ...(bands.length ? { bands } : {}) };
      });
      if (rows.some((row) => !trials.some((trial) => trial.solvent === row.solvent))) {
        throw new Error("Every dataset row must name a selected solvent.");
      }
      setParseError("");
      onStart({
        ...Object.fromEntries(fields.map(([key]) => [key, Number(values[key])])),
        trials,
      } as unknown as PaperSetup);
    } catch (failure) {
      setParseError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  return (
    <TeacherSetupPage
      title="Chromatography classroom setup"
      description="Define the approved solvent trials, classroom data and paper geometry before students begin."
      context={<p><strong>Model boundary</strong><br />The supplied water and 2-propanol examples use an 80 mm front. Other solvent or endpoint choices require instructor-supplied data.</p>}
    >
      <form className="teacher-setup-form" onSubmit={submit}>
        <SetupSection
          number={1}
          title="Trial plan and evidence"
          description="Choose at least two supported solvents and provide classroom observations when the supplied examples do not apply."
        >
          <SetupField
            label="Solvents in trial order"
            hint="Use each solvent once, separated by commas."
            wide
          >
            <input
              placeholder="water,propanol"
              required
              value={solvents}
              onChange={(event) => setSolvents(event.target.value)}
            />
          </SetupField>
          <SetupCallout>
            <p><strong>Available:</strong> water, propanol, ethanol, acetone and chromatography-solvent (petroleum ether/acetone).</p>
            <p>One to three observed regions are supported. Keep unresolved overlap as one region rather than assuming separate dyes.</p>
          </SetupCallout>
          <SetupField
            label="Instructor dataset rows"
            hint="One observed region per line: solvent | observed region label | #RRGGBB | measured distance in mm"
            optional
            wide
          >
            <textarea
              placeholder={"water | blue region | #2255CC | 34\nwater | yellow region | #E5B91F | 61"}
              rows={4}
              value={datasets}
              onChange={(event) => setDatasets(event.target.value)}
            />
          </SetupField>
          <SetupCallout>
            Leave this dataset blank only for the supplied water/2-propanol examples at an 80 mm front. Classroom data is shown as a supplied chromatogram and measured through the normal ruler and Rf workflow; the app does not invent predictive chemistry.
          </SetupCallout>
        </SetupSection>

        <SetupSection
          number={2}
          title="Paper and volume settings"
          description="Enter positive classroom quantities that remain within the authored apparatus capacities."
        >
          {fields.map(([key, label, hint]) => (
            <SetupField key={key} label={label} hint={hint} wide={key === "stopFrontMm"}>
              <input
                inputMode="decimal"
                min="0"
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
          I approve the selected solvents, dataset provenance, geometry, ventilation and solvent-specific waste routes.
        </SetupApproval>
        <SetupError message={parseError || error} />
        <SetupSubmit label="Use approved setup and start" />
      </form>
    </TeacherSetupPage>
  );
};
