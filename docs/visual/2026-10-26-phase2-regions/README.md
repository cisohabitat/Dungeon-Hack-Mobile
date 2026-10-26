# Phase 2: regional consistency

All thirteen region selections were reviewed on one generated floor at 320×667
and 390×844, with native running updates and renderer. Monsters were removed
and the theme supplied to compare the same camera/geometry. Twenty-six captures
cover wall/floor/ceiling colour and repeat joins; no failed regional loads were
recorded. [Palette comparison](regional-contact.png).

Sixty additional controlled structure views cover door, cell gate and stair-up
joins at one and three tiles in regions1/6/7/10/12, at both widths.
[Structure comparison](structures-contact.png). These use the shipped loader and
renderer with frozen synthetic geometry, explicitly not native generated rooms
or unassisted exploration. `structures.cjs` derives from the existing runtime
review fixture; `capture.cjs` records running generated geometry separately.

No new seam, broken silhouette or material mismatch requiring a repaint was
confirmed in these samples. Four Chromium checks passed (29.6s): exact native
arch masks, gate edges, coloured lock patches, fixed torch brackets, and
independent image failures, on both phone projects. No production code or art
changes are justified by this bounded review. No gameplay/balance changes.
This does not certify every regional decoration, animation or room arrangement.
Physical-phone and Safari visual review are not performed locally.
