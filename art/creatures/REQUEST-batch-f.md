# Batch F — six companion atlases

Scope: generation, repair, registered review exports and actual dungeon fitting
previews. Runtime integration and publication are separate stages, as in Batch E.

## References and identity

Use current companion portraits and `js/folk.js` as identity authorities:

- `dog`: brown scruffy Hound, floppy ears, pale muzzle/chest, red collar/brass tag.
  This is not the hostile Blink Hound (`hound`).
- `wolf`: lean grey wolf, amber eyes, pricked ears, low tail; no collar.
- `scrag`: freed olive-green goblin with ragged hood, knife, attached picks/key
  ring and short broken cuff chains. Preserve wiry body and bare long feet.
- `sellsword`: scarred mercenary, kettle hat, blue-grey brigandine/mail, red sash;
  one two-handed greatsword with continuous closed grips. No shield.
- `mender`: tired human healer, grey-green hood/robe, ash staff with tied herbs
  and brass bell, leaf embroidery, satchel and bandages. No wizard crystal.
- `renegade`: amber-eyed ash-grey dark elf, silver hair, ears through grey-green
  hood, worn brown leather and two held curved blades. No enemy red-eye palette.

## Sheet order and live actions

Each main sheet has nine figures, in row-major order:
idle, stepA, stepB, windup, strike, recover, sit, hurt, blink.
`special` is deliberately replaced by the explicitly mapped `sit` slot.

Both paws/legs lead alternately without mirroring held equipment. Every figure
faces the viewer. Keep intact anatomy, grips, weapons, ears and tails with wide
transparent gutters. No environment, ground plane, detached particles or shadows.
Uniform scale within a sheet; grounded visible alpha ends on row 236 after export.
Sitting changes posture/height naturally, never by resizing the entire figure.

`js/companion.js` selects idle, windup for a lunge, steps, rest, hurt and blink;
Mender additionally selects heal. Strike/recover are review reserves, not a reason
to change combat timing or introduce new runtime actions.

Rest must match existing commands: Hound sits, Wolf lies with head up, Goblin
squats, Sellsword leans on planted sword, Renegade lowers both blades while
standing, Mender kneels to sort satchel/bandages with staff beside knees.
Mender healing remains separate: both hands cupped forward, staff secured in arm
crook, restrained green warmth, herbs/bell/satchel retained. Do not discard rest
to fit healing into nine cells. Generate a matching extension and preserve its
prompt/source and measured registration.

## Review and later integration

Record actual prompts, references, originals and repairs in generation-batch-f.json.
Review all source figures and final cells, neutral, walking and action comparisons,
plus supported poses at 390px and 320px using the actual dungeon renderer.
Keep review substitutions clearly identified. Existing recruitment props may
reuse approved rest art later, with original framing preserved.

Integration must map the custom sit cell and Mender heal explicitly; the existing
fixed loader calls slot seven special and does not yet support these companion
kinds. Retain per-kind fallback, current scale, command rules, progression and
healing timing. Native offline, real-loader failure, Calm/reduced motion and
performance checks are required before claiming shipped coverage.
