import type { InteractionRelationType, InteractionZone } from "./types";

const zone = (
  id: string,
  ownerDefinitionId: string,
  accepts: string[],
  relationType: InteractionRelationType,
  maxOccupancy = 1,
): InteractionZone => ({
  id,
  ownerDefinitionId,
  accepts,
  relationType,
  maxOccupancy,
});

export const v1InteractionZones: InteractionZone[] = [
  zone(
    "analytical-balance-pan",
    "analytical-balance",
    ["watch-glass", "weigh-boat", "beaker-250ml", "crucible-with-lid"],
    "placedOn",
  ),
  zone("drying-oven-chamber", "drying-oven", ["watch-glass"], "insideInstrument"),
  zone("ring-stand-funnel-seat", "ring-stand", ["funnel"], "mounted"),
  zone("ring-stand-clay-triangle-seat", "ring-stand", ["clay-triangle"], "mounted"),
  zone("ring-stand-crucible-seat", "ring-stand", ["crucible-with-lid"], "placedOn"),
  zone(
    "ring-stand-calorimeter-support",
    "ring-stand",
    ["polystyrene-cup-8oz"],
    "mounted",
  ),
  zone(
    "ring-stand-stirrer-bay",
    "ring-stand",
    ["hot-plate-stirrer"],
    "receiving",
  ),
  // The hand-warmer assembly renders the stand as a state asset. Its heater
  // seat is intentionally distinct from the generic ring-stand support-ring
  // zone so the heater attaches to the visual base.
  zone(
    "hand-warmer-stirrer-base",
    "hand-warmer-calorimeter",
    ["hot-plate-stirrer"],
    "receiving",
  ),
  // The complete hand-warmer state assets render the nested assembly, so every
  // position that targets that assembly must be owned by it rather than one of
  // the individual items depicted in the state art.
  zone(
    "hand-warmer-cup-support-ring",
    "hand-warmer-calorimeter",
    ["polystyrene-cup-8oz"],
    "mounted",
  ),
  zone(
    "hand-warmer-inner-cup-nest",
    "hand-warmer-calorimeter",
    ["polystyrene-cup-8oz"],
    "inserted",
  ),
  zone(
    "hand-warmer-cover-seat",
    "hand-warmer-calorimeter",
    ["wooden-calorimeter-cover"],
    "placedOn",
  ),
  zone(
    "hand-warmer-probe-hole",
    "hand-warmer-calorimeter",
    ["probe-thermometer"],
    "inserted",
  ),
  zone(
    "hand-warmer-stir-bar-well",
    "hand-warmer-calorimeter",
    ["magnetic-stir-bar"],
    "inserted",
  ),
  zone(
    "polystyrene-cup-inner-nest",
    "polystyrene-cup-8oz",
    ["polystyrene-cup-8oz"],
    "inserted",
  ),
  zone(
    "polystyrene-cup-cover-seat",
    "polystyrene-cup-8oz",
    ["wooden-calorimeter-cover"],
    "placedOn",
  ),
  zone(
    "polystyrene-cup-stir-bar-zone",
    "polystyrene-cup-8oz",
    ["magnetic-stir-bar"],
    "inserted",
  ),
  zone(
    "wooden-cover-probe-hole",
    "wooden-calorimeter-cover",
    ["probe-thermometer"],
    "inserted",
  ),
  zone(
    "hot-plate-stirrer-deck",
    "hot-plate-stirrer",
    ["beaker-150ml"],
    "placedOn",
  ),
  zone("funnel-stand-paper-seat", "funnel-stand", ["filter-paper"], "inserted"),
  zone("funnel-receiving-vessel-zone", "funnel-stand", ["beaker-250ml", "erlenmeyer-flask-250ml"], "receiving"),
  zone("buchner-funnel-paper-seat", "buchner-funnel", ["filter-paper"], "inserted"),
  zone("buchner-funnel-receiver-neck", "buchner-funnel", ["side-arm-filter-flask"], "receiving"),
  zone("watch-glass-paper-seat", "watch-glass", ["filter-paper"], "placedOn"),
  zone("ring-stand-burette-clamp", "ring-stand-clamp", ["burette-50ml"], "mounted"),
  zone("ring-stand-burette-receiver", "ring-stand-clamp", ["erlenmeyer-flask-250ml"], "receiving"),
  zone("burette-funnel-seat", "burette-50ml", ["funnel"], "mounted"),
  zone("chromatography-chamber-paper-slot", "chromatography-chamber", ["chromatography-paper"], "developing"),
  zone("volumetric-flask-stopper-seat", "volumetric-flask", ["rubber-stopper-set"], "inserted"),
  zone("spectrophotometer-cuvette-slot", "spectrophotometer", ["cuvette"], "inserted"),
  zone("erlenmeyer-stopper-neck", "erlenmeyer-flask-250ml", ["rubber-stopper-delivery-tube"], "inserted"),
  zone("erlenmeyer-ph-probe-zone", "erlenmeyer-flask-250ml", ["ph-meter"], "inserted"),
  zone("delivery-tube-gas-syringe-port", "rubber-stopper-delivery-tube", ["gas-syringe"], "mounted"),
  zone("luer-lock-syringe-plunger-hole", "luer-lock-syringe", ["locking-nail"], "inserted"),
  zone("sample-rack-slot-1", "sample-rack", ["test-tube"], "placedOn"),
  zone("sample-rack-slot-2", "sample-rack", ["test-tube"], "placedOn"),
  zone("sample-rack-slot-3", "sample-rack", ["test-tube"], "placedOn"),
  zone("sample-rack-slot-4", "sample-rack", ["test-tube"], "placedOn"),
  zone("sample-rack-slot-5", "sample-rack", ["test-tube"], "placedOn"),
  zone("sample-rack-slot-6", "sample-rack", ["test-tube"], "placedOn"),
];

export const interactionZoneById = new Map(v1InteractionZones.map((item) => [item.id, item]));

export const getInteractionZone = (zoneId: string | undefined): InteractionZone | undefined =>
  zoneId ? interactionZoneById.get(zoneId) : undefined;
