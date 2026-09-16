# Publishing Lab Studio On GitHub Pages

Lab Studio builds to static files with relative asset paths and hash routes.

## Build

```bash
npm install
npm run typecheck
npm test
npm run build
```

The production output is `dist/`.

## Add A Bundled Lab

1. Create or edit a lab in `#/studio`.
2. Export the draft as `.lab.json`.
3. Add the JSON file under `public/labs/`.
4. Add a summary entry to `public/labs/index.json` with matching `id` and `file`.
5. Confirm required equipment, diagram layout, interaction specs, validation rules, and accessible labels are complete in Lab Design Studio.
6. Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run smoke:e2e`.
7. Deploy the generated `dist/` folder.
8. Share the catalog URL as `https://<owner>.github.io/<repo>/#/labs` or the direct player URL as `https://<owner>.github.io/<repo>/#/play/<lab-id>`.

## Add A Bundled Technique

1. Add a valid `TechniqueDefinition` JSON file under `public/techniques/`.
2. Add a summary entry to `public/techniques/index.json` with matching `id` and `file`.
3. Add or reference a matching TypeScript fixture only when tests need seed data; routed app navigation loads public JSON first.
4. Confirm each physical action either has an explicit `interaction` spec or can safely use the legacy default inferred from its action verb.
5. Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run smoke:e2e`.

## Runtime Loading Contract

The app loads `public/labs/index.json` for `#/labs` and `public/techniques/index.json` for `#/techniques`, then fetches the referenced JSON file for `#/play/:labId` or `#/technique/:techniqueId`. The loaded definition must validate and its internal `id` must match the index entry. TypeScript fixtures are fallback seed data for tests and local resilience, not the publishing source of truth.

Interaction specs and optional process layout metadata are part of the published contract. They must stay serializable, reference only known equipment or station ids, include accessible labels where required, and avoid runtime-only data such as local file paths, hashes, or provider file handles.

## GitHub Pages Workflow

The included workflow builds on pushes to `main` and publishes `dist/` through the Pages artifact flow. Hash routing means direct links such as `#/studio`, `#/labs`, `#/techniques`, `#/play/hard-water-demo`, `#/play/acid-base-titration`, and `#/technique/filtration` work without server-side rewrite rules.
