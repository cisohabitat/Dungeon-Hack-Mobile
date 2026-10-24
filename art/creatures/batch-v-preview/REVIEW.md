# Batch V — interface art consistency

Audit complete; evidence included with runtime release 0.9.33. **Reuse the existing UI artwork. No new painted atlas and no runtime edits.** The reviewed screens already separate compact gameplay sprites, larger approved paintings and scalable interface decoration.

| Area | Decision |
| --- | --- |
| Pack and equipment | Keep small sprites, shared grade borders, slot names and unknown-quality marks. |
| Item details and relic codex | Keep approved relic paintings, enlargement, named sprite fallback and text comparisons. |
| Journal and bestiary | Keep approved creature paintings, discovery silhouettes, statistics and collection disclosures. |
| Shop | Keep item sprites and shared inspection presentation; prices and confirmations remain text. |
| Status and controls | Keep scalable line icons and labelled condition buttons with `!`/`+` cues; retain accessible names and minimum 44px status targets. |

The existing CSS palette, panels, border radii and grade treatments provide a coherent frame system. Raster frames would add scaling and cropping work without resolving a demonstrated painting gap. Existing pixel sprites remain suitable for compact slots; larger paintings retain smooth rendering. This decision does not commission a repaint of items, relics, portraits or monsters.

## Visual evidence

[390px overview](390-overview.png) · [320px overview](320-overview.png) · [capture measurements](captures.json) · [implementation inventory and hashes](inventory.json).

44 native captures and two final overview sheets were visually reviewed. Native 320px/double-text relic and shop-inspection captures were also inspected at full size. The harness uses actual shipped UI at 390/320px, normal 16px text with standard colours and double 32px text with the safe palette. Isolated fixtures reveal two known creatures, one found relic, three carried items, two shop entries and Snared/Dazzled status labels. Pack, relic detail, quest/condition pages, bestiary/relic collections, scrolled paintings, shop inspection and status are captured without substituting images or renderer bindings. Fixtures are not changes to player saves or shipped rules. Captures wait for finite UI animations and image decoding.

At 320px/double text, collection headings/tabs and shop names wrap heavily; the long relic count makes the header tall, and the shop gold label meets the Close button. These are existing density/layout follow-ups, not missing painting work. Scrolling reaches the artwork and controls. The audit does not certify every label/condition/item combination or claim an exhaustive touch-target assessment. Keep future layout work in CSS and text flow, with explicit accessibility checks; do not bake labels into art.

## Validation and limits

Existing Chromium accessibility, double-text/safe-colour, bestiary and relic-portrait browser suites are run at their configured phone/small projects. **49 checks passed (4.3 minutes)**, across the configured projects; the access suite runs its own three viewport shapes under phone. This is 49 total, not 49 per width. These checks include discovered/undiscovered presentation, enlargement, fallback and offline art coverage. They supplement visual review; they do not establish physical iOS or WebKit verification.

Reproduce evidence with `node art/creatures/preview-batch-v.cjs` (Playwright dependency and `/usr/bin/chromium`). `node --check art/creatures/preview-batch-v.cjs`, `npm run check:agents`, `npm run check:art` and `git diff --check` validate tooling/documentation. No balance simulation is needed: no gameplay, controls, timing, visibility or runtime styling changed.

The E–T source integration backlog remains open. Batch W major-screen audit is next; optional X effects still require a demonstrated gap.
