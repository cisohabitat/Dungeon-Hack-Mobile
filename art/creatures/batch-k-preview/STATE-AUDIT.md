# Batch K mapping and inventory audit

`PROPS` currently has 42 keys. Batch J covers 17; Batch K covers the remaining
25. The roadmap listed 24 K keys; `bone_heap` is an existing additional prop,
not a newly invented object. J and K together exactly cover the current inventory.

The 24 encounter prop keys serve 28 encounter IDs. Shared mappings stay shared:
`shrine` serves Shrine, Vigil Lamp and Vigil Lamp Out; `bones` serves Gambler and
Ossuary; `barricade` serves Last Stand and War-Camp. Other mappings are one-to-one.
A title does not create an independent drawable state. In particular, the current
Vigil Lamp Out definition still uses the same shrine drawing; this batch does
not introduce an unlit variant or change choice/rung logic.

`js/motion.js` selects `ENCOUNTERS[n.id].sprite` with scale 0.85 and yOff 0.
`js/choices.js` uses the sprite's procedural `url` getter for the encounter card.
`js/meet.js` supplies the available/blocked choices and handles the Vigil rung
redirect. The preview inspects actual definitions and offered button counts,
without answering any choice. The Heart's blocked options remain blocked.

`bone_heap` has distinct callers:

- `js/motion.js`: collapsed Skeleton, scale `mb.scale * 0.95`, with a violet
  rise-progress ring; the original heap art remains the actual binding.
- `js/combat.js`: heap corpse records after bones are broken.
- `js/endscreen.js`: fallback share-card picture when there is no monster portrait.

The new heap must stay a low scattered pile with violet eye sockets, separate
from the seated Gambler's Bones. The review captures early/late progress at near
and far distances using forced collapsed states and the original renderer/ring.
It does not claim to drive combat collapse, revival, corpse animation or end-screen
sharing end to end. The other call sites are code audits.

Object cues to preserve: closed red wired chest vs brown chained strongbox,
three levers, four shields, one highlighted gold book in the middle row, two shrine
candles, violet altar candle/runes, two ruby idol eyes, ten clutch eggs, five pale
mushrooms, five cocoons, two floor dice, and black/blue-black pool water.
Transparent gaps in wells/webs/tripods and authored low pool/heap framing stay
part of their composition. No new obstacles, placement, interaction, dynamic
lighting or state-specific art resolver is introduced by this review batch.
