# Batch AD — remaining ordinary shield backs

Paint seven exact carried class/item pairs after auditing all35 combinations of
five ordinary shields and seven classes. Twelve pairs are legal: five already
have active P/Y artwork, seven need the source frames below. Named AB shields
and the seven local AC caster foci are separate surfaces.

| Sheet | Exact pairs | Shape / construction |
|---|---|---|
| ad1 | Fighter, Cleric, Druid / buckler | Small round wooden rear face, plain riveted iron rim, inside central boss, vertical leather grip |
| ad2 | Fighter, Cleric / towershield | Tall wooden rear face, plain iron rim, chamfered top corners and flat bottom; no pointed shield tip |
| ad3 | Fighter, Cleric / quillshield | Round brown wooden rear face, dark brown border, thirty narrow ivory quills alternating long/short around rim |

Every shield faces away from its bearer: the viewer sees the BACK, its attached
vertical leather grip, closed left fist and snug anchored forearm strap. The
forearm extends down-left from the fist through that strap. Exactly one connected
left hand and sleeve per cell; no palm-up focus, front emblem or other arm.
Fighter: grey armoured glove/cuff and coarse brown sleeve. Cleric: brown glove,
ochre-gold cuff and worn ivory sleeve. Druid: brown glove, muted green cuff and
earth-brown sleeve. Match the native geometry references and mature worn painted
materials of approved `held-y1.png`, retaining plain ordinary constructions.

One static `Assets.carried(id, cls)` frame supplies each pair. The existing
renderer moves it through rest/walking/damage, Bash, Calm, read/drink and cast
lowering. Generic cast/Bash fixtures are source-fitting stress states, not new
abilities; only Fighter has native Bash, and only existing class abilities may
be used in later activation evidence. Preserve class eligibility and two-hand
restrictions. No gameplay, collision, timing, world-light or dice changes.

Generate transparent original strips with at least8% clear margins and no
clipped quills, sleeves, grip or strap. Preserve original PNGs and exact prompts.
Export by crop, uniform scaling and translation only, with at least12px alpha32
clearance at256px. Analysis may measure component bounds but never mask/repaint
pixels. Review every source/export and both phone widths, including160/360/464-row
buffers. Retain exact identity guards, all active shields and AC pending sources.
Source proxies/frozen fixtures do not establish native activation, independent
loading/failure, offline delivery or release performance. Those remain separate
activation gates.
