# Phase 3: small-phone clarity

Reviewed native title, trader and Journal at enlarged text (textSize4) at
320×667,390×844 and740×360. Twelve layout captures include the longest real
title greeting, its dismissal, a supplied high gold balance, real trader stock
and the Journal's relic collection. `capture.cjs` reproduces them and writes
`layouts-evidence.json`. No production image or renderer substitutions.

`items.cjs` separately records eight running movement/Pack captures at320/390,
including an early and fully decoded/settled Sparkglass portrait. Its inventory
is supplied for inspection; this is not an unassisted relic discovery. See
[320px settled portrait](320-portrait-settled.png) and `items-evidence.json`.
The early animation frames are diagnostic evidence, not brightness judgements.

No new clipped controls, sideways scrolling or unreadable settled portrait was
confirmed in these samples. Enlarged headers retain Close, trader actions wrap,
and the Journal keeps legible collection labels. Landscape content scrolls
vertically. No runtime, painting, control, timing or gameplay changes are needed.

All19 access/layout browser cases passed (1.9m). These ran in the phone project;
the access cases explicitly set320/390/740 viewports. The small project excludes
these files, so this is not38 checks or two complete project runs. The checks
include enlarged title/shop/Journal, screen-reader announcements, Calm motion,
colour-safe intent, one-handed layout and map layout. Full CI remains required.

This is a bounded review of the photographed surfaces, not every item, hero,
translation, text setting, device or gameplay state. No physical-device visual
review was performed. Game balance is unchanged.
