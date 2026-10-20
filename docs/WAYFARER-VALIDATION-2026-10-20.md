# Wayfarer validation record

Gameplay revision `0aa55321a68c8a584b93f15ee5178908b7062198` prepares
v0.9.14, build 29, offline cache 89. This record distinguishes completed local
checks from the independent CI and physical-device gates.

- `npm test`: passed on final gameplay, including 746 rules in 74 files,
  type checking, generated guidance, current art, release-tool fixtures,
  generation, security/API, narration and offline checks. The headless rules
  and balance jobs shared CPU; no real-time performance claim follows from them.
- `RELEASE_BASE=41bf3aaf4568e4ccbbb2b5df104b767f1ff043b4 npm run release:check`:
  passed for v0.9.14/build 29 against the current production release.
- Local phone/small Chromium: all six new Spellblade cases passed. The final
  combined Spellblade/release run passed 11 of 12, with one small-phone initial
  page-load timeout; that exact offline case passed in a fresh isolated worker.
  This is validation after a targeted rerun, not one uninterrupted green run.
- New mobile cases cover five taps (four do not unlock), persistence, all seven
  cards, default name and approved portrait, keyboard activation, doubled text,
  axe serious/critical checks, existing-save preservation, actual gameplay,
  lantern labels, locked spells, rune casting, Conditions, and save/resume.
- The final painted portrait, fallback face, fallen shade, raised-blade pose,
  and silver-lantern pixel picture were visually inspected. The original epic
  painting and square adaptation are retained in `art/portraits/`.
- Balance settings, exact outcomes and complete-state comparisons are retained
  in [the balance audit](balance/2026-10-20-wayfarer/README.md).
- Local absolute frame-rate checks failed on both the feature and unchanged
  production. See [the performance record](PERFORMANCE-2026-10-20-WAYFARER.md).
  These failures are retained; no budget, timeout or assertion was weakened.

The full phone and small Chromium projects, Safari engine mobile checks and
isolated performance job must pass in CI before publication. Local targeted
checks do not stand in for those suites. Physical Android and iPhone Safari
checks remain pending: Linux browser engines and viewport emulation do not
establish a physical-device pass.

## Initial CI fixture corrections

Run [39479849906](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/39479849906)
passed rules, performance and two phone shards. The remaining phone shard,
small phone and Safari exposed a second portrait story fixture that enumerated
all seven class definitions while asserting six visible ordinary heroes. The
small phone also caught a keyboard-driven accessibility scan during the title's
entrance fade. The fixtures now select the six public stories and await the
existing `opening` state to end before scanning final colours. The assertions
still require six distinct stories and no serious/critical axe violations.

Both corrected cases passed on phone and small Chromium: four tests, one worker,
with no reruns or changed deadlines. Gameplay and the balance observer are
unchanged, so the recorded simulation comparisons remain applicable. The full
CI matrix verifies the final corrections before publication. One unrelated
initial small-phone browser-context closure cleared on its configured retry;
it was not treated as an application fix or an uninterrupted green initial run.
