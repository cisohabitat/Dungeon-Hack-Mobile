# AA remaining bow classes — source review

Nine class/state frames are complete locally, pending activation and publication.
Live0.9.37 remains unchanged:289 held frames and628 shipped paintings plus3 icons.
The preceding17 ranged source frames remain intact, also pending activation.

| Weapon | Class | States | Source |
|---|---|---|---|
| Shortbow | Fighter | rest, bowdraw, bowfull | exact approved Ranger Z reuse |
| Shortbow | Thief | rest, bowdraw, bowfull |3 new paintings, one image-tool sheet |
| Longbow | Fighter | rest, bowdraw, bowfull | exact approved Ranger T reuse |

Native references block painted held delivery and service workers. Each Fighter/
Ranger pose matches PNG bytes, grip, weapon bounds, dimensions and both nock
coordinates before reuse. All six copied registered PNGs and complete measurement
records match the approved Z/T files exactly; original generation/repair provenance
stays in their manifests. Separate Fighter class keys remain.

## Visual findings

All native opaque reference grids, the new original and approved reused sheets,
all9 registered cells/contact/registration/alpha diagnostics,6 phone galleries
and selected full-size screenshots were inspected. Thief retains a dark glove,
worn brown cuff and olive sleeve; all three left forearms are connected. Bow
flex increases from rest to half to full. Source has no string, arrow or right
hand. Fighter shortbow retains plain dark caps; longbow retains pale horn nocks.
All bow ends and sleeves are complete inside source cells. Upper original gutters
are narrower than the requested8 percent; registered alpha>32 clearance is>=47px.
Minor tool-output edge flecks remain. No scripted painting, palette swaps, masks,
mirroring or rotation occurred: only crops, uniform scale, translation and review
layouts. Atlas cells equal registered individual pixels exactly. Grip registration
and source nock anchors follow the renderer's top/bot convention, with top at the
lower image endpoint.

## Renderer review and limits

94 frozen captures and6 galleries at390/320px cover rest, catching the string,
half/full draw, before.72, release.72, recoil.75, settle.79, recovery1, Calm,
casting, reading and drinking.282 fixture cases at renderer heights160/360/464
comprise198 full weapon-visibility fits,54 action cases and30 fallback controls.
Visible weapon clearance is>=3.53px. Cast/read/drink deliberately lower the
bow below the viewport, matching renderer behavior; those cases permit bottom
occlusion while retaining horizontal/top checks and verifying string endpoints,
arrow state and absence of duplicate drawing hands. Ordinary bow motion retains
full weapon bounds checks. Sleeves/drawing hands may reach viewport edges as in
existing native framing. Both review viewports are844px tall;320px is a width
check, separate from the actual small-device baseline suite.

Live string endpoints match authored nocks within1px. The procedural nocked arrow
is present before.72 and absent from release through recovery; combat.js uses.72
for both bow projectiles. The existing procedural draw hand is present during
bow actions and yields to cast/read/drink hands. Calm keeps the rest-painted bend
while retaining live pull/release. Twelve exact id/class/pose/two/lit guards per
width preserve unsupported classes, states, named Horizon, published Ranger bows,
fists and existing longsword art. Five visible controls retain original art.
Full Game.state and Dice/Odds comparisons pass without excluding any fields;
recording is disabled before the snapshot because renderState otherwise logs calls.
No page/console errors occurred. All12 existing held-equipment phone/small browser
checks passed in31.1s, after captures finished.

These are frozen source substitutions with a Fighter HUD; Fighter/Thief casts
are stress fixtures, not new class powers. This is not native equip/action,
projectile-flight/hit, offline or performance integration evidence. No runtime
loader, service worker, balance or release files changed.

## Reproduce and roadmap

Run `python3 art/creatures/export-batch-aa-bows.py --check`,
`node art/creatures/reference-batch-aa-bows.cjs` and
`node art/creatures/preview-batch-aa-bows.cjs` from the repository root.
See [validation](validation.json), [coverage](coverage-audit.json),
[measurements](measurements.json), [native audits](reference-inventory.json) and
[capture report](dungeon/review.json). Existing baseline command is
`npx playwright test 'held-equipment\.spec\.js$' --project=phone --project=small --workers=2`;
local execution used system Chromium through a temporary config.

All legal ordinary shortbow/longbow pairs now have source coverage. Next source
work is rare scimitar/dwarfhammer, greatsword released-hand states and the named,
legendary and Mythic equipment library. Activation of these9 plus the preceding17
ranged frames remains separate; the whole AA library is not complete.
