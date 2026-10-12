# Two themes for Lab Studio 3D: evidence (2026-10-12)

You sent screenshots of the step card faded while carrying, Hand control and the Bench list, and asked: "make the bottom menu card also transparent when needed. Also, apply the same style to the opening card and also other attached cards." Asked how far to take it, you answered: "Everything in 3D and now actually you can make two themes: 1. Everything the old light one and 2. Everything the HUD look." For the fade: "While carrying, like the step card (Recommended)".

3D only. 2D is unchanged: nothing under `src/player/**` or `src/styles/app.css`, and no content or generator. Not pushed or published.

Renders, each with the Light theme on the left and the HUD on the right, at 1280 × 800 (carrying at 1024 × 700), in headless Chromium (SwiftShader):

- `renders/THEMES_lab.jpg`: the gate card, setup, the lab, the Bench list, Hand control and the Notebook.
- `renders/THEMES_more.jpg`: the Menu, the switcher, Help and carrying.
- `renders/THEMES_studio.jpg`: the Studio with a published technique open, its Open dialog and its More menu.

## The two themes

| Theme | What it is |
|---|---|
| **Light** | The look from before the HUD (2026-10-12 morning): the handoff's design (Q5), the step card and dock included, with no brackets and no scan line. |
| **HUD** (the default) | The step card's sci-fi look on every 3D surface. |

**The switch.** The HUD is the default, as the latest look you asked for. In the lab, Menu › Theme (HUD or Light). In the Studio, the More menu's "Use the Light theme" (or "Use the HUD theme"). One choice, kept in the browser (`lab-studio:3d:v1:theme`), serves the gate, the lab and the Studio, and a switch in one tab reaches the others. The gate has no switch of its own: a button there would change the Light theme's gate.

**How.** `ui/theme.ts` holds the choice; `Studio3DApp` sets it as `data-theme` on each `.s3d` root. `tokens.css` keeps the Light values in `:root` and remaps the same tokens under `.s3d[data-theme="hud"]`. Where the light styles wrote a colour out (white on a button, a progress track, the top bar's fill and so on), that colour became a token with the same value, so the HUD can remap it. `hud.css` adds what a colour cannot: the glass, the brackets, the glow and the captions. `stepHud.css` (the step card, the dock and its hint) is now scoped to the HUD theme too.

## Light is the original look

Computed styles of about 170 elements (the gate, setup, the lab's top bar, step card, dock, hint and labels, the Bench list, the Notebook, Hand control, the camera views menu, the Menu, the switcher, Help, and some 50 Studio elements) were compared between the Light theme and the commit before the HUD's rules were taken out of the page. Differences:

| Element | Difference | Why |
|---|---|---|
| Menu | 29 px taller | The new Theme choice. |
| The step card's scan line | Present in the page, `display: none` | The markup is shared; only the HUD shows it. |
| Camera views menu, Auto | Transparent, where the baseline caught the brand colour | The baseline's artifact: the original had no class on Auto. |
| The dock's On button | White on the brand colour, where the baseline caught a mid-transition tint | The baseline's artifact: removing the HUD rules started a colour transition. |

## The HUD everywhere

| Surface | HUD look |
|---|---|
| Gate (the opening card) and setup | The step card's glass and corner brackets on a dark grid. Journey steps outlined, their numbers in monospace. |
| Top bar (lab and Studio) | Glass with scan lines and a cyan underline glow. |
| Bench list, Examine, Hand control, drop panel, loader | The step card's glass (about three quarters opaque, blurred) with its corner brackets; titles in monospace cyan. |
| Menu, item menu, switcher, pop menus | Near-solid, smaller brackets, a brighter cyan edge. |
| Help, results, Studio dialogs, Notebook | Near-solid with brackets; the Notebook's open edge is lit. |
| Buttons, chips | The primary action glows cyan; guide actions are outlined; neutral and provenance chips are outlined. |
| Scene labels and callouts | Dark glass with a cyan edge; a callout keeps its green or red ring. |
| Studio | Dark page and panels with small brackets; the flow canvas, its dots, the minimap and nodes on dark; a selected node glows. |

**The fade, HUD only.** While an item is carried (`.s3d-player.is-carrying`), the dock, the Bench list and Examine fade to 40 % like the step card, and each comes back when the pointer or focus reaches it. Hand control and the drop panel stay solid, since they are in use while carrying. The Light theme does not fade.

## Contrast

`node scripts/studio3d/checkTokenContrast.mjs` now checks every theme pair in both themes (`THEMES_TOKEN_CONTRAST.md`): **147 of 147 pass** (Light 56, HUD 91). Over the 3D scene the HUD's glass is checked over the light stage, the dark stage and the window's white. Its tints are checked over its own panels. New pairs cover the menu and dialog surface, rows under the pointer and selected, the tints over a floating panel, the top bar, the hint, the assessment chip and the focus ring. To pass over the window's white, three HUD values were set: the OK colour #9af5d4 on its tint #4fe3a424, and the guide tint #3fd8ff24. `STEP_HUD_TOKEN_CONTRAST.md` stays as the record of the step card's first check.

## Checks

| Check | Result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | Clean |
| `npx vitest run src/studio3d --maxWorkers=2` | 33 files, 333 tests pass |
| New `__tests__/theme.test.ts` | The HUD default, a kept choice, an unknown stored value ignored; every caller told of a switch; every rule in `stepHud.css` and `hud.css` inside the HUD theme; every token the HUD remaps has a Light value |
| `node scripts/studio3d/checkTokenContrast.mjs` | 147 of 147 pass |
| `node scripts/practice3d/build.mjs --check` | Clean |
| `npm run content:check` | 22 violations, the existing baseline |

**Carrying, measured** (Transfer Liquid, the beaker taken from the shelf): in the HUD, the step card, the dock and the Bench list are at opacity 0.4, and the Bench list is back to 1 with the pointer on it. In the Light theme nothing fades, as before the HUD.

## Tuning after the first render

| # | Seen | Changed |
|---|---|---|
| 1 | Hand control's camera box kept the Light theme's dark green (#1c3027) on the HUD glass. | The HUD's core colour with a cyan hairline. |
| 2 | The Studio's view switch (Flow, Starting bench, Preview) showed no current view in the HUD: the Light theme's raised pill is the panel colour, the same as the switch on the dark page. | The current view is lit: the HUD band, a cyan hairline and a glow. |
| 3 | Three tint pairs failed over the window's white: OK on its tint (4.24:1), the guide colour on its tint (4.31:1) and brand on its tint (3.62:1). | OK is #9af5d4 on #4fe3a424 and the guide tint #3fd8ff24. Brand text on its tint is used only on solid panels and the gate card (the switcher's numbers, the set-up numbers, the Studio's chips and icons), so its pair now checks those. |

## Seen, not changed (the same in both themes, from before)

- **The Menu:** its buttons are centred while its links (Open the 2D version, Exit) are left-aligned.
- **The Studio at 1280 px:** the graph badge is cut short ("PROCESS · 3 STEPS · 9 ISS…"), and the bottom toolbar is clipped at its left ("…elect").
- **Equipment thumbnails** keep their light tiles in the HUD. They are images, not theme colours.
