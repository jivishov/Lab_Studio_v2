import { labApproval, labRecord, setup } from "../common.mjs";
import { twins } from "../paperChromatographyPractice.mjs";

/**
 * Paper Chromatography in 3D (Pack 3a, decided 2026-10-10; `proposals/PACK3_ATOMIZATION.md`, "Paper Chromatography",
 * "The lab"): the two trials, water then 2-propanol, as two parts, each with its own chamber, strip, solvent bottle
 * and waste beaker; the pencil, ruler, cylinder, capillary and dye vial are shared. Seventeen lab steps run around
 * them: safety and Prelab Part I, the plan up to the teacher's approval, then the comparison, the CER and the
 * Postlab Assessment. The 2D lab of the same id is not read; its lab step ids are kept where the step is the same.
 *
 * The setup page holds the prepared strip: the front's distance and each band's centre, from the baseline. The lab
 * carries the two models (`chromatographyModels`), bound through each twin's model slot; `labs3d.ts` works each
 * expected Rf out again from the teacher's distances and sets the development's stop distance to the front. The
 * solvent's depth up the strip is worked out from its volume (`prepared3d.ts`), so `solventDepthMm` is not a field.
 */
const [water, propanol] = twins;

const fromTwin = (technique, id, newId, label) => {
  const entry = technique.initialState.equipment.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`${technique.id} has no item "${id}".`);
  return { ...structuredClone(entry), id: newId, label: label ?? entry.label };
};

const shared = {
  "graduated-cylinder-1": "graduated-cylinder-1",
  "pencil-1": "pencil-1",
  "capillary-1": "capillary-1",
  "dye-vial-1": "dye-vial-1",
  "ruler-1": "ruler-1",
};

/** The slots both trials take from the same fields; the depth is the 3D loader's (`prepared3d.ts`). */
const trialConfiguration = {
  solventVolumeMl: setup("solventVolumeMl"),
  solventDepthMm: 5,
  baselineHeightMm: setup("baselineHeightMm"),
  spotterLoadVolumeMl: setup("spotterLoadVolumeMl"),
  spotVolumeMl: setup("spotVolumeMl"),
  spotDryMinutes: setup("spotDryMinutes"),
  developMinutes: setup("developMinutes"),
  stripDryMinutes: setup("stripDryMinutes"),
};

const model = (technique, distances) => {
  const [source] = technique.chromatographyModels;
  return {
    ...structuredClone(source),
    solventFrontMm: setup("frontMm"),
    bands: source.bands.map((band) => ({ ...band, distanceMm: setup(distances[band.id]) })),
  };
};

const text = (inputLabel) => ({ input: { inputMode: "text", inputLabel } });

/**
 * The trial's readings keep their ids (`water-solvent-front`, `propanol-band-red`, …): the Rf template finds each band's
 * reading by the trial's measurement prefix, which the compiler does not scope. The two trials' ids differ by
 * solvent, so nothing collides; 2D's lab preserves its ids the same way.
 */
const readings = (technique) => ({
  references: Object.fromEntries(technique.composition.evidenceOutputs
    .filter((output) => output.kind === "measurement").map((output) => [output.referenceId, output.referenceId])),
});

export default {
  id: "paper-chromatography",
  title: "Paper Chromatography",
  description: "Predict how water and 2-propanol will move a food-dye mixture up paper, run both trials, measure each band's Rf, and explain the separation from intermolecular attractions.",
  audience: "AP Chemistry students",
  learningGoals: [
    "Predict a separation from the attractions among the dyes, the cellulose paper and the solvent",
    "Run a paper chromatogram with water and with 2-propanol",
    "Measure the front and each band's centre from the baseline, and calculate each Rf",
    "Explain the separation with claim, evidence and reasoning",
  ],
  safetyNotes: [
    "Wear splash-proof goggles.",
    "2-Propanol is flammable: no flames or hot plates near it, and keep its chamber closed.",
    "Wash any skin contact with plenty of water.",
    "Used water and food dye go to the sink stream; used 2-propanol goes to the organic waste, never down the sink.",
  ],
  bench: [
    fromTwin(water, "chamber-1", "water-chamber", "Chamber for water"),
    fromTwin(propanol, "chamber-1", "propanol-chamber", "Chamber for 2-propanol"),
    fromTwin(water, "paper-1", "water-strip", "Strip for water"),
    fromTwin(propanol, "paper-1", "propanol-strip", "Strip for 2-propanol"),
    fromTwin(water, "water-bottle-1", "water-bottle-1"),
    fromTwin(propanol, "propanol-bottle-1", "propanol-bottle-1"),
    fromTwin(water, "graduated-cylinder-1", "graduated-cylinder-1"),
    fromTwin(water, "pencil-1", "pencil-1"),
    fromTwin(water, "capillary-1", "capillary-1"),
    fromTwin(water, "dye-vial-1", "dye-vial-1"),
    fromTwin(water, "ruler-1", "ruler-1"),
    fromTwin(water, "sink-waste-1", "sink-waste-1"),
    fromTwin(propanol, "organic-waste-1", "organic-waste-1"),
  ],
  chromatographyModels: [
    model(water, { "purple-overlap": "waterPurpleOverlapMm", yellow: "waterYellowMm" }),
    model(propanol, { blue: "propanolBlueMm", red: "propanolRedMm", yellow: "propanolYellowMm" }),
  ],
  parts: [
    {
      instanceId: "trial-water",
      title: "Water trial",
      technique: water,
      items: { ...shared, "chamber-1": "water-chamber", "paper-1": "water-strip", "water-bottle-1": "water-bottle-1", "sink-waste-1": "sink-waste-1" },
      models: { "chromatography-water-food-dyes-paper": "water-food-dyes-paper" },
      preserveIds: readings(water),
      configuration: trialConfiguration,
    },
    {
      instanceId: "trial-propanol",
      title: "2-Propanol trial",
      technique: propanol,
      items: { ...shared, "chamber-1": "propanol-chamber", "paper-1": "propanol-strip", "propanol-bottle-1": "propanol-bottle-1",
        "organic-waste-1": "organic-waste-1" },
      models: { "chromatography-propanol-food-dyes-paper": "propanol-food-dyes-paper" },
      preserveIds: readings(propanol),
      configuration: trialConfiguration,
    },
  ],
  steps: [
    { id: "prelab", title: "Safety and prelab", steps: [
      labRecord("review-challenge-safety", "Review the safety notes",
        "Goggles on. 2-Propanol is flammable: no flames nearby, and keep its chamber closed. Wash skin contact with plenty of water. Water and food dye go to the sink stream; 2-propanol goes to the organic waste.",
        { tag: "safety-review" }),
      labRecord("prelab-capillary-demo", "Watch the capillary demonstration",
        "Your teacher touches a strip's edge to coloured water and you watch the liquid climb the paper. Note what you see: how far it climbs, and whether the colour keeps up with the water.",
        { tag: "prelab-demonstration" }),
      labRecord("prelab-questions", "Answer Prelab Part I",
        "Answer Prelab Part I, questions 1 to 3: what made the liquid climb, what the paper is made of and how it attracts water, and why a dye might lag behind the solvent.",
        text("Your answers to questions 1 to 3")),
    ] },
    { id: "plan", title: "Plan the trials", steps: [
      labRecord("review-molecular-structures", "Review the dye and solvent structures",
        "Look at the supplied structures of the dyes, water, 2-propanol and cellulose. Mark where each can hydrogen bond, where it is polar or charged, and where only dispersion forces act.",
        { tag: "structure-evidence" }),
      labRecord("record-imf-hypothesis", "Record your hypothesis",
        "Before any trial, predict how each solvent will move the dyes, and why: connect each prediction to the attractions among the dye, the cellulose paper and the solvent.",
        { tag: "imf-hypothesis", ...text("Your hypothesis") }),
      labRecord("select-solvents", "Give a reason for each solvent",
        "Your teacher has chosen water and 2-propanol for these two trials. For each, write a reason it could test your hypothesis, before you see a result.",
        { tag: "solvent-selection", ...text("A reason for each solvent") }),
      labRecord("configure-repeatable-procedure", "Write the procedure",
        "Write the steps another student could repeat: label the chamber, measure and pour the solvent, draw the pencil baseline, spot and dry three times, hang the strip with its foot in the solvent and the spot above it, close the lid, mark the front at once, and read to the nearest millimetre.",
        { tag: "procedure-design", ...text("Your procedure") }),
      labRecord("design-data-table", "Design the data table",
        "Make columns for the solvent, the front's distance in mm, each band's colour and centre distance in mm, its Rf, how well the bands separated, and where the solvent went.",
        { tag: "data-table-design", ...text("Your table's columns") }),
      labApproval("submit-procedure-approval", "Teacher's approval",
        "Your teacher checks your procedure and data table before you start the trials.", { tag: "procedure-approved" }),
    ] },
    { id: "analysis", title: "Compare and explain", after: "trial-propanol", steps: [
      labRecord("compare-separation", "Compare the two separations",
        "Compare only what you measured: the number of bands, overlap and spacing, streaking, and each Rf to two significant figures. An Rf holds only for this paper, solvent and procedure.",
        { tag: "separation-comparison" }),
      labRecord("evaluate-hypothesis", "Evaluate your hypothesis",
        "Does your evidence support, partly support or refute your hypothesis? Tell an unexpected result apart from a trial that went wrong.",
        { tag: "hypothesis-evaluation", ...text("Supports, partly supports or refutes, and why") }),
      labRecord("explain-phase-interactions", "Explain the phases' attractions",
        "Explain how each dye's attraction to the cellulose against its attraction to the solvent sets how far it moved. Name the band that moved least in each trial: it spent the most time held by the paper.",
        { tag: "phase-interactions" }),
      labRecord("draw-process-model", "Draw a model of the chromatogram",
        "Draw and label the pencil baseline, the solvent below it, the solvent rising through the paper, the front, the bands, and the two distances each Rf uses.",
        { tag: "chromatography-model" }),
      labRecord("evaluate-green-chemistry", "Weigh the solvents' greenness",
        "Using only the solvent-guide evidence your teacher supplies, compare water and 2-propanol for safety and environmental impact.",
        { tag: "green-chemistry-evidence" }),
    ] },
    { id: "conclusion", title: "Conclude", after: "trial-propanol", steps: [
      labRecord("write-cer-conclusion", "Write your claim, evidence and reasoning",
        "Claim which solvent separated this mixture better. Cite the band count, overlap and spacing, your distances and Rf values, and reason from the attractions among dye, cellulose and solvent. An Rf alone does not identify a dye.",
        { tag: "cer-claim", ...text("Your CER") }),
      labRecord("record-interpretation-limits", "Record the limits of your results",
        "Note what limits your results: where you drew the baseline and the front, judging a band's centre, the ruler's millimetre, the spot's size, the lid's seal, the strip touching the wall, evaporation, and repeating the trial.",
        { tag: "interpretation-limits" }),
      labRecord("complete-postlab-solubility", "Complete the Postlab Assessment",
        "Compare the solubility of pyridine and benzene in water from their structures and attractions, and relate it to chromatography, without taking solubility alone as proof of a band's identity.",
        { tag: "postlab-solubility", ...text("Your postlab answer") }),
    ] },
  ],
  setup: [
    { id: "solventVolumeMl", label: "Solvent in each chamber", unit: "mL", kind: "number", defaultValue: 4, min: 2, max: 6,
      help: "Measured in the graduated cylinder and poured in. Its depth up the strip is worked out from the chamber's shape and must stay below the baseline." },
    { id: "baselineHeightMm", label: "Baseline height", unit: "mm", kind: "number", defaultValue: 15, min: 10, max: 25,
      help: "How far above the strip's lower edge the pencil baseline is drawn." },
    { id: "spotterLoadVolumeMl", label: "Dye drawn into the capillary", unit: "mL", kind: "number", defaultValue: 0.03, min: 0.01, max: 0.06,
      help: "The 1 mm capillary holds about 0.06 mL." },
    { id: "spotVolumeMl", label: "Dye left by each touch", unit: "mL", kind: "number", defaultValue: 0.005, min: 0.001, max: 0.02,
      help: "Three touches, each dried before the next." },
    { id: "spotDryMinutes", label: "Time for a spot to dry", unit: "min", kind: "number", defaultValue: 1, min: 0.5, max: 5,
      help: "Run fast on the step clock." },
    { id: "developMinutes", label: "Development time", unit: "min", kind: "number", defaultValue: 10, min: 3, max: 30,
      help: "Run fast on the step clock while the solvent rises." },
    { id: "stripDryMinutes", label: "Time for the strip to dry", unit: "min", kind: "number", defaultValue: 5, min: 1, max: 15,
      help: "Run fast on the step clock." },
    { id: "frontMm", label: "Solvent front, from the baseline", unit: "mm", kind: "number", defaultValue: 80, min: 40, max: 85,
      help: "Where each strip's front stops. The student reads it with the ruler; it is the denominator of every Rf." },
    { id: "waterPurpleOverlapMm", label: "Water: purple overlap's centre", unit: "mm", kind: "number", defaultValue: 59, min: 1, max: 85,
      help: "From the baseline, on the water strip. The student reads it; its Rf is this over the front." },
    { id: "waterYellowMm", label: "Water: yellow band's centre", unit: "mm", kind: "number", defaultValue: 66, min: 1, max: 85,
      help: "From the baseline, on the water strip." },
    { id: "propanolBlueMm", label: "2-Propanol: blue band's centre", unit: "mm", kind: "number", defaultValue: 28, min: 1, max: 85,
      help: "From the baseline, on the 2-propanol strip." },
    { id: "propanolRedMm", label: "2-Propanol: red band's centre", unit: "mm", kind: "number", defaultValue: 49, min: 1, max: 85,
      help: "From the baseline, on the 2-propanol strip." },
    { id: "propanolYellowMm", label: "2-Propanol: yellow band's centre", unit: "mm", kind: "number", defaultValue: 68, min: 1, max: 85,
      help: "From the baseline, on the 2-propanol strip." },
  ],
  rules: [
    { fields: ["frontMm", "baselineHeightMm"], plus: 0, atMost: 100,
      message: "The front must stop at least 10 mm below the top of the 110 mm strip: lower the front or the baseline." },
    { fields: ["spotVolumeMl", "spotVolumeMl", "spotVolumeMl"], plus: 0, atMost: "spotterLoadVolumeMl",
      message: "The capillary must hold the three touches: draw up more dye or leave less with each touch." },
    ...["waterPurpleOverlapMm", "waterYellowMm", "propanolBlueMm", "propanolRedMm", "propanolYellowMm"].map((field) => ({
      fields: [field], plus: 1, atMost: "frontMm",
      message: "Each band's centre must lie below the solvent front, at least 1 mm under it.",
    })),
  ],
};
