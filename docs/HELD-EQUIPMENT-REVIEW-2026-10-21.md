# Held equipment review

Prepared as v0.9.18, build 33, cache 93, against v0.9.17
(`257b71abb47e1b47aefe4d8b54f84bfed7fecb50`).

Reviewed 282 rendered frames for contact, proportions and unintended clipping:

| Group | Frames |
| --- | ---: |
| 18 base weapon families, four swing poses | 72 |
| 20 named weapon families, four swing poses | 80 |
| 18 ordinary legendary weapon variants, four swing poses | 72 |
| Named shields and foci | 11 |
| Base shields, foci and lantern | 11 |
| Eight class/form hand samples, fist and cast | 16 |
| Wayfarer reflection samples, five blades in four poses | 20 |

These are art samples, not changes to class equipment permissions. Bow staves
stay fixed while their string, arrow and drawing hand are rendered separately.
Forearms continue beyond the bottom of the first-person view.

Corrections from the review:

- Ordinary throwing knives used the pack's three-knife fan in the held view.
  They now use one blade with a wrap long enough for the fist. The pack fan is retained.
- Vashti's Needles carried spare needles beside the gripped blade. Only the central
  grip, guard and blade appear in the hand; its pack and relic pictures are retained.
- The Quill Shield used an open caster palm. Its held frame now shows the rear
  wood, rim quills, closed grip and forearm strap.

The Wayfarer's lantern gains a three-quarter cage, a shaded side pane, rear bars
and blue reflections on its fingers and handle. Charcoal gloves, silver cuff
trim and a blue rune replace the Fighter fallback. A separately cached blade
reflection is selected only while the silver lantern is equipped. Stowing it
selects the normal blade frame. Reflections do not add dungeon lights or change fog.

Renderer-only settling follows a finished step, moving the complete hand and
cage together. Calm view, equipment changes and time resets clear it. The base
mark reserves clearance in short views; casting and item use still lower the
grip out of the acting hand's way. No camera position, action timing, run clock,
combat, item statistics, saving or balance policy changes, so no new balance
simulation is needed.

The existing mobile lantern case now checks reflection cache separation and
selection, the distinct glove, stowing, Calm stability and unchanged game time,
alongside minimum-height walking and casting clearance. Full CI and publication
results are recorded on the PR and release; no physical-device pass is claimed here.
