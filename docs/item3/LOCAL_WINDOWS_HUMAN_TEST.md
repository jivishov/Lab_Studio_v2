# Item 3 local Windows human-test build

This package is a versioned production build for bounded local human testing. It is not a classroom, scientific, hardware, deployment, or release certification.

## Build the package

From a clean Item 3 checkout with dependencies prepared:

```powershell
node scripts/buildItem3HumanTest.mjs
```

The script keeps the TypeScript step in `npm run build` (`tsc -b && vite build`), records the exact source commit, records the resolved direct dependency versions, and writes the first package to:

`C:\Users\EmilJivishov\Projects\Lab_studio\local-builds\item3-human-test`

If that directory is already populated, a versioned sibling is created instead of overwriting it.

## Launch and stop

From the delivered package directory:

- Double-click `launch-lab-studio.bat`.
- The launcher starts the built output through the package-local Node static server and opens `http://127.0.0.1:4180/`.
- Double-click `stop-lab-studio.bat` to stop only the preview owned by that package.
- Port 4180 is fixed. A different service or build on that port is reported and left running.
- `logs\preview.log` records start, reuse, conflict, and stop events.

`launch-lab-studio-dev.bat` and `npm run dev` remain available for development work on port 5175; they are not the human-test artifact.

## Starting checklist

1. Confirm the visible build identifier and source commit in the top navigation.
2. Open Labs and Techniques and confirm the bundled catalogs load without a blocking overlay.
3. Exercise teacher setup and approval before previewing an unapproved configured technique.
4. Exercise Paper Chromatography closure/refusal/reopen/reset behavior.
5. Exercise both Green Chemistry tare conventions and the qualitative heated-product recovery boundary.
6. Exercise Quick Ache progression, refusal/recovery, and reset behavior.
7. Use pointer and keyboard controls through the normal Student Player paths.

The package `_lab-studio-build.json` is the machine-readable build identity. Its artifact hash covers the static application payload, packaged server, and launchers; the README, build record, and runtime logs are explicitly outside that non-circular payload hash.
