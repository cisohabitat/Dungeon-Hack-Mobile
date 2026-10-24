# Painted art runtime delivery — 24 October 2026

184 previously approved E–T gameplay exports are wired into the playable game and
its offline cache. They reproduce their reviewed source bytes exactly. U/V reuse
audits are included; their existing portraits, UI frames and illustrations stay.

| Runtime area | Delivered |
| --- | --- |
| Animated characters | Six class Shades, six companions with rest poses, Mender healing, barrel Mimic, four keeper variants |
| Static world and equipment | 74 trader, encounter, prop, dressing, remains, inventory and environmental pictures |
| Materials | 13 regional base wall/floor/ceiling sets and 27 Grey Halls architecture/detail cells |
| First-person equipment | 16 Fighter sword/Mage staff/Ranger bow poses and two Rune shield rear grips |
| Impacts | Four fire and four frost stages; existing lifetime, projection and fade gates |

[Delivery inventory](../runtime-delivery.json) maps every runtime path to its
source and SHA256. `python3 tools/export-painted-runtime.py --check` reproduces
all shipped bytes and the runtime catalog. No new painting was generated. Rebuild the diagnostic catalog layouts with
`python3 art/creatures/contact-runtime.py`; this only lays out shipped pictures.

## Native review

[390px gallery](390-overview.png) · [320px gallery](320-overview.png) ·
[capture record](review.json) · [character catalog](catalog-creatures.png) ·
[world catalog](catalog-world.png) · [material catalog](catalog-materials.png) ·
[held catalog](catalog-held.png) · [impact catalog](catalog-effects.png).

80 native captures plus two overview sheets show class Shades, companion rest and
healing, barrel Mimic, keeper phase/equipment variants, three traders, an encounter,
room dressing, all 13 regional base looks and three held families at 390/320px.
The harness freezes game updates and selects existing states in isolated runs;
it uses actual runtime loaders and renderer, with no asset routes, image swaps
or renderer overrides. Every one of the184 newly shipped images is cached and
decodes after a native offline reload at both widths, with no console/page errors.
This establishes loader delivery and representative rendering, not every encounter
outcome, boss transition or physical-phone certification.

The five catalog sheets and final native galleries were visually inspected.
Previously recorded source review findings, including imperfect material repeat
joins and held pose foreshortening, remain visible limitations rather than claims
of newly repaired painting. Source provenance and rejected repairs remain intact.

## State, fallback and safety boundaries

Static sprite objects upgrade in place, retaining callers and aliases; existing
DOM images also change from their fallback when decoding completes. Each file
fails independently. Creature shade/flash palettes are built between frames and
cached. Mender healing uses a separate single-frame export; companion cell 6 is
sit. Warlord phase 1 throne stays seated, standing shots use a spear through the
existing lunge, interrupted wind-ups revert, and phase 2 returns to cleaver art.
Lich phases reuse their approved existing atlas. Hidden Mimics and submerged
Drowned retain concealment. No pose adds an attack or rule.

Native64 material darkness arrays retain the original eight-level Uint32 format.
Grey Halls receives the approved R/S baseline; other regions retain original
secondary materials, regional overlays, coloured locks and architectural details.
A presentation revision refreshes cached floor/ceiling arrays if an image finishes
loading after a level was already drawn; saved geometry stays untouched.
The original stair arch stays because the painted source differs in 26 alpha-mask
pixels. The base Tooth Charm painting is an unused reserve; seeded amulet looks
must remain unchanged after identification. These are intentional exclusions,
not missing runtime downloads. Future regional refinements and W/X audits remain.

Held art binds exact raw id/class/pose/two-hand/lit combinations with reviewed grip,
object bounds and bow nocks. Named/reflected and unpainted gear retain procedural
art; live strings, arrows and drawing hands stay separate. Spell projectiles,
lightning, poison, triggered traps, telegraphs and Calm impacts stay procedural.
No lights, damage, target selection, action timing, generation or run dice changed;
this presentation delivery needs regression/performance checks, not balance tuning.

## Validation

- Full Chromium phone/small matrix: 791 checks completed in 50 minutes, 790 passed
  directly. One announcement check lost its trace file because a concurrent
  focused run initially shared the artifact directory; it passed in a clean,
  isolated rerun (25.4s). No gameplay assertion was relaxed.
- Deliberately late floor download: 2 focused checks passed at phone/small sizes
  (16.4s), verifying cache refresh on the same level without state changes.
- Two strengthened class-pose checks passed at both sizes (10.1s): every
  supported class Shade pose selects its own painted atlas.
- Native binding/fallback checks passed at both sizes: all 74 static keys, held
  guards, surface format, class/boss selection and independent corrupt world,
  Shade and held-family fallbacks.
- Isolated 4×CPU budget passed (56.9s):fight 43.6fps, wide 45.8, flooded 42.2,
  painted 31.6, rite 51.4. Minimum required 30fps (wide 27); startup 1833ms,
  below 6000ms. Thresholds and assertions were unchanged.
- Runtime exporter reproduces all 184 reviewed source bytes and catalog entries;
  portrait exporter reproduces all 16 class/keeper/companion exports. U's seven
  portrait hashes and review sheets also reproduce.
- Syntax, generated agent documentation, art inventory/cache and diff checks pass.
  Final `npm test` passed with 751 rule checks in 74 files (1m17s), plus type,
  generator, release, API, security, narration and offline checks. The mandatory
  pre-push hook repeats the full suite on the exact commit before main.

The new cache test brings the current matrix to 793 checks on future complete runs.
CI separately covers focused WebKit and release gates. Physical iOS certification
is not claimed by these Chromium viewport runs.
