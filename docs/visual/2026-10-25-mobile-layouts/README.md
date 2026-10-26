# Enlarged-text menu layout polish

Release v0.9.42. The user authorised publication on26October2026; the GitHub Actions run for the release commit records final CI and version publication.

## Problem and change

At double text size, the title's absolutely positioned fact card covered the logo and New Game area. Trader balances could paint over Close or outside the phone, while item descriptions were squeezed beside purchase/inspection buttons. Fixed two-column Journal tabs could split a single label across lines.

The enlarged-text styles now give title facts and returning-player News their own space before the logo. The landscape logo aligns with the first menu controls. Shop and Journal headers keep Close on the title row and put the balance/count on a separate wrapping row. Journal columns follow the enlarged font size; shop item/service buttons sit below their descriptions. Screens retain native vertical scrolling.

Normal-text styling and game rules are unchanged. These are title and paused-overlay layouts; they do not change combat controls, targeting, timing or information shown during play, so balance simulations are not needed. Existing illustrations and sprites are reused.

## Native visual evidence

| View | Before | After |
|---|---|---|
| 320px title, double text | [Overlap](before-320-title.png) | [Clear greeting and logo](after-320-title.png) · [after dismissal](after-320-title-dismissed.png) |
| 390px title, double text | [Overlap](before-390-title.png) | [Reflowed](after-390-title.png) |
| Landscape title, double text | [Overlap](before-740-title.png) | [Reflowed](after-740-title.png) · [after dismissal](after-740-title-dismissed.png) |
| 320px shop, double text | [Header/description collision](before-320-header.png) | [Separate rows and readable description](after-320-shop.png) |
| 390px shop, double text | [Crowded header](before-390-header.png) | [Reflowed](after-390-shop.png) |
| Journal labels, double text | Historical V audit records the gap | [320px](after-320-journal.png) · [390px](after-390-journal.png) · [landscape](after-740-journal.png) |

Before screenshots come from the reproduced regression failures. After screenshots use native UI, a real longest title fact and a supplied trader with a long balance. Hero rolls and prices may differ between fixtures. Neither images nor renderers are substituted. The captures are 320×667, 390×844 and 740×360 CSS pixels at a 32px root font; the before test captures use the project's device pixel ratio. Fixtures are not unassisted gameplay or physical iOS checks.

Reproduce the after samples with `node docs/visual/2026-10-25-mobile-layouts/capture.cjs` (installed Playwright and system Chromium). [Capture metadata](evidence.json).

## Regression coverage and validation

Six new `access.spec.js` cases cover both portrait widths and landscape. They check longest-fact and returning News placement, a visible logo, usable New Game/dismiss controls, header glyphs clear of Close, no header overflow, unsplit item/tab labels, native Inspect without arming payment, and native overlay dismissal. On the original CSS, five of the six initial checks failed; the initial layout fix passed all six. The final checks also cover the returning News and visible landscape logo.

Final local validation passed: `npm test` including751 rules; both full Chromium projects (869 parallel cases in55.7 minutes plus four full-cache cases on one worker,873 distinct cases total); and six strengthened layout rechecks, which also assert that Inspect leaves gold, inventory and stock unchanged. There were no failures. The isolated 4× CPU budget passed: fight37.8fps, wide40.4, flooded40.2, painted34.7, rite52.2; startup2089ms. Syntax, guidance synchronization and whitespace checks passed. [Recorded validation and source hashes](validation.json). Local WebKit and physical iOS checks were not performed. The separate earlier art-review capture correction is included in the same release. Ending/share-card keeper captions and outcome symbols remain open follow-ups.
