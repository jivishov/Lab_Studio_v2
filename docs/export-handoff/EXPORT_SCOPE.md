# Export scope

## Included

- Live `src/`, `server/`, and `public/` runtime/application content.
- `public/` catalogs, realistic equipment assets, MediaPipe models/WASM, and supporting manifests.
- `scripts/`, generator inputs, focused tests/fixtures, Playwright tests/configuration, and build/dev configuration.
- Focused project documentation and the package's entrypoint/helper files.
- An export-adapted root `AGENTS.md` and `README.md`, with the source README preserved alongside this handoff.

## Excluded

- `.git`, `node_modules`, `dist/`, `dist-server/`, `build/`, caches, test results, temporary workers/evidence, local agent settings, screenshots, archives, and generated TypeScript/Vite witnesses.
- Historical planning/evidence dumps and old experiment datasets that are not required by the runtime or build entrypoints.
- The existing `.github/workflows/pages.yml`, so the initial private push cannot trigger deployment or forbidden checks.
- Credentials and environment files. No source lockfile existed, and no lockfile was generated.

Optional historic scripts that refer to excluded evidence remain present when they are part of the retained script surface; their missing historical inputs are a documented limitation, not silently reconstructed data.
