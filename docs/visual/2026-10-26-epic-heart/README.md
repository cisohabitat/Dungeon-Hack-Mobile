# Epic Heart: the mountain’s first fire

The approved Heart is now a cracked volcanic core, bound in worn rune-cut iron
with a white-gold fire inside. A matching painting places the same core above
the existing low two-step stone dais. The collectible, floor/Pack view, Heart
encounter and Take/Keep cards share this identity. Quench keeps its flask symbol.

[Registered paintings and small-size checks](heart-contact.png).

| Surface | 320px | 390px |
| --- | --- | --- |
| Native floor item | [Floor](320-take-floor.png) | [Floor](390-take-floor.png) |
| Pack detail | [Pack](320-take-pack.png) | [Pack](390-take-pack.png) |
| Heart encounter | [Choice](320-keep-choice.png) | [Choice](390-keep-choice.png) |
| Take card | [Export](320-take-share.png) | [Export](390-take-share.png) |
| Keep card | [Export](320-keep-share.png) | [Export](390-keep-share.png) |

## Sources and export

`art/creatures/heart-polish/generation.json` records both exact prompts, references
and generated source filenames. The core was approved in preview before being
applied; the dais uses that same source as its design reference. Original PNGs
remain unchanged. Uniform Lanczos registration uses visible alpha with a small
fringe and a native row238 baseline, retaining full silhouettes and transparency.
There is no repaint, stretching, automatic shape repair or new gameplay effect.

Reproduce with `python3 art/creatures/heart-polish/export.py --check` (Pillow),
then `python3 tools/export-painted-runtime.py --check`.
`runtime-overrides.json` explicitly selects these two source exports in the common
delivery tool. The historical AF collectible and K dais exports remain unchanged
for provenance. Exactly two of1,550 common delivery images change;1,548 retain
their bytes. Runtime paths and the1,725 shipped-painting count are unchanged.
The collectible and dais procedural fallbacks now use dark stone, iron ribs and
contained fire, preserving the new identity if either painting cannot load.

## Native capture and tests

Reproduce these four sessions with
`node docs/visual/2026-10-26-epic-heart/capture.cjs` (project Playwright and system
Chromium). [Capture metadata](evidence.json) records320/390 widths, native item
scale0.4/onFloor, identical item routing, and unchanged state/dice across the
render-state read. The fixtures reach a generated four-floor crypt finale, then
supply defeated enemies, a nearby item position, inventory and ending knowledge.
Recording is disabled for the snapshot audit; game updates, renderer and controls
remain native. These are supplied-state captures, not unassisted boss victories.
Pack and encounter images wait for decode and their entrance animations.

The existing share-card matrix covers every keeper and all three endings, plus
named/class killers, companions, delayed/corrupt art and offline export. A new
case corrupts both Heart paintings, verifies their own core fallbacks, and confirms
that the Quench painting still loads independently. Full Chromium projects and
the isolated performance budget are required again for the combined release.
No combat, quest gates, item scale, dice, inventory or ending rules change.

Local validation is complete: `npm test` passed all 751 rule checks; all 925
distinct Chromium cases passed (919 parallel and six serial full-cache cases).
The 34 focused share-card cases also passed. [Final release evidence](validation.json)
records source hashes, results and publication authorization. Two early local
performance samples missed the unchanged painted-scene limit; an unchanged main
baseline also missed a scene limit. The paired release sample passed every budget
(33/30.9/34.7/41.6/52.1fps; startup 2392ms). All samples are retained.
CI, including its performance gate and release publisher, must pass before
publication is reported as verified. This record was written before publication. The previously
completed share-card checks are historical evidence for the code-only pass.
Local WebKit and physical iOS checks are not performed in this workspace.
