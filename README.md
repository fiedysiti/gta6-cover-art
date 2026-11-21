# Vice Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/fiedysiti/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/fiedysiti/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Cover Studio is a poster workshop for the GTA VI mood: drop in your own shots, arrange them into panels, wash them in sunset or neon colour, set a huge condensed headline over the top — and finish the cover with a VICE seal, a dark vignette, and film grain. The whole thing is a static page — no build, no upload, no account — so the pictures you use stay on your own computer from start to finish.

## Start in one click: scene presets

Four named scene cards sit at the top of the rail. One click loads a complete cover recipe — layout, grade, caption style, words, export size, badge, and finish — plus the sample photos dealt into the panels:

| Scene | Layout | Grade | Caption | Size |
| --- | --- | --- | --- | --- |
| Neon Reign | Triptych | Neon Nights | Chrome | 1080 × 1920 Story |
| Golden Getaway | Triptych | Sunset Gold | Chrome | 1080 × 1350 |
| Vice After Dark | Hero | Neon Nights | Chrome | 1920 × 1080 |
| Boulevard Kings | Strip | Sunset Gold | Outline | 1080 × 1080 |

Pick a card, tweak anything you like, export. The card stays highlighted while its recipe is the one on stage.

## Layouts

Six panel arrangements, keys 1–6, or hit S to shuffle to a new one:

- **Hero** — one tall panel left, two stacked right.
- **Triptych** — the new three-part cover: a tall left panel with two stacked panels right, split by a double-wide gutter so the panels read like a hinged triptych. The left panel is narrower than Hero's, so the right column carries almost as much of the poster.
- **Strip** — three tall panels in a row.
- **Grid** — four equal panels.
- **Single** — one full-bleed panel.
- **Duo** — two tall panels side by side.

## Colour grades

Eight washes laid over every photo, including two new ones:

- **Neon Nights** — hot pink into cyan, for covers that glow after dark.
- **Sunset Gold** — warm gold into deep amber, for golden-hour covers.
- Plus the original six: Sunset, Neon, Vice, Gold, Duotone, Midnight.

## Captions

Three headline styles in the bundled condensed type (Noto Sans Display Condensed Black, SIL OFL):

- **Shadow** — solid white letters with a soft drop shadow.
- **Outline** — hollow letters stroked in the grade accent, photo showing through.
- **Chrome** — new metallic letters: the headline is stamped downward in darkening shades for an extruded look, then filled with a vertical silver-to-gold gradient and a dark rim.

The headline auto-shrinks until it fits the poster width; the tagline sits under it in tracked capitals.

## The VICE badge

A round VICE seal you can switch on or off, move to any corner (top left, top right, bottom left, bottom right), and size small, medium, or large. It is drawn as a bright accent ring around a dark disc with a star and the word VICE in condensed type, and it paints over the panels but under nothing else, so it always reads.

## Finish: vignette and film grain

Two sliders close out the poster:

- **Vignette** (0–100%) — darkens the poster's edges with a radial falloff so the centre pops. The falloff starts inside the frame, so the middle of the photo stays untouched.
- **Film grain** (0–100%) — scatters light and dark speckles over the poster. The grain comes from a seeded generator, so the same poster always gets the same speckles — the live preview, the export, and a re-run are identical.

## Frame each panel by hand

Drag a panel to pan it, scroll to zoom, double-click to reset it — or paste an image straight from the clipboard (Ctrl/Cmd + V) into the first empty panel.

## Export

Four sizes: 1920 × 1080, 1080 × 1350, 1080 × 1080, and the new **1080 × 1920 Story** for vertical posts. Press E (or the Export button) and the poster downloads as a PNG at full size.

One-click **Randomize** (R) deals a fresh layout, grade, caption style, photo order — and a fresh finish: a random badge corner and size, plus new vignette and grain strengths.

## Shortcuts

| Key | Does |
| --- | ---- |
| 1–6 | Switch layout (Hero, Strip, Grid, Single, Duo, Triptych) |
| S | Shuffle to a different layout |
| R | Randomize layout, grade, caption style, photo order, and finish |
| E | Export PNG |
| Ctrl/Cmd + V | Paste an image from the clipboard into the first empty panel |

## Screenshot scenes

`app/src/shots.js` stages a fixed scene from a `?shot=` query, for reproducible screenshots:

```
?shot=cover&size=story&layout=triptych&grade=neonNights&captionStyle=chrome
  &caption=Neon%20Reign&subtitle=Rule%20The%20Night
  &emblem=on&emblemCorner=tr&emblemSize=medium&vignette=0.45&grain=0.18
```

`shot=cover` shows only the poster; `shot=editor` keeps the whole editor visible. The four scenes in `shots.json` use the new layouts, grades, caption style, badge, and finish. When the scene is painted, the page sets `window.__shotReady` so a screenshot can be taken.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. The server prints the four screenshot URLs from `shots.json` on startup. `node main.ts` (with `MAKEFUN_OUTPUT_DIR` standing in for `/output` outside the grader) copies `app/` and `screenshots/` into the output directory and writes `dossier.json`; run it twice and diff the outputs — the two runs must be byte-identical.

---

<sub>Entered on [make.fun](https://make.fun/?ref=3debkpg7&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
