import {
  emptyContents,
  type EquipmentDefinition,
  type EquipmentInstance,
  type SnapZone,
} from "../domain/types";
import stockBottleVariants from "./stockBottleVariants.json";

const stockBottleCapacityMl: Record<string, number> = {
  ...Object.fromEntries(Object.keys(stockBottleVariants).map((id) => [id, 1000])),
  "distilled-water-bottle-2l": 2000,
};

const realisticAssetById: Record<string, string> = {
  "brass-color-depth-comparison": "brass-color-depth-comparison",
  "brass-fume-hood-digestion": "brass-fume-hood-digestion",
  "analytical-balance": "analytical-balance",
  "beaker-150ml": "beaker-150ml",
  "beaker-250ml": "beaker-250ml",
  "beral-pipette": "beral-pipette",
  "buchner-funnel": "buchner-funnel",
  "burette-50ml": "burette-50ml",
  "capillary-spotter": "capillary-spotter",
  "chromatography-chamber": "chromatography-chamber",
  "chromatography-paper": "chromatography-paper",
  "conductivity-tester": "conductivity-tester",
  "crucible-tongs": "crucible-tongs",
  "crucible-with-lid": "crucible-with-lid",
  "data-collection-interface": "data-collection-interface",
  "distilled-water-bottle": "distilled-water-bottle",
  "dropper-bottle": "dropper-bottle",
  "drying-oven": "drying-oven",
  "bunsen-burner": "bunsen-burner",
  "erlenmeyer-flask-250ml": "erlenmeyer-flask-250ml",
  "filter-paper": "filter-paper",
  "foam-cup-calorimeter": "foam-cup-calorimeter",
  "funnel": "funnel",
  "funnel-stand": "funnel-stand",
  "gas-syringe": "gas-syringe",
  "graduated-pipette-10ml": "graduated-pipette-10ml",
  "graduated-cylinder": "graduated-cylinder-100ml",
  "graduated-cylinder-25ml": "graduated-cylinder-25ml",
  "hot-plate-stirrer": "hot-plate-stirrer",
  "hand-warmer-calorimeter": "hand-warmer-calorimeter-cal-00",
  "magnet": "magnet",
  "magnetic-stir-bar": "magnetic-stir-bar",
  "marble-chips": "marble-chips",
  "metric-ruler": "metric-ruler",
  "melting-point-apparatus": "melting-point-apparatus",
  "naoh-bottle": "reagent-bottle",
  "permanent-marker": "permanent-marker",
  "phenolphthalein-dropper": "dropper-bottle",
  "ph-meter": "ph-meter",
  "ph-paper": "ph-paper",
  "pipette-pump": "pipette-pump",
  "propanol-bottle": "propanol-bottle",
  "polystyrene-cup-8oz": "polystyrene-cup-8oz",
  "probe-thermometer": "probe-thermometer",
  "pencil": "pencil",
  "reagent-bottle": "reagent-bottle",
  "ring-stand": "ring-stand",
  "ring-stand-clamp": "ring-stand-clamp",
  "rubber-stopper-set": "rubber-stopper-set",
  "rubber-stopper-delivery-tube": "rubber-stopper-delivery-tube",
  "rubbing-alcohol-bottle": "rubbing-alcohol-bottle",
  "sample-bottle": "sample-bottle",
  "sample-rack": "sample-rack",
  "separatory-funnel": "separatory-funnel",
  "side-arm-filter-flask": "side-arm-filter-flask",
  "small-vial": "small-vial",
  "spectrophotometer": "spectrophotometer",
  "spatula": "spatula",
  "scoopula": "scoopula",
  "stirring-rod": "stirring-rod",
  "test-tube": "test-tube",
  "stopwatch": "stopwatch",
  "thermometer": "thermometer",
  "luer-lock-syringe": "luer-lock-syringe-empty",
  "luer-lock-syringe-locked": "luer-lock-syringe-locked",
  "locking-nail": "locking-nail",
  "reagent-tray": "reagent-tray",
  "unknown-acid-bottle": "reagent-bottle",
  "volumetric-flask": "volumetric-flask",
  "cuvette": "cuvette",
  "clay-triangle": "clay-triangle",
  "vacuum-source": "vacuum-source",
  "wire-gauze": "wire-gauze",
  "waste-beaker": "beaker-250ml",
  "wash-bottle": "wash-bottle",
  "watch-glass": "watch-glass",
  "weigh-boat": "weigh-boat",
  "wooden-calorimeter-cover": "wooden-calorimeter-cover",
};

export const publicAssetPath = (path: string): string => {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\/+/, "")}`;
};

export const equipmentAssetPath = (path: string): string => publicAssetPath(path);

const assetFor = (id: string): string => {
  const realisticId = realisticAssetById[id];
  if (realisticId === "") return equipmentAssetPath(`assets/equipment/${id}.svg`);
  return realisticId
    ? equipmentAssetPath(`assets/equipment-realistic/v1/${realisticId}.svg`)
    : equipmentAssetPath(`assets/equipment/${id}.svg`);
};

const equipment = (
  id: string,
  label: string,
  category: EquipmentDefinition["category"],
  affordances: EquipmentDefinition["affordances"],
  capacityAmount = 0,
  precisionAmount = 0,
  allowedContents: string[] = ["empty"],
  snapZones: SnapZone[] = [],
  options: { shelfPlaceable?: boolean } = {},
): EquipmentDefinition => ({
  id,
  label,
  category,
  asset: assetFor(id),
  shelfPlaceable: options.shelfPlaceable ?? true,
  dimensions: { width: 120, height: 120, unit: "px" },
  capacity: { amount: capacityAmount, unit: capacityAmount > 0 ? "mL" : "none" },
  precision: {
    amount: precisionAmount,
    unit: precisionAmount > 0 ? (category === "measurement" ? "mL" : "g") : "none",
  },
  allowedContents,
  affordances,
  snapZones: [
    {
      id: `${id}-bench-zone`,
      label: `${label} workbench zone`,
      accepts: [id],
      x: 0,
      y: 0,
    },
    ...snapZones,
  ],
  accessibleName: label,
});

export const v1EquipmentCatalog: EquipmentDefinition[] = [
  equipment(
    "brass-fume-hood-digestion",
    "Fume hood with covered brass digestion",
    "tool",
    ["draggable", "recordable"],
    0,
    0,
    ["empty"],
    [],
    { shelfPlaceable: false },
  ),
  equipment(
    "brass-color-depth-comparison",
    "Paired copper color-depth comparison",
    "measurement",
    ["draggable", "measurable", "recordable"],
  ),
  equipment(
    "analytical-balance",
    "Analytical balance",
    "measurement",
    ["draggable", "weighable", "recordable"],
    0,
    0.001,
    ["empty"],
    [
      {
        id: "analytical-balance-pan",
        label: "Balance pan",
        accepts: ["watch-glass", "weigh-boat", "beaker-250ml", "crucible-with-lid"],
        x: 54,
        y: 58,
      },
    ],
  ),
  // `solid` because the green-chemistry route's two labelled recovery containers - "Unused Sample"
  // (`purify-a-mixture-green-chemistry_2026-07-27.md` EX-08) and "Product Made from Heating
  // Samples" (EX-19) - are 250 mL beakers that receive a recovered solid, and the catalog must not
  // deny a content kind the route actually reaches.
  equipment("beaker-250ml", "250 mL beaker", "container", [
    "draggable",
    "fillable",
    "pourable",
    "measurable",
  ], 250, 5, ["empty", "liquid", "solid", "solution", "mixture", "precipitate"]),
  equipment("graduated-cylinder", "Graduated cylinder", "measurement", [
    "draggable",
    "fillable",
    "pourable",
    "measurable",
  ], 100, 1, ["empty", "liquid", "solution"]),
  equipment("graduated-cylinder-25ml", "25 mL graduated cylinder", "measurement", [
    "draggable",
    "fillable",
    "pourable",
    "measurable",
  ], 25, 0.5, ["empty", "liquid", "solution"]),
  // `solid` because Investigation 6's K-02 puts a dry microsample into the tube before K-03 adds any
  // solvent, so the tube legitimately holds a solid on its own for one step.
  equipment("test-tube", "Test tube", "container", [
    "draggable",
    "fillable",
    "pourable",
    "recordable",
  ], 20, 0.5, ["empty", "liquid", "solid", "solution", "mixture", "precipitate"]),
  equipment(
    "volumetric-flask",
    "Volumetric flask",
    "container",
    [
      "draggable",
      "fillable",
      "pourable",
      "measurable",
    ],
    100,
    0.1,
    ["empty", "liquid", "solution"],
    [
      {
        id: "volumetric-flask-stopper-seat",
        label: "Volumetric flask stopper seat",
        accepts: ["rubber-stopper-set"],
        x: 49,
        y: 26,
      },
    ],
  ),
  equipment(
    "burette-50ml",
    "50 mL burette",
    "measurement",
    ["draggable", "fillable", "pourable", "measurable", "recordable"],
    50,
    0.05,
    ["empty", "liquid", "solution"],
    [
      {
        id: "burette-funnel-seat",
        label: "Burette filling funnel seat",
        accepts: ["funnel"],
        x: 48.75,
        y: 23,
      },
    ],
  ),
  equipment(
    "ring-stand-clamp",
    "Ring stand and clamp",
    "tool",
    ["draggable"],
    0,
    0,
    ["empty"],
    [
      {
        id: "ring-stand-burette-clamp",
        label: "Burette clamp",
        accepts: ["burette-50ml"],
        x: 60,
        y: 35,
      },
      {
        id: "ring-stand-burette-receiver",
        label: "Receiving flask position beneath the burette",
        accepts: ["erlenmeyer-flask-250ml"],
        x: 212,
        y: 420,
      },
    ],
  ),
  equipment(
    "erlenmeyer-flask-250ml",
    "250 mL Erlenmeyer flask",
    "container",
    [
      "draggable",
      "fillable",
      "pourable",
      "measurable",
      "recordable",
    ],
    250,
    0,
    ["empty", "liquid", "solution", "mixture"],
    [
      {
        id: "erlenmeyer-stopper-neck",
        label: "Flask neck stopper seat",
        accepts: ["rubber-stopper-delivery-tube"],
        x: 53,
        y: 24,
      },
      {
        id: "erlenmeyer-ph-probe-zone",
        label: "Liquid-access zone for the pH probe",
        accepts: ["ph-meter"],
        x: 53,
        y: 52,
      },
    ],
  ),
  equipment("ph-meter", "pH meter", "measurement", [
    "draggable",
    "measurable",
    "recordable",
  ], 0, 0, ["empty"]),
  equipment("dropper-bottle", "Indicator dropper bottle", "reagent", [
    "draggable",
    "pourable",
  ], 30, 1, ["empty", "liquid", "solution"]),
  equipment("phenolphthalein-dropper", "Phenolphthalein", "reagent", [
    "draggable",
    "pourable",
  ], 30, 1, ["empty", "liquid", "solution"]),
  equipment("waste-beaker", "Waste beaker", "container", [
    "draggable",
    "fillable",
    "pourable",
  ], 250, 0, ["empty", "liquid", "solution", "mixture"]),
  equipment("filter-paper", "Filter paper", "filtration", ["draggable", "filterTarget"], 0, 0, [
    "empty",
    "precipitate",
  ]),
  equipment("chromatography-paper", "Chromatography paper", "chromatography", [
    "draggable",
    "spotTarget",
    "recordable",
  ], 0, 0, ["empty", "mixture"]),
  equipment(
    "chromatography-chamber",
    "Chromatography chamber",
    "chromatography",
    ["draggable", "fillable", "pourable", "chromatographyChamber"],
    50,
    1,
    ["empty", "liquid"],
    [
      {
        id: "chromatography-chamber-paper-slot",
        label: "Paper slot in solvent chamber",
        accepts: ["chromatography-paper"],
        x: 78,
        y: 84,
      },
    ],
  ),
  equipment("capillary-spotter", "Capillary spotter", "tool", ["draggable", "fillable", "pourable"], 1, 0, [
    "liquid",
    "solution",
    "mixture",
  ]),
  equipment("metric-ruler", "Metric ruler", "measurement", [
    "draggable",
    "measurable",
    "recordable",
  ], 0, 0),
  equipment("pencil", "Pencil", "tool", ["draggable", "recordable"], 0, 0, ["empty"]),
  equipment(
    "ring-stand",
    "Ring stand",
    "filtration",
    ["draggable"],
    0,
    0,
    ["empty"],
    [
      {
        id: "ring-stand-funnel-seat",
        label: "Circular funnel support ring",
        accepts: ["funnel"],
        x: 113,
        y: 190,
      },
      {
        id: "ring-stand-clay-triangle-seat",
        label: "Clay triangle support ring",
        accepts: ["clay-triangle"],
        x: 126,
        y: 194,
      },
      {
        id: "ring-stand-crucible-seat",
        label: "Crucible seat on clay triangle",
        accepts: ["crucible-with-lid"],
        x: 126,
        y: 166,
      },
      {
        id: "ring-stand-calorimeter-support",
        label: "Calorimeter cup support ring",
        accepts: ["polystyrene-cup-8oz"],
        x: 126,
        y: 194,
      },
      {
        id: "ring-stand-stirrer-bay",
        label: "Magnetic stirrer position beneath the support ring",
        accepts: ["hot-plate-stirrer"],
        x: 142,
        y: 378,
      },
    ],
  ),
  equipment("funnel", "Glass funnel", "filtration", ["draggable"], 0, 0, ["empty"]),
  equipment(
    "funnel-stand",
    "Funnel and stand",
    "filtration",
    ["draggable", "filterTarget", "fillable"],
    150,
    0,
    ["empty", "liquid", "mixture", "precipitate"],
    [
      {
        id: "funnel-stand-paper-seat",
        label: "Filter paper seat",
        accepts: ["filter-paper"],
        x: 127,
        y: 154,
      },
      {
        id: "funnel-receiving-vessel-zone",
        label: "Receiving vessel under funnel",
        accepts: ["beaker-250ml", "erlenmeyer-flask-250ml"],
        x: 127,
        y: 315,
      },
    ],
    { shelfPlaceable: false },
  ),
  equipment("wash-bottle", "Wash bottle", "reagent", ["draggable", "pourable"], 500, 5, [
    "liquid",
  ]),
  equipment(
    "drying-oven",
    "Drying oven",
    "heating",
    ["heatSource"],
    0,
    0,
    ["empty", "precipitate"],
    [
      {
        id: "drying-oven-chamber",
        label: "Oven chamber",
        accepts: ["watch-glass"],
        x: 60,
        y: 62,
      },
    ],
  ),
  equipment(
    "watch-glass",
    "Watch glass",
    "container",
    ["draggable", "fillable", "pourable", "weighable", "recordable"],
    0,
    0.001,
    ["empty", "solid", "precipitate"],
    [
      {
        id: "watch-glass-paper-seat",
        label: "Paper seat on watch glass",
        accepts: ["filter-paper"],
        x: 51,
        y: 30,
      },
    ],
  ),
  // `pourable` because Investigation 10's T-11 tips the weighed chips into the acid, and the
  // reducer's solid-transfer branch rejects a source without the affordance. No content used marble
  // chips as a transfer source before, so the addition changes no existing behaviour.
  equipment("marble-chips", "Marble chips", "sample", [
    "draggable",
    "weighable",
    "recordable",
    "pourable",
  ], 0, 0.001, ["solid"]),
  equipment(
    "rubber-stopper-delivery-tube",
    "Rubber stopper with delivery tube",
    "tool",
    ["draggable"],
    0,
    0,
    ["empty"],
    [
      {
        id: "delivery-tube-gas-syringe-port",
        label: "Delivery tube gas syringe port",
        accepts: ["gas-syringe"],
        x: 132,
        y: 30,
      },
    ],
  ),
  equipment("gas-syringe", "Gas syringe", "measurement", [
    "draggable",
    "measurable",
    "recordable",
  ], 100, 1, ["empty"]),
  equipment("stopwatch", "Stopwatch", "measurement", [
    "draggable",
    "recordable",
  ], 0, 0, ["empty"]),
  equipment("thermometer", "Thermometer", "measurement", [
    "draggable",
    "measurable",
    "recordable",
  ], 0, 0, ["empty"]),
  equipment(
    "probe-thermometer",
    "Probe thermometer",
    "measurement",
    ["draggable", "measurable", "recordable"],
    0,
    0,
    ["empty"],
  ),
  equipment(
    "hot-plate-stirrer",
    "Hot plate stirrer",
    "heating",
    ["draggable", "heatSource"],
    0,
    0,
    ["empty"],
    [
      {
        id: "hot-plate-stirrer-deck",
        label: "Hot plate heating surface",
        accepts: ["beaker-150ml"],
        x: 77,
        y: 34,
      },
    ],
  ),
  equipment("magnetic-stir-bar", "Magnetic stir bar", "tool", ["draggable"], 0, 0, ["empty"]),
  // `pourable` because EX-19 recovers the cooled product out of the crucible, and the solid-transfer
  // path rejects a source without the affordance ("The selected source is not pourable.").
  //
  // This widens a capability, so the newly reachable surface was checked rather than assumed: all
  // nine shipped actions naming this crucible as their source are `weigh`/`dry`/`cool` with
  // `readInstrument`/`placeInInstrument` interactions, none of which consults `pourable`, so no
  // existing traversal changes. What the affordance newly permits is the crucible passing the
  // solid-transfer source gate, the interaction-intent pour gate, and the authoring-time pour-source
  // checks in domain and studio validation. It also makes the crucible structurally eligible as a
  // configured solid-stock container, which stays unreachable because that handler additionally
  // requires the container the setup step itself declares.
  equipment("crucible-with-lid", "Crucible with lid", "container", [
    "draggable",
    "fillable",
    "pourable",
    "weighable",
    "recordable",
  ], 0, 0.001, ["empty", "solid", "mixture"]),
  equipment("crucible-tongs", "Crucible tongs", "tool", ["draggable"], 0, 0),
  equipment("clay-triangle", "Clay triangle", "heating", ["draggable"], 0, 0, ["empty"]),
  equipment("wire-gauze", "Wire gauze", "heating", ["draggable"], 0, 0, ["empty"]),
  equipment("bunsen-burner", "Bunsen burner", "heating", [
    "draggable",
    "heatSource",
  ], 0, 0),
  equipment("reagent-bottle", "Reagent bottle", "reagent", ["draggable", "pourable"], 250, 1, [
    "liquid",
    "solution",
    "solid",
  ]),
  equipment("distilled-water-bottle", "Distilled water bottle", "reagent", ["draggable", "pourable"], 500, 1, [
    "liquid",
    "solution",
  ]),
  equipment("propanol-bottle", "2-propanol bottle", "reagent", ["draggable", "pourable"], 250, 1, [
    "liquid",
    "solution",
  ]),
  equipment("rubbing-alcohol-bottle", "Rubbing alcohol bottle", "reagent", ["draggable", "pourable"], 250, 1, [
    "liquid",
    "solution",
  ]),
  equipment("unknown-acid-bottle", "Unknown acid", "reagent", ["draggable", "pourable"], 250, 1, [
    "liquid",
    "solution",
  ]),
  equipment("naoh-bottle", "0.100 M NaOH", "reagent", ["draggable", "pourable"], 250, 1, [
    "liquid",
    "solution",
  ]),
  // `solid` because the teacher's configured solid master stock is established in this bottle
  // before EX-06 loads the planned mixture, and a solid-mass `sourceInventory` is refused unless
  // the named container may hold a solid as well as pour one out.
  equipment("sample-bottle", "Sample bottle", "sample", [
    "draggable",
    "fillable",
    "pourable",
    "recordable",
  ], 125, 0, ["empty", "liquid", "solid", "solution", "mixture"]),
  equipment(
    "separatory-funnel",
    "Separatory funnel",
    "container",
    ["draggable", "fillable", "pourable", "recordable"],
    250,
    0,
    ["empty", "liquid", "solution", "mixture"],
  ),
  equipment("sample-rack", "Sample rack", "sample", ["draggable", "recordable"], 0, 0, [
    "empty",
  ], [
    { id: "sample-rack-slot-1", label: "Rack slot 1", accepts: ["test-tube"], x: 16, y: 18 },
    { id: "sample-rack-slot-2", label: "Rack slot 2", accepts: ["test-tube"], x: 36, y: 18 },
    { id: "sample-rack-slot-3", label: "Rack slot 3", accepts: ["test-tube"], x: 56, y: 18 },
    { id: "sample-rack-slot-4", label: "Rack slot 4", accepts: ["test-tube"], x: 76, y: 18 },
    { id: "sample-rack-slot-5", label: "Rack slot 5", accepts: ["test-tube"], x: 96, y: 18 },
    { id: "sample-rack-slot-6", label: "Rack slot 6", accepts: ["test-tube"], x: 116, y: 18 },
  ]),
  equipment("small-vial", "Small vial", "reagent", ["draggable", "pourable"], 20, 0.01, [
    "empty",
    "solid",
    "solution",
  ]),
  equipment("reagent-tray", "Reagent tray", "tool", ["draggable", "recordable"], 0, 0, [
    "empty",
  ]),
  equipment(
    "luer-lock-syringe",
    "Modified Luer Lock syringe",
    "measurement",
    ["draggable", "fillable", "measurable", "pourable", "recordable"],
    60,
    1,
    ["empty", "liquid", "solution", "mixture"],
    [
      {
        id: "luer-lock-syringe-plunger-hole",
        label: "Plunger locking hole",
        accepts: ["locking-nail"],
        x: 60,
        y: 106,
      },
    ],
  ),
  equipment("locking-nail", "Syringe locking nail", "tool", ["draggable"], 0, 0, ["empty"]),
  equipment("luer-lock-syringe-locked", "Locked luer-lock syringe", "measurement", [
    "draggable",
    "fillable",
    "measurable",
    "pourable",
    "recordable",
  ], 60, 1, ["empty", "liquid", "solution", "mixture"]),
  equipment("cuvette", "Cuvette", "measurement", [
    "draggable",
    "fillable",
    "measurable",
    "recordable",
  ], 4, 0.1, ["empty", "liquid", "solution"]),
  equipment(
    "spectrophotometer",
    "Spectrophotometer",
    "measurement",
    ["draggable", "measurable", "recordable"],
    0,
    0,
    ["empty"],
    [
      {
        id: "spectrophotometer-cuvette-slot",
        label: "Cuvette slot",
        accepts: ["cuvette"],
        x: 112,
        y: 74,
      },
    ],
  ),
  equipment("rubber-stopper-set", "Rubber stopper", "tool", ["draggable"], 0, 0, ["empty"]),
  equipment("beaker-150ml", "150 mL beaker", "container", [
    "draggable",
    "fillable",
    "pourable",
    "measurable",
  ], 150, 5, ["empty", "liquid", "solution", "mixture", "precipitate"]),
  equipment(
    "polystyrene-cup-8oz",
    "8 ounce polystyrene cup",
    "container",
    ["draggable", "fillable", "pourable", "recordable"],
    237,
    0,
    ["empty", "liquid", "solution", "mixture"],
    [
      {
        id: "polystyrene-cup-inner-nest",
        label: "Inner cup nesting area",
        accepts: ["polystyrene-cup-8oz"],
        x: 59,
        y: 61,
      },
      {
        id: "polystyrene-cup-cover-seat",
        label: "Wooden cover seat",
        accepts: ["wooden-calorimeter-cover"],
        x: 59,
        y: 25,
      },
      {
        id: "polystyrene-cup-stir-bar-zone",
        label: "Inner cup stir bar zone",
        accepts: ["magnetic-stir-bar"],
        x: 59,
        y: 94,
      },
    ],
  ),
  equipment(
    "wooden-calorimeter-cover",
    "Wooden calorimeter cover",
    "tool",
    ["draggable"],
    0,
    0,
    ["empty"],
    [
      {
        id: "wooden-cover-probe-hole",
        label: "Thermometer hole in wooden cover",
        accepts: ["probe-thermometer"],
        x: 59,
        y: 24,
      },
    ],
  ),
  equipment("weigh-boat", "Weighing boat", "container", [
    "draggable",
    "fillable",
    "pourable",
    "weighable",
  ], 0, 0.001, ["empty", "solid"]),
  equipment(
    "hand-warmer-calorimeter",
    "Hand-warmer calorimeter assembly",
    "container",
    ["fillable", "pourable", "recordable"],
    237,
    0,
    ["empty", "liquid", "solution", "mixture"],
    [
      {
        id: "hand-warmer-stirrer-base",
        label: "Magnetic stirrer position on the stand base beneath the support ring",
        accepts: ["hot-plate-stirrer"],
        x: 59,
        y: 83,
      },
      {
        id: "hand-warmer-cup-support-ring",
        label: "Outer cup position through the support ring",
        accepts: ["polystyrene-cup-8oz"],
        x: 59,
        y: 51,
      },
      {
        id: "hand-warmer-inner-cup-nest",
        label: "Inner cup nesting position",
        accepts: ["polystyrene-cup-8oz"],
        x: 59,
        y: 51,
      },
      {
        id: "hand-warmer-cover-seat",
        label: "Wooden cover seat",
        accepts: ["wooden-calorimeter-cover"],
        x: 59,
        y: 39,
      },
      {
        id: "hand-warmer-probe-hole",
        label: "Probe hole in the wooden cover",
        accepts: ["probe-thermometer"],
        x: 59,
        y: 38,
      },
      {
        id: "hand-warmer-stir-bar-well",
        label: "Inner cup stir bar zone",
        accepts: ["magnetic-stir-bar"],
        x: 59,
        y: 63,
      },
    ],
    { shelfPlaceable: false },
  ),
  equipment("foam-cup-calorimeter", "Foam cup calorimeter", "container", [
    "draggable",
    "fillable",
    "recordable",
  ], 120, 1, ["empty", "liquid", "solution", "mixture"]),
  equipment(
    "buchner-funnel",
    "Buchner funnel",
    "filtration",
    ["draggable", "filterTarget", "fillable"],
    100,
    0,
    ["empty", "liquid", "mixture", "precipitate"],
    [
      {
        id: "buchner-funnel-paper-seat",
        label: "Buchner funnel perforated plate",
        accepts: ["filter-paper"],
        x: 50,
        y: 32,
      },
      {
        id: "buchner-funnel-receiver-neck",
        label: "Side-arm flask neck under Buchner funnel",
        accepts: ["side-arm-filter-flask"],
        x: 50,
        y: 86,
      },
    ],
  ),
  equipment("side-arm-filter-flask", "Side-arm filter flask", "container", [
    "draggable",
    "fillable",
    "pourable",
    "recordable",
  ], 250, 0, ["empty", "liquid", "solution", "mixture", "precipitate"]),
  equipment("vacuum-source", "Vacuum source", "tool", ["draggable", "recordable"], 0, 0, [
    "empty",
  ]),
  equipment("conductivity-tester", "Conductivity tester", "measurement", [
    "draggable",
    "measurable",
    "recordable",
  ], 0, 0, ["empty"]),
  equipment("melting-point-apparatus", "Melting point apparatus", "measurement", [
    "draggable",
    "heatSource",
    "measurable",
    "recordable",
  ], 0, 0, ["empty"]),
  equipment("ph-paper", "pH paper", "measurement", [
    "draggable",
    "measurable",
    "recordable",
  ], 0, 0, ["empty", "liquid", "solution"]),
  equipment("permanent-marker", "Permanent marker", "tool", ["draggable", "recordable"], 0, 0, [
    "empty",
  ]),
  equipment("magnet", "Magnet", "tool", ["draggable", "recordable"], 0, 0, ["empty"]),
  equipment("data-collection-interface", "Data collection interface", "measurement", [
    "draggable",
    "recordable",
  ], 0, 0, ["empty"]),
  equipment("graduated-pipette-10ml", "10 mL graduated pipette", "measurement", [
    "draggable",
    "fillable",
    "pourable",
    "measurable",
  ], 10, 0.1, ["empty", "liquid", "solution"]),
  equipment("beral-pipette", "Beral pipette", "tool", [
    "draggable",
    "fillable",
    "pourable",
  ], 3, 0.2, ["empty", "liquid", "solution"]),
  equipment("pipette-pump", "Pipette pump", "tool", ["draggable"], 0, 0, ["empty"]),
  equipment("spatula", "Spatula", "tool", ["draggable"], 0, 0, ["empty", "solid"]),
  equipment("scoopula", "Metal scoopula", "tool", ["draggable"], 0, 0, ["solid"]),
  equipment("stirring-rod", "Stirring rod", "tool", ["draggable"], 0, 0),
];

// Explicit stock sizes preserve the original bottle capacities used by other activities.
for (const [id, baseId] of Object.entries(stockBottleVariants)) {
  const base = v1EquipmentCatalog.find((item) => item.id === baseId)!;
  const capacityMl = stockBottleCapacityMl[id] ?? 1000;
  const capacityLabel = capacityMl % 1000 === 0 ? `${capacityMl / 1000} L` : `${capacityMl} mL`;
  v1EquipmentCatalog.push({
    ...base,
    id,
    label: `${base.label} (${capacityLabel})`,
    accessibleName: `${base.accessibleName} (${capacityLabel})`,
    capacity: { amount: capacityMl, unit: "mL" },
    snapZones: base.snapZones.map((zone) => ({
      ...zone,
      id: zone.id.replace(baseId, id),
      accepts: zone.accepts.map((accepted) => accepted === baseId ? id : accepted),
    })),
  });
}

export const equipmentById = new Map(v1EquipmentCatalog.map((item) => [item.id, item]));

export const createEquipmentInstance = (
  definitionId: string,
  suffix = "1",
  location: EquipmentInstance["location"] = "shelf",
): EquipmentInstance => {
  const definition = equipmentById.get(definitionId);
  if (!definition) {
    throw new Error(`Unknown equipment definition: ${definitionId}`);
  }
  return {
    id: `${definitionId}-${suffix}`,
    definitionId,
    label: definition.label,
    location,
    contents: emptyContents(),
  };
};

export const groupedEquipment = v1EquipmentCatalog.reduce<Record<string, EquipmentDefinition[]>>(
  (groups, item) => {
    groups[item.category] = [...(groups[item.category] ?? []), item];
    return groups;
  },
  {},
);
