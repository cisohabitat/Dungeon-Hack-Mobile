# Batch L room-dressing review — 24 October 2026

Eleven static room-dressing paintings are complete in the gritty,
weathered style of approved monster art. Three original source sheets produce
eleven individual 256px WebPs, two 512px square atlases and one 768×256 strip.
This publication contains source/review assets; runtime integration remains pending.

Generated with `image_gen.imagegen` (model not disclosed). Exact prompts,
references, original generated paths, native source sizes and authored crops
are in [the manifest](../generation-batch-l.json). No painting/recolouring is
performed by export scripts, and no source repair was needed. Sources remain
preserved under art/creatures and generated_images.

## Visual review

Sources, active procedural reference groups, all individual exports, three
atlases and [contact sheet](contact-sheet.png) were inspected. Preserved cues
include three hoops on the barrel; two hoops and painted gold flame on the red
oilcask; plain anvil with left horn and block; closed brown strapped chest;
X-braced crate; two open cuffs; one empty-eyed skull with scattered bones;
plain rubble without an arm; three candles; four teal mushrooms; and sealed
terracotta urn with gold band. Materials use worn wood, rusted iron, aged bone,
wax and chipped clay. No cartoon faces, new living figures or encounter scenery.
The cuffs have dark shaded inner metal surfaces; open cuff splits and gaps
between chain links stay transparent, rather than flattening metal into outlines.

The [caller audit](STATE-AUDIT.md) explains why K/J scenes are not direct reuse,
and corrects the earlier roadmap's description of all dressing as non-interactive:
five containers already have smash/kick behaviour, with oil and chest rules.

## Registration

Author rectangles use native source pixels (1254px squares for L1/L2;
2172×724 for L3), not display-preview dimensions. Shackles extend slightly below
the nominal upper-right grid cell; their authored crop includes the complete cuff
in the empty gutter without including another object. This is raster extraction,
not repainting or reassembling object parts.

Whole-composition ground anchors end visible alpha at row 236 with at least
12px clearance. Uniform fitting preserves low shackles/bones/rubble silhouettes
(max heights 82/96/96px) rather than stretching floor arrangements upright.
`measurements.json` records source/export hashes, crops, bounds, scales and
anchors; the deterministic exporter reproduces every file byte for byte.

## Phone review

[390px overview](dungeon/390-overview.png) and
[320px overview](dungeon/320-overview.png) contain all 60 captures, including
near/far ordinary dressing, three concealed Mimic variants and puzzle chests.
All were visually inspected, with full-size checks of oilcask warning, low
shackles, chest disguise and puzzle chest. Objects remain within the dungeon
view; shallow props intentionally become small at distance. Actual renderer
selection/positions/scale/flags are checked before substituting frozen frames.
No page or console errors were recorded. See [metrics](dungeon/review.json).

These are review-only substitutions. Runtime loader/offline caching, emissive
masks, moving rubble callers, interaction outcomes and performance remain for
integration validation. Black-wash preview levels darken the entire painting,
including flames/caps; they do not reproduce procedural emissive parts. No
world lights, gameplay, collision, choice, loot or save changes were made.

## Reproduction

- `node art/creatures/reference-batch-l.cjs`
- `python3 art/creatures/export-batch-l.py --check`
- `node art/creatures/preview-batch-l.cjs`
- `npm run check:art`
- `npm run check:agents`

Exporter reproduction, inventory/mapping assertions and both-width review passed.
Balance simulations are unnecessary for source/review-only art with no gameplay
changes. Publication checks include the full npm test suite, phone/small release checks and
the required pre-push rerun. CI status is tracked separately.
