import type { EquipmentLocation } from "./types";

export const isVisibleWorkbenchLocation = (location: EquipmentLocation): boolean =>
  location === "workbench" || location === "snapZone";
