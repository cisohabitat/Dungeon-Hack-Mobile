# Wayfarer identity update validation

Prepared release: v0.9.15, build 30, offline cache 90. Baseline production commit:
`64d7949971f2f06a04e36ba0747dfdf8a9953087` (v0.9.14).

The class now has its own gatekeeper origin and motive on the creation and
opening screens. Starting background modifiers still apply. The opening reads
the shared world recording, and hides the unrelated background-story recording;
no new personal voice recording was added. The held Silver Lantern uses its
silver cage/blue flame in a cached first-person focus frame on all floors.
Its body is raised and inset so it stays visible; stowing it removes the frame.

Normal hero levels offer six exclusive talents and six lantern lessons. Each
talent adds and restores five life and two spell points, once when learned.
Sever the Veil’s accuracy needs an active rune and a held blade. Rune/ward
limits and descriptions share the same derived helper as save validation.
Existing saves retain old lessons; future offers use the new class pool. A new
run gives the full progression. Renown past level twelve stays shared.

Local evidence on the selected source:

- `npm test` passed: 751 rules across 74 files, types, generator, art/release
  tooling, security, narration, offline lifecycle and voice-catalogue checks.
- All ten focused Wayfarer browser cases passed across phone and smallest phone:
  unlock/portrait/personal opening, keyboard/save preservation, live casting and
  save/resume, carried art on ordinary/dark floors and stowing, real level-up
  cards and the life/spell-point grant.
- Type checks, release comparison against production and agent-doc sync passed.
- The balance verifier passed 9,566 retained fresh outcomes with zero simulation
  ERRORs/timeouts, all 144 public-class state/log pairs unchanged, 120 baseline
  pilots matching retained results, and 160 selected tuning outcomes reproduced
  within the larger final cells. [Raw results and reproduction](balance/2026-10-20-wayfarer-identity/README.md).
- The four-worker full Chromium attempt was stopped after timeout failures in
  accessibility and art-preparation cases. Its [log is retained](balance/2026-10-20-wayfarer-identity/validation/local-four-worker-browser.log).
  It is not counted as a passing full suite. The two-worker diagnostic retains
  the same cases, deadlines and assertions; no local full-suite pass is claimed
  by this report.

Before merging, CI must pass all seven jobs: rules, three full phone shards,
smallest phone, Safari engine mobile and the isolated frame-rate budget. Main’s
release job must also pass before publication is reported complete. The budget
remains 4× CPU throttle, 30 fps (27 in the wide view) and startup within 6 seconds.
No check or deadline was relaxed. CI results belong to the PR/commit and release.
Physical Android/iPhone testing remains unperformed; browser emulation and the
WebKit engine are not hardware validation.
