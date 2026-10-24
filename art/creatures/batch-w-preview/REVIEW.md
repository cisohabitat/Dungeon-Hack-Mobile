# Batch W — major screen illustrations

**Reuse the existing approved artwork.** No new major-screen painting is needed
in the reviewed states. This audit evidence is included with release0.9.34; W changed no runtime files,
shipped pictures or gameplay outcomes.

| Surface | Decision |
| --- | --- |
| Title | Retain the two approved painterly key-art framings. Portrait keeps the Heart above the title; landscape reserves the right side for controls. |
| Loading | Retain the transient dark title fallback while the same art decodes. There is no separate loading illustration to replace. No new boss spoiler is introduced. |
| Prologue | Retain the darkened key art and the selected class's painted face. The background is an emblematic adventurer, not a replacement player portrait. |
| Death | Retain the hero's own face with the existing fallen treatment, cause and epilogue. A generic corpse scene would lose class identity and consume summary space. |
| Take / quench / keep | Retain the selected hero portrait and each outcome's own title and text. A single glowing-Heart victory background would misrepresent the quenched ending. |
| Exported cards | Retain the native 800×420 format, painted hero face and live run details. Compact procedural accents have separate state/content follow-ups below. |

## Evidence

58 native screenshots/downloads, eight final overview sheets and one source/export
comparison layout were visually reviewed (67 review images total).

See the six main galleries: [390px](390-overview.png), [320px](320-overview.png),
[landscape](landscape-overview.png), [desktop](desktop-overview.png),
[390px double text](390-double-overview.png), [320px double text](320-double-overview.png).
The [key-art comparison](keyart-contact.png) lays out the unchanged approved sources
and shipped WebPs; [inventory](inventory.json) records their exact hashes.
[Capture metadata](captures.json) records native state and image-load checks.

The harness exercises actual shipped screens, UI choices, death, Heart pickup,
all three endings, native share downloads, delayed-image recovery and offline
reload/orientation change. Isolated fixtures remove foes, descend to a generated
four-floor crypt and place the hero at its actual Heart. Alternate outcomes use
their existing eligibility flags/items and real encounter buttons. These are
presentation fixtures, not native combat or quest-acquisition coverage. No images,
renderer functions or outcome functions are replaced.

Review includes 390×844, 320×667, 851×393 and 1280×800 viewports, plus both upright
phones at 32px double text. First-visit overlays and normal/Calm title states are
included. Calm is the existing accessibility behavior; captures wait for finite
UI fades rather than hiding animation. All visible images decode, page width stays
within its viewport, and the longer screens scroll vertically. Double text makes
some headings and prose tall; no dense painted background is added behind them.

The mature cavern/stone/ember materials fit the approved dark-fantasy direction.
The two framings are related authored compositions, not interchangeable crops.
Source prompts, references and terms remain in [key-art provenance](../../keyart/SOURCES.md).

## Layout, content and selection follow-ups

At double text, the title fact card can cover the logo and reach into the New
Game area, especially at 320px. See [native 320px capture](320-double-title.png)
and the two double-text galleries. This is a demonstrated overlay/layout issue;
it needs a CSS/disclosure review, not replacement key art. Passing horizontal
width checks does not certify overlap-free controls. This audit records the
issue and does not claim to have fixed it.


`js/endscreen.js` currently sets the winning share-card caption to “and brought
down the Dread Lich” for every keeper, while the on-screen ending correctly uses
`Dungeon.keeperOf`. W's generated four-floor crypt runs exercise the Lich; the
Warlord/Heartforged mismatch is a code-audit finding, not claimed route coverage.
A future content fix should derive the card caption from the actual keeper.

All winning cards also select the generic Heart sprite, including the quench and
keep outcomes. The outcome text differs correctly. Audit whether a smaller
outcome-aware symbol or a text-only card is clearer before commissioning any
new icon. This is not a justification for repainting title scenes or hero faces.
The compact killer/companion accents do not always use their dungeon atlases;
keep card composition and state selection separate from the major-scene audit.

## Validation and limits

Seven existing focused browser checks pass (43.7s): title framing/Calm/opening,
Heart finale timing and quench, death scroll reset, and portrait/share continuity.
Project filters apply: the title/endgame checks run on phone, while portrait/share
continuity runs on phone and small. The capture harness separately covers both
exact phone widths, landscape, desktop and double text.

Reproduce layouts and hashes with `python3 art/creatures/export-batch-w.py --check`;
reproduce native evidence with `node art/creatures/preview-batch-w.cjs` (project
Playwright and system Chromium required). Syntax, docs, art-inventory and diff
checks are run before completion. This audit does not claim WebKit, a physical
iPhone, every quest path, colour contrast certification or new fallback behavior.
No balance simulation is needed: runtime art, rules, visibility, controls, timing,
randomness and saves are unchanged. Batch X's effects audit is now complete; see its separate review.

Regenerate only the diagnostic gallery layouts from existing captures with
`node art/creatures/preview-batch-w.cjs --galleries`. The controlled pending-load
image uses a native CDP screenshot after asserting no web fonts; normal captures
retain Playwright font readiness.
