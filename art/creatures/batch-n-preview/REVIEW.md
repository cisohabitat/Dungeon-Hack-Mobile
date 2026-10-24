# Batch N remains review — 24 October 2026

Four low floor-remains paintings are complete: sparse bone fragments,
broken wooden staves/iron, terracotta shards and a dark hide/cloth husk. One source
sheet with two preserved repairs produces four 256px WebPs and one 512px atlas.
This publication contains source/review assets; runtime integration remains pending.

Generated with `image_gen.imagegen` (model not disclosed). Exact prompts, active
procedural and painted material references, generated original paths, repairs,
selected source and authored registration are in
[the manifest](../generation-batch-n.json). Source painting/repairs use the image
tool; exports only extract, uniformly fit and register raster artwork.

## Visual review and registration

Originals/repairs, four active reference cells/group, all individual exports,
[atlas](n1.webp) and [contact sheet](contact-sheet.png) were inspected. Bones have
one small partial empty-eyed skull, two longer bones and short fragments; no
violet eyes, seated body or ribcage heap. Staves retain three broken boards, bent
iron hoop and small wooden head fragment. Four major pottery pieces lie flat,
with gold decoration on two and plain front/right pieces. The generic low husk
has muted dark hide and a tan rag, without a face or upright corpse silhouette.

The first pottery source had an extra large piece and upright wall; repairs
flattened/corrected the composition and removed excess gold decoration. Preserve
all source stages as provenance, using the final complete sheet for exports.
The final remains use aged bone, splintered wood, rusty iron and chipped clay in
the approved gritty painted style. No new gore or living figures were introduced.

Sources are native 1254px squares. Authored top crops extend to y800 through the
empty gutter to retain all bone/hoop tips; lower crops start in the same gutter,
without adjacent artwork. Whole-composition bases place visible alpha at row236
with >=12px margins and maximum height72px. All four stay shallow; no standing
creature normalization or hand-painted script output. `measurements.json` records
source/export hashes, crop bounds, scales and anchors; reproduction passes byte
for byte.

## Phone and timing review

[390px overview](dungeon/390-overview.png) and
[320px overview](dungeon/320-overview.png) show all 24 captures: each key near/far
and beside gold under a standing Goblin. Both overviews, full-size clear views for
every identity and a full-size overlap were reviewed. Floor silhouettes fit the
view; small details deliberately become small at distance. Gold remains visible
and floor sprites stay behind the standing creature. No page/console errors.

56 actual reveal/expiry selection checks preserve strict >450ms reveal and
until>G.t expiry, including exact boundaries and at=0 fallback. Before each
painted substitution, the harness checks the actual key, fractional coordinates,
SIZE, onFloor/yOff and absent dress flag, and unchanged remains record. Overlap
assertions check actual gold/foe selection and floor-before-standing draw order.
See [metrics](dungeon/review.json) and [caller audit](STATE-AUDIT.md).

Creature/container selection, duration and cap are source-audited; no full death,
smash, loot-taking, save migration or normal interaction outcome is claimed.
Updates/render frames are frozen for review. Loader/fallback, offline caching and
performance remain for runtime integration; no gameplay, collision, lighting or
save changes were made.

## Reproduction

- `node art/creatures/reference-batch-n.cjs`
- `python3 art/creatures/export-batch-n.py --check`
- `node art/creatures/preview-batch-n.cjs`
- `npm run check:art`
- `npm run check:agents`

No balance simulations are required for source/review-only artwork. Publication
checks remain separate from this local review.
