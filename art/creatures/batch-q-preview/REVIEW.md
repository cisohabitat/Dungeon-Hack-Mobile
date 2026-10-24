# Batch Q effects review — 24 October 2026

Eleven source/review cells are complete locally: three static world sprites
(flames, ripple, snare), four fire impact phases and four frost impact phases.
Source/review assets are published; runtime integration remains pending. Batch P is published alongside this batch.

## Selected art

See [contact sheet](contact-sheet.png), [alpha review](alpha-review.png) and
[manifest](../generation-batch-q.json) for exact prompts, references, generated
originals, selected sources and rejected repairs. Generated with image_gen.imagegen;
model not disclosed. Export scripts crop, uniformly scale and assemble only.
The first frost source was too symmetric; its first sliver repair retained petal
shapes and clipped a tip. Both remain rejected provenance. The selected chips
source has seven separate ice fragments, open gaps and four expanding phases.
Fire retains an organic amber curl and pale hot centre. World water stays low,
without an exposed Drowned; snare retains a low loop and two wooden pegs.
All originals, selected cells, contact/alpha sheets and six phone galleries were
visually reviewed. Alpha composites retain transparent gaps without rectangular
black mattes. Fire has soft coloured smoke edges on light backgrounds.

## Registration

World cells use authored scene bounds, row-236 visible bottoms and >=12px clearance;
ripple/snare have low framing. Impact families share one uniform scale per family
and fixed target origin (128,128), preserving expansion rather than normalizing
each frame independently. Straight RGBA exports retain source brightness; fading
is external. Measurements and hashes are in [measurements](measurements.json).
Reproduce with `python3 art/creatures/export-batch-q.py --check`.

## Browser review and limits

The [390px world gallery](dungeon/390-world-overview.png),
[impact gallery](dungeon/390-impacts-overview.png) and
[procedural controls](dungeon/390-controls-overview.png), plus corresponding
320px galleries, cover 88 frozen captures: 28 world, 42 impact, 18 controls.
Normal impact candidates are stamped before held gear; Orc intent and warning
remain visible. Late phases deliberately become faint under existing fade curves.
Calm and safe warning palette controls retain their current meanings. Poison
retains its rim and Poisoned status chip. Triggered traps remain procedural.

52 actual module pixel checks verify before/within/after lifetime gates across
both widths. The existing elemental-feedback Playwright suite passed 14 tests
at phone/small widths, covering actual spell costs, damage and feedback timing.
No console/page errors were recorded in the review harness. Frozen fixtures are
not native casts or trap outcomes. The pillar pre-impact fixture is before birth;
other pre-impact fixtures are within lifetime but before the hit gate. The suite
separately covers native timing. No six-target, FPS, offline or cache claim is made.
See [state/format audit](STATE-AUDIT.md) for retained rendering and integration gates.
