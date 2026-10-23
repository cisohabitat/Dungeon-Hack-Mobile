# Batch G barrel Mimic art review — 23 October 2026

One nine-pose barrel/default Mimic source sheet and one selected full-sheet repair,
generated with `image_gen.imagegen` (model not disclosed). Actual prompts, input
references, original output paths and registration are in
`../generation-batch-g.json`. This is preview artwork, not runtime integration.

## Identity finding and references

The legacy drawer in `js/creatures.js` describes a cylindrical barrel with wooden
staves, two body hoops, rear-hinged round lid, wet toothed mouth, one tongue and
two stalk eyes. The later `alignCreature` repair in `js/creatureidentity.js`
currently replaces the procedural drawer with a chest-shaped picture, including
when revealed barrel/default variants retain the procedural guard.

`procedural-reference.png` captures that **active chest-shaped fallback**;
`legacy-barrel-reference.png` renders the **older barrel design**, before the
identity override. `node art/creatures/reference-batch-g.cjs` reproduces both
references using the actual parts painter. The older drawer is evaluated in Node,
not the browser; the page's content security policy stays intact. The existing
painted chest atlas supplies materials/lighting, not barrel anatomy. The new art
is a deliberate barrel variant, not a claim that the active fallback already has
this shape. No fallback code is changed in this stage.

## Source and export review

Original sheet, repair and all nine exported cells visually inspected. Selected
art retains round rim/lid and bowed vertical staves, exactly two body hoops,
two rooted stalk eyes, one attached red tongue and uneven rooted teeth. The
asymmetric knot stays on viewer left in both rocking poses. There are no feet,
arms, chest locks, invented tentacles or detached droplets.

The first source had repeated lid/eye tilt in the rocking pair and crowded lower
barrel margins. The complete repair reverses stepB's tilt without mirroring the
wood knot and adds source margins. The palette remains coherent across the full
selected sheet. Wide-mouth poses show the dark throat and attached tongue; the
rear hinge is mostly occluded from this frontal view, rather than a floating lid.

Export: 768×768 WebP, nine transparent 256px cells. A common scale across the
sheet and measured horizontal barrel-base centres register visible bottoms on
row 236. All cells pass source/output clipping and at least 12px visible-alpha
clearance. The exporter only extracts connected figures, scales and registers;
character drawing and palette changes belong to the image tool.

## Supported poses and reserves

Row-major: idle, stepA, stepB, windup, strike, recover, special reserve, hurt,
blink reserve. Steps rock/hitch the barrel in opposite directions without legs.
The current `POSES.mimic` has no special or blink object. The closed stalk-eye
cell and reserve threat are review material only; they add no runtime action.

## Dungeon fitting and variant checks

`node art/creatures/preview-batch-g.cjs` captures seven supported poses at each
of 390px and 320px: **14 captures**. Both overview sheets were visually inspected
for fitting, tongue/lid clearance and visible windup warning. No page/console
errors were reported; captured scale remains **0.8**.

At each width the harness also checks revealed and concealed states for explicit
barrel, missing/default disguise and explicit chest: **12 variant cases** total.
Concealed objects retain their exact `dress_barrel`/`dress_chest` scenery. Revealed
barrel/default retains the existing procedural guard; chest remains eligible for
its approved painting. These assertions run before any painted-cell substitution.

The harness then decodes the review sheet into cached cells and substitutes a
chosen supported pose into a frozen barrel dungeon draw. It does not modify
runtime bindings, remove the variant guard or change timing. These checks do not
establish real-loader, native offline, failure-isolation or Calm-view integration.
There are no gameplay, save-field, collision, warning or attack changes.

## Reproduction and next stage

- `python3 art/creatures/export-batch-g.py --check`: verifies the atlas,
  neutral/walking/action comparisons and measurements byte-for-byte.
- `node art/creatures/reference-batch-g.cjs`: captures active and legacy references.
- `node art/creatures/preview-batch-g.cjs`: requires locked Playwright dependency
  and system Chromium; `CHROMIUM_PATH` overrides `/usr/bin/chromium`.
- `npm run check:art`: checks reviewed hashes, not anatomical quality.

No `img/creatures/` export, runtime module, service-worker entry or release number
changes. Later integration must select only reviewed revealed barrel/default
states, retain concealed scenery and chest art, and preserve procedural fallback
through loading/failure. Real-loader browser, native offline, Calm/reduced motion
and performance validation remain required before claiming shipped coverage.
