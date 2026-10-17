# Local run recording and replay

Puzzle guesses, resets and closing the cache are recorded alongside other inputs.
Optional caches replay with the same clues, marks and treasure as the original run.

New browser runs record the seed, hero configuration, build, starting game memories,
public player actions and exact simulation/frame times. The end screen offers **Replay
this run** after victory or defeat. Playback has pause/resume and 1×, 2× and 4× speed.
The viewer respects the current text size and Calm view settings. It is silent and includes the first-person view, floor, health and elapsed game time.

The current run's record travels with normal saves and continues when they are loaded,
including the load's grace period and reset page clock. Replay is currently offered for
that finished run while its end screen is open. Imported save codes, older saves without
recordings and runs using testing aids do not offer replay. This first version does not
provide shared links, a replay library or leaderboard verification.

## Isolation and limits

The viewer runs in a separate same-origin iframe. Before loading game modules it replaces
its storage with an in-memory copy of the starting memories, with audio, reports and
vibration disabled. Its Game instance, dice and Progress caches are separate from the live
page. Closing it destroys the frame. Playback does not replace a save or earn another
Hall entry, trophy, mastery stage, Daily/Weekly result or telemetry report on the device.
The viewer can run offline after the application has cached its files.

A recording is bounded to 1,500,000 JSON characters (roughly 3 MB of UTF-16 storage), plus
small format metadata. There is no fixed time limit: size depends on frame rate and the
number of actions and loads. On reaching the limit capture stops, ordinary play continues,
and the end screen explains why replay is unavailable. An incomplete record is never
presented as a complete replay. If a save fails, the optional recording is dropped and
the ordinary game save is retried. Only a store that cannot keep that smaller save
uses the existing save error path. The end screen explains when storage prevented
keeping a replay. A resumed run from another build still plays, with replay unavailable.

Playback requires the same build identifier and format. Bump the build when publishing
rules or recording changes. A terminal state fingerprint detects reproduction failures;
it is a debugging check, not authentication for a competitive leaderboard.

## Files and changes

- `js/recording.js`: bounded capture, live-object argument references, save/load events,
  memory storage, replay execution and outcome verification.
- `js/game.js`: connects capture to the public API and restores the initial clock/config.
- `js/replaycontrols.js`: opens and closes the end-screen dialog and framed viewer.
- `replay.html`, `js/replayview.js`: isolated playback and its controls.
- `test/replay.js`: runs a recording through the bot harness without a browser.

A new player-facing mutator must be added to `RECORD_METHODS`. Do not record internal
calls again. Item arguments are references into the live state so an equip, buy, sell
or use acts on the same inventory or stock object. Direct developer-console edits to
state are outside the recording boundary and can fail outcome verification.

Capture is off by default in the bot harness to avoid slowing balance benchmarks;
recording tests explicitly enable it with `Game.recordRuns(true)`. To independently
verify a JSON record obtained from `Game.recording()`:

```bash
node test/replay.js /path/to/recording.json
```

This reproduces the rules and view clocks in memory and fails if the terminal state
does not match. The CLI never reads or writes the browser's persistent storage.

## Validation

`test/rules-recording.js` compares recording on and off for all six classes on Normal
and Hard over three seed sets, and then reproduces the recorded outcomes headlessly.
It also covers inventory references, save/load continuation, recording limits, testing
aids and build rejection. These are deterministic parity checks, not new balance
measurements; passive observation does not change the rules or their simulation times.
The existing browser dice check excludes only the recording metadata from its gameplay
comparison, while continuing to compare the hero, all remaining game state and the log.

`test/browser/replay.spec.js` covers pause/speed controls, outcome verification,
Escape/focus restoration, accessibility, offline use and unchanged live saves/progress
on the phone and small-phone projects. The performance budget checks recording in play.

Optional cache reward choices use the existing recorded `puzzleAction('claim', id)`
mutator. The puzzle regression walks to a real cache through public inputs, solves
it, chooses unidentified gear and replays to the same terminal state. Saving a
solved but unclaimed cache preserves its choice; loading never keeps an open
overlay or grants a second share. Legacy caches without reward metadata retain
their original coin release.
