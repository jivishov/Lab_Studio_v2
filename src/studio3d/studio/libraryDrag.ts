/**
 * What a library card carries when it is dragged onto a stage (handoff §4.3). During a drag only
 * the data *types* can be read, so a step template also sets a `+step` type: the Flow view can
 * light an edge for insertion before the drop reveals what is being carried.
 */
export const LIBRARY_DRAG_TYPE = "application/x-studio3d-library";

export type LibraryDrag =
  | { kind: "template"; id: string }
  | { kind: "technique"; id: string }
  | { kind: "equipment"; id: string };

export const writeLibraryDrag = (transfer: DataTransfer, item: LibraryDrag): void => {
  transfer.setData(LIBRARY_DRAG_TYPE, JSON.stringify(item));
  transfer.setData(`${LIBRARY_DRAG_TYPE}+${item.kind === "template" ? "step" : item.kind}`, "1");
  transfer.effectAllowed = "copy";
};

export const readLibraryDrag = (transfer: DataTransfer): LibraryDrag | undefined => {
  try {
    const value = JSON.parse(transfer.getData(LIBRARY_DRAG_TYPE)) as Partial<LibraryDrag>;
    if ((value.kind === "template" || value.kind === "technique" || value.kind === "equipment") && typeof value.id === "string") {
      return value as LibraryDrag;
    }
  } catch {
    // not a library card
  }
  return undefined;
};
