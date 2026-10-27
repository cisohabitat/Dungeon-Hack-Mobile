# Painted-art coverage — 27 October 2026

Audited game revision `ee6e7af0ea7f26d0b3d1b34172f30e756bdb9abf`, v0.9.50.
No missing approved playable art binding was found in the declared inventory.
The main roadmap still marked E–K as pending despite their completed activation;
this documentation phase corrects that status and records the actual remaining
procedural surfaces. No player code, painting, game version or cache changes.

## Inventory and native loader results

| Surface | Coverage | Result |
| --- | --- | --- |
| Encounter props | 42/42 source keys | Painted static bindings |
| Dressing/regional remains | 23/23 source keys | Painted static bindings |
| Item drawers | 93/95 direct keys | Two intentional reserves below |
| Named small items | 47/47 identities | Painted static bindings |
| Traders | Merchant, Wick, Pedlar | Three painted static routes |
| Creature identities | 65 base/named/class identities, 530 supported pose routes | Native painted loader results |
| Keeper/Mimic variants | Five variants, 39 supported pose routes | Native painted loader results |
| Common static catalog | 266 bindings, including rarity aliases | Native image requests/decode |
| Held/carried catalog | 810 held states, 35 carried states | Exact native metadata requests/decode |
| Regional surfaces | 13 themes, including all declared decor/torch/material fields | Required keys present and native requests decoded |
| Contact effects | Four fire and four frost frames | Both native complete-family loaders ready |
| Portrait libraries | Seven living, seven fallen, 53 bestiary/keeper, six companion, 47 relic paths | Files and offline declarations present |
| Common delivery | 1,550 files | All manifest SHA-256 hashes and offline declarations match |

[Machine-readable source inventory](inventory.json) records every creature pose,
theme and portrait path. [Loader results](loaders.json) record 569 resolved
creature pose routes, 1,590 ready world/equipment/material cache entries and no
failed entries or page/console errors. Cache entries include separate rarity
variants; they are not 1,590 distinct shipped files. These counts are additional
views of overlapping data and must not be summed as unique paintings.

Native cached-image contact sheets were inspected for obvious blank/fallback
figures, missing props and inconsistent identity:

- [Creatures/classes/champions](creatures-0.png) and [remaining variants](creatures-64.png).
- [Traders/encounters/dressing](world-0.png), [equipment](world-64.png),
  and [consumables/Heart/keys](world-128.png).

These sheets compose cached native sprites on a diagnostic background. They
are not dungeon screenshots or proof of native action transitions, fitting,
occlusion, balance or every creature's anatomy at every pose. The title-screen
sweep uses native loader objects without replacing images or game functions.
It explicitly requests existing variant keys; separate live-state regressions
check their selection. No reserve pose is treated as a new action.

## Procedural surfaces that remain

Two physical object surfaces still use direct procedural drawing and are listed
as optional AI/AJ in the [atlas roadmap](../../../art/creatures/ATLAS-ROADMAP.md#remaining-procedural-object-conversions--27-october-2026):

1. The ordinary amber lantern in `renderer.js: drawLantern`, selected by the
   existing dark-floor twist. This is separate from the painted blue Wayfarer
   lantern. Review its cage/handle before commissioning a transparent body;
   preserve live flame/glow, placement, sway and Calm behavior.
2. The open reading page in `spellfx.js: drawReading`. Pack scrolls and class
   hands already use paintings. Review/reuse those sources before authoring a
   new open page; preserve writing, burn clipping, embers, colors and timing.

The scan also found expected dynamic layers: bow strings/arrows, sling travel,
missiles and spell geometry; terrain stains, status/trap/death motion; door
damage/fire composition; exact arch/lock geometry; warning/receipt text and UI
vectors. These are intentional drawing systems, with prior bounded reviews in
[X](../../../art/creatures/batch-x-preview/REVIEW.md),
[interactions](../2026-10-27-interactions/README.md) and
[combat effects](../2026-10-27-combat-effects/README.md). A painted static sprite
cannot replace their live geometry without a separate demonstrated need.

The unmatched item keys are not missing player art: `items.js: spriteFor`
routes keys to `key_<color>` and jewels to their seeded appearance, including
after identification. The generic `key` and `amulet_tooth` sources are reserves.
The unused `fountain_hint` legacy sprite has no current source caller outside
its data declaration; regional fountain materials are painted. Grey Halls
retains its exact native stair arch; other painted arches compose within the
same authoritative opening. Failed or loading images intentionally retain
independent procedural fallbacks.

## Reproduction and validation

Run from the repository root, with existing dependencies and system Chromium:

```sh
node docs/visual/2026-10-27-art-coverage/inventory.mjs
node docs/visual/2026-10-27-art-coverage/loaders.cjs
python3 tools/export-painted-runtime.py --check
node art/creatures/audit-named-equipment.mjs --check
```

The common exporter reproduces all 1,550 shipped files/catalog entries. The
named-equipment audit confirms 47 named identities, 31 weapon/shield candidates,
all 31 with source and delivery. Inventory/loader scripts are review tools, not
new CI jobs. The first local launch hit this environment's restricted synchronous
Git subprocess behavior; rerunning the unchanged loader command with process
permission succeeded. No game/assertion changes were made to accommodate it.

All 68 focused Chromium cases passed on their first attempt (34 per phone
project, two workers, 5.5 minutes), with unchanged assertions and no retries:

- Seven elemental-effect checks per project, retaining costs, impact times,
  expiry, bounded painted bursts and Calm behavior.
- Eight painted-world checks per project: general delivery, live boss/class
  selection, all-file offline decode and five door leaf/motion/damage/lock/fire
  checks. This includes 104 controlled regional/opening routes per project;
  controlled fitting is separate from the native opening/closing tests.
- Ten portrait checks per project: installed living/seven-fallen offline
  portraits, all seven class death/export routes and failed/stalled skull loads.
- Nine share-card checks per project: all three native Heart endings for each
  of the three keepers, with keeper caption, outcome symbol and companion art.

```sh
npx playwright test --project=phone --project=small --workers=2 \
  test/browser/painted-world.spec.js test/browser/portraits.spec.js \
  test/browser/elemental-feedback.spec.js test/browser/sharecard.spec.js \
  --grep 'approved world|boss equipment|all activated art|door leaves|closed and sliding|keeps damage|burning door|fallen|skull|painted fire|painted frost|impact|outcome|keeper'
```

The local command uses a wrapper selecting system Chromium, a separate local
server port and fresh server startup; filters, assertions, deadlines and retry
settings are unchanged. Full-cache checks should normally be run serially as
in CI; this bounded local sweep included them with two workers and all passed.
Raw successful output is retained in [focused-browser.log](focused-browser.log).
`npm test` passed, including synchronized agent guidance, art hashes/offline
declarations, release-tool fixtures, types, generation, security, audio/worker
lifecycle and all 751 rules in74 files (rule phase1m15s). Release preparation
correctly leaves v0.9.50/build65/cache125 unchanged. Required CI
and the publication job remain pending at report creation; the successful
statuses on the publication commit are authoritative.

Source/loader completeness does not establish all possible seeded gameplay
states or a physical iOS Safari pass. Existing game rules, dice and timings are
unchanged, so balance simulation is not required for this documentation phase.
