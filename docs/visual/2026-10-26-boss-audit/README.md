# Keeper encounters and victory presentation

Review of v0.9.45 after the three-phase visual audit. All three keepers were
sampled at320×667 and390×844. No confirmed runtime/art defect requiring a change
was found in the reviewed views. This publishes review evidence, with no new
painting, gameplay change or version bump.

## Coverage and limits

- Six native introduction captures show actual dialogs, decoded portraits and
  the Face the keeper control.
- Eighteen controlled phase/tell views show each keeper at phases0/1/2, including
  the Warlord's throne/spear, open/white-hot Heartforged and Lich rite progress.
- Six scroll-impact views use the native lightning command and generated effect,
  with a supplied midpoint render time. Damage flashes, numbers and warning
  glyphs remain distinguishable; the Lich's rite interruption is expected.
- Eighteen native ending sessions cover three keepers × three outcomes × two
  phone widths. Generated final floors and real choice controls are used, with
  enemy defeat, quench and knowledge supplied. Each records choice, victory and
  actual downloaded card:54 images. Captions and symbols match each outcome.

These84 captures are **not unassisted boss victories**. `combat.cjs` freezes
simulation after the native introduction to prevent AI from changing the phase
before capture; it uses the shipped renderer/art with supplied health, phase,
windup and spell midpoint. The phase images do not prove native phase transition
triggers, pacing or difficulty. `endings.cjs` keeps updates and UI native, reaches
generated final floors through the native stair helper and checks actual keeper
routing. It does not simulate defeating the keeper. Both record page errors and
explicit fixture scope. No physical-device or local WebKit visual review.

Initial fixture attempts requested a nonexistent Warlord special pose, allowed
AI to leave the throne before capture, or photographed a scroll before impact.
These capture problems were corrected before the selected final images; they
were not game defects. No production code, image or assertion was changed.

## Review galleries

[Phase/tell comparison](boss-contact.png) · [Spell impact](spell-contact.png) ·
[All nine ending cards at320px](ending-contact.png).

Native examples: [Heartforged introduction](320-heartforged-intro.png),
[Warlord throne](320-warlord-phase-1.png), [Lich rite](320-lich-phase-2.png),
[Heartforged lightning](390-heartforged-lightning.png),
[Quench victory](320-lich-quench-end.png), [Keep victory](320-lich-keep-end.png).
Victory screens scroll vertically; the card export is a separate800×420 image.
The living hero portrait remains appropriate for every victory outcome.

## Reproduction and validation

Run `node docs/visual/2026-10-26-boss-audit/combat.cjs`, then `endings.cjs`.
They require the project Playwright package and system `/usr/bin/chromium`.
Finish captures before browser checks to avoid starving the deferred art queue.
[Combat metadata](combat-evidence.json) and [ending metadata](ending-evidence.json)
record the individual cases. [Validation](validation.json) records check results.

Balance simulations and a new performance benchmark are unnecessary for this
review-only publication: all shipped game/art bytes remain unchanged from the
verified v0.9.45 release. This is bounded coverage, not certification of every
boss attack, equipment/class combination, text setting or device.
