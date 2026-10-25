# AD ordinary shield-back source review — 25 October 2026

Seven new exact carried frames complete **source coverage**, alongside five
unchanged P/Y frames, for all12 legal ordinary shield/class pairs. They are:
Fighter/Cleric/Druid bucklers, Fighter/Cleric tower shields and Fighter/Cleric
Quill Shields. The [35-pair audit](ordinary-shield-audit.json) uses actual
`Game.canEquip` and exact active catalog keys:12 legal,23 rejected,5 delivered,
7 source gaps. A catalog entry records delivery intent, not native-load proof.
Named AB shields and pending AC caster equipment are separate inventories.

The [brief](../REQUEST-batch-ad-shields.md) and native procedural geometry /
eligibility references preceded generation. Three original image-tool strips,
prompts and reference paths remain in `generation-batch-ad-shields.json`. There
were no repairs. The sources and all seven final exports were visually inspected:
rear wooden faces, attached vertical grips, connected closed left fists and
forearm straps, class gloves/cuffs/sleeves, full rims and Quill Shield tips.
Tower shields have chamfered upper corners and flat bottoms; bucklers remain
round with the inside boss; Quill Shields retain a dark brown rim and narrow
alternating ivory quills. The native thirty-quill construction is the reference;
the lower-left perimeter is occluded by the forearm, so the complete hidden count
is not independently visible. No front emblems or named substitutions are added.

The three-background [alpha comparison](alpha-review.png) and opaque composites
show clean transparent silhouettes with natural antialiasing. The image tool's
transparent Quill Shield preview showed apparent red/yellow patches which are
absent on opaque composites; no background mask, palette edit or repaint was
applied. Original pixels remain preserved. Requested8% source margins were not
met everywhere. Complete component crops cross the nominal first buckler column
by23px and first Quill Shield column by4px, with no figure overlap or clipped
equipment. Registered alpha>32 clearance is at least17px at256px resolution.

Registration measures grip landmarks against native silhouettes. Authored
shield-only bounds exclude the diagonal sleeves and include all visible rim /
quill tips. Each ordinary item has one shared physical source scale across its
class variants; class-specific hand/cuff pixels are never recoloured or reused.
Export only crops, uniformly scales and translates original RGBA pixels. Alpha
components measure bounds and crop separation; they are never applied as masks.

All112 full-phone source captures were reviewed through14 labelled screen-crop
galleries, seven per width. Each frame covers rest, maximum walking bob, damage,
Calm, Bash, cast, read and drink at390/320px.336 fitted fixtures cover the same
states at160/360/464-row view buffers, with45 exact class/identity guards per
width:17 uncovered shield/class calls, all21 published carried pairs and all7
pending AC pairs. Full `Game.state()` and Dice/Odds state stay unchanged during
drawing. No page or console errors occurred. All shields fit outside action
lowering, keep the centre ahead clear at rest and preserve complete tips during
the synthetic Bash. Sleeves can leave the viewport; left-hand actions deliberately
lower carried shields, including the tall tower shield's remaining upper edge.

These are **frozen source-fitting proxies**, not native equipment activation,
action transitions, loading/failure, offline or performance evidence. The HUD
retains the setup Fighter; only the view fixture selects target class costume.
Bash/cast fixtures stress placement and do not grant abilities: Fighter has Bash;
Cleric/Druid retain their existing abilities. Existing equipment regressions
separately passed12/12 across phone/small in48.5s. Repository/export checks are
recorded in `coverage-audit.json`. Balance simulations are unnecessary because
this pass changes source art, review tools and documentation only.

Reproduce from the repository root:

```sh
node art/creatures/reference-batch-ad-shields.cjs
python3 art/creatures/register-batch-ad-shields.py
python3 art/creatures/export-batch-ad-shields.py --check
node art/creatures/preview-batch-ad-shields.cjs
python3 art/creatures/gallery-batch-ad-shields.py
```

AC+AD total14 pending carried frames. No runtime, offline-cache or release file
has changed; public v0.9.39 is unchanged. Activation requires exact class/id
binding, native legal class/equip/action/Calm evidence, independent image failure,
installed offline Continue and full release checks, including performance and CI.
Preserve all active P/Y/AB frames and AC lantern base/reflection metadata.

Next painting: AE fists, casting/read/drink hands and Wild Shape bear claws,
after auditing the actual class/action states and current procedural timing.
