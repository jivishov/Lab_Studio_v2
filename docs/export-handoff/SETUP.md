# Setup and repair checkout notes

## Local setup

The application is a client-side React and TypeScript Vite app with optional local Node services.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5175/#/studio` for Lab Design Studio. The Windows helper `launch-lab-studio.bat` starts the development server with the local Assay Studio and Causalyst feature flags.

Useful routes include:

- `#/studio` — Lab Design Studio.
- `#/labs` — bundled lab catalog.
- `#/techniques` — bundled technique catalog.
- `#/play/acid-base-titration` — reference titration lab.
- `#/play/hard-water-demo` and `#/play/intro-filtration-demo` — reference labs.

The gesture-control runtime uses the bundled MediaPipe model and WASM files under `public/mediapipe/`. Camera input is optional; pointer, keyboard, and accessible controls remain the normal interaction paths.

## Optional services and commands

The package scripts also expose the local assistant, MCP server, learning server, capability/content checks, and the existing test/build commands. Their source/configuration is retained for later repair work. A package manager lockfile was not present in the source snapshot, so dependency installation is not reproducible to a recorded lock revision.

The repository validation policy permits only source review, basic static checks, and basic linting during the current packaging stage. Do not run detailed tests, full suites, application runtime probes, generators, builds, browser/E2E matrices, performance checks, or release pipelines without later explicit authorization.

## Initial repository boundary

The initial private repository contains no automatic GitHub Actions or Pages workflow. Deployment and CI setup are intentionally deferred. Do not infer a successful build, deployed behavior, or human-validation readiness from the presence of this source package.
