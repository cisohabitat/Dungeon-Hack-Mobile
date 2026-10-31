# Wall-column recovery for the Heart staging release

The Heart plinth candidate v0.9.70 reached main at
`a64e9b50c5d9f6313969e5650bebc8587fda287d`, but its publisher was skipped.
[CI run 41181249678](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/41181249678)
passed all 1,272 browser cases on their first attempts and failed the unchanged
wet-scene budget at 28.2 FPS against 30. The blocked version is not a release tag.
Its artifact manifests and complete 14-report inventory are retained here;
original ZIPs and job log remain in the execution workspace.

The recovery combines adjacent wall columns only when the source canvas and
integer destination top/height agree. Source texels must repeat exactly or
advance by exactly one. A once-prepared horizontal mirror of each immutable
wall picture lets descending texels form ascending strips; the source coordinate
reversal preserves their original appearance. Nearest-neighbour sampling copies
each source texel into its exact destination column, without changing opacity.
Closed/sliding door leaves use their original surface and immediate draw path.
Pending wall draws flush before doors, stair recesses, arches, webs and lighting.
Per-column light samples, fog, counters and fountain coordinates remain live.
No pending draw crosses a frame. The prepared picture mirror follows source
identity through the same immutability contract as the existing soft-wall cache.
Floor shading, stains, material alpha, art, doors, collision, generation and game
rules remain unchanged.

The frozen comparison records **2,340 identical final views** against the exact
blocked commit: all 13 regions, three heights, five floor environments, three
angles and four Calm/flicker snapshots. It uses real shared assets, isolated
renderers and reset presentation particle RNG; it is a fitting comparison,
not native play. The separate eight-round alternating diagnostic records gains of
3.9–10.8% in all five scenes, with 128–160 merged columns per frame. Single-sample timings attached to the
pixel matrix are not performance clearance.

The permanent `region-art.spec.js` regression compares grouped draws with an
independent forwarding canvas that expands repeated columns and contiguous strips into the
original individual calls. It covers 104 region/aperture/angle combinations,
including a partially moving door, and requires actual grouped draws. The initial repeat-only candidate passed both
Chromium widths (2 cases, 20.5 seconds); final strip checks and fresh full
browser runs, the unchanged nine-scene budget and CI are recorded in
`validation.json` as they complete; publication remains pending until every
required job passes.

Several tempting alternatives were rejected before selection: per-pixel
warm-colour memoization, branched and split projection caches all regressed
warmed diagnostics; pre-baked material alpha changed final pixels. Opaque-wall
floor coverage kept all 2,340 pixel comparisons identical but was slower and
failed the original budget at decals27.7/wet24.5 FPS. Its patch, helper, raw
comparison and failed budget log are retained under explicitly rejected names.
The first repeat-only wall candidate also missed the unchanged budget at
decals29.2/wet26.5 FPS. Lazy and whole-palette warmed-texture tables regressed
diagnostics and were removed. None of those floor caches or opacity changes
ships in this recovery.

Browser-engine stability investigation is deferred for this round at the
owner's request. Ordinary browser and FPS gates still apply. Human listening
review is also skipped. These desktop-engine fixtures do not certify physical
iOS behavior, unassisted exploration, a complete AAA3 pass or AAA quality.

The initial all-mirrored strip candidate's isolated local budget passed eight scenes but
missed wet at 26.8 FPS; startup was 2052 ms against 6000 ms. `rejected-mirrored-doors/performance-local.log`
retains every measurement and the failure. This is not local FPS clearance, and
the identical failed gate is not rerun. Fresh unchanged CI remains mandatory;
no release is published unless all required jobs pass.

Final-source native captures contain 18 supplied-pose keeper/Heart views and
30 observed changed turn/walk actions across 320px, 390px and 740px layouts.
All 51 files are unmodified copies, and their six runtime source hashes match
the frozen candidate. `native-validation.json` records those checks; this
confirms running shipped rendering with supplied legal inspection poses and
safety HP, rather than unassisted play or device approval.

The first full strip run stopped after 488 passes and four door-observer
failures, with two interrupted cases and 529 not run. Mirrored door canvases
bypassed the existing leaf-identity observers, despite identical fitting
pixels. The final renderer excludes all closed/sliding door leaves from
mirroring and batching; its original surfaces and immediate draws are retained.
All 12 focused door/strip cases passed in 59.8s at both phone widths, with
existing assertions unchanged. The rejected source, four failures and its
native/pixel/FPS evidence are preserved in `rejected-mirrored-doors/`; the full
raw interrupted report/log/traces remain in the execution workspace. A complete
new verification uses the corrected source and a separate `recovery-final`
workspace prefix; interrupted results are never counted as clearance.

The corrected source also missed the isolated local wet budget at 24.9 FPS;
all other eight scenes passed and startup was 2017 ms. The canonical
`performance-local.log` and `validation.json` retain this final-source failure.
The gate is not rerun unchanged; fresh unchanged CI must clear every required
job before publication.

Final local functional verification completed after the workspace connection
recovered: **1,031 unique Chromium cases passed**, comprising 1,023 regular
cases on two workers and eight serial installation/offline cases on one worker.
Both projects completed with zero failures, retries or skipped cases:
phone 658 and small 373. Raw JSON reports, per-case inventories/events and
logs remain under `/workspace/aaa3-plinth-recovery-final-*`; the checked
summary and timing statistics are recorded here. Runtime/test/art hashes and
all native-capture source hashes match the frozen source. This is local
functional clearance, not a claim that the separate local wet FPS gate passed.
Fresh main CI and its publisher remain the publication authority.
