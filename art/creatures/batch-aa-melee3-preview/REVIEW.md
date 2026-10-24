# AA ordinary melee — third source pass: remaining dagger classes

Activation update: these reviewed frames are now integrated for release0.9.36.
See [native activation evidence](../batch-aa-melee-runtime/REVIEW.md).
The source-only findings below record the earlier review stage.

36 class frames (27 unique painted poses) are complete and reviewed locally.
This pass is unpublished and unactivated. The previous36-frame second melee
pass is preserved locally. The live game remains0.9.35 with414 shipped paintings,
3 app icons and246 common delivery files.

| Exact pair | Frames | Selected source |
|---|---|---|
| Fighter/dagger |9 CUT, one right hand |held-aa9.png |
| Ranger/dagger |9 CUT, identical Fighter pixels |held-aa9.png |
| Druid/dagger |9 CUT, one right hand |held-aa11-compact.png |
| Spellblade/dagger |9 CUT, one right hand |held-aa12-compact.png |

All four pairs pass Game.canEquip. Together with the active Thief dagger and
Mage dagger from the pending second source pass, this completes source coverage
of all six legal dagger classes. Cleric cannot equip a dagger and receives no
new dagger atlas. Other ordinary weapons/class pairs, ranged props and named
variants remain open. Spellblade's unlock and game rules are unchanged.

[Brief](../REQUEST-batch-aa-melee3.md), [manifest](../generation-batch-aa-melee3.json)
and [native inventory](reference-inventory.json) retain exact prompts, references,
request outcomes, class palettes, eligibility and supported existing poses.

## Source findings and reuse

All five original/repair sheets and27 unique selected poses were visually
reviewed. Fighter keeps grey gauntlet/cuff and brown cloth. Druid keeps brown
leather, green cuff and brown cloth. Spellblade retains charcoal gauntlet, slate
cuff, fine silver crossing seams, muted blue cuff mark and dark blue-grey cloth.
The mark belongs to the cuff, not a glowing blade rune. Hands grip connected
plain brass-crossbar daggers with complete pommels and forearm ends. The mature
painted materials follow existing approved held art and the monster art direction.

Ranger has no separate HAND_COLORS entry and currently falls back to Fighter.
All nine native reference PNGs are byte-identical, with equal grips/object bounds;
per-pose SHA256 proof is recorded in the native inventory and manifest. Ranger
reuses the same source crops, authored grips/bounds and shared aa9 family scale.
The exporter asserts all nine final PNG pairs and registration fields are equal.
Class keys remain separate and exact; no wildcard or blanket costume recolour.
The [opaque palette comparison](reference-palettes.png) shows all four families.

The original Druid and Spellblade blades were too long. Selected image-tool
compact-prop edits shorten them while retaining class hands and cloth. All
originals are retained. Three input requests were rejected without images;
exact prompts, references and request IDs are recorded beside successful clarified
static inventory requests. The image tool did not disclose its model.

Source grids are approximate. Fighter/Ranger and Spellblade use an authored430px
lower first/second-column boundary to preserve complete sleeve ends. Druid uses
nominal418/836 boundaries. Some raw cells miss the requested8% gutter. Small
red/yellow antialias flecks remain on raw edges; registered dark/light/brown alpha
comparisons and phone views show no large detached debris. No scripted painting,
masking, recolouring, rotation or mirroring was used. Export only crops, uniformly
resizes by family, translates and lays out existing pixels.

[Contact](contact-sheet.png), [grip/object registration](registration-review.png),
[alpha comparison](alpha-review.png) and [measurements](measurements.json) cover
all36 RGBA256 cells and four review atlases. Every registered alpha>32 silhouette
has at least32px clearance (required12px); authored object height is at most64px.
Right-hand anchors and object-only bounds keep equipment inside the view while
sleeves may naturally leave it.36 class cells occupy9MiB decoded, or6.75MiB for
27 unique pictures before further copies/GPU; this source pass allocates nothing
in the game and adds no offline downloads. Runtime deduplication is not claimed.

## Dungeon evidence and limits

The [capture inventory](dungeon/review.json) records120 captures and360 fitting
cases across390/320 phone widths and160/360/464 buffer heights.336 fits use
new source art;24 retain protected published art or procedural controls. Ten
direct identity guards per width preserve Cleric/off-class rejection, left,
unsupported channel, wrong hand count, lit/reflected state, named Grimtooth,
existing Thief/Mage dagger and empty casting-hand bindings. Four visible controls
per width cover existing Thief dagger, existing procedural Mage dagger, wrong
two-hand Druid presentation and named Spellblade Grimtooth. These guards are
presentation checks, not claims that illegal equipment becomes usable.

Each family covers nine CUT boundaries0/.08/.16/.24/.32/.42/.52/.68/.84,
recovered1, Calm cut and cast/read/drink presentation. All new frames are
one-handed; cast/read/drink keep rest in the right hand while native action
hands stay separate. Fighter casting is a renderer stress case, not a new power.
Class/item-qualified unique capture labels prevent shared dagger names from
overwriting Calm/recovery evidence. No page or console errors occurred.

All120 screenshots were visually reviewed through eight galleries. These are
frozen exact raw id/class/pose/two/lit=false source substitutions with Game.update
paused. The HUD/log intentionally remain the seeded Fighter fixture. They are
not native class runs, equip/attack transitions, offline delivery, failure recovery,
warning/occlusion coverage or a performance benchmark. Existing runtime bindings
and the pending second source pass remain untouched.

- [390 Fighter](dungeon/390-fighter-dagger-overview.png) · [320](dungeon/320-fighter-dagger-overview.png)
- [390 Ranger](dungeon/390-ranger-dagger-overview.png) · [320](dungeon/320-ranger-dagger-overview.png)
- [390 Druid](dungeon/390-druid-dagger-overview.png) · [320](dungeon/320-druid-dagger-overview.png)
- [390 Spellblade](dungeon/390-spellblade-dagger-overview.png) · [320](dungeon/320-spellblade-dagger-overview.png)

## Reproduce and validation

```sh
node art/creatures/reference-batch-aa-melee3.cjs
python3 art/creatures/export-batch-aa-melee3.py --check
node art/creatures/preview-batch-aa-melee3.cjs
npx playwright test '/held-equipment\.spec\.js$' --project=phone --project=small --workers=2
npm run check:agents
npm run check:art
```

12 existing held-equipment browser checks passed in33.1s using system Chromium
and a separate localhost4190 server. These check unchanged runtime behavior,
not activation of the new frames.217 new reviewed rasters cover5 sources,
41 native cells/grids/palette comparison,43 registered exports/layouts and128
captures/galleries. Export reproducibility, exact Ranger reuse, script syntax,
art hashes, documentation and whitespace checks pass. No gameplay change means
no balance simulation. Native action/failure/offline evidence, full runtime suites
and isolated performance remain activation/publication gates. No version change.
