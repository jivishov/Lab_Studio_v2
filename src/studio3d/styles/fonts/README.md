# Bundled fonts (decision U1)

| File | Face | Version | Weights | SHA-256 |
|---|---|---|---|---|
| `ibm-plex-sans-var.woff2` | IBM Plex Sans, variable | 3.201 | `wght` 100–700 (400, 500 and 600 used) | `e2291e842cf5af167122a22881a740c7f2dda7716f1e8cd76680264f4a859470` |
| `ibm-plex-mono-400.woff2` | IBM Plex Mono Regular | 2.3 | 400 | `08949f728dc52d528e69b1667d15c89a5686a4ee9a296ff90983985f99c380f7` |
| `ibm-plex-mono-500.woff2` | IBM Plex Mono Medium | 2.3 | 500 | `01d285447409c8a588692162439a038b8cbd7871309ee20267b0d2d91c6e8e22` |

- **Source.** Copied unchanged from `virtual_lab\experiments\dna-microarray-3d\assets\fonts\`: `plex-sans-400.woff2`, `plex-mono-400.woff2` and `plex-mono-500.woff2`. That project ships the same variable Sans file three times, as `plex-sans-400`, `plex-sans-500` and `plex-sans-600`, with identical hashes. Here it is bundled once and declared as a weight range.
- **Licence.** SIL Open Font License 1.1, as each file's name table declares (license URL `http://scripts.sil.org/OFL`). `OFL.txt` travels with the files, as the licence requires. The licence text was copied from `three/examples/fonts/MPLUSRounded1c/OFL.txt`, and the copyright lines were taken from the fonts' own name tables. Checked on 2026-09-23 (plan §6.3).
- **Subset.** Both faces are Latin subsets of 270–280 glyphs. The Sans subset has thin space (U+2009), `·`, `…`, `×`, `−`, `°`, `±` and `µ`. The Mono subset has **no thin space**, so the space between a value and its unit must be set in the Sans face. Neither subset has ✓, ✕, →, ▾ or ▸; those marks are SVG stroke icons (handoff §3.6), never glyphs.
