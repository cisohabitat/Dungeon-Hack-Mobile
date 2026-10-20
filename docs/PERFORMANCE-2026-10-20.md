# Local performance clearance: 20 October 2026

The v0.9.13 presentation changes passed the unchanged performance budget on
GitHub Actions before publication. Functional browser validation passed locally
after isolated reruns. The absolute budget still failed on this development
runner; that result is retained below and is not a physical-phone pass.

## Compared code and method

- Production baseline: `bf11e4ff7c49a28ea2696bc3e7e68885bbed2d61`, v0.9.12.
- Working code: staged v0.9.13, build 28, cache 88. SHA-256 of
  `git diff --cached -- js index.html css/style.css sw.js`:
  `ef0951c37109ee5ec54d0bea5df6c379bd4f5a3c37e6742fbce551392afe8cef`.
- Run order: working code, production baseline in an isolated worktree, working
  code again. Each ran alone, one Chromium worker, with the existing 4× DevTools
  CPU throttle. No deadlines, budgets or assertions were relaxed.
- Command: `PERF=1 npx playwright test --project=perf --workers=1`. Local adapters
  select `/usr/bin/chromium`; production used port 4174, working code port 4173.
  Each revision used its own fixture; the working fixture additionally opens
  Customise before entering the same startup seed. Scene construction, seeds,
  measurement intervals and thresholds are unchanged.
- Thresholds: 30 fps for fight, flooded floor and rite; 27 fps for the wide
  scene; startup within 6,000 ms. See `test/browser/perf.spec.js` for the scenes.

## Results

| Run | Fight fps | Wide fps | Flooded fps | Rite fps | Startup ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Working, first | 19.0 | 17.7 | 21.2 | 29.0 | 5,203 |
| Unchanged production | 15.3 | 7.4 | 15.9 | 25.8 | 4,036 |
| Working, confirmation | 14.2 | 14.1 | 12.7 | 19.7 | 3,218 |

All three fail the frame-rate gate. Startup passes in all three. A separate
2-second host-counter sample reported 13.2% hypervisor steal time; no competing
browser or test processes were active. Shared-runner variability is plausible,
but these samples do not establish its cause or establish a code regression.
Keep the absolute gate open until it passes on a stable runner, then record the
result here. Do not lower the thresholds to obtain a pass.

## Other validation

- `npm test`: passed, including 732 rules checks, generation, release tooling,
  imports/security, narration and offline lifecycle checks.
- Complete phone and small Chromium run: 674 passed, 13 failed. All 13 subsequently
  passed in fresh workers, one at a time. This is validation after targeted
  reruns, not one uninterrupted green full-suite run. The new accessibility
  fixture's player-object typo was corrected; all other failures cleared without
  changing application code or weakening their assertions.
- Final type check, generated agent guidance and all five narrative checks pass.
- Physical Android and iPhone Safari checks remain pending; no devices or device
  farm are attached. Linux viewport testing is not a physical iOS result.

## CI clearance

The unchanged Frame-rate budget job passed for commit
`064bd693eba9ec29e070abb8e1b7bacfa1a33dca` on GitHub Actions:
[run 39451609172, performance job](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/39451609172/job/118727587152).
It used the existing 4× CPU throttle and thresholds, with no retries or relaxed
assertions. This clears the stable-runner gate for this code; it does not explain
the local failures or replace physical-device validation.
