import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SceneDescription } from "../adapters/runtimeToScene";
import { BenchEngine, webgl2Available, type BenchEngineOptions } from "./BenchEngine";

/**
 * Thin React wrapper around BenchEngine (plan D5): it owns the canvas, creates the engine once,
 * and syncs it whenever the scene description changes. Everything the learner can do here can
 * also be done without the canvas, from the step card and the Bench list (G-6).
 */
export interface BenchViewProps {
  scene: SceneDescription;
  options: BenchEngineOptions;
  label: string;
  /** Rendered instead of the canvas when WebGL 2 is unavailable (plan D3: navigate, never import 2D). */
  fallback: ReactNode;
  onEngine?: (engine: BenchEngine | undefined) => void;
  /** Called after each sync has drawn every item (models loaded). */
  onSynced?: (engine: BenchEngine) => void;
  children?: ReactNode;
}

export const BenchView = ({ scene, options, label, fallback, onEngine, onSynced, children }: BenchViewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BenchEngine | undefined>(undefined);
  const [supported] = useState(webgl2Available);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!supported || !canvasRef.current) return undefined;
    let engine: BenchEngine;
    try {
      engine = new BenchEngine(canvasRef.current, options);
    } catch {
      setFailed(true);
      return undefined;
    }
    engineRef.current = engine;
    onEngine?.(engine);
    const observer = new ResizeObserver(() => engine.resize());
    observer.observe(canvasRef.current);
    return () => {
      observer.disconnect();
      onEngine?.(undefined);
      engine.dispose();
      engineRef.current = undefined;
    };
    // The engine is created once per mount; option changes go through setOptions below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  useEffect(() => {
    engineRef.current?.setOptions(options);
  }, [options]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    void engine.sync(scene).then(() => onSynced?.(engine));
    // onSynced is read at sync time; re-syncing only follows the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  if (!supported || failed) return <>{fallback}</>;
  return (
    <div className="bench3d">
      {/* Focusable and driven by keys (arrows, Enter, E, S, T...), so it is an application region,
          not an image; items are named through the Bench list (handoff §8). */}
      <canvas ref={canvasRef} className="bench3d__canvas" aria-label={label} aria-roledescription="3D bench" role="application" tabIndex={0} />
      {children}
    </div>
  );
};
