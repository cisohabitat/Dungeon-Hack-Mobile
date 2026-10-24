# Batch I — three static traders

Build the roadmap's Merchant, Wick and Pedlar as one transparent source sheet
with three frontal full figures in a horizontal row. Use active `Assets.sprites`
references from `js/folk.js`. Preserve each trader's species, silhouette,
clothes, equipment sides and friendly trade gesture; no invented combat poses.

Merchant: grey Lampfolk, huge pale eyes, drooping ears, patched brown robe,
blanket-topped pack, hanging pan/cup, viewer-left lamp staff and viewer-right coin.
Wick: older grey Lampfolk, brass spectacles, blue-grey hood-back cloak, rust scarf,
no pack; viewer-left held ledger and viewer-right crook lamp.
Pedlar: green goblin, floppy red cap, short stained tunic, belt purse, scavenged
pack with cookware, lantern and packed sword; viewer-left attached charm string
and viewer-right beckoning hand. All have bare feet. Trade items stay attached.

Export one 256px static cell per identity, a combined 768x256 atlas, neutral
contact sheet and measured registration. Preserve true alpha, complete equipment,
12px minimum margins and visible alpha baseline row236. Register each body on x128.
Only raster extraction/scaling/registration is scripted; drawing/repairs use
image_gen.imagegen. Preserve prompts, references and original generated output.

Capture existing dungeon renderer at 390px/320px, near/far. Assert actual trader
selection, scale 0.95, shop names and collision. Check market precedence over the
Wick flag. Review only: do not change loader, shops, facing, collision, service
worker or shipped imagery. Static loading needs a separate integration step.

## User style correction

The original looks too cartoonish. Redraw all three in the same gritty painted
style as the existing monster atlases, using Goblin and Warlord style references.
Replace cute rounded faces and huge glossy pupils with weathered mature facial
anatomy, smaller recessed pupils, muted colours, rough cloth and directional
shading. Preserve trader identities and static equipment/gestures. Keep rejected
source provenance and reproduce a side-by-side monster style comparison.
