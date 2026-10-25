# AA activation: ranged, bows, rare, released greatsword and Penitent

Release 0.9.38, build 53, offline cache `deepdelve-v113` activates all 116 pending
held frames. The prior five source reviews remain historical evidence of painting
selection, image-tool attempts, rejected repairs, registration and source fixtures.
This directory records their subsequent native integration.

| Source batch | Newly active frames |
| --- | ---: |
| aa-ranged: sling, throwing knife, hand crossbow | 17 |
| aa-bows: missing shortbow/longbow classes | 9 |
| aa-rare: scimitar and dwarfhammer classes | 63 |
| aa-greatsword: Fighter released-hand CUT poses | 9 |
| aa-penitent: exact Fighter/Cleric named flail | 18 |

Every new runtime PNG matches its reviewed source export byte for byte. All 460
previous common delivery records and files retain identical bytes. The common
exporter now reproduces 576 files; the catalog has 405 held frames and the game
ships 744 paintings plus 3 app icons. New compressed runtime art totals 2,027,593
bytes. `activation-audit.json` records these counts.

The existing exact family loader and renderer activate the new catalog entries;
neither implementation nor gameplay rules changed. Spellblade scimitar keeps one
18-state family across plain/reflected variants. Fighter greatsword keeps one
18-state family across two-hand and released-hand poses. Named Penitent uses
`relic_penitent` from an actual `t:flail,u:penitent` item; ordinary flail art never
counts as named coverage. All 116 runtime paths are precached by the service worker.

## Native actions and visual review

Run `node art/creatures/preview-batch-aa-runtime116.cjs` with the local server and
installed Chromium as described in the script. `captures.json` records 50 sessions:
25 legal class/equipment variants at each of 390px and 320px. Real class creation,
equipment eligibility/equip, attack, reading, drinking and legal caster spells run
with native updates and the native loader. Spellblade plain evidence removes the
actual lantern. A passive canvas observer forwards all native calls unchanged.
There are no asset routes, renderer substitutions or frozen update loops.

All 164 actions advanced game time and drew the selected painted family. Assertions
require an empty sling pouch after launch, full bow draw and released greatsword
keys while using a scroll or potion. Every session also exercises Calm and a native
offline Continue reload; all 405 held frames are cached in each of the 50 reloads.
The 742 captures are assembled into 50 galleries, all visually inspected at both
widths for fitting, connected construction, class materials and action transitions.
All 792 native PNGs are registered by SHA256 in `art/review.json`. No page or console
errors were recorded.

Setup supplies legal equipment, resources and a durable target and clears scenery.
These captures establish native integration, actions and offline delivery; they
do not establish unassisted combat, quest progression or real-device iOS behavior.
Live action hands, strings/arrows and moving projectiles remain procedural.

## Regression and release verification

The focused painted-world/release run passed all 56 checks across phone and small.
Seven new corrupt-image cases require whole-family procedural fallback while an
independent family still loads, including exact named identity, both greatsword
hand counts and both Spellblade lighting variants. New fitting coverage checks 125
new/protected bindings at three renderer heights (375 checks per viewport), exact
current-pose drawing and unchanged run/Dice/Odds state. Existing 642-binding coverage
remains. A native overlap regression starts a greatsword attack, uses an actual
scroll or potion during the swing, checks released non-rest art and subsequent
restoration of the two-hand rest frame.

All 837 Chromium cases completed across phone (558) and small (279): 834 passed
in the four-worker run, and three timing failures passed unchanged on one worker.
Those failures were the phone background-preparation deadline and initial offline
ready-status deadlines on both viewports; assertions and time limits were retained.
The isolated 4x CPU-throttled performance gate passed: fight43.2, wide40.9,
flooded44.6, painted39.3 and rite58.6 fps; start1795ms. `npm test` passed, including
types, generator, art, security, release, offline and zero-failure rule checks.
All five source exporters, the 576-file common exporter, guidance synchronization
and exact named inventory checks pass. `validation.json` records the local results.

Publication still requires every CI job, including WebKit and version publication,
and verification that the public deployment serves the published commit and art.
CI and public results belong to that exact commit and are checked after the push.

## Remaining painting work

The named inventory has 47 identities, 31 held weapon/shield candidates and one
delivered held family (Penitent). Thirty held candidates still lack held source.
Dawnbringer for Fighter/Cleric is next, followed by The Ogre's Toll and the remaining
named blade, staff, bow, spear and carried families. Worn/inventory/portrait art and
carried source sheets are separate coverage categories.
