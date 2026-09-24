import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { EquipmentInstance, LabDefinition, RuntimeState } from "../../domain/types";
import { getInteractionZone, v1InteractionZones } from "../../domain/interactionZones";
import { createEquipmentInstance, equipmentById } from "../../equipment/catalog";
import { resolveLiquidStyle } from "../../equipment/liquidRendering";
import { formatContentLabel } from "../../player/contentDisplay";
import { createRuntimeState } from "../../runtime";
import { createStudioIdAllocator } from "../../studio/studioTransactions";
import { BENCH_MM, fromBench, runtimeBenchPointsMm } from "../adapters/benchCoordinates";
import { runtimeToScene, type SceneDescription } from "../adapters/runtimeToScene";
import { nextPlacementPoint } from "../adapters/twoDPlacement";
import type { BenchEngine } from "../bench/BenchEngine";
import { BenchView } from "../bench/BenchView";
import { equipment3dEntry } from "../equipment3d/readiness";
import { catalogueSpecs } from "../player/panels";
import { Icon } from "../ui/Icon";
import { Thumbnail } from "./LibraryPanel";
import { LIBRARY_DRAG_TYPE, readLibraryDrag } from "./libraryDrag";
import { readStudioUi, updateStudioUi } from "./studioUi";
import type { Studio3DController } from "./useStudio3DDraft";

/**
 * Stage: Starting bench (handoff §4.5, decision U3): the Photoreal Bench's arranging model on the
 * real 3D bench, over `initialState.equipment`. Every change is `upsertInitialEquipment` or
 * `removeInitialEquipment`; positions are stored in the 2D player's units through
 * `benchCoordinates`, so the draft still plays there. What is drawn is the runtime's own starting
 * state (`createRuntimeState`), so the bench shows what the learner will start with.
 */
const INSTANCE_DRAG_TYPE = "application/x-studio3d-instance";
const LIFT_MM = 16;
const SNAP_RADIUS_MM = 45;

/** The learner's starting state for this draft; the runtime adds any required item not placed. */
export const startingState = (draft: LabDefinition): RuntimeState => createRuntimeState(draft, "guided");

export const startingScene = (draft: LabDefinition): { state: RuntimeState; scene: SceneDescription } => {
  const state = startingState(draft);
  return { state, scene: runtimeToScene(state, draft) };
};

const authoredInstance = (draft: LabDefinition, id: string): EquipmentInstance | undefined =>
  draft.initialState?.equipment.find((instance) => instance.id === id);

/**
 * A zone the carried item could start seated in: its owner must be on the bench exactly once,
 * since the runtime seats a starting item on the first instance of the zone's owner
 * (`deriveLegacyAttachments`), and the zone must accept the item (`v1InteractionZones`).
 */
export const seatingZonesFor = (state: RuntimeState, childDefinitionId: string) =>
  v1InteractionZones.filter((zone) => zone.accepts.includes(childDefinitionId)).flatMap((zone) => {
    const owners = state.equipmentInstances.filter((i) => i.definitionId === zone.ownerDefinitionId);
    const anchor = equipment3dEntry(zone.ownerDefinitionId)?.anchors[zone.id];
    return owners.length === 1 && owners[0].location === "workbench" && anchor ? [{ zone, owner: owners[0], anchor }] : [];
  });

/**
 * A starting instance for `definitionId`: the runtime's implicit one (a required item it would add
 * to the shelf) when there is one, else a new id from the Studio's allocator.
 */
const newStartingInstance = (draft: LabDefinition, state: RuntimeState, definitionId: string): EquipmentInstance => {
  const implicit = state.equipmentInstances.find((i) => i.definitionId === definitionId && !authoredInstance(draft, i.id));
  if (implicit) return { ...implicit };
  return { ...createEquipmentInstance(definitionId, "1"), id: createStudioIdAllocator(draft).next(definitionId) };
};

/** Click or Enter on a library card (§4.3): the next free spot, as the 2D `placeEquipment` gives it. */
export const addStartingItem = (studio: Studio3DController, definitionId: string): void => {
  if (studio.readOnly) return;
  const state = startingState(studio.draft);
  const instance = newStartingInstance(studio.draft, state, definitionId);
  const point = nextPlacementPoint(state.equipmentInstances.filter((i) => i.location === "workbench"), definitionId);
  studio.commit(`Add ${instance.label} to the starting bench`, [{ type: "upsertInitialEquipment", instance: { ...instance, location: "workbench", x: point.x, y: point.y } }],
    { selection: { kind: "equipment", id: instance.id } });
};

export const BenchSetupView = ({ studio, onToast, onInspectEquipment }: {
  studio: Studio3DController;
  onToast: (text: string, action?: { label: string; run: () => void }) => void;
  onInspectEquipment: (instanceId: string) => void;
}) => {
  const { draft, commit, selection, setSelection, readOnly } = studio;
  const [engine, setEngine] = useState<BenchEngine>();
  const [snapZones, setSnapZones] = useState(() => readStudioUi().bench.snapZones);
  const [labels, setLabels] = useState(() => readStudioUi().bench.labels);
  const [, bump] = useState(0);
  const [overShelf, setOverShelf] = useState(false);
  const [callout, setCallout] = useState<{ x: number; y: number; text: string; kind: "valid" | "free" | "detach" }>();
  const shelfRef = useRef<HTMLDivElement>(null);
  const carryRef = useRef<{ id: string; definitionId: string; startX: number; startY: number; active: boolean; point?: { xMm: number; yMm: number }; zone?: string } | undefined>(undefined);
  const { state, scene } = useMemo(() => {
    try { return startingScene(draft); } catch { return { state: undefined, scene: undefined }; }
  }, [draft]);
  const selectedId = selection?.kind === "equipment" ? selection.id : undefined;
  const shelf = state?.equipmentInstances.filter((i) => i.location === "shelf") ?? [];
  const onBench = scene?.bench.length ?? 0;
  const options = useMemo(() => ({ quality: "high" as const, reducedMotion: typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) }), []);

  useEffect(() => {
    if (!engine) return undefined;
    engine.onChange = () => bump((v) => v + 1);
    // The stage is narrower than the player's window: start on the whole bench (§4.5 "Reset").
    let active = true;
    void engine.settled().then(() => { if (active) engine.frameBench({}, true); });
    return () => { active = false; engine.onChange = undefined; };
  }, [engine]);
  useEffect(() => { engine?.setSelected(selectedId ?? null); }, [engine, selectedId, scene]);
  useEffect(() => { updateStudioUi({ bench: { snapZones, labels } }); }, [snapZones, labels]);

  const newInstance = (definitionId: string): EquipmentInstance => newStartingInstance(draft, state!, definitionId);

  const place = (instance: EquipmentInstance, xMm: number, yMm: number, verb: string) => {
    const point = fromBench(instance.definitionId, xMm, yMm);
    const next: EquipmentInstance = { ...instance, location: "workbench", x: point.x, y: point.y };
    delete next.snapZoneId;
    return commit(`${verb} ${instance.label}`, [{ type: "upsertInitialEquipment", instance: next }], { selection: { kind: "equipment", id: instance.id } });
  };
  const seat = (instance: EquipmentInstance, zoneId: string, ownerLabel: string) => {
    const next: EquipmentInstance = { ...instance, location: "snapZone", snapZoneId: zoneId };
    return commit(`Seat ${instance.label} on ${ownerLabel}`, [{ type: "upsertInitialEquipment", instance: next }], { selection: { kind: "equipment", id: instance.id } });
  };
  const toShelf = (instance: EquipmentInstance) => {
    const next: EquipmentInstance = { ...instance, location: "shelf" };
    delete next.x; delete next.y; delete next.snapZoneId;
    return commit(`Return ${instance.label} to the shelf`, [{ type: "upsertInitialEquipment", instance: next }]);
  };
  const remove = (instanceId: string) => {
    const instance = authoredInstance(draft, instanceId);
    if (!instance) { onToast("This item is added by the runtime because the draft requires it. Remove it from Required equipment in Setup."); return; }
    const result = commit(`Remove ${instance.label} from the starting setup`, [{ type: "removeInitialEquipment", instanceId }], { selection: undefined });
    if (result.ok) onToast(`Removed ${instance.label}.`, { label: "Undo", run: studio.undo });
  };
  const instanceFor = (id: string): EquipmentInstance | undefined =>
    authoredInstance(draft, id) ?? state?.equipmentInstances.find((i) => i.id === id);

  // ------------------------------------------------------------ carrying on the canvas
  const nearestZone = (definitionId: string, xMm: number, yMm: number) => {
    if (!state || !snapZones) return undefined;
    const points = runtimeBenchPointsMm(state);
    let best: { zoneId: string; ownerId: string; ownerLabel: string; d: number } | undefined;
    for (const { zone, owner, anchor } of seatingZonesFor(state, definitionId)) {
      const at = points.get(owner.id);
      if (!at) continue;
      const d = Math.hypot(at.xMm + anchor.positionMm[0] - xMm, at.yMm + anchor.positionMm[1] - yMm);
      if (d < SNAP_RADIUS_MM && (!best || d < best.d)) best = { zoneId: zone.id, ownerId: owner.id, ownerLabel: owner.label, d };
    }
    return best;
  };

  useEffect(() => {
    if (!engine) return undefined;
    const canvas = engine.canvasElement;
    const rectOf = () => canvas.getBoundingClientRect();
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || readOnly) return;
      const id = engine.pick(event.clientX, event.clientY);
      const item = id ? scene?.bench.find((i) => i.instanceId === id) : undefined;
      if (!item) return;
      carryRef.current = { id: item.instanceId, definitionId: item.definitionId, startX: event.clientX, startY: event.clientY, active: false };
      canvas.setPointerCapture(event.pointerId);
      engine.holdCameraInput(true);
    };
    const move = (event: PointerEvent) => {
      const carry = carryRef.current;
      if (!carry) return;
      if (!carry.active && Math.hypot(event.clientX - carry.startX, event.clientY - carry.startY) < 4) return;
      carry.active = true;
      const point = engine.benchPointAt(event.clientX, event.clientY);
      if (!point) return;
      carry.point = point;
      const over = shelfRef.current?.getBoundingClientRect();
      const shelfHit = Boolean(over && event.clientX >= over.left && event.clientX <= over.right && event.clientY >= over.top && event.clientY <= over.bottom);
      setOverShelf(shelfHit);
      const zone = event.altKey || shelfHit ? undefined : nearestZone(carry.definitionId, point.xMm, point.yMm);
      carry.zone = zone?.zoneId;
      engine.previewCarry(carry.id, point.xMm, point.yMm, LIFT_MM);
      const zoneAnchor = zone ? equipment3dEntry(state!.equipmentInstances.find((i) => i.id === zone.ownerId)!.definitionId)?.anchors[zone.zoneId]?.positionMm : undefined;
      engine.setTargetRing(zone?.ownerId ?? null, "valid", zoneAnchor);
      const r = rectOf();
      const seated = instanceFor(carry.id)?.location === "snapZone";
      setCallout(shelfHit ? undefined : {
        x: event.clientX - r.left, y: event.clientY - r.top - 44,
        text: zone ? `Release to seat it on ${zone.ownerLabel}` : seated ? "Moving detaches this item." : "Release to set down",
        kind: zone ? "valid" : seated ? "detach" : "free",
      });
    };
    const up = (event: PointerEvent) => {
      const carry = carryRef.current;
      carryRef.current = undefined;
      engine.holdCameraInput(false);
      setCallout(undefined);
      setOverShelf(false);
      if (!carry) return;
      engine.endCarryPreview();
      if (!carry.active) { setSelection({ kind: "equipment", id: carry.id }); return; }
      const instance = instanceFor(carry.id);
      const over = shelfRef.current?.getBoundingClientRect();
      const shelfHit = Boolean(over && event.clientX >= over.left && event.clientX <= over.right && event.clientY >= over.top && event.clientY <= over.bottom);
      let ok = false;
      if (instance && shelfHit) ok = toShelf(instance).ok;
      else if (instance && carry.zone) {
        const owner = seatingZonesFor(state!, instance.definitionId).find((z) => z.zone.id === carry.zone);
        ok = owner ? seat(instance, carry.zone, owner.owner.label).ok : false;
      } else if (instance && carry.point) ok = place(instance, carry.point.xMm, carry.point.yMm, "Move").ok;
      if (!ok && scene) void engine.sync(scene);
    };
    const dbl = (event: MouseEvent) => {
      const id = engine.pick(event.clientX, event.clientY);
      if (id) onInspectEquipment(id);
    };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("dblclick", dbl);
    // Esc cancels a carry (§4.9): the preview is dropped and the bench shows the draft again.
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !carryRef.current) return;
      carryRef.current = undefined;
      engine.holdCameraInput(false);
      engine.endCarryPreview();
      setCallout(undefined);
      setOverShelf(false);
      if (scene) void engine.sync(scene);
    };
    window.addEventListener("keydown", key);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", key);
      canvas.removeEventListener("dblclick", dbl);
      engine.holdCameraInput(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, scene, state, readOnly, snapZones, draft]);

  // Library equipment and shelf items dropped onto the bench (HTML drag and drop).
  const onDragOver = (event: DragEvent) => {
    if (readOnly) return;
    if (event.dataTransfer.types.includes(`${LIBRARY_DRAG_TYPE}+equipment`) || event.dataTransfer.types.includes(INSTANCE_DRAG_TYPE)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = event.dataTransfer.types.includes(INSTANCE_DRAG_TYPE) ? "move" : "copy";
    }
  };
  const onDrop = (event: DragEvent) => {
    if (!engine || readOnly) return;
    const point = engine.benchPointAt(event.clientX, event.clientY);
    if (!point) return;
    const x = Math.max(-BENCH_MM.width / 2, Math.min(BENCH_MM.width / 2, point.xMm));
    const shelfId = event.dataTransfer.getData(INSTANCE_DRAG_TYPE);
    if (shelfId) {
      event.preventDefault();
      const instance = instanceFor(shelfId);
      if (instance) place(instance, x, point.yMm, "Place");
      return;
    }
    const item = readLibraryDrag(event.dataTransfer);
    if (item?.kind !== "equipment") return;
    event.preventDefault();
    place(newInstance(item.id), x, point.yMm, "Add");
  };

  // Keyboard map (§4.9), only while the bench has focus.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!engine) return;
    const instance = selectedId ? instanceFor(selectedId) : undefined;
    if (event.key === "Home") { event.preventDefault(); engine.frameBench({}, true); return; }
    if ((event.key === "f" || event.key === "F") && selectedId) { event.preventDefault(); engine.frameItems([selectedId], 2.2); return; }
    if (!instance || readOnly) return;
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); remove(instance.id); return; }
    if (event.key === "Enter") { event.preventDefault(); onInspectEquipment(instance.id); return; }
    if (event.key.startsWith("Arrow") && instance.location === "workbench" && state) {
      event.preventDefault();
      const at = runtimeBenchPointsMm(state).get(instance.id);
      if (!at) return;
      const step = event.shiftKey ? 50 : 10;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0;
      place(instance, at.xMm + dx, at.yMm + dy, "Move");
    }
  };

  if (!state || !scene) {
    return <div className="s3d-stage-empty"><div className="s3d-glass-card"><p>The starting setup cannot be drawn until the draft's equipment is valid. See Checks.</p></div></div>;
  }

  const labelItems = labels && engine ? scene.bench.map((item) => ({ item, at: engine.screenPoint(item.instanceId, 0) })) : [];
  return (
    <div className="s3d-benchsetup" onKeyDown={onKeyDown} onDragOver={onDragOver} onDrop={onDrop}>
      <BenchView scene={scene} options={options} onEngine={setEngine}
        label="Starting bench. Every item is also listed in the inspector when nothing is selected."
        fallback={<div className="s3d-fallback"><p>This browser cannot draw the 3D bench. The starting equipment is listed in the inspector.</p></div>}>
        {labelItems.map(({ item, at }) => (at?.visible ? (
          <div key={item.instanceId} className={`s3d-label s3d-label--quiet${item.instanceId === selectedId ? " is-selected" : ""}`} style={{ left: at.x, top: at.y + 10 }}>{item.label}</div>
        ) : null))}
        {callout ? (
          <div className={`s3d-callout s3d-callout--${callout.kind === "valid" ? "valid" : callout.kind === "detach" ? "invalid" : "free"}`} style={{ left: callout.x, top: callout.y }}>
            <Icon name={callout.kind === "valid" ? "seat" : callout.kind === "detach" ? "warn" : "move"} size={14} />{callout.text}
          </div>
        ) : null}
      </BenchView>
      <div ref={shelfRef} className={`s3d-shelf-strip${overShelf ? " is-over" : ""}`} aria-label="Starting shelf">
        <span className="s3d-shelf-strip__label">Shelf</span>
        <div className="s3d-shelf-strip__items">
          {shelf.length === 0 ? <span className="s3d-small">Nothing starts on the shelf.</span> : shelf.map((instance) => (
            <div key={instance.id} className={`s3d-shelf-item${instance.id === selectedId ? " is-selected" : ""}`} draggable={!readOnly}
              onDragStart={(e) => { e.dataTransfer.setData(INSTANCE_DRAG_TYPE, instance.id); e.dataTransfer.effectAllowed = "move"; }}
              onClick={() => setSelection({ kind: "equipment", id: instance.id })} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") setSelection({ kind: "equipment", id: instance.id }); }}
              title={authoredInstance(draft, instance.id) ? instance.label : `${instance.label} (added by the runtime: the draft requires it)`}>
              <Thumbnail definitionId={instance.definitionId} size={44} />
              <span>{instance.label}</span>
            </div>
          ))}
        </div>
        <span className="s3d-small s3d-shelf-strip__note">Drag between the bench and this shelf. The runtime starts shelf items in the learner's tray.</span>
      </div>
      <div className="s3d-tbar s3d-tbar--stage" role="toolbar" aria-label="Bench tools">
        <button type="button" className="is-on" aria-pressed="true"><Icon name="move" />Arrange</button>
        <i />
        <button type="button" className={snapZones ? "is-on" : ""} aria-pressed={snapZones} onClick={() => setSnapZones((v) => !v)} title="Alt bypasses snapping"><Icon name="seat" />Snap to zones</button>
        <button type="button" className={labels ? "is-on" : ""} aria-pressed={labels} onClick={() => setLabels((v) => !v)}>Labels</button>
        <i />
        <button type="button" onClick={() => engine?.frameBench({}, true)}>Front</button>
        <button type="button" onClick={() => engine?.overhead()}>Top</button>
        <button type="button" onClick={() => engine?.frameBench({}, true)}><Icon name="reset" />Reset</button>
      </div>
      <span className="s3d-sr" aria-live="polite">{onBench} on bench, {shelf.length} on shelf</span>
    </div>
  );
};

// ------------------------------------------------------------ the inspector's Equipment views

export const EquipmentInspector = ({ studio, instanceId, onNudge, onToShelf, onRemove }: {
  studio: Studio3DController;
  instanceId: string;
  onNudge: (dxMm: number, dyMm: number) => void;
  onToShelf: () => void;
  onRemove: () => void;
}) => {
  const { draft, readOnly } = studio;
  const state = useMemo(() => { try { return startingState(draft); } catch { return undefined; } }, [draft]);
  const instance = state?.equipmentInstances.find((i) => i.id === instanceId);
  if (!instance) return <p className="s3d-small">This item is no longer in the starting setup.</p>;
  const definition = equipmentById.get(instance.definitionId);
  const zones = v1InteractionZones.filter((z) => z.ownerDefinitionId === instance.definitionId).map((z) => z.id);
  const holder = instance.location === "snapZone" ? getInteractionZone(instance.snapZoneId)?.ownerDefinitionId : undefined;
  const style = definition ? resolveLiquidStyle(instance.contents, definition) : undefined;
  const authored = Boolean(draft.initialState?.equipment.some((i) => i.id === instanceId));
  const disabled = Boolean(readOnly);
  const pad = (icon: string, dx: number, dy: number, text: string, flip = false) => (
    <button type="button" className="s3d-button s3d-button--icon" aria-label={text} disabled={disabled || instance.location !== "workbench"} onClick={() => onNudge(dx, dy)}
      style={flip ? { transform: "scaleX(-1)" } : undefined}><Icon name={icon} /></button>
  );
  return (
    <>
      <div className="s3d-eyebrow">Starting equipment</div>
      <div className="s3d-eq-preview"><Thumbnail definitionId={instance.definitionId} size={110} /></div>
      <div className="s3d-ins-title">{instance.label}</div>
      <dl className="s3d-kv">
        <dt>Instance</dt><dd className="s3d-mono">{instance.id}</dd>
        <dt>Location</dt><dd>{instance.location === "snapZone" ? `seated on ${holder ? equipmentById.get(holder)?.label ?? holder : "its holder"}` : instance.location}</dd>
        {catalogueSpecs(instance.definitionId).map((spec) => { const [k, ...v] = spec.split(" "); return [<dt key={`${k}-t`}>{k}</dt>, <dd key={`${k}-d`}>{v.join(" ")}</dd>]; })}
        <dt>Owned zones</dt><dd className="s3d-mono">{zones.join(", ") || "none"}</dd>
        <dt>Contents</dt>
        <dd>{style && instance.contents.kind !== "empty" ? <span className="s3d-swatch" style={{ background: style.fill }} aria-hidden="true" /> : null}{formatContentLabel(instance.contents)}</dd>
      </dl>
      {!authored ? <div className="s3d-note">Added by the runtime because the draft requires it. Placing it adds it to the starting setup.</div> : null}
      <section className="s3d-ins-sec">
        <div className="s3d-ins-sec__head is-static">Placement</div>
        <div className="s3d-nudge">
          <div className="s3d-nudge__pad">
            <span />{pad("up", 0, 10, "Move 10 mm back")}<span />
            {pad("arrow", -10, 0, "Move 10 mm left", true)}<span className="s3d-nudge__centre"><Icon name="move" /></span>{pad("arrow", 10, 0, "Move 10 mm right")}
            <span />{pad("chev", 0, -10, "Move 10 mm forward")}<span />
          </div>
          <span className="s3d-small">Arrows move 10 mm; Shift moves 50 mm.</span>
        </div>
      </section>
      <div className="s3d-row">
        <button type="button" className="s3d-button" disabled={disabled || instance.location === "shelf"} onClick={onToShelf}><Icon name="tray" />Return to shelf</button>
        <button type="button" className="s3d-button s3d-button--danger-quiet" disabled={disabled} onClick={onRemove}>Remove</button>
      </div>
      <div className="s3d-note"><b>Positions note.</b> Positions are stored in the units the 2D player uses, so this draft still plays there.</div>
      <div className="s3d-note">Contents are edited in the original Studio's inspector fields.</div>
    </>
  );
};

export const BenchInventory = ({ studio }: { studio: Studio3DController }) => {
  const state = useMemo(() => { try { return startingState(studio.draft); } catch { return undefined; } }, [studio.draft]);
  if (!state) return <p className="s3d-small">The starting setup cannot be read yet.</p>;
  const group = (title: string, items: EquipmentInstance[]) => (
    <>
      <div className="s3d-eyebrow">{title} · {items.length}</div>
      <ul className="s3d-eq-list">
        {items.map((i) => (
          <li key={i.id}><button type="button" className="s3d-eq-list__button" onClick={() => studio.setSelection({ kind: "equipment", id: i.id })}>
            <Thumbnail definitionId={i.definitionId} size={28} /><span>{i.label}</span><span className="s3d-mono s3d-small">{i.id}</span>
          </button></li>
        ))}
      </ul>
    </>
  );
  return (
    <>
      {group("On the bench", state.equipmentInstances.filter((i) => i.location === "workbench" || i.location === "snapZone"))}
      {group("On the shelf", state.equipmentInstances.filter((i) => i.location === "shelf"))}
      <div className="s3d-note"><b>Positions note.</b> Positions are stored in the units the 2D player uses, so this draft still plays there.</div>
    </>
  );
};

/** Moves of a starting item from the inspector's nudge pad, in bench millimetres. */
export const nudgeStartingItem = (studio: Studio3DController, instanceId: string, dxMm: number, dyMm: number) => {
  const state = startingState(studio.draft);
  const instance = studio.draft.initialState?.equipment.find((i) => i.id === instanceId) ?? state.equipmentInstances.find((i) => i.id === instanceId);
  const at = runtimeBenchPointsMm(state).get(instanceId);
  if (!instance || !at) return;
  const point = fromBench(instance.definitionId, at.xMm + dxMm, at.yMm + dyMm);
  studio.commit(`Move ${instance.label}`, [{ type: "upsertInitialEquipment", instance: { ...instance, location: "workbench", x: point.x, y: point.y } }]);
};

export const returnStartingItemToShelf = (studio: Studio3DController, instanceId: string) => {
  const instance = studio.draft.initialState?.equipment.find((i) => i.id === instanceId) ?? startingState(studio.draft).equipmentInstances.find((i) => i.id === instanceId);
  if (!instance) return;
  const next: EquipmentInstance = { ...instance, location: "shelf" };
  delete next.x; delete next.y; delete next.snapZoneId;
  studio.commit(`Return ${instance.label} to the shelf`, [{ type: "upsertInitialEquipment", instance: next }]);
};
