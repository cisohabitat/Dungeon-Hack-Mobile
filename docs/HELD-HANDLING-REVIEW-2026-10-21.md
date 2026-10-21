# Held equipment review — 21 October 2026

The review covered 329 cached frames in 24 sheets: 162 base weapon poses,
60 named weapon poses, 36 ordinary legendary variants, 22 carried shields/foci,
16 class/form hands, 15 Wayfarer reflected blade frames and 18 bow draw frames.
It also covered 60 actual renderer frames across short (160-pixel) and tall
(360-pixel) views, and recorded real sword and bow attacks through normal controls.

## Corrections

- Add cached intermediate cut and recovery angles; keep the hand and object in
  one frame. Staffs and spears drive forward, and staffs lean into casting.
- Fit the object's cached bounds rather than its sleeve. Keep resting left-hand
  gear within the left 42% of the view, preserving the floor square ahead. Apply
  casting, reading, drinking, throwing and shield-bash movement after fitting so
  those actions start from the same grip as rest.
- Keep bow string ends on fitted nocks, and the drawing fist at the string.
  Cache two draw-flex poses. Lower the bow and omit the spare fist during
  left-hand actions, preventing a third hand.
- Remove the held arrow at 0.72 of its existing swing and the knife at 0.4,
  matching combat.js. Resolve named handling with namedBase: Vashti is thrown
  rather than slashed, and its returning hand is empty.
- Carry Horizon's bands, Galewind's leaves and Farstrider's fins into the held
  view, with Sisters' Buckler retaining its pale rim. Other named weapons and
  foci continue to share their Pack drawing; bows and shields show the rear.
- Keep small attack/casting glints on existing equipment surfaces. Omit new
  glints and draw flex in Calm view. Preserve existing named pixel silhouettes
  even when quality is unknown; read no hidden powers or enchantments.

## Verification scope

The focused browser checks cover object fitting at both view-height extremes,
fitted string endpoints, drawing-hand contact, arrow/knife release, no duplicate
casting hands, continuous cast entry, cache reuse, Calm effects, existing named
silhouettes and shield/focus floor-loot clearance. They run in both Chromium
sizes and the mobile WebKit set. Existing bow-loot, greatsword two-hand and
Wayfarer lantern checks remain in place.

An additional local sweep compared seven shields/foci at heights 160, 200 and
360 against the same floor ring with bare hands: all 21 retained every visible
item pixel after the left-side fit correction. Screenshots, the review gallery,
renderer storyboards and the attack movie are workspace review artifacts, not
new deployed image assets. Final commands, performance measurements and CI
results belong in the change description; a local performance failure must not
be reported as a pass or hidden by changing the budget.

This is presentation only. Combat, projectile flight, cooldowns, spell costs,
world lighting/fog, targeting, dice, saves and run clocks are unchanged. Renderer
checks retain state/dice invariants and loot visibility; no new balance simulation
is required. Full Chromium phone/small, mobile WebKit and the isolated performance
gate must pass before main publication. Physical Android/iPhone checks were not
performed.

## Local performance observations

Both runs used the unchanged isolated Playwright performance test, one worker
and 4× CPU throttling, with no concurrent browser suite or balance bench.

| Revision | Fight fps | Wide fps | Flooded fps | Rite fps | Startup ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| v0.9.19 (`f3f531a`) | 32.6 | 34.7 | 28.7 | 26.4 | 2532 |
| Final v0.9.20 implementation | 16.4 | 26.0 | 26.4 | 31.6 | 2620 |

Both missed the existing local frame-rate budget. The new fight reading was
worse than this baseline reading; these observations do not establish parity or
a physical-device performance pass. No thresholds were weakened. Full isolated
CI performance is a required gate before merging this change.
