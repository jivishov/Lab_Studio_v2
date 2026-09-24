import { Technique3DRoute } from "./player/Technique3DRoute";
import { studio3DFallbackHash, type Studio3DRoute } from "./routes3d";
import { Studio3D } from "./studio/Studio3D";
import "./styles/studio3d.css";
import "./styles/studio3d-studio.css";

const viewTitles: Record<Studio3DRoute["view"], string> = {
  home: "Lab Studio 3D",
  studio: "Studio 3D",
  technique: "Technique in 3D",
  play: "Experiment in 3D",
};

/**
 * Entry point of the additive Lab Studio 3D app (plan §4.2), mounted by the shell only while
 * `studio3dV1` is on. `#/3d/technique/:id` runs Player3D and `#/3d/studio` runs Studio 3D (M6);
 * experiments (Phase B) replace the remaining placeholders, linking to the 2D route meanwhile.
 */
export const Studio3DApp = ({ route }: { route: Studio3DRoute }) => {
  if (route.view === "studio") {
    return (
      <div className="s3d">
        <Studio3D />
      </div>
    );
  }
  if (route.view === "technique") {
    return (
      <div className="s3d">
        <Technique3DRoute techniqueId={route.techniqueId} />
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
