# Batch N remains caller and timing audit

Audited 24 October 2026. Four existing DRESSING remains keys in dress_* namespace.
Source/review assets only; no live bindings or death/container rules changed.

| Picture | SIZE | Existing caller |
|---|---:|---|
| remains_bones | .46 | Eligible undead, skeleton or bat in combat.fallen |
| remains_husk | .50 | Other eligible creatures in combat.fallen |
| remains_staves | .42 | Smashed barrel/crate/oilcask/chest in scenes.smash |
| remains_shards | .40 | Smashed urn in scenes.smash |

`combat.js` excludes base sprites wraith, slime, lich, shade and puffcap from
persistent remains. Other eligible undead/bats use the generic bone picture,
not new species-specific art. Other eligible creatures use the same neutral husk.
The falling corpse/particles are separate from persistent remains; K bone_heap is
also separate, including its collapsed Skeleton/rising-ring callers.

Creature remains last REMAINS_MS=240000 game milliseconds. Both creature deaths
and container smashes filter expired records and retain at most sixteen entries.
Container remains have at=G.t-1000 and until=G.t+REMAINS_MS*2, so their eight-minute
remains are already past the reveal delay. Urn uses pottery; other smashable
containers use wood/iron. Chest loot, seeded container loot and oil spill/fire
behaviour remain untouched. pruneRemains filters by until>G.t on return to a floor.
These caller mappings/durations are source-audited, not exercised death or smash
outcomes in this preview.

`motion.js` selects a record only when until>G.t and G.t-(at||0)>450. Its world
coordinates are already centred/fractional; no extra .5 or dressing ox/oy is added.
Render scale is SIZE[r.k], yOff0, onFloor true; there is no dress flag. The
renderer sorts floor sprites behind standing sprites using its existing depth
bias. Static decoration, regional aliases and generic corpses are not replaced.

## Reuse decision

L's decorative bones have full long bones/ribs and a larger skull composition.
K's gambler bones are seated; K heap has violet eyes and collapsed-state identity.
None fits the sparse fragments. L containers are intact, and M elven shards are
dark purple-grey stone rather than terracotta. Their material treatment is a
reference, with four new compositions on one source sheet. No whole-cell reuse.

The first source's pottery had five major pieces and an upright wall. A full-sheet
repair flattened it to four; a second removed the surplus gold stripe from the
right-hand piece. Selected sheet keeps two decorated pieces, plain front/right
pieces, complete wood/bone tips and low neutral husk/cloth. All originals/repairs
and exact prompts/paths are retained. Exports only crop, fit and register raster.

## Preview evidence

The harness freezes game updates and sets G.t=10000 for exact timing boundaries.
For each key at each width it checks ages449/450 invisible, age451 visible,
until=G.t-1/G.t invisible, until=G.t+1 visible and at=0 fallback visible:
28 real renderState selections per width, 56 total. These use actual procedural
bindings before any painted frame substitution.

24 captures = four keys × (near clear, far clear, near with gold+Goblin) × two
widths. Assertions cover actual key, SIZE, fractional coordinates, unchanged
record, yOff0/onFloor and absent dress flag. Overlap cases check the actual gold
and standing Goblin, all floor draws precede the standing draw and one foe is
shown. Both galleries and full-size identity/overlap views were visually reviewed.
No page/console errors were recorded. Gold remains readable between the Goblin's
feet, and remains stay low without covering the creature or HUD.

Frozen substitutions do not establish live loader/fallback, offline caching,
save migration, normal combat/smash outcomes, performance or mobile Safari support.
Source/review assets are published; runtime integration remains pending. Batch M source/review assets are published alongside N.
