# AC–AH runtime delivery — 0.9.40

The user authorised activation and publication on 25 October 2026. This release adds 577 runtime files to the existing 973: fourteen carried frames, twenty-four empty-hand frames, 134 new live small-item paintings, and 405 regional texture selections. The catalog now contains 810 held frames,35 carried frames,266 static routes (including rarity aliases) and 471 materials. All 1,550 catalogued files are offline cached; the full art inventory has 1,718 shipped paintings plus 3 icons. All 973 prior runtime files retain identical bytes.

## Runtime behaviour

Equipment retains exact class/id/pose/two/lit guards. Empty hands switch each three-pose class family together, including three Ranger-to-Fighter source reuses. No unsupported pose becomes a new ability. The lantern's authored base landmark is carried through to renderer fitting; the new native equip test caught its omission and it was corrected before publication.

Small item sprites keep native floor scale, hover/glint, item names, actions, seeded unidentified appearances and separate large relic portraits. Relic, legendary and mythic edges are cached from the same painting before shade/flash canvases and Pack URLs are created. No per-frame recolouring or encoding. The unused generic key and reserved Tooth source are excluded; coloured keys and native seeded amulet appearances remain authoritative.

Regional art is requested on use, independently per image; visiting a region does not eagerly decode every other region. Native floor/ceiling revision invalidation and eight opaque shade levels remain intact. Architecture composition is cached once: the original exact stair alpha clips the painted surface, with original stone filling the few candidate edge pixels; the shared eight-bar gate keeps native regional outer edges; all original coloured door/gate lock patches are copied unchanged. Failed images retain their own procedural fallback. Torch wall/bracket pixels below native y 30 are fixed to frame 0; only the flame area varies with the existing sequence/timing and Calm rules. Native decoration indices still select the corresponding regional slots. These are runtime presentation compositions; original source artwork and rejected repairs are unchanged.

## Native evidence

No source-image routes, Assets proxies, floor-frame replacements or DOM picture substitutions are used by the native capture tools. They exercise the shipped loader/cached palettes and real renderer/Pack bindings in frozen scene/state fixtures. These fixtures are not an assertion that every captured stress pose is a native ability or that every procedural texture reserve appears in generated levels.

- Carried foci:98 captures and 294 three-height fits.
- Ordinary shield backs:112 captures and 336 three-height fits.
- Empty hands:176 captures and 528 three-height fits.
- Small items:602 captures;560 floor checks and 280 Pack checks across all 140 live keys at 390/320. All 47 large relic pictures remain intact.
- Regional architecture:240 near/far captures for twelve themes at both widths.

That is 1,228 native captures. Representative phone galleries, equipment overviews, material/gate/arch views and small-item floor/Pack views were visually inspected; all source selections were already reviewed on source contacts. Not every full phone screenshot was individually visually signed off. Hand and carried fitting fixtures retain full Game/Dice/Odds neutrality checks. Source crop/alpha limits and intentional viewport wrist lowering are documented in the source reviews.

Meaningful browser regressions additionally equip all fourteen new carried pairs through Game.equip, check all 24 native hand bindings and exact guards, compare every region's pre/post arch alpha, gate edges and lock bytes, check fixed torch brackets and shade opacity, preserve seeded appearances, inspect native rarity pixels/cached URLs, and verify independent corrupt hand/item/material fallbacks. A private-origin offline test caches and decodes all 1,550 catalogued files after a native disconnected reload at both phone widths. Existing offline and native weapon/companion/creature regressions remain enabled.

## Release verification

Focused runtime tests and all-export offline checks passed. The complete Chromium projects, isolated performance budget, npm test, exact export checks and CI publication are tracked in verification.json. No gameplay rule changes occurred, so no balance simulation is needed; native visibility, action/equipment semantics and Calm/performance are covered by presentation regressions. Linux Chromium and CI WebKit do not establish a physical iOS Safari check.

Chromium verification: the full 867-case run passed 842 directly; all 25 failures passed in 28 fresh isolated checks (including both viewports and strict nullable-id guards). Icon expectations now wait for painted-image promotion instead of retaining a temporary procedural URL; native physical small sprites remain independent from hidden large portraits. Timing and offline deadlines were preserved. The all-export offline audit decodes in bounded batches of eight to avoid artificial sequential frame waits while checking every file.

Final local checks passed: npm test (including751 rules), all source/runtime export checks, syntax and whitespace. The isolated4x-CPU budget measured fight40.9fps, wide41.1fps, flooded38.8fps, painted35fps and rite50.7fps, with1,884ms startup. Required limits remain30fps (wide27fps) and6,000ms startup. GitHub Actions and its publication job remain authoritative for the released commit.
