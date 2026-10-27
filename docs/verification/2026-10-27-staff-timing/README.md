# Named-staff overlap fixture

The existing Heartroot read/drink check intermittently missed its `drive-one`
frame in WebKit. The v0.9.49 CI run 40499388537 first passed 198 Safari cases and
failed that old case; an unchanged failed-job retry passed all 199. No new combat
effect regression failed. This fixture correction changes no shipped game file,
painting, game rule or animation duration; the game version remains 0.9.49.

The former fixture started a 330ms swing, calculated a render state, then waited
12% of that duration before consuming an item. The game presentation clock was
from the last animation frame. A controlled Chromium 4× probe measured a 147ms
wait instead of the intended 40ms, with consumption at 3077.7ms after the swing's
3067.1ms end. A missed pose cannot be recovered by polling longer. Both hands
still restored correctly. See `prior-original.json` for all 1×/4×/8× samples,
including successes; these are earlier diagnostics on the unchanged v0.9.49
runtime, not physical iOS evidence.

The corrected fixture prepares its visible enemy and art work, then starts
native attack and consumption together on a fresh frame. It also rejects a
swing that already ended before overlap. It keeps native equip, actual consumed
items, both classes/staffs, image identity checks, both existing five-second
polls, restoration after 1100ms, page-error assertions and the 120-second test
limit. Neither the game clock nor the renderer is frozen or replaced.

`probe.cjs` extracts and executes the activation function from the actual spec,
then records native draw keys. Its stable mode mirrors the prepared-art setup;
`--original` extracts the former activation from commit a15ec7d3. The game
runtime is the same in both modes. Artificial CPU slowdown is a diagnostic;
Safari validation remains a separate required CI job.

```sh
node docs/verification/2026-10-27-staff-timing/probe.cjs
STAFF_CLASSES=mage STAFF_WIDTHS=320 STAFF_RATES=4 node docs/verification/2026-10-27-staff-timing/probe.cjs --original
```

The stable matrix covers both named staffs,320/390px and 1×/4×/8× slowdown.
Each observation retains the same five-second interval and both required pose
predicates. `STAFF_OUTPUT`, `STAFF_WIDTHS`, `STAFF_CLASSES` and `STAFF_RATES`
select diagnostic output or a bounded subset. Failed original samples are
retained alongside passing ones; no test deadline or performance budget is
relaxed. Detailed final validation is recorded before publication.

The fresh original control missed the drive in 1 of 2 observations at 4×; both
restorations passed. All 24 stable observations passed, and all 6 focused browser
cases passed in 43.6s. Runtime bytes are unchanged; no balance simulation is
needed. Full repository checks and required CI remain publication gates.

`npm test` passed, including all751 rule checks (1m28s). Required CI and
publication remain gates after this test-only commit is pushed.

The published fixture phase is commit372a6485. CI40515439249 passed all seven
checks and publisher. Both corrected staff cases passed first try in WebKit
(28.3s each). Two unrelated existing guide-accessibility/weapon-offline cases
used the configured automatic retry; no manual workflow retry was needed.
