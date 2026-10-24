# Batch Q state and format audit

Audited spellfx.js, elementfx.js, arcanefx.js, overlay.js, powers.js, motion.js
and elements.js. No runtime modules are changed by this batch.

## World sprites

Ordinary dressing scales: flames .55, ripple .9, snare .42, onFloor/dress true.
Live fire uses base .5 (door .75) plus .07*sin(now/110+x*7+y*3), onFloor/glow true.
Door fires keep the hero-facing .56 offset along a passable axis. Sunk Drowned
uses ripple at .86+.06*sin(now/420+uid); laid snares use
.42*(1+.06*sin(now/160+x*3+y)). The preview asserts these existing bindings,
scale and offsets before substituting the three static sources at near/far depth.
Geometry stays static; original runtime scale oscillation remains. Field fires
already supply light; no new source light or emission mask is introduced.

## Spell timing and layers

Effects use born=realNow+delay and until=born+duration. drawSpells rejects
now<born and now>=until. Normalized post-hit age is (t-impact)/(1-impact).
Fireball: 750ms, impact .35; pillar: 700ms, .15; cone: 520ms, .3.
Scroll fireball has the existing 600ms read delay. Radius is clamp(q.r*.26,12,54),
with at most six target points. Review fixtures use one target, not six.
Fire alpha is (1-age)^2; frost alpha is (1-age)^1.6. Four candidate phases use
ages .02/.25/.55/.85 with nearest-phase boundaries .135/.4/.7. These phase
choices are review prototypes, not a new gameplay cadence.

Existing order is world/warnings, spells, held gear, flashes/boss, traps, status.
The review temporarily suppresses only the selected normal post-hit procedural
spell and injects its candidate before the first held frame draw. Context state
and hooks are restored. Calm, pre-hit cues and controls keep procedural drawing.

## Retained procedural rendering

Calm fire remains a fixed smaller mark without particles; Calm frost retains
four static marks. Lightning paths/Calm angular marks, projectiles, telegraphs,
scroll/use and poison/status remain procedural. There is no independent poison
impact spell to commission. Standard/safe palettes alter warning colours, not
fire/frost colours. Glyphs and intent text continue carrying danger information.

Trap durations remain dart420, needle650, pit900, alarm1400, disarm700, snare900ms.
Each rejects normalized time <0 or >=1. Distinct dart flight, needle/green tint,
pit dust/occlusion, alarm rings, disarm sparks and screen snare loop are retained.
Poison preview sets only a frozen status fixture and restores it afterwards.

## Runtime delivery gates

Source review does not add loaders, offline entries or allocations. Future delivery
must retain independent procedural failure fallback, precomputed/cached scaling
and shading, correct alpha/layers and current Calm behaviour without per-frame
painting. Verify native casts, trap triggers/outcomes, six-target overlap, warning
readability, offline reload and isolated phone frame-time/memory before integration.
Eight 256px RGBA impact frames cost 2MiB raw; three world cells with five cached
RGBA shades cost 3.75MiB raw, 5.75MiB combined, excluding decoded-image/canvas/GPU
overhead. This is an estimate, not measured runtime memory. Emission/shading policy
needs explicit integration review, especially ordinary flames versus lit fields.
