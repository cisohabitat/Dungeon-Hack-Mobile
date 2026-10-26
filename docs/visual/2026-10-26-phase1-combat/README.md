# Phase 1: combat readability

Reviewed native running Fighter, Mage and Ranger crowd/rest/attack views at
320×667 and 390×844, plus native Mage lightning. Supplied enemy positions,
high health and delayed enemy actions make these controlled encounters, not
unassisted fights. The renderer, updates, attack button and spell rules are native.
`capture.cjs` reproduces the fourteen images; `evidence.json` records the fixtures.
The floor-arrival animation is allowed to finish before review.

## Finding and correction

Lightning hitting three enemies aligned at different depths projected multiple
damage/save receipts onto almost the same line. The existing per-enemy lift
could not separate receipts belonging to different enemies. Floating labels now
move below earlier intersecting labels. Horizontal target registration, number
sizes and warning-mark protection remain intact; labels outside the view or
colliding with an incoming-blow mark are omitted as decorative receipts.

See [corrected 320px lightning](320-mage-spell.png),
[320px melee](320-fighter-attack.png) and [390px bow](390-ranger-attack.png).
No enemy repaint or weapon registration change was justified by these samples.
This does not certify every class/equipment/action combination.

The added browser case checks three aligned receipts at ordinary and large
number sizes. Existing combat tests cover intent, warning clearance and actual
outcomes; elemental tests check spell costs and impact timing. This is receipt
layout only: no targeting, enemy visibility, controls, timing, damage, rules or
seeded dice change, so balance simulations are not required. Full browser and
performance gates remain required in CI before verified release publication.

## Validation before publication

All 28 focused Chromium checks and npm test (751 rule checks) passed.
Three isolated performance samples are retained in [validation.json](validation.json):
release painted23fps, unchanged-main22.2fps, paired release26.1fps, all below
the unchanged30fps limit. The first release sample also missed flooded27.2fps;
all other scenes passed. The initial invocation without PERF=1 skipped and is
not a measurement. CI performance and full browser checks must pass before
this phase is reported as verified.
