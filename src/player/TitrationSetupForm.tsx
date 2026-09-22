import { useState } from "react";
import type { TitrationSetup } from "../data/labSetup";
import {
  SetupApproval,
  SetupCallout,
  SetupError,
  SetupField,
  SetupSection,
  SetupSubmit,
  TeacherSetupPage,
} from "./TeacherSetupLayout";

type NumericField = {
  key: string;
  label: string;
  hint: string;
  min?: number;
  max?: number;
};

const endpointFields: NumericField[] = [
  { key: "endpointWindowMl", label: "Endpoint acceptance window", hint: "At least 0.01 mL and no larger than the permitted addition.", min: 0.01 },
  { key: "persistenceSeconds", label: "Required color persistence", hint: "Positive duration in seconds.", min: 0 },
  { key: "maximumIncrementMl", label: "Largest titrant addition", hint: "0.05–5 mL; must contain the endpoint window.", min: 0.05, max: 5 },
];

const indicatorFields: NumericField[] = [
  { key: "indicatorVolumeMl", label: "Indicator addition", hint: "Approved simulation setting in mL, at most 1 mL.", min: 0, max: 1 },
  { key: "indicatorStartPh", label: "Phenolphthalein color-onset pH", hint: "Approved threshold above pH 7 and below the strong-color threshold.", min: 7, max: 14 },
  { key: "indicatorStrongPh", label: "Strong-color pH threshold", hint: "Approved threshold above the color-onset pH and no higher than 14.", min: 7, max: 14 },
];

const apparatusFields: NumericField[] = [
  { key: "conditioningVolumeMl", label: "Burette conditioning volume", hint: "Positive volume in mL, up to 5 mL.", min: 0, max: 5 },
  { key: "tipPurgeMl", label: "Tip-purge volume", hint: "Positive volume in mL, below 1 mL.", min: 0, max: 1 },
  { key: "rinseVolumeMl", label: "Receiver rinse volume", hint: "Positive volume in mL, up to 10 mL.", min: 0, max: 10 },
];

export function TitrationSetupForm({
  labId,
  onStart,
  error,
}: {
  labId: string;
  onStart: (setup: TitrationSetup) => void;
  error?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const beverage = labId === "beverage-acidity";
  const redox = labId === "hydrogen-peroxide-redox-titration";
  const modelFields: NumericField[] = redox
    ? [{
        key: "standardizationRangeM",
        label: "Maximum standardization range",
        hint: "Positive approved concordance range in mol/L.",
        min: 0,
      }]
    : beverage
      ? [
          { key: "sampleAMolarityM", label: "Sample A model concentration", hint: "Positive instructor-supplied proxy concentration in mol/L.", min: 0 },
          { key: "sampleBMolarityM", label: "Sample B model concentration", hint: "Positive instructor-supplied proxy concentration in mol/L.", min: 0 },
          { key: "beverageAliquotMl", label: "Fresh beverage aliquot", hint: "Positive volume in mL, at most 10 mL.", min: 0, max: 10 },
        ]
      : [];
  const fields = [
    ...endpointFields,
    ...(!redox ? indicatorFields : []),
    ...apparatusFields,
    ...modelFields,
    ...(beverage ? [{ key: "naohMolarityM", label: "Standardized NaOH", hint: "Choose one supported molarity in mol/L." }] : []),
  ];

  const setValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const numericField = (field: NumericField, wide = false) => (
    <SetupField key={field.key} label={field.label} hint={field.hint} wide={wide}>
      <input
        inputMode="decimal"
        max={field.max}
        min={field.min}
        required
        step="any"
        type="number"
        value={values[field.key] ?? ""}
        onChange={(event) => setValue(field.key, event.target.value)}
      />
    </SetupField>
  );

  const modelNote = beverage
    ? "This supported example uses a monoprotic acetic-acid proxy and phenolphthalein for two beverage samples, with two independent quantitative trials each. It does not predict arbitrary mixed or polyprotic beverages. Supply prepared samples and include any degassing or color-interference controls in the preparation protocol."
    : redox
      ? "The configured inquiry includes bounded practice, three independent iron standardizations and two trials for each assigned peroxide sample. Acid and aliquot amounts are requested during execution; standardization must finish before sample analysis."
      : "This reference exercise uses the disclosed weak-acetic-acid model, a 25 mL aliquot, 0.100 M NaOH and phenolphthalein. These are transparent reference choices, not a source-prescribed procedure.";
  const modelScope = beverage
    ? "Uses instructor-supplied proxy concentrations and does not predict arbitrary mixed or polyprotic beverages."
    : redox
      ? "Requires the standardization sequence to finish before assigned peroxide samples are analyzed."
      : "Uses a disclosed weak-acetic-acid reference model with explicit apparatus and indicator assumptions.";

  return (
    <TeacherSetupPage
      title="Teacher titration setup"
      description="Set the approved endpoint rule, apparatus preparation and classroom handling plan before the investigation begins."
      context={<p><strong>Model scope</strong><br />{modelScope}</p>}
    >
      <form
        className="teacher-setup-form"
        onSubmit={(event) => {
          event.preventDefault();
          onStart({
            titrationSetup: true,
            ...Object.fromEntries(fields.map(({ key }) => [key, Number(values[key])])),
            wasteProtocol: values.wasteProtocol ?? "",
            preparationProtocol: values.preparationProtocol ?? "",
          } as TitrationSetup);
        }}
      >
        <SetupSection
          number={1}
          title="Endpoint and indicator rules"
          description="Define the acceptance window and visual endpoint behavior for this model."
        >
          {endpointFields.map((field) => numericField(field))}
          {!redox ? indicatorFields.map((field) => numericField(field)) : null}
          <SetupCallout>{modelNote}</SetupCallout>
        </SetupSection>

        <SetupSection
          number={2}
          title="Apparatus preparation"
          description="Set the bounded conditioning, purge and receiver-rinse volumes."
        >
          {apparatusFields.map((field, index) => numericField(field, index === apparatusFields.length - 1))}
        </SetupSection>

        {modelFields.length || beverage ? (
          <SetupSection
            number={3}
            title={redox ? "Standardization rule" : "Beverage model"}
            description={redox ? "Set the instructor-approved concordance range." : "Supply the two prepared-sample proxy concentrations, aliquot and standardized titrant."}
          >
            {modelFields.map((field, index) => numericField(field, redox || index === modelFields.length - 1))}
            {beverage ? (
              <SetupField label="Standardized NaOH" hint="Choose one supported concentration in mol/L." wide>
                <select
                  required
                  value={values.naohMolarityM ?? ""}
                  onChange={(event) => setValue("naohMolarityM", event.target.value)}
                >
                  <option value="">Select an approved molarity</option>
                  <option value="0.1">0.10 mol/L</option>
                  <option value="0.25">0.25 mol/L</option>
                </select>
              </SetupField>
            ) : null}
          </SetupSection>
        ) : null}

        <SetupSection
          number={modelFields.length || beverage ? 4 : 3}
          title="Preparation and disposal"
          description="Record the approved classroom protocols that govern this run."
        >
          <SetupField label="Waste and rinsate route" hint="Name the instructor-approved collection or disposal route." wide>
            <textarea
              required
              rows={4}
              value={values.wasteProtocol ?? ""}
              onChange={(event) => setValue("wasteProtocol", event.target.value)}
            />
          </SetupField>
          <SetupField
            label="Sample preparation, probe readiness and indicator protocol"
            hint="Include the controls required for the selected model."
            wide
          >
            <textarea
              required
              rows={4}
              value={values.preparationProtocol ?? ""}
              onChange={(event) => setValue("preparationProtocol", event.target.value)}
            />
          </SetupField>
        </SetupSection>

        <SetupApproval>
          I approve the supported model, independent trial counts, apparatus, safety precautions, preparation and waste route.
        </SetupApproval>
        <SetupError message={error} />
        <SetupSubmit label="Start with approved settings" />
      </form>
    </TeacherSetupPage>
  );
}
