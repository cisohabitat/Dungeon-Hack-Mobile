# Batch P equipment gap, identity and motion audit

Audited 24 October 2026. All 95 ITEM_ART pictures were captured and reviewed in
inventory-overview.png. Batch P targets the seven appended regional reward/base
identities, not the whole library. Six have direct ordinary base selections; the
Tooth Charm fang is a reserve, as explained below. Existing named relic paintings,
ordinary core gear, rarity edges and supported held weapons are unchanged.

| Key | Preserved visual identity | Scope |
|---|---|---|
| elvenchain | Fine blue-grey mail, violet edging | Inventory/floor base source |
| marshhide | Olive scaled hide, dark lacing and rivets | Inventory/floor base source |
| dwarfplate | Heavy dark iron shoulders/cuirass, copper trim | Inventory/floor base source |
| runeshield | Iron tower form, two bars, boss, cyan Y/rune baseline | Inventory/floor plus separate rear frames |
| dwarfhammer | Iron square head, rear beak, top spike, wood haft/copper | Inventory/floor base source |
| handxbow | Black-purple stock, violet gem, connected prod/string/bolt | Inventory/floor base source |
| amulet_tooth | One yellow fang on hide thong | Reserve base only |

Elven/dwarf plate/hammer and marsh hide derive heavily from base part recolours;
the painted pass makes fine mail, scaled hide and iron/copper materials readable
without changing identity. The other three compositions keep their distinct
existing structures. Scimitar, wyrmscale and quillshield already have distinct
constructed silhouettes; no extra commissions were added merely to fill sheets.
All 47 existing named relic portraits and NAMED_ART remain separate.

## Tooth appearance guard

buildLooks in game.js gives every amulet type a seeded appearance. items.spriteFor
continues using that appearance after identification. Ordinary Tooth Charm may
therefore show an obsidian amulet rather than its base fang picture. Hissra's Tooth
has its separate named sprite/portrait. Neither is replaced with this new fang.

The harness checks unknown and known spriteFor against the same seeded look,
checks the named Hissra mapping stays distinct, and captures both ordinary states
without any painted substitution. The fang is retained as a reviewed base reserve;
no claim of a normal live base-fang binding or changed discovery rules is made.

## Demonstrated carried-shield gap

motion.view requests spriteFor(eq.shield). A plain Rune-Cut Shield selects
runeshield. carriedParts currently accepts only buckler/shield/towershield/
quillshield (plus foci/lantern), so Assets.carried('runeshield',cls) returns null.
Renderer asks for that exact carried frame and has no fallback to a tower shield.
The preview asserts the null result before override and after restoring it.
This batch prepares source frames; it does not fix the live carried gap.

shieldFits permits the heavy Rune-Cut Shield only for Fighter and Cleric. The
harness checks canEquip for all seven classes at each width. Two newly painted
rear frames use their existing palettes: grey glove/cuff/brown sleeve for Fighter,
brown glove/brass cuff/ivory sleeve for Cleric. Other classes remain ineligible.
The back has iron plates, attached vertical grip/crossbars and forearm strap;
one left hand grips it, with the forearm extending down-left. No front boss/rune
is shown on the rear. Existing tower-shield rear frames are references, not a
claim that Rune-Cut Shield already had a supported carried picture.

Inventory icons use centre fitting, not creature ground anchors. Held pictures
use independent authored grip points and object bounds. The first rear export
clipped at the top during bash in the 160px view. Uniform source scale is capped
to 128px object height before normal heldPlacement; no bash time/path is changed.
36 numeric fitting checks cover both classes × three view heights × rest/bash/
Calm × both phone widths. Only object bounds must fit; sleeve may leave the view.
Cast-lowering captures intentionally lower the shield off-screen as before.

## Existing motion and identity contracts

heldart moves parts around GRIPS/ICON_AXIS before painting class hands. Separate
HELD_ART keeps one throwing knife versus a Pack bundle, and long two-handed
sword geometry. Named weapon handling uses namedBase/NAMED_ART, not suffix tricks.
heldview caches cut/recovery angles; spears/staffs drive forward, and staff casting
uses channel/rest. Bows keep fitted nocks, drawn string/shaft and two-hand release.
Combat release fractions stay bow .72, knife .4, sling .55, hand crossbow .32.
The crossbow uses the existing rest frame and .32 recoil path; no new weapon
poses, projectile times, class grip or named markings are commissioned here.
The two shield rear pictures share the existing whole-frame bash/lowering path.

Twelve existing held-equipment.spec.js tests passed across phone/small, covering
view fitting, bow/knife release/contact, Calm, named silhouettes and loot clearance.
Those tests do not cover the newly found Rune shield gap or prove the review
paintings are integrated; separate harness checks above address the source frames.

## Evidence and limits

56 captures: 24 six-key near/far floor views, 12 actual Pack details, four unchanged
seeded Tooth views and 16 Fighter/Cleric rear views in rest/bash/Calm/cast-lowering.
Actual original URLs, names/actions, floor scale .32, onFloor/yOff and unchanged
item records are checked before DOM/render substitution. Both galleries and
selected full-size Pack/held views were inspected, with no page/console errors.
Gold rarity edges, named illustrations, discovery, items and gameplay remain intact.
Rune/crossbow source luminosity is only source colour in preview; live emissive
handling must be decided at integration without adding world lights.

Frames/game updates are frozen; Assets.carried is overridden temporarily for
review and restored. No app, loader, cache, save, combat or equipment-rule change
is included. Offline/failure fallback, final rarity outlines, emissive material
handling, native equip/unequip/action outcomes, layered hand integration and
performance remain integration gates. Publication remains pending.
