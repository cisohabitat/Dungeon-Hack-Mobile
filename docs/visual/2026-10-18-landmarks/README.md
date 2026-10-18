# Landmark stonework and treasure inspection

Presentation pass following v1.5.0 (`85b7347ecf302463f67e00d391adb05cbf80bb5c`),
prepared as v1.6.0, build 14, offline cache v70.

Stair jambs carry regional cuts and crown stones. The original alpha mask is
applied after painting, leaving every opening pixel clear. Shrine mosaics gain
compass cuts and the final sanctum has dark glass inlays. All details are baked
before the existing shade caches; there are no lights, particles or per-frame
surface painting. Tile kinds, map placement, functional props, fog and occlusion
are unchanged. The surface sheet was captured from the actual browser caches.

Legendary and Mythic items get a 96-pixel inspection picture, coloured frame,
name, powers and lore. A newly carried piece is selected when the player opens
the pack, with a brief reveal; taking one through the pack's floor row uses the
existing inventory event to redraw once. No pickup opens a screen, captures
input, equips an item or pauses a fight. Calm view and reduced motion omit the
movement. The reveal memory is transient and seeded from carried equipment on
start/load; it does not add save fields, or repeat on sorting or equipping.
Unknown ordinary quality remains unknown.

[Small-phone treasure inspection](legendary-reveal.png) ·
[Cached landmark surfaces across all themes](landmark-surfaces.png)

## Balance review

No gameplay code, loot, costs, combat clocks, targeting, controls, generation,
lighting ranges or fog distances changed. The pack still pauses only when the
player opens it. Existing recorded balance measurements can therefore be reused:
[the Mythic audit](../../balance/2026-10-18-mythics/), including all six classes
on Normal and Hard, exploration, short and long delves and Hard ladder sentinels.
This is not a new balance simulation. Browser checks compare gameplay state and
both run RNG streams before and after rendering, and preserve visible-foe
geometry, pool cues and lock colours through the existing regional tests.

## Verification

The focused phone/small-phone flows cover world pickup without a modal, opening
the pack, grade/art/powers/lore, unchanged player state, sorting without another
reveal, taking the Mythic through the floor row, reduced motion, axe WCAG 2.2 AA,
horizontal bounds, native save/reload without an old reveal, clear/solid arch
pixels and cached shrine textures without game/RNG mutation.

Full repository checks, both complete Chromium projects and isolated performance
are required before publication; CI additionally gates the release on WebKit.

Local validation completed on 18 October 2026:

- `npm test`: all checks pass, including 722 rules across 71 files on four
  processes (1m51s for the rules), generator, release, types, security and voice.
- Complete Chromium `phone` and `small` projects: **577 passed**, 34.8 minutes,
  two workers, no retries. The new flows pass on both viewport sizes.
- Isolated `PERF=1` project: **passed**, 45.3 seconds. At 4× CPU slowdown:
  fight 57.8 fps, wide 55.1 fps, flooded 57.8 fps, rite 60.4 fps;
  startup 1,839 ms, within the existing budget.

GitHub's seven required jobs, including WebKit, and its publication job remain
separate gates. Public release and deployment are verified after the push.
