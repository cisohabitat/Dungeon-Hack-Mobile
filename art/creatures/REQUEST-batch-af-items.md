# AF — small floor and Pack item pictures

Complete small-item source coverage for95 base `ITEM_ART` keys and47 exact
`namedSprite` identities:142 source selections. Reuse the six active P base
paintings and P's reserved Tooth Charm without changing bytes; paint88 remaining
base keys and47 named small pictures (135 unique new paintings). The existing
47 opaque512px relic portraits remain unchanged and are not transparent floor
sprites. Gold/legendary legacy edges reuse base rasters as before; they do not
require redundant paintings. Every named small identity keeps its own exact key.

Each picture is one isolated object, no hands, bodies, mannequin or scene. Follow
the native small-item reference silhouette, camera angle and material colours;
diagonal weapons retain hilt lower-left/tip upper-right. Armour/cloaks stay empty;
shield fronts differ from AD rear carried views. Pack lantern has its native
hanging ring, rather than AC's closed-fist carry handle. Keep distinct potion
bottle shapes/colours, ring stones/bands, amulet loops, food, oils, charms, quest
objects, five coloured key shapes, gold/gem/Heart and scroll/page distinctions.
Use mature worn painted materials matching approved P equipment and monsters,
clear at32/48/64px; no toy finish, text/captions, external aura or cast shadows.

The first11 eight-cell sheets cover88 base keys, then six sheets cover47 named
keys, with the last sheet's final slot blank. Follow row-major reference order,
full isolated object per cell,8% source margins and complete tips/chains/bow
strings. A bow's string/arrow belong in its small inventory picture; AF must not
alter the separate held bow's live renderer strings. Vashti's small picture keeps
its spare needles; its held view still uses one blade.

Seeded appearances are renderer keys, not item powers. Preserve all potion/ring/
amulet look tables, shared unknown scroll art and actual `Game.spriteFor`
routing before/after identification. Do not replace an unknown ring with a named
power painting. Tooth Charm remains a reserve: its seeded amulet picture persists
after identification. Named worn identities are separate from ordinary seeded
jewellery. Do not expose hidden quality, names, powers or discovery state.

Crop/uniform-scale/translate only, transparent256px source exports with at least
12px clearance. Review all cells, alpha on opaque backgrounds,32/48/64/128px
legibility and both phone widths in source-only Pack/floor fixtures. Preserve
originals/prompts/repairs, existing P pixels, rarity outlines, cached shading,
ground contact and per-key failures. Frozen proxies are not native activation,
offline delivery or performance proof. No gameplay/dice/loot changes.
