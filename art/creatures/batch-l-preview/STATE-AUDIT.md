# Batch L caller and reuse audit

Audited 24 October 2026. Source/review assets only; no live loader bindings changed.

## Inventory and presentation

`js/dressing.js` has 18 keys. L covers eleven static identities; Q retains
`flames`, `ripple`, `snare`; N retains four `remains_*` keys. Runtime pictures use
`dress_` prefix in `js/assets.js`, distinct from encounter `PROPS` keys.

| Key | SIZE | Preserved identity |
|---|---:|---|
| barrel | 0.66 | Closed brown stave cask, three iron hoops, visible head |
| oilcask | 0.66 | Dark red cask, two hoops, brass stopper, painted gold flame, oil drip/pool |
| anvil | 0.50 | Cold iron face, left horn, short wooden block; no hearth/tools |
| chest | 0.60 | Closed brown domed lid, three iron straps, brass hasp/keyhole |
| crate | 0.62 | Closed slatted wood, diagonal X bracing, nails/stencil wear |
| shackles | 0.50 | Low floor ring/chain and two open cuffs |
| bones | 0.50 | Low long bones/ribs and one skull with empty dark eyes |
| rubble | 0.55 | Low grey stone spill and grit, no emerging arm |
| candles | 0.46 | Three lit ivory candles, centre tallest, shared wax pool |
| mushrooms | 0.50 | Four pale-stalked teal caps, distinct size order |
| urn | 0.58 | Sealed terracotta vessel, worn gold diagonal band |

`BY_WALL` remains barrel/crate/urn. `motion.js` renders dressing at
`x+.5+ox`, `y+.5+oy`, using saved kind's SIZE, yOff 0, onFloor/dress true.
`regionalProp` can replace rubble with crypt_lid/iron_scrap/roots/elf_shards and
marsh mushrooms with reed_bundle. These five aliases belong to M. Fallen rubble
bypasses regional replacement. Harness assertions check aliases and bypass;
ordinary preview fixtures use fell=true to retain the selected base image.

## Existing interactions and secondary callers

The dressing module introductory comment is incomplete. `scenes.js` SMASHABLE
contains barrel, crate, urn, oilcask and chest. `combat.js` can smash these;
`game.js` Use attacks and walking into one kicks it apart, consuming that step.
Chest loot, seeded container loot, staves/shards remains and oil spill/burst rules
remain unchanged. `elements.js` also bursts oil casks reached by fire. The assets
must preserve these existing cues; no smash, loot or fire outcome is tested here.

`motion.js` uses the same dress_barrel/dress_chest for concealed Mimics, including
default barrel when disguise is absent, at ordinary SIZE with dox/doy offsets.
Revealed creature art remains separate. Previews force all three concealed cases
and assert the real render selection before replacing only the review frame.

Locked puzzle piles reuse dress_chest at scale .5, onFloor true, yOff 0, without
the dress flag. The harness forces an unsolved puzzle/item fixture and checks that
binding. This does not exercise puzzle solving/rewards or native save migration.

`motion.js` falling rocks also use dress_rubble at scale .36 and elevated yOff;
`prelude.js` uses it at .34+.06*s and animated yOff. These are source-audited,
not captured here. Future integration must check both animation callers too.

Candles contribute existing world lights, and procedural candles/mushrooms have
emissive parts. Review frames use five black-wash levels without emissive masks;
therefore captures do not establish equivalent emissive rendering. Integration
must preserve existing lights and decide source masks without adding new lights.

## Reuse decision

No J/K cell is directly reused. K anvil is a workshop scene; its chest is red/gold
and tripwired; rubble contains an arm; bones form a seated gambler; fungus has
five ivory mushrooms with skull/hand; bone_heap has violet eyes. Their composition,
framing or identity differs from ordinary room dressing. Approved originals stay
unchanged. L uses three newly generated sources, with no painted repairs needed.

## Evidence and limits

`dungeon/review.json` records 60 world captures: eleven ordinary keys plus three
concealed Mimic cases and one locked puzzle chest, at 1/3 tiles and 390/320px.
Assertions cover actual asset identity, positions/offsets, SIZE, yOff, onFloor,
dress flags, floor draw order and visible dressing count. Five regional aliases
and fell bypass are checked at each width. No page/console errors were recorded.
Render frames and game updates are frozen for review. These substitutions do not
prove live loading, service-worker caching, emissive masks, performance, normal
interaction outcomes or mobile Safari support.
