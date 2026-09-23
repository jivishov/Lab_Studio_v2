import { studio3DFallbackHash, type Studio3DRoute } from "./routes3d";

const viewTitles: Record<Studio3DRoute["view"], string> = {
  home: "Lab Studio 3D",
  studio: "Studio 3D",
  technique: "Technique in 3D",
  play: "Experiment in 3D",
};

/**
 * Entry point of the additive Lab Studio 3D app (plan §4.2), mounted by the shell only while
 * `studio3dV1` is on. The Studio 3D and Player3D layouts are built after the M0 mock-ups are
 * approved (plan §5, §7), so for now each route says what it will host and links to the
 * existing 2D route for the same content.
 */
export const Studio3DApp = ({ route }: { route: Studio3DRoute }) => {
  const subject =
    route.view === "technique" ? route.techniqueId : route.view === "play" ? route.labId : undefined;
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
