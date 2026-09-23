import { BenchPreview } from "./bench/BenchPreview";
import { studio3DFallbackHash, type Studio3DRoute } from "./routes3d";
import "./styles/studio3d.css";

const viewTitles: Record<Studio3DRoute["view"], string> = {
  home: "Lab Studio 3D",
  studio: "Studio 3D",
  technique: "Technique in 3D",
  play: "Experiment in 3D",
};

/**
 * Entry point of the additive Lab Studio 3D app (plan §4.2), mounted by the shell only while
 * `studio3dV1` is on. `#/3d/technique/:id` shows the M3 bench preview; Player3D (M5) and Studio 3D
 * (M6) replace the remaining placeholders, each linking to the existing 2D route meanwhile.
 */
export const Studio3DApp = ({ route }: { route: Studio3DRoute }) => {
  if (route.view === "technique") {
    return (
      <div className="s3d">
        <BenchPreview techniqueId={route.techniqueId} />
      </div>
    );
  }
  const subject = route.view === "play" ? route.labId : undefined;
  return (
    <main className="route-status" data-studio3d-view={route.view}>
      <h1>{viewTitles[route.view]}</h1>
      {subject ? <p><code>{subject}</code></p> : null}
      <p>Lab Studio 3D is in development. This route does not run anything yet.</p>
      <p>
        <a href={studio3DFallbackHash(route)}>Open the 2D version</a>
      </p>
    </main>
  );
};
