# Batch M regional mapping and reuse audit

Audited 24 October 2026. Five existing `REGIONAL_PROPS` from
`js/regionalprops.js`; source/review work only. No runtime bindings changed.

| Picture | Saved kind / scale | Existing selectors |
|---|---|---|
| crypt_lid | rubble / .55 | road crypts, or theme name containing Catacombs/Crypts |
| iron_scrap | rubble / .55 | dwarves, or forge region |
| roots | rubble / .55 | Mossy Depths, or warrens road |
| reed_bundle | mushrooms / .50 | marsh people |
| elf_shards | rubble / .55 | elves, glass face, or Blue Vaults |

`motion.js` calls regionalProp with THEMES[L.theme], saved kind and fell flag.
The picture comes from `Assets.sprites['dress_'+alias]`, while scale stays
`SIZE[d.k]`, position x+.5+ox/y+.5+oy, yOff 0 and onFloor/dress true. There are
no new saved kinds, placement rules, obstacles, interactions or light sources.
All five objects are decorative regional pictures; they do not become the
smashable containers covered by L's separate audit.

## Existing theme mappings

- crypt_lid: Brown Catacombs, Crimson Crypts, The Ossuary.
- iron_scrap: The Grey Hold, The Old Forges.
- roots: Mossy Depths, The Warrens.
- reed_bundle: The Sunless Marsh.
- elf_shards: Blue Vaults, Obsidian Sanctum, The Dark Elf Halls.

Grey Halls and The Drowned Halls leave both ordinary rubble/mushrooms unchanged;
other themes also leave the unaliased base kind unchanged. All thirteen themes ×
two base kinds are asserted against an explicit expected table at each width.
The same 26 cases check fell=true bypasses all regional selection. Three synthetic
overlapping-selector checks preserve branch precedence: crypt before dwarves,
forge before elves, and glass before Mossy Depths. These are mapping checks,
not new theme definitions.

The preview forces one dressing record in the same open corridor and switches
the actual theme index. Some themes do not ordinarily list rubble in their props;
these captures validate existing picture selection if such a record is present,
not a claim that normal generation emits every combination. Geometry comes from
the fixed combat-clarity layout, not a newly generated regional floor. Existing
lights are copied to invalidate the cached field; no light is added.

Before each painted substitution, the real renderState is checked for the saved
base kind, unchanged record, offsets, scale and floor flags. A second renderState
with fell=true must select the ordinary procedural base image instead. Saved data
is restored to fell=false for the capture, then only its render-frame image is
replaced. No loader override or persistent change is made.

## Art identities and reuse

Crypt lid: low cracked grey-beige slab with three incised strokes and loose stones.
Iron scrap: low ten-tooth gear with a diagonal eye-ended bar and restrained rust.
Roots: short broken crown, spreading roots, three muted green leaves.
Reeds: seven uneven olive/tan stalks with lower binding and small muddy foot.
Elven shards: three dark purple-grey triangular pieces, lavender bevels, base chips.

L's plain rubble and K's workshop/stone scenes do not match these silhouettes.
No whole-cell reuse fits; approved material treatment is reused as reference.
M1 has four cells and M2 one shard cluster, avoiding filler identities. Neither
source needed a painted repair. Whole-object raster crops preserve all tips;
M1 crop boundaries extend across empty nominal gutters without adjacent objects.

## Evidence and limits

44 captures = eleven theme mappings × two distances × two widths. Actual
regional identity, saved scale/record/offsets, floor flags/order and visible
dressing count pass, with no page/console errors. All mappings and precedence
checks are recorded in dungeon/review.json. Source/exports, both overview sheets
and one full-size view per identity were visually reviewed.

Frames and game updates are frozen; theme indices are forced on a fixed layout.
This does not establish live loader/fallback, service-worker caching, native
region generation, navigation, performance or mobile Safari support. Runtime
integration and publication remain pending.
