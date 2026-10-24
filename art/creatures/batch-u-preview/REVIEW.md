# Batch U portrait reuse review — 24 October 2026

Batch U is complete as a reuse audit: all seven hero portraits already
have approved paintings and appropriate native bindings. No new painting or
replacement is needed. Existing portrait assets are already published, integrated
and cached offline; this audit evidence is included with runtime release 0.9.33.
This decision follows U’s requirement to commission only demonstrated gaps.

See [portrait contact](contact-sheet.png), [small-size review](size-review.png),
[active source/export hashes](inventory.json) and [audit manifest](../generation-batch-u.json).
Existing generation prompts, original outputs and the approved six-class refinement
remain in [portrait provenance](../../portraits/generation.json) and
[source notes](../../portraits/SOURCES.md). No image-generation tool was invoked
for U. Layout scripts only resize existing exports and assemble review evidence.

## Visual findings and reuse

Fighter retains beard, nasal helmet, mail and red cloth; Cleric has short curls,
ivory cloth and sun emblem; Mage retains grey hair/beard, dark blue cloth and
geometric clasp; Thief has a charcoal hood/dark leather; Ranger has red hair/beard,
green-brown wrap and bow/quiver; Druid has long dark/grey curls, restrained leaves
and spiral pendant. Distinct faces and class equipment remain readable at48/96/
128px. All six use the approved quieter backgrounds and mature painted materials.
Wayfarer remains the distinct hooded living hero with silver lantern, rune sword
and dramatic gateway background. Its approved composition differs deliberately
from the quiet public-class set; no identity is replaced to force a uniform crop.

The approved refinement sheet, seven selected source crops/Wayfarer source,
contact/size panels and four final screen galleries were inspected. No selected
source, shipped WebP, crop, palette or portrait binding changes. Heroes are not
replaced by fallen Shades, champions, boss or companion art. Ending greyscale and
mastery borders remain existing UI treatments, not new portrait variants.

## Actual UI evidence

42 captures/native downloads at 390/320px use the shipped portraits with no image
substitution or renderer override. Each width covers the six-class picker, six
collapsed/expanded portraits and matching stories, seven-class unlocked picker,
Wayfarer collapsed/expanded portrait, prologue, hero sheet, ending, native800x420
share card and an offline reload showing all seven512px portraits. Native screen
fade animations finish before capture; prologue portrait is scrolled into view.

See [390 selection](screens/390-selection-overview.png),
[320 selection](screens/320-selection-overview.png),
[390 Wayfarer](screens/390-wayfarer-overview.png) and
[320 Wayfarer](screens/320-wayfarer-overview.png).
[Native share card](screens/390-spellblade-share.png) retains the same face.
Square framing, image-rendering:auto, correct URLs/natural size, unchanged public
class count, hidden unlock, matching backstories and no horizontal overflow pass.
No page/console errors were recorded. There are no newly authored portrait bytes.

32 existing browser checks passed:30 class/boss/relic portrait tests selected by
the portraits.spec.js suffix filter, plus two focused Wayfarer unlock tests, across
phone/small. The class tests cover missing Fighter fallback, mastery frames,
identity through story/sheet/ending/share and offline loading. The audit harness
additionally verifies all seven after actual unlocked offline reload. This is
Chromium phone evidence; no new WebKit, double-text or full accessibility claim.

The existing portrait exporter --check reproduces all16 class/keeper/companion
WebPs from current sources. U introduces no loader, service-worker, game-rule,
asset replacement or runtime integration task. Broader E–T integration and V–X
proposals remain separate roadmap work.

Reproduce audit sheets with `python3 art/creatures/export-batch-u.py --check`
and actual native screen captures with `node art/creatures/preview-batch-u.cjs`.
