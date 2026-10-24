# Batch H boss art review — 23 October 2026

Four transparent nine-cell sources and four registered 768px WebP review atlases:
`heartforged_open`, `heartforged_whitehot`, `warlord_throne`, `warlord_spear`.
Generated with `image_gen.imagegen` (model not disclosed). Prompts, references,
original paths, retained drafts/repairs and registration are in
[the generation manifest](../generation-batch-h.json).

## Selected art

The Heartforged retains its helmet, iron limbs and one hammer held with both
hands on a continuous shaft, hammerhead on viewer right. Two attached chest
doors expose the unbarred furnace. Phase 2 uses pale white-hot iron with dark
joint gaps and a white-yellow core. Emberlings, fire lines and light remain
separate. Selected full-sheet repairs correct repeated walking leads and closed
grilles. The rejected isolated open-furnace step exaggerates foreshortening.

Both Warlord forms retain olive skin, hammered crown, red fur cloak, armour,
tooth necklace and drum on viewer right. The spear stays in the anatomical right
hand on viewer left. Release and recovery hands are empty, avoiding a duplicated
projectile. The throne is a connected compact seat with a plunder/iron backrest;
it never walks. Standing stepB advances the drum-side leg. Its isolated draft
repeated the spear-side lead, so a coherent full-sheet repair is selected.

All originals, intermediate repairs and all 36 exported cells were visually
inspected for identity, frontal presentation, connected gear, alpha edges and
pose clarity. Sources have true alpha. Each sheet uses one common scale and
measured horizontal body centres, with visible alpha bottom at row236 and at
least12px clearance. `measurements.json` records source bounds, scale and offsets.
The two Heartforged phases have slightly different authored proportions; spear
clearance makes the standing Warlord's body smaller inside its cell. The phone
previews preserve existing boss world scales (1.4/1.3). Future integration should
review phase-to-phase animation and apparent body size before enabling bindings.

Special/blink slots on the new sheets are reserves. Throne stepA/stepB are seated
weight shifts and reserves too. They add no actions or walking support.

## State audit and reuse

[STATE-AUDIT.md](STATE-AUDIT.md) records current code paths and mapping proposals.
Phase overrides are not cumulative: standing phase-1 Warlord can throw spears
after throne exit or failed bearer spawn, but phase 2 has no ranged attack.
Reuse existing cleaver/drum art for standing melee/commands and frenzy. Existing
cold-blue Lich casting cells cover phases 1 and 2; no extra costume is needed.
No phase-specific fallback body/throne drawer currently exists; these are new
illustrations of the fight's described states, not copies of a phase renderer.

## Verification and limits

- 751 existing rule checks in 74 files passed, including boss checks.
- Export `--check` reproduces all four atlases, three comparison sheets and measurements.
- 72 frozen dungeon captures at 390px/320px: 52 for new sheets, 20 for reused Lich/Warlord cells.
- Actual mstat checks cover all nine boss/phase combinations; new/reused draws assert the existing procedural guard and retain scale.
- All windup warnings remain visible; no page/console errors. Throne ward translucency remains the actual renderer effect.

`node art/creatures/preview-batch-h.cjs` disables game updates after setup to hold
forced review states, renders through the existing renderer and substitutes only
selected painted cells. Throne state is asserted for every capture. Non-throne
captures are unwarded. Sources and exports are approved as review assets; these
captures do not prove live loading, complete transitions, animation timing, spear
re-equipping, direct skips, no-spawn outcomes, interruption recovery or offline
support. Transition edge cases are code audits, not claims of end-to-end coverage.

No runtime loader, procedural guard, gameplay, service worker or shipped image is
changed. Runtime integration remains pending; this publication contains source and review assets.
