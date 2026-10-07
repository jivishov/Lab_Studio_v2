# Publish Lab Studio 3D to GitHub Pages (runtime files only)

**For:** an LLM agent working on this Windows machine, with Git Bash, Node and npm.
**Written:** 2026-10-06, and reviewed the same day. A dry run (see "Dry run" at the end) ran steps 1 to 7 exactly as written, up to a commit on a throwaway branch, without pushing. Step 8 can only run after the real push.

**Prompt to give the agent:**
> Publish Lab Studio 3D to GitHub Pages by following
> `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d\planning\2026-09-23_lab-studio-3d\PAGES_3D_PUBLISH.md`
> exactly. Ask me the one question in step 1 before you start.

## 0. What, where, and what not

- **Source:** the Lab_studio worktree `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`, branch `claude/lab-studio-3d`.
  - At writing, its head is the commit adding this file. The last change to anything in the build is `da88230` ("Print the approximate scale on the 150 mL beaker too").
  - Build from the head you find, and record its SHA.
  - The source is **read-only** here: no edits, no commits, no push of this branch, no `git stash` of any kind.
- **Destination:** the GitHub repo `jivishov/virtual_lab`, branch `main`, folder `experiments/<DEST>/`.
  - The repo is served by GitHub Pages from `main` (no Actions workflow), with the custom domain in its `CNAME`, `virtuallab.az`.
  - The published URL is `https://virtuallab.az/experiments/<DEST>/`.
- **Runtime files only:** only the Vite production build goes to the destination. That means `index.html`, the hashed `assets/`, and the copied `public/` folders.
  - No source, `planning/`, `tools/`, `scripts/`, tests, `node_modules`, `.claude/` or docs.
- **Separate from the 2D version:** the 2D Lab Studio is already published at `experiments/lab-studio/`. **Do not touch it**, or any other folder outside `experiments/<DEST>/`.

## 1. The folder name, and the settings file

**Ask the user to choose the folder name.**
- The user suggested `lab-studio-3D`.
- GitHub Pages URLs are case-sensitive, so the link must then be typed with the capital D.
- Every existing folder under `experiments/` is lowercase: `lab-studio`, `dnamicroarray_v2`, `elisa_assay`, and so on.
- **Recommend `lab-studio-3d`.**

Then write the settings every later block reads, with the chosen name in its first line. Each command block below starts by sourcing this file, because an agent's shell often does not keep variables from one command to the next.

```bash
cat > /c/Users/EmilJivishov/AppData/Local/Temp/lab-studio-3d-pages.sh <<'EOF'
DEST=lab-studio-3d                                    # the folder name the user chose, exactly
SRC=/c/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d
STAGE=C:/Users/EmilJivishov/AppData/Local/Temp/lab-studio-3d-pages
SITE="$STAGE/experiments/$DEST"
VL=/c/Users/EmilJivishov/Projects/virtual_lab
WT=C:/Users/EmilJivishov/AppData/Local/Temp/virtual_lab-pages-3d
BRANCH=publish/lab-studio-3d
export NODE_PATH=C:/Users/EmilJivishov/Projects/Lab_studio/node_modules   # Playwright for step 5
EOF
```

Keep these paths short. Windows' 260-character path limit broke `git hash-object` on this build under a long temporary folder.

## 2. Preflight in the source (read-only)

```bash
source /c/Users/EmilJivishov/AppData/Local/Temp/lab-studio-3d-pages.sh
cd "$SRC"
git status --short                         # must print nothing
git log -1 --format='%h %s'                # record this SHA
node scripts/practice3d/build.mjs --check  # the 3D practice files are current (exit 0)
npx tsc -p tsconfig.app.json --noEmit      # exit 0
npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d   # 23 files, 239 tests, all passing
```

Use `--maxWorkers=3`. On this machine the default worker count times out starting its workers; that is not a test failure.

If any check fails, stop and report. Don't fix anything in the source.

## 3. Build into a staging folder

Build outside both repos, into a layout that mirrors the site, so the build can be checked from the same subpath Pages will serve.

```bash
source /c/Users/EmilJivishov/AppData/Local/Temp/lab-studio-3d-pages.sh
cd "$SRC"
rm -rf "$STAGE"
VITE_STUDIO_3D_V1=true \
VITE_LAB_STUDIO_BUILD_ID="pages-3d-$(date +%Y%m%d)" \
VITE_LAB_STUDIO_BUILD_SOURCE_COMMIT="$(git rev-parse --short HEAD)" \
VITE_LAB_STUDIO_BUILD_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
VITE_LAB_STUDIO_BUILD_FEATURE_PROFILE="pages-3d" \
npx vite build --outDir "$SITE" --emptyOutDir
test -f "$SITE/techniques-3d/index.json" && test -f "$SITE/assets/equipment-3d/v1/beaker-250ml.glb" && echo "3D content present"
find "$SITE" \( -name '_*' -o -name '.*' \) -print   # must print nothing
du -sh "$SITE"; find "$SITE" -type f | wc -l          # about 223 MB, about 547 files
```

**The flags:**
- `VITE_STUDIO_3D_V1=true` is required. Without it the 3D routes are not enabled in the bundle.
- The worktree's `.env.development.local` sets it only for the dev server; a production build doesn't read that file.
- Leave every other `VITE_*` feature flag unset (Assay, Causalyst, Studio core). They default to off.
- The `VITE_LAB_STUDIO_BUILD_*` values are provenance only.

**How to build:**
- **Don't use `npm run build`.** It runs `tsc -b` first, which also builds the server, MCP and learning projects; they aren't needed here.
- `vite.config.ts` already sets `base: "./"`, so every asset path is relative and the build works from any subfolder. Routes are hash routes (`#/...`), so no server rewrites are needed.

**What the build holds:**
- **Top level:** `index.html`, `favicon.svg`, `assets/`, `assay-profiles/`, `assays/`, `capabilities/`, `labs/`, `mediapipe/`, `techniques/`, `techniques-3d/`.
- **`assets/`:** the hashed JS, CSS and fonts; the hand-tracking WASM (`vision_wasm_module_internal-*.wasm`); and the copied `equipment/`, `equipment-3d/`, `equipment-realistic/`, `equipment-splats/` and `goblin-mode/`.
- **Largest file:** about 11.8 MB, far under GitHub's 100 MB per-file limit.

**Why the `find` check must print nothing:** the repo has no `.nojekyll`, so Pages runs Jekyll, which silently drops any file or folder whose name starts with `_` or `.`. If one appears, stop and ask the user: adding `.nojekyll` at the repo root would change the whole site.

**Keep the whole build, including the 2D art.** The 3D bundle contains the 2D shell, and its "Open the 2D version" links open the 2D player inside this deployment, which needs that art.
- **Repository size:** most files are byte-identical to ones already in virtual_lab (323 of 547 files, 184 MB), and Git stores those once. Only about 224 files (37 MB) are new to the repository.
- **Site size:** it goes from about 263 MB to about 486 MB, within GitHub Pages' 1 GB limit.

## 4. The one post-build edit: land on the 3D player

The bundle is the whole Lab Studio app. Its root (`#/`) shows the 2D home, and `#/3d` is only a placeholder, so `index.html` gets a redirect to the first 3D technique (Weigh a Solid), whose title menu switches between all the 3D techniques. The title also becomes "Lab Studio 3D".

```bash
source /c/Users/EmilJivishov/AppData/Local/Temp/lab-studio-3d-pages.sh
node -e '
const fs = require("fs"); const f = process.argv[1]; let s = fs.readFileSync(f, "utf8");
if (s.includes("location.replace")) throw new Error("already edited");
const tag = "<script>if(!location.hash||location.hash===\"#\"||location.hash===\"#/\")location.replace(\"#/3d/technique/weighing\");</script>\n    ";
const at = s.indexOf("<script type=\"module\"");
if (at < 0) throw new Error("module script not found");
s = s.slice(0, at) + tag + s.slice(at);
s = s.replace("<title>Lab Studio</title>", "<title>Lab Studio 3D</title>");
fs.writeFileSync(f, s);
console.log("index.html edited");' "$SITE/index.html"
```

Make no other edits to the build.

## 5. Check the staged build from its subpath

Serve `$STAGE`, so the build is at `/experiments/<DEST>/` exactly as on Pages, with a minimal static server (no rewrites, like Pages). Write the server and the check:

```bash
source /c/Users/EmilJivishov/AppData/Local/Temp/lab-studio-3d-pages.sh
cat > "$STAGE/serve.cjs" <<'EOF'
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.resolve(process.argv[2]), port = Number(process.argv[3] || 5199);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".woff2": "font/woff2" };
http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("404"); }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" }); res.end(data);
  });
}).listen(port, "127.0.0.1", () => console.log("serving " + root + " on " + port));
EOF
cat > "$STAGE/check.cjs" <<'EOF'
const { chromium } = require("playwright");
const base = process.argv[2];   // the folder URL, ending in "/"
const routes = ["", "#/3d/studio", ...["weighing", "measuring-volume", "making-solution", "dilution", "transmittance-dilution",
  "transfer-practice", "hard-water-precipitation-practice", "filtration-practice", "drying-practice",
  "thermal-decomposition-mass-loss-practice"].map((id) => "#/3d/technique/" + id)];
// Software rendering (SwiftShader) is slow: open every page at the player's Low quality, as a viewer could choose.
const lowQuality = () => { try { localStorage.setItem("lab-studio:3d:v1:player-ui", JSON.stringify({ quality: "low", beacon: true })); } catch {} };
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  let failures = 0;
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(lowQuality);
    const bad = [];
    page.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url()); });
    page.on("requestfailed", (r) => bad.push("failed " + r.url()));
    page.on("pageerror", (e) => bad.push("pageerror " + e));
    page.on("console", (m) => { if (m.type() === "error") bad.push("console " + m.text()); });
    await page.goto(base + route);
    await page.waitForTimeout(8000);
    const hash = await page.evaluate(() => location.hash);
    const ok = bad.length === 0 && (route !== "" || hash === "#/3d/technique/weighing");
    if (!ok) failures += 1;
    console.log((ok ? "OK   " : "FAIL ") + (route || "(bare URL)") + " -> " + hash + (bad.length ? " " + JSON.stringify(bad.slice(0, 5)) : ""));
    await page.close();
  }
  // One bench with models: Dry and Weigh, its setup saved, its step card showing.
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(lowQuality);
  await page.goto(base + "#/3d/technique/drying-practice");
  await page.waitForTimeout(5000);
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll("button")].find((b) => /Next: setup|Start/.test(b.textContent.trim()))?.click(); await sleep(800);
    for (const [id, v] of Object.entries({ precipitateMassG: "0.15", paperMassG: "0.552", watchGlassMassG: "30", firstDryingMinutes: "12" })) {
      const el = document.getElementById("s3d-slot-" + id); if (!el) continue;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const box = document.querySelector('input[type="checkbox"]'); if (box && !box.checked) box.click(); await sleep(200);
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Save setup and start")?.click();
  });
  await page.waitForTimeout(10000);
  const step = await page.evaluate(() => document.querySelector(".s3d-step__title")?.textContent ?? "no step card");
  await page.screenshot({ path: process.argv[3], timeout: 120000 });
  if (step !== "Note the paper's mass") failures += 1;
  console.log((step === "Note the paper's mass" ? "OK   " : "FAIL ") + "bench: " + step + " (screenshot " + process.argv[3] + ")");
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
EOF
```

Start the server **in the background**: use your tool's run-in-background option, since a trailing `&` may be killed when the command returns.

```bash
source /c/Users/EmilJivishov/AppData/Local/Temp/lab-studio-3d-pages.sh
node "$STAGE/serve.cjs" "$STAGE" 5199
```

Then run the check:

```bash
source /c/Users/EmilJivishov/AppData/Local/Temp/lab-studio-3d-pages.sh
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:5199/experiments/$DEST/"   # 200
node "$STAGE/check.cjs" "http://127.0.0.1:5199/experiments/$DEST/" "$STAGE/bench.png"
```

**Pass criteria:**
- Every line reads `OK`, and the command exits 0.
- The bare URL ends at `#/3d/technique/weighing`.
- The bench line shows "Note the paper's mass".
- Look at `bench.png`: it shows the oven, the ring stand with funnel and flask, the balance, the sink and the pad.

Then stop the server: stop the background task, or end the process listening on port 5199.

## 6. Copy into a fresh virtual_lab worktree

The main checkout `C:\Users\EmilJivishov\Projects\virtual_lab` holds the user's untracked local folders, among them `experiments/dna-microarray-3d/`, `experiments/dnamicroarray_new/`, `experiments/lab_studio_opus/` and `experiments/lab-studio/.claude/`. **Never stage those.** Work in a separate worktree from `origin/main` instead:

```bash
source /c/Users/EmilJivishov/AppData/Local/Temp/lab-studio-3d-pages.sh
git -C "$VL" fetch origin
git -C "$VL" worktree add -b "$BRANCH" "$WT" origin/main
test ! -e "$WT/experiments/$DEST" || echo "experiments/$DEST already exists: this is an update (see step 9)"
rm -rf "$WT/experiments/$DEST"           # only this folder, which this deploy owns entirely
cp -r "$SITE" "$WT/experiments/$DEST"
```

Rules for this step:
- `virtual_lab` is its own Git repository. Don't use the `C:\Users\EmilJivishov\Projects` workspace repo or its `scripts/workspace.ps1` for this.
- Never run `git clean -x`, a recursive `git reset --hard`, or a whole-tree checkout in either repo.

## 7. Commit and push

```bash
source /c/Users/EmilJivishov/AppData/Local/Temp/lab-studio-3d-pages.sh
cd "$WT"
git add -A "experiments/$DEST"
git status --short | grep -v " experiments/$DEST/"     # must print nothing: no other path is touched
git diff --cached --stat | tail -1                       # about 547 files changed
git diff --cached --numstat -- "*.glb" "*.wasm" "*.task" "*.png" "*.woff2" | awk '$1 != "-"'   # must print nothing: all treated as binary
```

Then commit. Put the source SHA from step 2 in the body, and add the commit attribution line your own instructions require:

```bash
source /c/Users/EmilJivishov/AppData/Local/Temp/lab-studio-3d-pages.sh
cd "$WT"
git commit -m "Publish Lab Studio 3D Pages runtime" \
  -m "Built from Lab_studio claude/lab-studio-3d at <SHA> with VITE_STUDIO_3D_V1=true (vite build, base ./). Pack 1 and Pack 2 3D techniques at experiments/$DEST/; the bare URL opens Weigh a Solid in 3D."
git push origin HEAD:main
```

- `core.autocrlf` is `true` in this repo and there is no `.gitattributes`. Warnings that LF will be replaced by CRLF in the built JS and JSON files are expected and harmless: Git normalizes those text files and leaves the binaries alone, which the `numstat` check confirms.
- **If the push is rejected** as non-fast-forward: `git fetch origin && git rebase origin/main`, then push again. The commit only adds `experiments/<DEST>/`, so it rebases cleanly. **Never force-push.**
- After a successful push, remove the worktree and its branch:

```bash
source /c/Users/EmilJivishov/AppData/Local/Temp/lab-studio-3d-pages.sh
git -C "$VL" worktree remove "$WT"
git -C "$VL" branch -D "$BRANCH"
```

## 8. Verify on GitHub Pages

Pages rebuilds from `main` after the push, usually within 1 to 10 minutes; watch the repo's "pages build and deployment" run. Then:

```bash
source /c/Users/EmilJivishov/AppData/Local/Temp/lab-studio-3d-pages.sh
for p in "" "techniques-3d/index.json" "assets/equipment-3d/v1/beaker-250ml.glb" "mediapipe/models/hand_landmarker.task"; do
  curl -s -o /dev/null -w "%{http_code} https://virtuallab.az/experiments/$DEST/$p\n" "https://virtuallab.az/experiments/$DEST/$p"
done                                     # all 200
node "$STAGE/check.cjs" "https://virtuallab.az/experiments/$DEST/" "$STAGE/bench-live.png"   # every line OK
```

**Links to give the user:**
- Start (Weigh a Solid; the title menu lists every 3D technique): `https://virtuallab.az/experiments/<DEST>/`
- Any technique: `https://virtuallab.az/experiments/<DEST>/#/3d/technique/<id>`, where `<id>` is one of:
  - Pack 1: `weighing`, `measuring-volume`, `making-solution`, `dilution`, `transmittance-dilution`;
  - Pack 2: `transfer-practice`, `hard-water-precipitation-practice`, `filtration-practice`, `drying-practice`, `thermal-decomposition-mass-loss-practice`.
- Studio 3D: `https://virtuallab.az/experiments/<DEST>/#/3d/studio`

**Tell the user about these limits:**
- **Hand control** needs HTTPS (the site has it) and the viewer's camera permission. It loads its model from the folder by a relative path, but it has not been tested with a real camera (the G3 check is still outstanding).
- **"Open the 2D version"** in this deployment opens the 2D player with this branch's technique files, not the separately published 2D lab. On this branch, Dilute a Stock Solution and transmittance-dilution can't be finished in 2D (their inversion step; `proposals/PACK2_ATOMIZATION.md`).

## 9. Updating later

- **Republishing:** repeat steps 2 to 8 from the new Lab_studio head. Step 6's remove-and-copy of `experiments/<DEST>/` drops stale hashed bundles. Commit as "Update Lab Studio 3D Pages runtime" with the new SHA.
- **Removing:** delete `experiments/<DEST>/` in a fresh worktree, commit and push. Nothing else references it.

## Do not

- Edit, commit, push or stash in the Lab_studio source worktree.
- Touch `experiments/lab-studio/` (the 2D version) or any path outside `experiments/<DEST>/`.
- Stage the user's untracked folders in the main `virtual_lab` checkout.
- Add `.nojekyll`, edit the site's root pages, or add a link on the home page without asking the user. A home-page link like the 3D microarray's (commit `36284e3`) is a reasonable follow-up to offer.
- Force-push, rewrite `main`, or use `git clean -x` or recursive resets.
- Prune folders from the build to save space (see step 3).

## Dry run (2026-10-06)

Steps 1 to 7 were run exactly as written, from source head `0d84ff3` (runtime last changed at `da88230`). The one difference: `BRANCH` and `WT` were set to throwaway values, and the push was skipped. The throwaway worktree, branch, settings file and staging folder were then removed. `origin/main` was untouched (`08e7ac0`).

- **Step 2:** the practice files are current; the typecheck exits 0; `src/studio3d` passes 239 of 239 tests.
- **Step 3:** built in about 5 s; 547 files, 223 MB; no names starting with `_` or `.`.
- **Step 4:** the redirect and the title are in place.
- **Step 5:**
  - The server answered 200, and all 12 routes passed, the bare URL ending at `#/3d/technique/weighing`.
  - The bench showed "Note the paper's mass", and its screenshot shows the oven, the ring stand with funnel and flask, the balance, the sink and the pad.
  - The first run found a fault in this file's check: at the player's default quality, the screenshot timed out under software rendering. The check now opens every page at Low quality and allows 120 s.
- **Step 6:** the worktree was created from `origin/main`, and the build copied in.
- **Step 7:**
  - Only `experiments/lab-studio-3d/` was staged: 547 files, every binary treated as binary. The commit was made but not pushed.
  - After it the worktree was clean, so a plain `git worktree remove` worked.
- **Measured on this build:** 323 of its 547 files (184 MB) are byte-identical to files already in virtual_lab; 224 files (37 MB) are new.
