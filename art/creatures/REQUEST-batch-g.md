# Batch G — revealed barrel/default Mimic

Scope: one transparent nine-pose barrel Mimic source sheet, reproducible registered
review export and dungeon-fitting previews. No runtime integration/publication.

## Identity authority

`js/creatures.js` retains the legacy barrel drawer: upright wooden staves,
two body iron hoops, round wooden lid with a continuous rear hinge, wet dark
throat and gums, uneven teeth resembling broken staves, one attached long tongue
lolling over the front rim, and exactly two eyes on stalks rooted at knots in the
wood. No chest lock plate, treasure-chest shape, limbs, tentacle legs or new eyes.

The active `alignCreature` repair in `js/creatureidentity.js` currently replaces
that drawer with a chest-shaped fallback for all variants. Preserve this fact in
review records: the legacy barrel capture is a design reference, not current
runtime appearance.

Use the captured legacy barrel reference for construction and the existing
painted chest Mimic atlas for materials/lighting only. The new form is cylindrical
and recognisably a barrel, never a reskinned rectangular chest.

## Nine cells

Row-major: idle, stepA, stepB, windup, strike, recover, special reserve, hurt,
blink. All mouths/eyes face the viewer. There are no legs: stepA/stepB are distinct
left/right rocking/hitching staves with the same asymmetric wood grain and hoops,
not mirrored textures. Idle tongue hangs down front; windup hinges lid farther
back and opens throat; strike extends attached tongue forward; recovery retracts
it; reserve threat does not add a new action; hurt recoils with hinge intact;
blink closes only the stalk eyes, preserving their attached stalks.

Same barrel proportions, lid, iron hoops, wood palette and shared scale across all
cells. No detached teeth/staves, floor, shadows, scenery, text or particles.
Wide transparent margins and gutters. Export 768×768 with 256px cells, visible
bottom on row 236 and at least 12px visible-alpha clearance at other edges.

## Variant safeguards

`js/motion.js` defaults missing/falsey disguise to barrel while concealed, and
currently keeps every non-chest revealed form procedural. Audit explicit barrel
and missing disguise states. Concealed chest/barrel retain `dress_<disguise>`
scenery and never show this creature prematurely. Existing revealed chest Mimics
keep their approved painting. Keep current scale, collision, attacks, tongue
behavior, warnings, save fields and timing. No special-pose or blink object is added; both cells are reserves.

Review original/repair sheets and all final export cells before recording hashes.
Capture supported existing poses at 390px/320px with visible attack warnings and
check concealed/default variant selection. Clearly distinguish review-only
substitution from runtime/offline integration and later publication.
