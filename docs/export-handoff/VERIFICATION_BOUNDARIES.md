# Verification boundaries

The export evidence covers packaging integrity only:

- authoritative source path, parent Git root, branch, HEAD, and dirty-worktree provenance;
- source-before/source-after SHA-256 manifests with relative paths and byte sizes;
- targeted copy retries for source files that changed while copying;
- destination byte parity for all selected files except the intentional README/AGENTS adaptations;
- required entrypoints, catalogs, equipment assets, open-chamber assets, MediaPipe models, and WASM presence;
- absence of selected out-of-scope paths, symlinks/reparse points, files over GitHub's 100 MB per-file limit, and targeted credential/token patterns.

The package was not installed, executed, built, typechecked, semantically validated, content-checked, generated, tested, browser-tested, performance-tested, deployed, or human/scientifically validated during export. Existing reports or README statements about earlier runs remain historical evidence and are not refreshed by this repository creation.

One held 4DGS trial displays the optional path `assets/equipment-splats/bunsen-burner-v1/manifest.json` from `src/trials/BunsenBurner4dgsTrial.tsx`, but that manifest is absent in the live source and the trial uses its documented realistic SVG fallback. The old experiment datasets that are not runtime inputs were excluded; this was recorded as a source limitation rather than reconstructed.

The open-chamber art was copied unchanged. No SVG-wrapper semantics, composite rendering, or browser-scale asset validation was performed during packaging.

The catalog scope currently describes 17 indexed labs and 42 indexed techniques. Those counts describe included catalog breadth only; they are not a readiness verdict. The future repair worker should keep source inspection, authorized technical verification, classroom/scientific judgment, and release acceptance as separate evidence layers.

The independent repair review and its paste-ready repair prompt are deliberately outside this export because the user will supply the review directly to the future web ChatGPT worker using GPT-5.6 Terra with Max reasoning.
