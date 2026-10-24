# Batch AA — wider held weapons, first production tranche

Runtime update: the selected exports are integrated for release0.9.35. See the
[native weapon activation review](../batch-zaa-runtime/REVIEW.md). The source-stage
findings and limits below are historical; they are separate from delivery evidence.

36 painted source frames are complete and reviewed locally. They are unpublished
and not activated. Batch Z remains intact as a separate unpublished source pass;
the shipped game stays0.9.34. The whole AA library is **not complete**.

| Pair | Poses | Hands | Selected source |
|---|---|---|---|
| Thief/dagger |9 CUT |One right |held-aa1-refined.png |
| Fighter/battleaxe |9 CUT |One right |held-aa2-refined.png |
| Cleric/hammer |9 CUT |One right |held-aa3-edges.png |
| Fighter/greatsword |9 CUT |Two on one handle |held-aa4.png |

The [brief](../REQUEST-batch-aa.md), [generation manifest](../generation-batch-aa.json)
and [native references](reference-inventory.json) record exact legal pairs,
prompts, inputs, every output and source selection. Fighter battle axe and Cleric
hammer also cover existing alternative starter-kit identities. Remaining Fighter
hammer, other dagger classes, flails, slings, throwing knives, hand crossbows and
named/class variants still need dedicated source review. AB–AG remain planned.

## Source and export review

All11 original/repair sheets and36 final registered poses were visually inspected.
The first dagger was too long; the selected image-tool correction shortens its
blade while retaining the charcoal glove and olive sleeve. The axe retains its
single broad cutting edge and small opposite spike. Hammer retains a modest
rectangular face/pick and brown glove/gold cuff/ivory sleeve. Selected final edge
repair removes the conspicuous white patches on earlier hammer sleeves; its
original, first refinement and native-only alternative are retained as rejected
provenance. Sword retains two attached grey gauntlets on one long handle, brown
sleeves and distinct pose angles. Its original is selected: first refinement
flattens rest/drawback, while the native-only alternative adds pale blade debris.
Both alternatives remain in the manifest. No manual source pixel repair occurred.

Two input moderation rejections on benign static equipment requests produced no
images; request IDs and available outcomes are recorded. The initial parallel
request ended before all per-group results were available. Its unreported outcomes
are not labelled successful. Clarified prop-display requests produced the retained
sheets. Tool model was not disclosed.

Sources have approximate3x3 grids. Hammer authored row boundaries425/818 keep
upper sleeves and the return head complete. Sword right-column row boundary800
keeps its return tip and preceding sweep sleeve; other columns retain836. Dagger
lower first-column boundary430 keeps the through sleeve. These crops lie in clear
gaps and retain entire figures without alpha masking, erasure or neighbour removal.
The requested8% raw margin is not achieved in every source pose. Small coloured
or pale edge flecks remain and are documented, rather than claimed repaired.
Registered exports retain>=12px alpha>32 clearance; final downsamples were reviewed
on dark, light and brown backgrounds and in dungeon views. Large hammer white
patches are absent; minor antialiased fringe remains. Continued art refinement can
address these source remnants without scripted recolouring or masking.

[Contact sheet](contact-sheet.png), [registration](registration-review.png),
[alpha comparison](alpha-review.png) and [measurements](measurements.json) cover
all36 poses and their four family atlases. Each uses an authored main right-hand
anchor and **object-only** bounds; sleeves may naturally leave the game view.
The exporter only crops, uniformly resizes each family, translates and lays out
unchanged pixels. Family object-height limits are dagger64, axe128, hammer112,
sword128; the short dagger stays distinct from a short sword. No mirrored,
rotated, recoloured, hand-painted or alpha-filtered source is made by scripts.
36 RGBA256 cells represent9MiB decoded before caches/GPU; this source pass adds
no runtime allocations or offline downloads.

## Phone evidence and limitations

[Capture inventory](dungeon/review.json) records120 screenshots and360 fitting
cases across390/320 CSS widths and160/360/464 buffer rows. All36 pose keys were
selected. Of360 fitting cases,318 select reviewed art and42 deliberately remain
procedural (sword's released-hand actions plus four guarded controls per width
and height). Each width has60 captures:56 state fixtures and4 visual controls.

Per pair, nine CUT boundaries0/.08/.16/.24/.32/.42/.52/.68/.84, complete recovery1,
Calm cut, and cast/read/drink fixtures are checked. Greatsword is two-handed only
while both hands remain on its grip. During cast/read/drink the renderer requests
one-handed art, so it deliberately retains the existing procedural sword and
freed left hand. This avoids a third hand. All other families retain painted rest
during those existing presentation states. Generic cast fixtures, particularly
Thief/Fighter, are renderer stress cases and grant no new class abilities.
Read uses the existing map hand; drink uses the actual seeded potion sprite.

Ten direct fallback identity checks per width preserve other dagger classes,
left-hand poses, reflected/lit variants, wrong hand counts, another hammer ID,
unsupported sword poses and empty casting hands. Four visual controls cover
Fighter dagger, Dwarven Hammer, one-handed sword and two-handed axe. All selected
pairs pass Game.canEquip. Current P/Y shield art remains untouched.

The preview temporarily proxies only exact raw id/class/pose/two/lit=false frames,
freezes Game.update and supplies render-state fixtures with no enemies or loot.
The HUD/log intentionally remain the seeded Fighter review context; these are
**not real class runs**, attack transitions, loot/warning/occlusion coverage,
service-worker delivery, image-failure recovery or performance evidence.
The native renderer draws the poses but source substitution is not activation.
Both widths have no page/console errors. All120 captures were inspected through
the eight galleries; sword drink and hammer cut were also inspected at native size.

- [390 dagger](dungeon/390-dagger-overview.png) · [320 dagger](dungeon/320-dagger-overview.png)
- [390 axe](dungeon/390-battleaxe-overview.png) · [320 axe](dungeon/320-battleaxe-overview.png)
- [390 hammer](dungeon/390-hammer-overview.png) · [320 hammer](dungeon/320-hammer-overview.png)
- [390 sword](dungeon/390-greatsword-overview.png) · [320 sword](dungeon/320-greatsword-overview.png)

## Reproduce and validation

```sh
node art/creatures/reference-batch-aa.cjs
python3 art/creatures/export-batch-aa.py --check
node art/creatures/preview-batch-aa.cjs
npx playwright test '/held-equipment\.spec\.js$' --project=phone --project=small --workers=2
npm run check:agents
npm run check:art
```

12 existing held-equipment browser checks passed at both widths in33.1s using
system Chromium, a separate localhost4190 server and temporary output directory.
They validate the unchanged runtime, not a shipped AA loader. Source exporter,
script syntax, documentation and art checks also pass. No gameplay rules or
runtime files change, so balance simulations, full runtime browser suites and
performance measurement are reserved for activation. Before delivery: add exact
lazy bindings and offline files, verify byte-identical exports, native legal equip/
actions and sword hand release, independent failure fallback, offline reload,
full release checks and isolated performance. Publication remains a separate step.
