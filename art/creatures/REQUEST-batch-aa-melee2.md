# AA ordinary melee — second production pass

Source/review only, local and unpublished. Keep all0.9.35 runtime bindings.
Paint36 CUT frames: Fighter/hammer9, Fighter/flail9, Cleric/flail9, Mage/dagger9.
All pairs are legal and one-handed. Fighter hammer covers the Sentinel starter
kit, Cleric flail its Crusader kit; Mage carries a dagger in the ordinary kit.
Nine poses are rest/drawback/windup/strike/cut/sweep/through/recover/return,
at0/.08/.16/.24/.32/.42/.52/.68/.84 of the existing swing, returning at1.

Flail is the existing short shaft/short curved chain/single spiked iron head,
not a new physics animation or long whip. Preserve all connections and pose
orientation; no mace substitution or new move. Fighter grey gauntlet/cuff and
brown sleeve; Cleric brown leather/gold cuff/ivory sleeve. Mage pale skin hand,
purple cuff/sleeve and very short ordinary dagger, no metal glove or staff.

References use fresh native browser sessions per family. An initially suspected
missing Cleric flail head was a preview misread: opaque diagnostic and exact
pixel comparison confirm the native chain/head are complete. No game fix.

True RGBA3x3 sheets, whole connected props and sleeve ends inside each cell,
target8% transparent gutters. Mature gritty painted monster-compatible materials.
256px exports with authored right-hand grips and object-only bounds, uniform
family scales, >=12px registered alpha clearance. Scripts may crop, uniformly
resize, translate and lay out existing pixels, never repaint/recolour/rotate/mask.

Review all36 sources/exports in the dungeon at390/320 and160/360/464 buffer
heights. Check CUT boundaries, recovery, Calm, cast/read/drink presentation,
exact raw id/class/pose/two/lit guards, other-class/named variants and existing
active T/Y/Z/AA art. Frozen source proxies are not native activation evidence;
Fighter casting stress cases do not grant a class spell. Later activation needs
native actions, whole-family failure fallback, offline and full release checks.
Remaining AA pairs, ranged states and named variants remain open.
