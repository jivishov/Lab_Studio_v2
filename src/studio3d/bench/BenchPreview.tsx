import { useEffect, useMemo, useState } from "react";
import { loadBundledTechnique } from "../../data/loadBundledTechniques";
import type { RuntimeState, TechniqueDefinition } from "../../domain/types";
import { createRuntimeState, performRuntimeAction } from "../../runtime";
import { runtimeToScene } from "../adapters/runtimeToScene";
import { studio3DFallbackHash } from "../routes3d";
import { BenchView } from "./BenchView";

/**
 * M3 bench preview for `#/3d/technique/:id`: the technique's real runtime state, with every tray
 * item free-moved onto the bench through the runtime's own `place` + `benchMove` path, so the look
 * layer, models, contents and displays can be checked. Player3D (M5) replaces this view.
 */
const withTrayOnBench = (definition: TechniqueDefinition): RuntimeState => {
  let state = createRuntimeState(definition);
  const shelved = state.equipmentInstances.filter((instance) => instance.location === "shelf");
  shelved.forEach((instance, index) => {
    state = performRuntimeAction(definition, state, {
      verb: "place",
      sourceInstanceId: instance.id,
      location: "workbench",
      parameters: { benchMove: true, x: 34 + (index % 5) * 148, y: 86 + Math.floor(index / 5) * 160, zIndex: index + 1 },
    });
  });
  return state;
};

export const BenchPreview = ({ techniqueId }: { techniqueId: string }) => {
  const [definition, setDefinition] = useState<TechniqueDefinition>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    loadBundledTechnique(techniqueId).then(setDefinition, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [techniqueId]);
  const scene = useMemo(() => (definition ? runtimeToScene(withTrayOnBench(definition), definition) : undefined), [definition]);
  const options = useMemo(() => ({ quality: "high" as const, reducedMotion: false }), []);
  const fallbackHash = studio3DFallbackHash({ view: "technique", techniqueId });
  if (error) return <main className="route-status"><h1>Bench preview</h1><p>{error}</p></main>;
  if (!scene || !definition) return <main className="route-status"><p>Preparing the bench…</p></main>;
  return (
    <div className="s3d-preview">
      <BenchView
        scene={scene}
        options={options}
        onSynced={(engine) => engine.frameItems("all", 1.3)}
        label={`3D bench for ${definition.title}. Use the Bench list to reach every item.`}
        fallback={<main className="route-status"><p>This browser cannot draw the 3D bench.</p><a href={fallbackHash}>Open the 2D version</a></main>}
      />
      <div className="s3d-preview__tag">Bench preview (M3) · {definition.title} · {scene.bench.length} items · missing models: {scene.missingModels.length}</div>
    </div>
  );
};
