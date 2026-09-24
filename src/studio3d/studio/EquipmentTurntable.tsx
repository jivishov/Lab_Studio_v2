import { useEffect, useMemo, useState } from "react";
import { v1InteractionZones } from "../../domain/interactionZones";
import { equipmentById } from "../../equipment/catalog";
import type { SceneDescription } from "../adapters/runtimeToScene";
import type { BenchEngine } from "../bench/BenchEngine";
import { BenchView } from "../bench/BenchView";
import { catalogueSpecs } from "../player/panels";
import { Thumbnail } from "./LibraryPanel";
import { startingScene } from "./BenchSetupView";
import type { Studio3DController } from "./useStudio3DDraft";

/**
 * Equipment inspection (handoff §4.8): the model on a turntable with its starting contents, its
 * zones and capacities, and where it came from (Blender version and generator). Presentation
 * only; nothing here edits the draft.
 */
export const EquipmentTurntable = ({ studio, instanceId }: { studio: Studio3DController; instanceId: string }) => {
  const [engine, setEngine] = useState<BenchEngine>();
  const item = useMemo(() => {
    try { return startingScene(studio.draft).scene.bench.find((i) => i.instanceId === instanceId); } catch { return undefined; }
  }, [instanceId, studio.draft]);
  const scene = useMemo<SceneDescription | undefined>(() => (item
    ? { bench: [{ ...item, placement: { kind: "bench", point: { xMm: 0, yMm: 0, yawDeg: 0 } } }], tray: [], hidden: [], missingModels: [] }
    : undefined), [item]);
  const options = useMemo(() => ({ quality: "balanced" as const, reducedMotion: Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) }), []);
  useEffect(() => {
    if (!engine || !item) return undefined;
    let active = true;
    void engine.settled().then(() => {
      if (!active) return;
      engine.frameItems([item.instanceId], 1.5, {});
      engine.setTurntable(true);
    });
    return () => { active = false; engine.setTurntable(false); };
  }, [engine, item]);
  const definitionId = item?.definitionId ?? studio.draft.initialState?.equipment.find((i) => i.id === instanceId)?.definitionId;
  const definition = definitionId ? equipmentById.get(definitionId) : undefined;
  const zones = v1InteractionZones.filter((z) => z.ownerDefinitionId === definitionId);
  const entry = item?.model;
  return (
    <div className="s3d-turntable">
      <div className="s3d-turntable__view">
        {scene && entry ? (
          <BenchView scene={scene} options={options} onEngine={setEngine} label={`${item?.label ?? "Equipment"} on a turntable`}
            fallback={<Thumbnail definitionId={definitionId} size={180} />} />
        ) : <Thumbnail definitionId={definitionId} size={180} />}
      </div>
      <dl className="s3d-kv">
        <dt>Definition</dt><dd className="s3d-mono">{definitionId ?? "—"}</dd>
        {definitionId ? catalogueSpecs(definitionId).map((spec) => { const [k, ...v] = spec.split(" "); return [<dt key={`${k}-t`}>{k}</dt>, <dd key={`${k}-d`}>{v.join(" ")}</dd>]; }) : null}
        <dt>Category</dt><dd>{definition?.category ?? "—"}</dd>
        <dt>Zones</dt><dd>{zones.length ? zones.map((z) => <div key={z.id}><span className="s3d-mono">{z.id}</span> <span className="s3d-small">accepts {z.accepts.map((id) => equipmentById.get(id)?.label ?? id).join(", ")}</span></div>) : "none"}</dd>
        <dt>Contents</dt><dd>{item?.contentsText ?? "—"}</dd>
        <dt>Model</dt><dd>{entry ? <>Blender <span className="s3d-mono">{entry.provenance.blender}</span><br /><span className="s3d-mono s3d-small">{entry.provenance.generator}</span></> : "No 3D model: 2D only"}</dd>
      </dl>
    </div>
  );
};
