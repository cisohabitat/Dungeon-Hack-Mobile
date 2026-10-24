# Batch O texture/architecture format audit

Audited 24 October 2026 against assets.js, regionart.js, looks.js and renderer.js.
Batch O's commissioned scope is thirteen baseline wall/floor/ceiling sets, not a
replacement for every architectural state or surface variant. M/N source/review assets are published alongside this pass.

## Native formats and sampling

Assets.TEX=64, a power of two. Walls are 64px canvases; floor and ceiling surfaces
have eight opaque Uint32Array darkness levels, each 4096 entries. For level l,
each RGB channel is truncated after multiplication by 1-l/7, with alpha 255. Level 7
is opaque black. Renderer texel coordinates wrap with &(TEX-1); changing tile size
requires coordinated renderer changes. High-resolution256 files are review detail,
not loaded by a new runtime path. Source images are opaque three-panel strips.

The renderer caches softened floor/ceiling arrays and wall surfaces beyond three
tiles, retaining crisp near detail. Existing light/fog, floor-edge shade, own-light
and wall-face shade still apply. There is no emissive channel or new world light.
Batch O exports use diffuse material detail, no torch, hole, new path or painted
pool cue. Both marsh and drowned floors remain solid ground rather than water.
Existing material reflections/relief are colour only, not additional lights.

The procedural pipeline bakes regional wall/floor details and wall foot shading,
then derives architecture and lazy variants. Integrating painted bases requires a
specific decision about those overlays/derived frames; loading a source PNG does
not automatically preserve them. Do not bind review images without this audit.

## Existing inventory kept procedural

looks.js has seven floors: room, path, mosaic, altar, water, rubble, straw; four
roofs: rock, beams, roots, cave; three wall kinds: plain, rock, fallen. Assets also
has alternate/damp/cracked walls, rock pillars, decor and torches. None of these
secondary variants is repainted here. No creature-style sprite anchors are used.

State-bearing architecture includes plank doors and coloured locks, barred cell
doors/locks, stairs up/down, arch/recess/back pieces, pillars, wet/dry fountains
and animated torches. STAIR_OPEN=21/64 drives the arch opening and related
perspective. Door/recess sampling, lock colours, transparent openings and secret
walls must retain existing meanings. No new painted door/arch/stair was needed to
fill an asset gap; the current states exist and require a coordinated material
pass if their base wall palette changes during integration. This is an explicit
architecture follow-up, not a claim that all Batch O architecture is painted.

## Coverage

Thirteen themes each have one wall, base floor and base ceiling: Grey Halls,
Brown Catacombs, Mossy Depths, Blue Vaults, Crimson Crypts, Obsidian Sanctum,
The Ossuary, The Warrens, The Dark Elf Halls, The Grey Hold, The Sunless Marsh,
The Drowned Halls and The Old Forges. 39 native 64px tiles, 39 detail 256px tiles and
39 native 3×3 repeat panels are deterministic exports from thirteen source
strips; one full-strip marsh repair is preserved. No pixel synthesis, recolour,
seam blending or drawing is done by exporter scripts.

## Controlled renderer review

preview-batch-o.cjs decodes each native tile and creates the existing eight-level
arrays, checking every RGB channel/alpha/black endpoint. It uses a temporary theme
proxy and a fixed 9×13 material booth, with near wall and long floor/corridor views
at 390px/320px. For isolation, the proxy unifies ordinary alternate/cracked wall
selection and disables decals within the booth; neutral look metadata selects
base roof even for Warrens rooms that normally use beams. This is intentional
review setup, not live variant replacement or native region generation.

The proxy leaves actual door, stair, fountain, key-coloured locks/cell locks and
non-base floor/roof objects unchanged. Assertions check identity before capture,
and originals are restored and checked for mutation afterward. These establish
that the harness retains the old objects, not that old architecture visually
matches new materials or that every state has been exercised. 52 captures cover
13 themes ×2 views ×2 widths, with no page/console errors. Each width verifies
208 cached floor/ceiling levels. Raw level storage is 262144 bytes/theme, equal in
dimensions to the existing format; this is not a measured total memory budget.

Native offline reload, procedural fallback/load failures, cache invalidation,
secret-wall equivalence, variant/architecture transitions, native regional floors,
texture switching/low-memory behaviour and isolated frame-rate checks remain
integration gates. None is established by these source-only previews. No app,
service-worker, gameplay, collision, navigation or save files changed.
