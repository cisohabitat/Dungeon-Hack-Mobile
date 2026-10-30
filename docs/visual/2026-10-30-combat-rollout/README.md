# Combat rollout across the enemy roster

Human listening review is skipped at the owner's explicit request on 30 October.
It is not a release gate for this work. Automated tests and recordings are not
claimed as human listening or physical-device approval.

All 53 monster identities now use their existing recovery painting from 130–300ms
after a strike. This includes ordinary foes, named champions, keepers and ranged
releases. Hurt and the next wind-up take priority. Calm view retains its existing
exclusion of reaction pictures. Missing pictures keep their existing fallback.
Only pictures change; actual attack, lunge, cooldown and movement clocks do not.

The Warlord's existing WeakMap retains the spear through the recovery picture,
then clears at 300ms. Interruptions, a new wind-up and phase changes still clear
it. No saved state, attack timing or extra spear is introduced.

Fourteen short material profiles cover the roster: bone, armour, claw, magic,
leather, flesh, wing, wet, wood, rust, quill, breath, fire and iron. Named foes
inherit their base sprite's material while keeping their own paintings. The
three reference profiles remain unchanged. Unknown identities retain the
original complete warning. Every layer sits beneath the learnt warning tones;
none schedules a later contact when the enemy can no longer complete its move.
Existing weapon/contact samples and Heartforged's stamp resonance stay intact.
The roster contains no stone-bodied foe; existing scenery impacts already
supply stone, so no flesh creature is assigned that material.

`inventory.mjs` records the53 routes in `inventory.json`. The all-identity
browser checks exercise exact strike/recovery/expiry, warning/hurt priority,
unchanged run prints and dice, and the actual WebAudio warning nodes for every
identity. They compare each warning's frequencies against an unlayered unknown
identity and require the original tones to remain present. Existing Calm pixel,
concealment, boss-state, offline and corruption assertions stay in place.

`capture.cjs` records 23 native running combat fixtures (six seconds, ten for keepers) at 320/390px,
including all material families, named variants, keepers, ranged releases and
Calm examples. Enemy positions, health, phase, spoken and concealment flags and
hero health are supplied; updates, actions, dice and paintings run normally.
The audio is a real master tap before the output limiter with the sample pack
off. These are presentation fixtures, not generated encounters or balance wins.

No balance simulations are required: no rule, resource cost, targeting,
visibility, AI choice, dungeon generation or action schedule changes.

## Validation

- Eight focused cases passed across both Chromium phone sizes: all 53 identities,
  exact recovery boundaries, original warning tones, unchanged dice, boss/shade
  guards, Warlord spear continuity and existing Calm pixel checks.
- Two fresh strengthened audio checks also passed, verifying 14 distinct actual
  node profiles for both ordinary and special warnings. Filter type, initial
  frequency and Q are recorded without changing their audio processing.
- All 23 native recordings decoded as VP8/Opus with non-silent audio and no
  clipping in these fixtures. Captured master peaks span−9.0 to−4.3dBFS.
  Every fixture observed a recovery state; Calm still omits the reaction picture.
  The montage was visually inspected. `verify-clips.py` checks recording streams,
  source hashes, event identities and levels. Complete videos and transitions
  remain; the PNG selection keeps the first warning/strike/recovery and each
  special warning instead of repeated cycles.
- `npm test` passed all 751 rules in 74 files plus type, art, release, generator,
  API, security, narration and offline checks.
- The unchanged isolated 4× CPU gate passed all original seven scenes:
  fight 39.9, wide 43.7, flooded 41.6, painted 38.1, amber 37.4, reading 34.2 and
  rite 57.7FPS; startup 1888ms. No thresholds, scenes or assertions changed.
- Full Chromium selection: 1,009 cases; 1,008 passed and one phone offline
  readiness check failed while waiting for `data-core=true` within the existing
  10-second assertion. Its trace recorded 1,985 requests and no failed requests;
  the cause remains unproven. The original trace and full log are retained, with
  the exact failure and trace hash in `offline-readiness-diagnostic.json`.
- A bounded isolated recheck then passed the same offline test on both phone
  sizes using one worker, with no source, assertion or deadline changes:
  phone35.2s, small33.6s, zero retries. All 1,009 selected cases are verified
  across the full run and recheck; the first full run is not labelled clean.
- Full CI including WebKit, isolated performance and the release publisher must
  pass on the exact committed source before publication is called verified.

[Open the native combat gallery](preview.html).
