# AN — healing and ward accent audit (31 October 2026)

Retain the native healing, shield, blessing and bear-paw effects. The reviewed
casts do not demonstrate a missing physical surface that needs painting. Their
restrained marks preserve spell identity and the painted creature behind them;
adding a textured panel or opaque burst would consume their clear space.
No new atlas is commissioned. This completes the optional AK–AN surface review
sequence, not the broader AAA/device or engine-reliability work.

## Native action evidence

`node docs/visual/2026-10-31-healing-ward-audit/capture.cjs` records eight actual
spells: Mage Shield; Cleric Bless, Protection, Cure Light Wounds and Cure Serious
Wounds; Druid Mending Moss and Wild Shape; and Spellblade Spellguard. Each is
cast through `Game.castSpell` at 320×667, 390×844 and short landscape 740×360,
in Normal and Calm/safe modes: 48 casts, 288 view-canvas frames and six galleries.

The fixture supplies level 10, spell reserves, an injured hero before each cast,
a passive durable adjacent Orc with a long existing melee wind-up, recovery
reset between casts, and the device-local Wayfarer unlock. The low-health red
rim and healing wash remain native; they are part of this supplied injury
scenario, not newly introduced by the shield/ward or by this review.

Every cast must spend its expected points, create the original style/duration
with immediate impact, advance the real game clock, and leave play active.
Healing must restore health; Shield/Protection must apply their armour effect,
Bless its hit effect, Wild Shape its hide, and Spellguard its existing guard.
All sampled frames retain a renderer-reported warning. Eight runtime source
hashes are verified before and after capture in [captures.json](native/captures.json).

Updates, rendering, asset requests, dice and clocks are not substituted. The
frames sample observed animation times at five effect phases and after expiry;
they do not freeze the game or extend an effect to obtain pictures. Separate
casts have different native healing rolls and are not pixel-matched experiments.
These are controlled action fixtures, not UI Cast-button coverage, an unassisted
run, full-HUD or multi-enemy approval, companion healing, guard absorption,
long-lived buff expiry, performance measurement or physical-device evidence.
The after-expiry frame concerns the short visual effect, not the gameplay buff.

Reviewed galleries:

- [320 Normal](native/320-normal-overview.png) and [Calm/safe](native/320-calm-safe-overview.png)
- [390 Normal](native/390-normal-overview.png) and [Calm/safe](native/390-calm-safe-overview.png)
- [740 short landscape Normal](native/740-normal-overview.png) and [Calm/safe](native/740-calm-safe-overview.png)

## Decisions

| Family | Existing presentation and decision |
|---|---|
| Healing | Twelve small green cross motes rise from the lower view in Normal; Calm keeps three still marks which only fade. Cure Light/Mending Moss last 800ms and Cure Serious 850ms. Retain the native wash/motes; a painted surface would not track these separate rising points. |
| Shields and wards | Mage Shield and Cleric Protection use a thin blue shield outline at the lower centre for 600ms; Spellguard uses the same shape with its own blue and 500ms default visual duration. Preserve the open centre, class colours and their independent gameplay effects. A filled painting would cover the floor/creature currently visible through the outline. |
| Blessing | Bless has a pale-gold diamond and short horizontal rays for 600ms. The mark is distinct from the blue shield; Calm retains fixed rays. Keep its readable silhouette and fade. |
| Wild Shape | A warm brown paw with four toes marks the 700ms transformation; the real shape also changes the hands to claws. Preserve the simple paw and native claws, rather than treating the effect as another shield. |

`arcanefx.js` anchors buff marks at 0.86 of view height and sizes them from the
smaller buffer dimension. That geometry must remain live as the view shortens.
Healing placement is also relative to the current view; Calm changes count and
motion rather than merely swapping a painting. Warning clipping and spell/held
layer order remain unchanged. Existing deterministic regressions independently
check distinct shapes, fade, expiry and fixed Calm bounds; actual-spell tests
check costs/timing. Their synthetic render controls are separate evidence from
the native captures above.

No game code, shipped image, loader, offline entry, allocation, cost, timing or
save field changes. No balance simulation is required for documentation/review
tooling. The runtime remains v0.9.68/build 83; its published tag must stay on the
oil implementation commit rather than move to this later audit publication.

## Verification and next work

[validation.json](validation.json) records local verification. The first capture
attempt requested a nonexistent idle pose key and timed out before any frame;
the corrected harness waits for the existing hurt/wind-up keys at the same
60-second deadline. The original failure is retained outside the repository at
`/workspace/healing-ward-initial-readiness-failure.log`.

Publication requires the documentation-only release-tooling and committed
release-screen checks on both Chromium projects, the mandatory exact-commit
pre-push `npm test`, and every unchanged CI job. Final CI records are retained
outside this immutable audit snapshot; local checks alone are not CI clearance.

No automatic AO atlas follows this review. Use the existing paintings first
when a concrete scene reveals a defect. The roadmap still tracks underlying
Chromium/WebKit reliability, selected landmark/keeper composition and real-device
review separately. Human listening review remains skipped at the owner's request.
