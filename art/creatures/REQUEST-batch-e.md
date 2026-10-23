# Batch E — fallen class Shades

Scope: six class-specific source sheets and registered review atlases. Generation
and review do not assert runtime integration or publication. Follow
ATLAS-ROADMAP.md and the shared direction in ATLAS-BRIEFS.md.

## Shared construction

Nine complete frontal figures, transparent background, wide clear gutters and
intact weapon tips. Uniform body scale and consistent class equipment. Hovering
ragged lower body with attached spectral mist, no legs, boots or ground shadow.
Skull/shadowed undead face, blue eye light, no living skin. Keep class clothing
recognisable in cold spectral colours. No detached decorations or mist blobs.
Measure upper-torso centres in each source frame; fringe length must not drive
vertical registration. Export 256px cells in a 768px square atlas.

Row-major: idle, reserve drift A, reserve drift B, sword windup, forward sword
strike, recovery, reserve brace, hurt, dimmed-eye idle/blink. Floating Shades have
no walking objects. Reserve cells do not create new actions. Current supported
pose inventory derives from POSES.shade and its generated reaction/attack poses.

## Identity briefs

All six retain the current Shade sword in anatomical right hand (viewer left).
The portrait is a clothing reference, not a requirement to resurrect a living
person. References include the reviewed Batch D spectral body and current class
portraits; current SHADE_GEAR remains the equipment authority.

- **Spellblade:** charcoal/slate embroidered hood and mantle, silver fittings,
  chainmail accents. Silver cage lantern hangs below a closed left fist from an
  intact carry handle; small blue flame stays inside cage. No shield.
- **Thief:** blue-grey hood and cloak, ragged spectral leather; current shield
  in left hand. No new dual-dagger combat kit.
- **Mage:** cold blue-violet robe, restrained trim, short curled grey hair/beard
  on spectral head. Left hand carries a straight staff with pale crystal focus.
  Retain sword attacks; no invented spellcasting animation.
- **Cleric:** pale tabard over mail, restrained sun emblem, short curled hair on
  spectral head; current left-hand shield. No mitre, living face or new mace.
- **Ranger:** cold green hood and cloak, quiver behind shoulder, left-hand bow
  with attached string; sword attack remains the current action. No new arrows.
- **Druid:** muted spectral green leaf mantle and leaf brow, long grey hair,
  leaf-tipped staff in left hand. No antlers or invented casting action.

## Review gates

Inspect all nine source figures and all nine exported cells per class, including
closed grips, consistent held sides and distinct supported attacks. Preserve
original sheets and repairs. Record exact prompts and registration in
`generation-batch-e.json`; reproducible exports belong in `batch-e-preview/`.
Do not record reviewed hashes before visual inspection. A later integration must
bind the exact class elite objects and maintain procedural fallback during both
atlas loading/failure and deferred class-gear preparation. Runtime previews,
offline and release validation must precede claims of shipped coverage.
