# Lighting and material transitions — 27 October 2026

Candidate release: v0.9.48, build63. The preceding v0.9.47 deployment was verified
live before this audit: commit `d1eba99c578733255d5b794bf6efc777f4ffcdbc` and all
five changed runtime files matched. Its earlier pending-deployment blocker is
resolved. Publication of this new candidate requires its own CI and publisher.

## Findings and corrections

Floor and ceiling torchlight used a single value per tile while walls blended
the square-centred light field. Moving across a tile edge therefore changed the
whole tile's brightness at once. A uniform-material diagnostic measured a
21.67-point adjacent brightness jump on the unchanged v0.9.47 renderer.

The same diagnostic then exposed a second problem: a weak distant torch replaced
the hero's brighter foot light. The lit sample was156 versus178.33 without that
torch. The final shader preserves the brighter of the two shade contributions.

`castFloor` now blends the same four square-centred light samples as wall faces.
It fetches those samples only when a scanline enters a new light cell, with no
per-pixel allocation or texture painting. Floors without any lights skip that
work. Source shade/material caches, warm colours, wall-foot shadows, cave roofs,
flicker, Calm mode and distant softening remain in place.

Source paintings, wall/sprite lighting, fog/visibility distances, explored-map
rules, ray intersections, collision, inputs, timing and seeded outcomes are
unchanged. This is presentation work, so balance simulation is not required.
The regression checks the whole run and Dice/Odds remain unchanged around its
isolated draws.

## Evidence and scope

`capture.cjs` records native walks and turns through supplied nearby torchlit,
dark, flooded and overgrown terrain, plus Cone of Cold freezing water and a
flask/fire-scroll sequence producing oil, fire and ash. Game commands, updates,
casts, loading and rendering stay active. Nearby terrain/torches, a level10 Mage,
HP/SP and a stationary durable target are supplied. Hazard timers are shortened
after creation to observe native expiry handling; these captures do not verify
the ordinary hazard lifetime or balance. Fire spread/damage ticks are held back
after the initial fire capture to keep that fixture local.

The same tool separately records frozen Calm views of all13 regions at320/390px
with normal, dark, flooded/ice and overgrown floors. These are material, doorway,
seam and distance-detail fitting checks, not native room-generation evidence.
The native sessions include740px landscape:18 sessions and90 commands, alongside
104 frozen regional views and four installed-offline profiles. Final totals and
release checks are in `validation.json`; per-frame cameras, fields and images
are in `captures/evidence.json`.

`LIGHTING_OFFLINE=1` installs the actual current worker, disconnects both the
browser and origin, reloads and Continues, then runs torch movement and water/ice
cases at320/390px. These are current-version installed profiles, not historical
upgrade/retry evidence. Original hazard rules and render sources stay active.

`before/` retains the original painted-material probe, failing brightness
regression and weak-torch failure. The painted `probe.cjs` view is a frozen
geometry diagnostic using shipped materials. Its before/after pictures are
separate from the **synthetic uniform materials** used only inside the browser
regression; those diagnostic textures are never used to judge or export art.

An initial capture attempt asked for a nonexistent Mage Fireball spell. The
fixture was corrected to consume the actual fire scroll. An intermediate full
capture passed before the foot-light correction; those raw captures remain in
the execution workspace, and the committed final set was repeated with both
fixes. No game assertion or deadline was relaxed for these tool corrections.

No further repaint or atlas is justified by these bounded samples. They do not
certify every generated room, hero/element combination or physical iOS device.

## Performance and release checks

All local performance samples are retained as `performance-*.txt` and
`before/performance.txt`. The final candidate's first sample failed the painted
scene at29.7FPS against the unchanged30FPS requirement. One subsequent paired
unchanged-main/final-candidate comparison passed both revisions: painted34.2
and35.1FPS respectively. The other scenarios and startup passed too. This
variable evidence establishes a passing budget run, not a speed improvement.
All performance samples used the same thresholds, workload, CPU throttle,
assertions and one worker.

An initial broad Chromium run used three workers and hit two resource-sensitive
checks:26 deferred pictures remained at the title's25-second deadline, and the
crowded render sample measured10.33ms against its unchanged8ms limit. That run
was stopped (294 passed, two failed, three interrupted,634 not run). Both
unchanged cases passed alone on one worker; the complete matrix was restarted
at its normal two-worker concurrency. Original diagnostics and the interrupted
run's full report remain in `validation-failures/`. This concurrency correction
does not alter a test assertion, deadline or game behaviour.

The new mobile regression requires the tile-edge brightness step to stay at
most5 points, retains positive torch brightening, and rejects any weakening of
the hero's foot light. Both Chromium sizes passed after both fixes. Full local
Chromium, rule and release results are recorded in `validation.json` before
publication; CI WebKit and the release publisher are separately required.

## Reproduce

Use the repository Playwright dependency and system `/usr/bin/chromium`. Run
captures before full browser workers; run the frame-rate project in isolation.

```sh
node docs/visual/2026-10-27-lighting/capture.cjs
LIGHTING_OFFLINE=1 node docs/visual/2026-10-27-lighting/capture.cjs
node docs/visual/2026-10-27-lighting/probe.cjs > /tmp/lighting-painted-probe.json
node docs/visual/2026-10-27-lighting/gallery.cjs
```

`LIGHTING_OUTPUT` chooses a separate capture directory; `LIGHTING_PROBE_OUTPUT`
chooses another probe image directory. Preserve the committed historical
evidence when rerunning. Native, regional and comparison contact sheets sit
beside this report; full images and camera/field records remain in their folders.
For a bounded native check of the public game, set `LIGHTING_BASE_URL`,
`LIGHTING_KINDS=lighting,cold` and `LIGHTING_REGIONS=0`, with a separate output
directory. Keep installed-offline fixtures on their local controlled origin.
