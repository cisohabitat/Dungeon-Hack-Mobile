# Share-card keeper, outcome and painted-cutout polish

This records the initial code-only pass before the approved Epic Heart refresh.
The [new Heart captures and final combined release checks](../2026-10-26-epic-heart/README.md)
supersede the older Heart images shown in this gallery.

Cards now name the keeper selected by the real delve: Dread Lich, Goblin Warlord
or Heartforged. Their main symbol matches the ending: the carried Heart for
Take, the smiths’ flask for Quench, and the warm Heart on its dais for Keep.
Quench has a cool backdrop and heading. The plain shared line names the actual
ending too. The initial pass reused existing approved art. The combined release also
includes the separate approved Heart replacement; game rules remain unchanged.

[All nine keeper/outcome combinations](endings-contact.png).

| Keeper | Take | Quench | Keep |
| --- | --- | --- | --- |
| Lich | [Card](phone-lich-take.png) | [Card](phone-lich-quench.png) | [Card](phone-lich-keep.png) |
| Warlord | [Card](phone-warlord-take.png) | [Card](phone-warlord-quench.png) | [Card](phone-warlord-keep.png) |
| Heartforged | [Card](phone-heartforged-take.png) | [Card](phone-heartforged-quench.png) | [Card](phone-heartforged-keep.png) |

## Killer and companion identity

Cards use the existing canonical idle dungeon paintings for killers and living
companions. Named champions keep their exact identity. Class Shades use the
current floor’s bones to select their own class gear; unknown or unsupported
legacy gear falls back to remains, never a guessed Fighter. These static accents
do not claim to reconstruct the animation or boss phase of the final blow.

[Ogre, Grisk, Skarrow and Mage Shade exports](killers-contact.png).
All six companion kinds are covered by the nine ending fixtures. On a death,
the companion is named but not drawn next to the killer. Fallen companions,
companions on another floor, and unknown imported kinds are omitted.
The hero’s living/skull portrait and earned mastery frame remain intact.

## Loading and native evidence

`prepareArt()` starts only the card’s selected pictures and allows a bounded
1.5-second wait alongside the hero portrait. It draws the current cached images,
so a decode during that wait can replace a fallback. Corrupt art remains on its
own fallback; stalled images cannot prevent export, and a later export upgrades
when the image arrives. No new assets or modules need offline delivery.
The UI retains the current-run guard before sharing.

`sharecard.spec.js` covers both phone Chromium projects. The nine keeper/ending
fixtures reach generated final floors using native stairs and route choice,
assert the actual generated keeper, then supply its defeat by clearing enemies.
They take the generated Heart through the real encounter choice and export
through the actual button. Thus they cover real finale transitions, not an
unassisted boss fight. Extra resources and companions are supplied fixtures.
The offline fixture supplies a Heart after a native installed-game reload with
network access disabled. No image or DOM art is substituted in successful cases.

Tests compare the actual PNG’s pixels exactly against the current painted card,
check selected art identity separately, verify keeper/outcome words and unchanged
player/options/statistics, and exercise companion exclusion, named/class killers,
corrupt and stalled images, late upgrades and installed offline export.
The first six failures were fixture errors: the Warlord was checked before the
route fork. After reaching the actual keeper floors, all 32 focused cases passed.

Reproduce with `npx playwright test 'sharecard.spec.js$' --project=phone --project=small --workers=2`.
This container uses system Chromium through the local config override.
In full-suite runs, the offline ending fixture joins the existing full-cache
install cases on one worker; their deadlines and assertions are unchanged.

Local validation is complete. `npm test` passed, including 751 rule checks.
Both full Chromium projects ran: 916 cases passed and one existing companion
assertion failed in the parallel run (1.1h). That exact unchanged test passed all
three isolated rechecks (21.7s). Its immediate sprite check accepts only rest or
wind-up even though the unchanged renderer can select walking/blinking poses;
the goblin was recruited and opened the lock successfully before the assertion.
No assertion, deadline or companion runtime code was changed for this recheck.
All six serial full-cache checks passed (2.9m), including both native offline
ending exports. Together, all 923 distinct browser cases have passing results.
The 32 earlier focused cases also passed; the full run covers the later invalid-ID
fallback guard and updated News text.

The isolated 4× CPU performance recheck passed: fight 35.5fps, wide 33.6,
flooded 34.3, painted 33.8, rite 47.4; startup 2127ms. The first run had one failure,
painted 29.4fps against the unchanged 30fps budget; the other scenes passed.
Both measurements and the browser recheck are retained in [validation.json](validation.json).
No performance limit or browser deadline changed. Type checks, art/offline
inventory, guidance sync and whitespace checks passed.
This historical record predates the combined Heart release; its final validation
is linked above. Publication is authorized for v0.9.44. Screenshots are
phone-viewport Chromium evidence, not a physical iOS pass.
