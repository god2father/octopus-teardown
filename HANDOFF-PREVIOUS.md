# Handoff: Freedom teardown sim

Last updated 2026-11-12 (second session). Branch `freedom-teardown`, last commit `e34b01c`. **Uncommitted**: head sculpt passes, the body pass and the callout redesign below. `main` and the Pages site (`docs/`) were not touched.

## What this is

This is a personal, non-commercial fan build of the ZGMF-X10A Freedom **without wings**, made with the `teardown` skill in this repo (`.claude/skills/teardown`). Every part is procedural three.js geometry: no official models, logos or ripped assets. The user is aware that `origin` is a public repo and chose to push anyway. Do not add this build to `npm run pages`.

The single standard is the user's reference sheet, `reference/freedom/sheet.webp` (1536×1024):
- Top row: front, left, right, back, 3/4 front and 3/4 back views.
- Bottom row: close-ups of head, chest, shoulder, backpack, hand, foot, skirt, knee, hip, forearm, shin and ankle.

**The user wants the model to look like that sheet.** They have repeatedly rejected "improved but still blocky" results. Proportions first, then shape, then surface.

## Files

| path | role |
|---|---|
| `sims/freedom-shared/kin.js` | `SPEC` skeleton in metres (hipX, thigh, shin, ankle, waistY, shoulderX/Y, neckY, upperArm, foreArm, packY/Z…), poses (`POSE.stand` is the reference A-pose), rail-cannon deploy and burst cycle, reactor power. `machineAt()` is the single source for robot and console. |
| `sims/freedom-shared/robot.js` | All geometry. Helpers: `rbox` (chamfered box), `prism` (XY outline extruded on z), `hull` (side profile `[z,y]` extruded on x), `taper`, `inset`, `narrowToe`, `slot` (vent), `bolt`, `piston`, `armor()`/`frame()`. Sections run pelvis/skirts → legs → rail cannons → torso/chest → head → arms → backpack → beams. The head has a **reference-pixel projection** shader (`projected`, `onBeforeCompile`). |
| `sims/freedom-shared/headTex.js` | De-lit head close-up and side crops as base64 (generated from `img2/freedom/proj/*.jpg`). |
| `sims/freedom-shared/stage.js` | Studio, long lens (16°, `LENS`), metal reflection environment. |
| `sims/freedom-shared/{console,film,live,i18n}.js` | Bilingual console, 35 s film script, live page. Assemblies: HERO, HEAD, BACKPACK, REACTOR, RAILGUN, RAIL FIRE. Display: labels, phase shift, X-ray, exploded, turntable. |
| `img2/freedom/targets.json` + `size-gate.mjs` | **Size gate**: 38 part-dimension checks read off the reference at 79 px/m. Run `node img2/freedom/size-gate.mjs` after every geometry change. It must print `GATE PASS`. |
| `img2/freedom/image-analysis.md`, `assessment.json`, `di.json` | img2threejs intake: measurements, detail inventory. |

## Commands

```bash
npm run build:freedom              # → teardown-out/dist/freedom-live.html, freedom-film.html
node img2/freedom/size-gate.mjs    # 38 size checks
node .claude/skills/teardown/sims/capture.mjs freedom-film --size 1600x900 --dpr 1 --stills 0.5,8.2,26.5 --cols 3 --out teardown-out/freedom-keys.png
```

- **Preview**: `.claude/launch.json` defines `teardown-dist`, a python http.server on port 8791 serving `teardown-out/dist`. Open `http://localhost:8791/freedom-live.html`.
- **Capture on macOS**: needs `--use-angle=metal`. It was added to `.claude/skills/teardown/paths.mjs`; that folder is gitignored, so re-add the flag if the skill is reinstalled.

## Review method that works

The user rejected eyeballing. Compare at the **same scale** with the reference:
- **Reference grids**: crop the sheet front view (`crop=330:500:0:0`, ×3) or side view (`crop=200:500:500:0`, ×3) and draw a 30 px / 150 px grid, which gives 79 px = 1 m.
- **Model grids**: render the model with a 9° camera, scaled so fin-to-sole is 18.03 m at 79 px/m, and stack it beside the reference.
- **Head close-ups**: the reference head tile is `crop=362:300:0:518`. Render the model head at a fixed scale from front, side and 3/4.

Scripts: `node img2/freedom/gridview.mjs <outdir> [views]` renders the whole suit at 79 px/m with a 3.2° lens (front, left, right, back, q, rq; close-ups chest, shoulder, pack, foot, knee, legs, arm framed like the sheet tiles). `img2/freedom/cmp.sh` / `zoom.sh` stack them beside the reference crops (`rf.png` = `crop=330:500:14:0` ×3, `rl.png` = `crop=200:500:340:0` ×3) with a 1 m grid. `headviews.mjs` does the head.

## Status per region

| region | state |
|---|---|
| Proportions | All 38 gate checks pass. Fin tip at 18.03 m. |
| Head | **Re-sculpted 2026-11-12 as lofted geometry, projection removed** (`headTex.js` is no longer imported; the projected pixels ghosted on the fins and smeared at 3/4). New `loft()` helper in `robot.js` skins measured cross-sections: narrow dome over a wider ear shell, camera tower carried back as a crown ridge, beak crest, diamond-section V-fins with a foot on the crest, ridged mask, cheek guards, framed side vents at 45°, real amber eyes with an orange lid. Gate passes. Same-scale sheet: `teardown-out/freedom-head-compare.png`; renderer: `node img2/freedom/headviews.mjs <outdir>` (front, q, side, rq, back, top, low at 388.5 px/m). Second pass the same day on side and back: crowned dome (1.08 m on the centre line) that widens behind and seats on the ear shell with a clean seam, shell top climbing to the back, double-cut round corners, rim band under the helmet, wider and taller crown ridge with a yellow tail tip and rear camera recess, ear knobs, rear slots. Compare sheet now has front, side, rear 3/4 and back rows. Third pass on the side: the dome now runs forward as a visor whose lower edge is the brow diagonal, the ear shell starts behind it (z -0.1) with the louvred vent on the 45-degree face under the diagonal, cheek guards are lofted 0.5 m deep with the jaw edge climbing to the ear, the back profile is one round from shell to crown. Fourth pass: `smoothLoft()` (Chaikin-rounded rings, Catmull-Rom resampling, smooth shading, `fnormal` kept for the panel texture) now skins the dome, ear shell and rim; `planeCut()` draws engraved panel lines that follow those shells; the crown ridge is two plates with a raked gap; eyes sit in a dark socket rim. HEAD view checked in `freedom-live.html`, no console errors. Fifth pass: tower, crest, mask, chin and cheek guards are bevelled lofts (`smoothLoft(..., 1, 1, true, true, 0.03)`); the ear guard is an angular rim of bars over a dark recess with four louvres, sitting 0.09 m proud of the shell; fins re-aimed to the full-body front view (long tip 1.66 m out, 1.45 m up; short tip 1.75 m up); eyes are thin slanted wedges in a dark socket; `headviews.mjs` now uses a 3.2° lens because the reference tiles are near-orthographic (the 16° lens inflated everything forward of the face by ~10%). Note: `THREE.Shape.holes` did not cut the guard frame here, which is why the rim is built from bars. Sixth pass: ear shell uses one rounding pass (crisper), rear dome widened, raised ear plate with slits and yellow marker, cheek guard top drops behind the brow, gap between visor and ear shell closed. **Gaps:** dome reads as a long loaf from the side where the reference's is taller and rounder under a larger arched ridge; eye is not visible in pure side view; white paint is cleaner and brighter than the reference's weathered grey; back has a waist between dome and shell. Not committed. |
| Body pass 2026-11-12 | Rebuilt from the bottom-row close-ups and checked at 79 px/m against the front, side, back and 3/4 views (`teardown-out/freedom-body-compare.png`). **Feet**: faceted ankle guard skirt (side plates drop to a point, front/back arched), long red toe wedge with a white instep and slot, red heel. **Knee**: teardrop shield + calf wrap, smaller knee discs. **Shin**: lofted, calf bulge behind, waisted above the ankle. **Shoulder**: main block + top cap running to the tip, red tip panel, blue frame under the tip. **Arms**: upper arm 1.7 m, forearm 2.8 m, elbow at 13.1 m, arms out 23°, curled fingers. **Chest**: taller pec blocks with vents up high and dark under-blocks, prow with red band at its front edge, blue flanks receding to the red hatch, white flank plates. **Front waist**: white centre plate over a navy block. **Backpack**: centre column + stepped cap + lower block, grey-framed 4-slat vent, side blocks, light hex port flanges, ducted boxes. Hard-surface lofts use the new `facet()` (flat shading). Navy lightened to `#5a607e`. Targets re-measured: shoulder slice 2.1 m, ankle guard 2.7 m, hand bottom 8.3, upper-arm slice at 13.6 m. **Gaps**: thigh and hip blocks still boxy; rear skirt too large and flat; rail cannons plain; front-view knee shield still rounder than the reference's angular plate; 3/4 views not tuned. |
| Callouts | Redesigned 2026-11-12 (they were unreadable): white card, 1 px border, shadow, 3 px red edge on the leader side, 12.5 px bold name, 10 px sub-line, Chinese on the same line; leaders 1.8 px red over a 4.5 px white halo, anchor dot with ring. Half-translated labels now show only the translated segments. Anchors re-aimed to the rebuilt pack/knee/foot. Screenshot: `teardown-out/freedom-callouts.png`. |
| Chest | (superseded by the body pass above) |
| Shoulders | Wing shape, red top stripe, blue marker. Size passes. Surface detail is basic. |
| Legs and feet | Shield knee guard, slim shin, faceted ankle guard with V flap, sloped red toe wedge, white instep with slot, red heel, toes out 12°. Close in front view. |
| Arms, skirts, backpack, rail cannons | Sized to the gate, shapes still blocky. |
| Overall look | Still reads as a box model next to the sculpted reference. The head projection was the biggest single gain. |

## Suggested next steps

1. Ask the user for clearer side and back views of the head if they want the head side improved by projection.
2. Extend the same projection approach to other parts using the bottom-row close-ups (chest, shoulder, backpack, foot, knee). Keep projections per part in that part's rest space so the teardown still works.
3. Re-record the film (`npm run video:freedom`). The last recording predates every reshape.
4. Open a PR into `main` only if the user asks.

## Notes on working with this user

- Replies in Chinese, short and direct.
- They want real fidelity to the reference, not progress reports on blocky iterations.
- Show same-scale reference-vs-model images rather than describing changes.
- Commit only when asked. Push was explicitly approved for this branch.
