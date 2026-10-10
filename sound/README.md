# Deepdelve procedural sound pack

This pack uses the local procedural workaround requested for both tiers of
`REQUEST.md`. It contains original compositions and physically inspired sound
design. The string, horn, choir and creature voices are synthetic approximations,
not live recordings or outputs from a text-to-audio model.

`manifest.json` lists the game-ready OGG/Vorbis and M4A/AAC-LC files, variations,
FLAC masters, decoded sample counts, sample rate, loop intervals and export
hashes. `SOURCES.md` documents every asset. `validation.json` records the measured
checks and the remaining limitations. No integration code is changed here.

## Reproduce and check

Install Python 3, NumPy, SciPy, FFmpeg and ffprobe, then run:

```sh
python sound/render.py
python sound/validate.py
```

The renderer writes only inside this folder, replacing its own generated files.
The immutable seed for each variation is derived from its logical asset name.
The complete generation recipes are in `render.py` and `production.json`.

Each theme is twelve bars of 4/4 at its own fixed tempo. All four stems have the
same canonical sample count and start on bar one. Loop events are rendered
circularly, so resonant tails continue across the boundary. The title's four-note
identity is adapted to each floor's scale; the title cue plays once.

## Integration requirements

- Decode both formats respecting encoder priming/delay metadata. Trim decoded
  loop buffers to `[loopStartSample, loopEndSample)`; AAC and Vorbis exports may
  have trailing padding. Vorbis gets a 128-frame silent guard to prevent short
  decoder output. These fields count sample frames, not individual channel samples.
- Start all four stems on the same audio clock, then fade their gains as the mood
  changes. Do not normalise stems independently. Gain and peak measurements are
  included in the manifest and validation report.
- Keep the existing synthesised audio as fallback and retain synthesised magic.
- Load by floor and format; do not preload both formats or the FLAC masters.
- Listen to the pack and test native browser decoding, ducking, pause/resume,
  looping, voice character and phone performance before release. Automated
  measurements do not verify realism, emotional impact or listening fatigue.

The repository's game checks require a complete checkout and dependencies; they
were not run for this isolated asset delivery because workspace downloads were
unavailable. The separate audio validator checks the files themselves.
