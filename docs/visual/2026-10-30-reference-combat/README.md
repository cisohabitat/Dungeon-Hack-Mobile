# Reference combat: Orc, Skarrow and Heartforged

This bounded AAA4 pass uses an ordinary melee fighter, an Elder Wyrm champion
and an iron keeper as references. Their approved paintings remain unchanged.

The first inspection found the same warning synthesis for all three identities,
and an immediate return to idle after the130ms strike picture. The change keeps
the learnt warning tones and adds quiet, short armour movement (Orc), an intake
of breath (Skarrow), and iron partials (Heartforged). The keeper's existing stamp
impact also carries a short iron resonance. These layers begin with the existing
event; they never schedule an impact after an interrupted attack.

Each reference foe uses its existing recover picture from130–300ms after a melee
lunge. Hurt and new warnings take priority. Calm view retains its existing
exclusion of reaction pictures. This is a drawing change, not a longer recovery
window in the rules. Damage, cunning wind-up variation, AI, costs and seeded
dice are unchanged. Other creatures keep their existing presentation.

`capture.cjs` records six10-second running combat sessions at320/390px. Enemies,
positions, spoken flags and hero HP are supplied. Frames, updates, attack dice,
warning events and paintings run normally. The WebM contains the real canvas
and a WebAudio master tap before the output limiter. Synthesis fallback is
selected; these recordings do not certify the complete sample mix, device
speakers, human listening preference or an unassisted playthrough. Event and
transition timestamps accompany the clips in `native/evidence.json`.

Human listening approval remains open. Compare the clips on headphones and a
phone speaker before extending this material standard to every foe. No new
recordings have been commissioned or imported.

## Validation

- Six corrected native clips decode as VP8 video with Opus audio. All six
  carry the expected foe identity in their warning events; both Wyrm fixtures
  include breath, and both keeper fixtures include an identified stamp impact.
  Captured master peaks span−7.6 to−5.6dBFS, with no clipping in these fixtures.
  `verify-clips.py` verifies stream decoding, source hashes and event identities.
- The initial capture exporter split its data URL at a comma inside the codec
  MIME type, producing invalid7-byte video files. The decoder check caught it;
  all six sessions were recorded again with the corrected exporter. Only the
  corrected clips are evidence. A small first-cycle/special PNG selection is
  retained; complete running transitions remain in the video and event records.
- 20 focused Chromium checks passed across phone/small. The final full suite
  also exercises strengthened exact-frequency and picture-availability guards.
- `npm test`:751 rule checks in74 files, zero failures, plus type, release,
  painting, generator, API, security, narration and offline checks.
- Unchanged isolated4×CPU gate:41.9/38.9/36.4/35.9/37.2/34.9/51.7FPS
  (fight/wide/flooded/painted/amber/scroll/rite); startup2233ms. Every original
  scene and threshold remains; no unchanged-source rerun for a passing score.
- The first full Chromium selection exposed an old pose expectation at131ms:
  `visual-polish.spec.js` expected the strike to have disappeared with no
  recovery. Both traces' only mismatch was that reaction-presence flag; its
  hit/hurt recovery, Calm pixels, warning and dice guards all passed. The test
  now explicitly requires the recover picture at131ms and expiry at300ms,
  retaining every other assertion. Product source, recordings and FPS evidence
  are unchanged by this test correction. The original traces/log are retained; `pose-expectation-diagnostic.json` records both exact failures and trace hashes.
- Full Chromium selection:1009 cases,1007 passed and only the two original
  pose expectations failed (one per viewport; both workers had loaded the old
  test body). Fresh workers then passed both corrected cases with zero retries.
  All1009 selected cases are verified across the full run and bounded recheck;
  the initial full run is not described as a clean pass. The product remained
  byte-identical during the correction. Fresh full CI, including WebKit and
  performance, remains required before release publication.

No balance simulations were required: only sound metadata/synthesis and drawing
pose selection change. No gameplay formula, action schedule, AI choice, movement,
cost, targeting, visibility or seeded random call changes.

Open [the six-clip review](preview.html) to compare the fixtures. Actual listening
on headphones/device speakers, sample-mix review and AAA5 remain open.
