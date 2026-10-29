# Keeper approaches and live identity

Baseline: v0.9.57, `d7654bc88464e56a6f982737d36fb887ebf8d0ff`.

## Finding and chosen change

The native approach audit includes the Lich, Warlord and Heartforged at320px
and740px. Generated final floors run normally from a supplied legal pose before
the hall. Testing HP and matching door keys are supplied; movement, unlocking,
introductions, enemies and updates remain native. These are inspection walks,
not unassisted runs or physical-device evidence.

A guard can occupy the foreground while the keeper's named life bar is already
visible. The bar identifies the keeper correctly, but the large creature in
front can look like the owner of that bar. Add a small painted keeper face to
the existing bar, using the approved introduction portraits. The keeper must
already meet the existing awake/spoken bar conditions. Hidden keepers and named
champions receive no new portrait.

The20px face samples a fixed square from each existing512px painting. Original
image bytes stay unchanged. The bar's right edge and reserved header height stay
fixed; its name and proportional health fill move beside the face. Phase notches,
rite progress, throne text and all previous activation rules remain intact.
The loader requests only the current keeper's picture, keeps at most three
entries, and draws the cached image without per-frame raster preparation.
Loading, corrupt or unexpected-size pictures retain the original complete text
bar independently; a failed keeper cannot disable another. The pictures already
belong to the installed game's offline cache.

## Placement experiments were rejected

A400-floor survey found between one and six ordinary creatures in each final
hall. Every surveyed hall has at least one creature in its central three rows;
this includes the intentional nave guard. A previous close inspection from a
side pose alone cannot establish how a real entrance approach reads.

Two isolated placement prototypes were compared with the exact baseline:

- **Wide:** relocate central-row ordinary creatures to free side-aisle squares
  in the same hall. A1,080-floor comparison found2,292 relocations and no other
  content changes. Both seed sets of the eight-floor pilot showed a concerning
  class tradeoff: Fighter gained wins while Mage and Druid lost them. This is
  an exploratory small sample, not a final win-rate estimate or balance clearance.
- **Dais only:** leave the intentional nave guard in place and move only
  incidental creatures immediately around the Heart. A1,080-floor comparison
  found252 relocations;856 floors were entirely unchanged. Another180 nonfinal
  comparisons were identical. This smaller alternative also remains unapproved
  for gameplay; identifying the existing bar addresses the observed confusion
  without changing encounters.

Both prototypes preserve creature counts, stats, other generated content and
random streams, but changing coordinates can still change outcomes. Their
matched pilot records and rejected source patches are retained separately from
the shipped implementation. There is no accepted spawn, room, lighting-placement
or game-rule change in this release. The historical balance measurements remain
applicable; these rejected pilots do not replace the README win-rate table.

The complete pilot archive contains4,032 actual simulations:1,344 baseline,
1,344 wide and1,344 dais-only runs. Both candidate comparisons reuse the same
baseline. Each uses all seven classes, Normal/Hard, `bench`/`alt`, eight dungeon
seeds with two trials each, and8/12/16-floor runs. There are no errors or timeouts.
The wide prototype flips89 paired win outcomes; dais-only flips seven. All
pre-final-floor arrival histories remain equal. These16-run cells are deliberately
exploratory; neither prototype reached final400-run balance clearance.

The final presentation code separately passed1,008 regression simulations over
all seven classes, Normal/Hard, three seed sets and8/12/16-floor lengths. All504
paired run records and all504 whole-state fingerprints are identical. Both sides
use frozen v0.9.57 metadata so version strings do not contaminate the comparison;
the four presentation-source hashes match the prepared release. This is an exact
regression control, not a fresh statistical win-rate estimate. Full browser and
release checks use v0.9.58 metadata.

## Evidence and verification

`validation.json` records completed checks and source hashes. The fitting preview
uses the actual bar painter with supplied states; it verifies crop and label
layout, not native combat. Native captures and offline evidence are recorded
separately. Loading/failure controls compare the entire fallback bar with its
original text-only drawing, and live integration checks protect identity, health
proportions, game state and both dice streams.

The126-state bar-painter comparison changes no pixels outside the original
header area; all18 named/empty controls remain entirely identical. The first
diagnostic mask omitted two original text-outline pixels at x6 on a long stress
label. The corrected mask includes that measured outline, with the original
failure logs retained; no product change or existing assertion was altered.

All nine native views retain the badge inside the reserved header. The320px
Double-text/Calm Heartforged walk also exposes condition/log crowding under
multiple threats. That observation is an open AAA4 combat-clarity item, not an
accessibility clearance inferred from these screenshots.

The initial browser command found a stale external configuration path and ran
no tests. The persistent audit configuration corrected that setup. A wide-
prototype capture later exceeded the unchanged art-readiness wait under concurrent
bench load; its log is retained and it is excluded from release evidence.
Full release verification runs on the final presentation source. No test budget,
assertion, retry policy or performance threshold is weakened.

Further changes to guard placement or hall geometry still require matched final
balance validation. This phase does not certify a complete architectural review,
physical-device behavior, listening quality or an AAA grade.

## Reproduce

Run from the repository root with the existing Node/Playwright dependencies.
`bench-used.py` preserves the exact original runner; `bench.py` and `analyze.py`
add configurable workspace/output roots while retaining the recorded policies.
The game bot itself is unchanged. Create isolated worktrees and apply only the
named audit patches there:

```sh
export KEEPER_WORKSPACE=/workspace
export KEEPER_AUDIT_OUT=/tmp/keeper-review
mkdir -p "$KEEPER_AUDIT_OUT"
for keeper_variant in baseline candidate narrow presentation; do
  git worktree add --detach --no-checkout "$KEEPER_WORKSPACE/aaa3b-$keeper_variant" d7654bc88464e56a6f982737d36fb887ebf8d0ff
  git -C "$KEEPER_WORKSPACE/aaa3b-$keeper_variant" sparse-checkout set --no-cone /js/ /test/ /package.json /package-lock.json
  git -C "$KEEPER_WORKSPACE/aaa3b-$keeper_variant" checkout d7654bc88464e56a6f982737d36fb887ebf8d0ff
done
gzip -dc docs/visual/2026-10-29-keeper-identity/rejected-wide.patch.gz | git -C "$KEEPER_WORKSPACE/aaa3b-candidate" apply -
gzip -dc docs/visual/2026-10-29-keeper-identity/rejected-narrow.patch.gz | git -C "$KEEPER_WORKSPACE/aaa3b-narrow" apply -
gzip -dc docs/visual/2026-10-29-keeper-identity/presentation.patch.gz | git -C "$KEEPER_WORKSPACE/aaa3b-presentation" apply -
python3 docs/visual/2026-10-29-keeper-identity/bench.py pilot
python3 docs/visual/2026-10-29-keeper-identity/bench.py pilot-narrow
python3 docs/visual/2026-10-29-keeper-identity/analyze.py pilot
python3 docs/visual/2026-10-29-keeper-identity/analyze.py pilot-narrow narrow
python3 docs/visual/2026-10-29-keeper-identity/bench.py control
node docs/visual/2026-10-29-keeper-identity/bar-matrix.cjs
KEEPER_OUT=/tmp/keeper-native node docs/visual/2026-10-29-keeper-identity/approaches.cjs
KEEPER_ONE=1 KEEPER_OFFLINE=1 KEEPER_OUT=/tmp/keeper-offline node docs/visual/2026-10-29-keeper-identity/approaches.cjs
```

For the original native view, also set `KEEPER_BASELINE` and
`KEEPER_UI_BASELINE` to the baseline worktree. Source module routing is audit
machinery only. `capture-archive.json` indexes additional unmodified original
screenshots outside Git; the committed evidence selects representative frames
without changing their pixels. Do not pool rejected pilots with the final
presentation controls or infer physical-device clearance from these tools.
