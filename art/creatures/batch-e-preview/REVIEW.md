# Batch E source and preview review — 23 October 2026

Six fallen class Shades: Spellblade, Thief, Mage, Cleric, Ranger and Druid.
Generated with `image_gen.imagegen`; the model was not disclosed. Actual prompts,
references, original generated paths, repairs and measured registration are in
`../generation-batch-e.json`. Originals and both full-sheet repairs are preserved.

## Visual findings

All six original sheets, both selected repair sheets and all 54 final export cells
were inspected. Spellblade retains a silver cage lantern below the closed left
fist; Thief retains hood/shield; Cleric has a pale tabard and sun emblem; Mage
retains violet robes and staff; Ranger retains hood, bow/string and quiver; Druid
retains leaf mantle, long hair and attached leaf staff. All retain the existing
right-hand Shade sword, and float without boots or legs. Staff/bow/lantern sides
remain consistent through sword windup, strike and recovery.

The original Mage and Ranger sheets had living faces and are rejected as final
selections. Mage's selected full-sheet repair replaces exposed faces and hands
with skeletal anatomy. Ranger's selected repair replaces the face with a frontal
skull and restores a hood across all poses. Full-sheet repairs retain coherent
palettes rather than mixing a differently lit replacement head into one cell.
The Druid intentionally has a quieter grey-green spectral palette; the others
have stronger blue fringe. This difference is recorded, not automatically tinted.

## Registration and limitations

One uniform scale per class, measured upper-torso anchors and a fixed target
anchor align bodies independently of changing robe fringe. Every export cell
retains at least 12px of visible-alpha clearance, including raised weapons and
staff ornaments. Exporter checks source clipping, output clipping and margins.
No character drawing or recoloring occurs in the exporter.

The three top-row cells are neutral/drift studies, not walking legs. Special is a
reserve brace. Current floating Shades have no walking objects and no dedicated
special pose object. Dimmed-eye/neutral skull variants stand in for blink; this is
not a claim that every class depicts anatomical eyelid closure. Hurt and recovery
retain a frontal head with upper-body recoil, not a new stagger mechanic.

## Dungeon review

`node art/creatures/preview-batch-e.cjs` produces 72 captures: six classes × six
supported poses × two widths (390px and 320px). Both overview sheets were visually
inspected for identity, fitting and visible windup warnings. No page/console
errors were reported. The transient floor announcement is hidden in this review
harness so it cannot obscure faces. Character labels use a named fallen hero.

**These are review substitutions.** The harness routes the existing Shade image
request to the chosen review atlas, binds existing procedural class pose objects
in an isolated loader instance and freezes each selected painted draw. It does
not remove the shipped renderer's class guard or modify game rules. These
captures establish fitting and warning visibility, not integration, save/load,
Calm view, atlas-failure isolation or native offline correctness.

## Reproduction and next stage

- `python3 art/creatures/export-batch-e.py --check`: verifies six review atlases,
  neutral/drift/action comparisons and measurements byte-for-byte.
- `node art/creatures/preview-batch-e.cjs`: requires `npm ci` and system Chromium;
  `CHROMIUM_PATH` can override `/usr/bin/chromium`.
- `npm run check:art`: checks recorded reviewed hashes, including these sources
  and review exports. It does not establish visual quality.

No `img/creatures/` exports, runtime bindings, service worker entries, release
numbers or gameplay files change in this stage. Next: integrate exact class elite
objects, retain procedural fallback before gear/atlas readiness and on failure,
and run real-loader browser, offline and performance validation before publication.
