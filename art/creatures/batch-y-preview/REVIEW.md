# Batch Y — ordinary shield rear views

Three new painted carried frames: **Fighter shield, Cleric shield, Thief buckler**.
Source/review complete locally, unpublished. No shipped art, runtime binding,
service-worker entry, release metadata or gameplay rule changes.

The E–X audit sequence is complete. Y explicitly extends T's documented remaining
held-library gap, rather than repainting approved monsters, effects or portraits.

## Identity and registration

One generated transparent [source strip](../held-y1.png) preserves the rear-view
wood/rim/vertical grip and attached left forearm strap in the
[native references](reference-sheet.png). Fighter keeps grey glove/dark cuff/brown
sleeve; Cleric brown/gold/ivory; Thief charcoal/brown/olive. The ordinary shield has
a flat top and pointed lower edge; the buckler stays round with its inner boss.
Weathered grain, scratched iron, stitched matte leather and coarse sleeves match
the mature painted held kit. No front heraldry, new runes, glow or decorative weapon.

All three source figures and exports were visually inspected for connected
fingers/grip, strap attachment, rear construction and class palette. The source
Fighter rim has 13px right-cell clearance and Cleric 19px, below the requested
8% gutter; both complete edges are retained with no neighbouring overlap. This
spacing exception is documented, not silently cut out or repaired with scripts.

`python3 art/creatures/export-batch-y.py --check` reproduces three 256px RGBA
frames, [atlas](shield-atlas.png), [alpha comparison](alpha-review.png) and
[measurements](measurements.json). Crop/uniform scale/translation only; no painting,
recolouring, mirroring, warping or rotation. Common scale preserves proportions;
authored grips land within rounding of128,128. All registered alpha bounds have
>=12px clearance. Object bounds cover the shield, excluding the extended sleeve;
shield height is below128px. The source grip is the centre of the grasped handle,
not the centre of the overall arm silhouette.

## Actual state mapping

| Pair | Frame/motions | Guard |
|---|---|---|
| fighter/shield | One static rear frame | Exact raw id `shield`, class `fighter` |
| cleric/shield | One static rear frame | Exact raw id `shield`, class `cleric` |
| thief/buckler | One static rear frame | Exact raw id `buckler`, class `thief` |

`renderer.drawView` already translates/scales the carried frame through rest,
shield Bash, cast, read and use. No extra pose or new shield action is necessary.
Bash remains450ms, contact/shove transition .33, full shove held to .5, then home;
the preview selects .4. Cast lowers using the existing520ms sine; read uses1000ms
and drinking850ms. Existing action hands, scroll and seeded potion sprite remain.
Calm keeps the same frame and existing motion rules. No hand is painted on top
of a simultaneous procedural carried hand.

Six exact-fallback controls retain original frame objects: Fighter towershield,
Mage shield, Thief shield, Fighter buckler, Cleric Rune shield and named Bastion.
No named-base stripping or off-class substitution. All three selected pairs pass
`Game.canEquip`; test availability does not authorise every class/shield pairing.
P's integrated Rune shield rear frames, named shields, quill shields, foci,
Wayfarer lantern and all unselected kits remain outside this source pass.

## Review evidence and limits

`node art/creatures/reference-batch-y.cjs` captures the original carried frame
shapes/palettes. `node art/creatures/preview-batch-y.cjs` temporarily proxies only
these three exact pairs through `Assets.carried` and freezes presentation states.
This is a source-review harness, not native delivery or actual action outcomes.
It restores the proxy afterwards. No runtime/image requests are replaced outside
the isolated review context. The starting Fighter character's name/story remains
in fixture HUD/log text; changing the pose class in a fixture is not a new run.

36 phone captures and two galleries cover three pairs × six states at390/320px:
[390 gallery](390-overview.png), [320 gallery](320-overview.png).
108 fitting cases cover both widths × three pairs ×160/360/464 buffer heights ×
rest/Bash/Calm/cast/read/use. Rest/Bash/Calm shield bounds stay within the view;
action cases deliberately lower the shield and may carry it below the viewport.
The sleeve may leave the viewport as before. These are bounds and source-fit
checks, not warning/loot/contrast certification in every combat situation.
See [capture records](captures.json).

Twelve existing held-equipment browser tests passed on phone and small (31.2s),
covering current runtime fits, bow/knife release, Calm/named shapes and loot
clearance. Those baseline checks do not establish Y integration. Preview syntax,
reproducible exports, documentation and reviewed-art inventory checks also pass.
Balance simulations are unnecessary: no implementation or game outcomes changed.

Three decoded256 RGBA frames need .75MiB pixel storage; cached copies could add
another .75MiB before browser/GPU overhead. Source review adds zero runtime memory.
Future delivery must use exact lazy bindings, independent fallback and offline
cache entries; review native equip/unequip, Bash/contact, cast/read/drink transitions,
short views, named identities and loot visibility, then full browser/release and
isolated frame-time checks. No fresh performance/offline/physical iOS pass is
claimed here. W/X local audit work remains intact and unpublished.

## Runtime delivery follow-up — release0.9.34

These three approved source exports are now integrated and published with the
W/X audits. See [native activation review](../batch-y-runtime/REVIEW.md). The
frozen source-review evidence above is preserved and does not substitute for
the native equip/action/offline and release validation.
