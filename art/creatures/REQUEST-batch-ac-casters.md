# Batch AC — ordinary caster equipment

Seven isolated carried frames, painted in the worn, mature style of approved
monster/equipment art. Native geometry and actual eligibility were captured
before generation in `batch-ac-casters-preview/reference-inventory.json`.
The generation manifest preserves the exact prompts and originals; this written
brief consolidates that audit and those prompts after generation.

| Sheet | Exact class/id | Construction |
|---|---|---|
| ac1 | Mage / spellbook | Closed oxblood leather, cream pages, brass clasp/corners, tooled gold circle and cross |
| ac1 | Mage / crystal_orb | Pale blue glass, brass claw stand/pedestal, no lightning |
| ac1 | Mage / orb_storms | Navy glass, silver claw stand/pedestal, pale lightning inside only |
| ac2 | Cleric / holy_symbol | Twelve-rayed carved wooden sun and attached tan cord loop |
| ac2 | Cleric / silver_symbol | Sixteen alternating silver rays, bright boss, attached chain loop |
| ac2 | Cleric / reliquary | Gilt peaked house, red roof gem, four blue studs, one bone in a dark front window |
| ac3 | Spellblade / wayfarer_lantern | Closed fist on rigid carry handle, worn silver angled cage below, blue flame |

The six foci rest on the left palm. Mage has bare weathered skin and purple
cloth; Cleric has brown gloves, ochre cuffs and ivory cloth. The lantern uses a
closed charcoal glove, silver cuff trim, a blue rune and dark slate cloth.
Every forearm extends down-left. Keep complete connected fingers, sleeves,
cords, handles, rays and stand feet. No extra hands, external halo or backdrop.

`Assets.carried(id, cls)` supplies one static frame per exact pair. The renderer
moves that whole frame during walking, damage, casting, reading and drinking;
these actions do not require newly invented focus poses. Foci are class-restricted
by `Game.canEquip`, not generic shields. Do not add Bash abilities. The lantern's
`at.base` must mark its actual bottom rim: short views reserve space from that
mark. Keep its existing lowering, settling, Calm and reflected-blade behaviour.
No new world light or change to fog, class rules, costs, timing or dice.

Only crop, uniformly scale and translate generated pixels. Alpha analysis may
measure landmarks but must not repaint/mask them. Preserve originals, exact
crops and spacing exceptions, then review source/export transparency and fitting
at 390/320px, including 160/360/464-row render buffers. Source proxies/frozen
fixtures are not native gameplay, delivery, fallback-loading or offline evidence.
Activation later requires exact class/id delivery, independent failures, native
actions, offline caches and the full release checks.
