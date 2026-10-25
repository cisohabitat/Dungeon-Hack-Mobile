# AA named held pass1 — the Penitent's Flail

18 class/state frames are complete locally, pending activation/publication.
Live0.9.37 remains unchanged:289 held frames and628 shipped paintings plus3 icons.
The preceding98 source frames remain intact;116 local frames now await activation.
No runtime loader, serviceworker, game rules, powers, balance or release changed.

## Identity and class coverage

Fighter and Cleric are the two legal flail classes. Each has rest/drawback/windup/
strike/cut/sweep/through/recover/return with exact id `relic_penitent`, two=false,
lit=false. Native references and preview audits use actual {t:'flail',u:'penitent'}
items through Game.canEquip and Game.spriteFor, proving both named sprite routes.
Held paintings/serviceworkers are blocked for native references. No ordinary flail
source is bound under a named key, and no named prefix is stripped by the proxy.

The [named library audit](named-library-audit.json) records47 named identities,
31 weapon/shield held candidates, exact relicUsableBy class restrictions, held
source metadata and held/carried runtime delivery separately. Penitent is the
first source family;30 candidates remain without held source. None of these
named held/carried families is painted in the current delivery catalog. This says
nothing about existing inventory/portrait/worn art. The source scan requires exact
id/class/pose/two metadata; carried source sheets remain a separate review.
Mythic owner restrictions are applied, not merely base-item classes. Other-family
pose requirements still need renderer audits before generation.

## Production and visual findings

Four outputs are preserved with exact prompts/reference/output paths. The Fighter
original showed only two beads. A direct bead repair also showed two and was
rejected; the selected Fighter class edit uses the correct Cleric three-bead
construction and paints grey glove/steel cuff/brown sleeve in the image tool.
Cleric retains brown glove/gold cuff/ivory sleeve. There was no scripted recolour.
All four outputs, native opaque grids, all18 registered frames/contact/
registration/alpha diagnostics, ordinary-vs-named comparison,4 phone galleries
and selected full-size captures were visually inspected.

Selected poses retain three pale-gold prayer studs and the small gold cross on
the lower grip, a compact wooden haft/dark grip, one short connected linked chain
and one spiked iron ball. Full spikes, chain, haft butt, fingers and forearm ends
remain complete. These prayer marks distinguish the named flail from the ordinary
painted controls. Worn iron/leather/cloth use the established mature painted style.
Bright spots are material highlights, not emission or scene light. Native vector
rarity contours are separate from the named prayer construction; the source does
not bake an emitting gold aura into the cloth. Small raw edge flecks remain,
with opaque diagnostics used to resolve transparent-view artifacts.

Authored crop boundaries cross nominal gaps: bottom through/recover450, middle
strike/cut400, lower-middle/right rows begin800 and middle cut/sweep end800.
These retain raised head spikes and sleeve ends without neighbour traces.
Original gutters are narrower than the requested8percent in places; registered
alpha>32 clearance is>=25px. Scripts only crop, uniformly scale, translate and
assemble diagnostics; no painting, masks, rotation or mirroring. Atlas cell pixels
match individual exports exactly and measurements/export bytes reproduce.

## Renderer checks and limits

68 frozen captures and4 galleries at390/320px cover all9 CUT poses, recovered1,
Calm cut, cast/read/drink and6 controls.204 three-height fixture checks at
160/360/464 comprise168 new prop bounds checks and36 other fallback checks.
New prop clearance is>=3.50px. The Cleric retains the published shield in
ordinary fixtures; action hands remain procedural.17 exact id/class/pose/two/lit
guards per width protect all ineligible classes, unsupported hand/pose/reflection
requests, ordinary Fighter/Cleric flails, generic relic_flail, false legend_penitent,
other named Dawnbringer/Vashti and bear fist. Visible ordinary/other-name/wrong-class/
wrong-hand controls retain their original art. Full Game.state and Dice/Odds
comparisons pass with no excluded fields; recording is disabled before snapshot
because renderState normally appends API events. No page/console errors occurred.
All12 existing held-equipment phone/small checks passed in29.8s, after captures.

These frozen source fixtures use a Fighter HUD, modified class/view/clocks and
paused updates. Generic Fighter casting is stress only, not a new class power.
Both source viewports are844px tall;320px is a width check rather than the native
667px small screen. This does not prove native equip/actions, relic powers,
offline delivery, performance or quest progress. Activation must preserve named
identity routing and independent class-family failures and run those gates.

## Reproduce and next work

Run `python3 art/creatures/export-batch-aa-penitent.py --check`,
`node art/creatures/reference-batch-aa-penitent.cjs` and
`node art/creatures/preview-batch-aa-penitent.cjs` from the repository root.
Refresh/check the named inventory with
`node art/creatures/audit-named-equipment.mjs` and
`node art/creatures/audit-named-equipment.mjs --check`.
See [validation](validation.json), [coverage](coverage-audit.json),
[measurements](measurements.json), [native references](reference-inventory.json),
[identity comparison](identity-review.png) and [captures](dungeon/review.json).
Baseline command: `npx playwright test 'held-equipment\.spec\.js$' --project=phone --project=small --workers=2`;
local execution selected system Chromium through a temporary config.

Next source batch: Dawnbringer for Fighter/Cleric, then the Ogre's Toll and the
remaining named weapon/carried families in the identity audit. Penitent is complete
as source; the named/legendary/Mythic library remains open.116 local frames across
all pending passes await activation/publication.
