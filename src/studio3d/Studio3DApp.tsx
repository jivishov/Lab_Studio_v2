import { Lab3DRoute } from "./player/Lab3DRoute";
import { Technique3DRoute } from "./player/Technique3DRoute";
import { studio3DFallbackHash, type Studio3DRoute } from "./routes3d";
import { Studio3D } from "./studio/Studio3D";
import { useStudio3DTheme } from "./ui/theme";
import "./styles/studio3d.css";
import "./styles/studio3d-studio.css";
// The HUD theme last, so it wins a tie with the light rules (hud.css).
import "./styles/hud.css";

const viewTitles: Record<Studio3DRoute["view"], string> = {
  home: "Lab Studio 3D",
  studio: "Studio 3D",
  technique: "Technique in 3D",
  play: "Experiment in 3D",
};

/**
 * Entry point of the additive Lab Studio 3D app (plan §4.2), mounted by the shell only while
 * `studio3dV1` is on. `#/3d/technique/:id` runs Player3D, `#/3d/studio` runs Studio 3D (M6), and
 * `#/3d/play/:labId` runs a 3D experiment from `public/labs-3d/` (D8, 2026-10-10). The home view
 * remains a placeholder, linking to the 2D route. Each root carries the theme, Light or HUD (ui/theme.ts).
 */
export const Studio3DApp = ({ route }: { route: Studio3DRoute }) => {
  const [theme] = useStudio3DTheme();
  if (route.view === "studio") {
    return (
      <div className="s3d" data-theme={theme}>
        <Studio3D />
      </div>
    );
  }
  if (route.view === "technique") {
    return (
      <div className="s3d" data-theme={theme}>
        <Technique3DRoute key={route.techniqueId} techniqueId={route.techniqueId} />
      </div>
    );
  }
  if (route.view === "play") {
    return (
      <div className="s3d" data-theme={theme}>
        <Lab3DRoute key={route.labId} labId={route.labId} />
      </div>
    );
  }
  return (
    <main className="route-status" data-studio3d-view={route.view}>
      <h1>{viewTitles[route.view]}</h1>
      <p>Lab Studio 3D is in development. This route does not run anything yet.</p>
      <p>
        <a href={studio3DFallbackHash(route)}>Open the 2D version</a>
      </p>
    </main>
  );
};
