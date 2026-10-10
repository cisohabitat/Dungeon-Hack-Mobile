# Sound and music request: Deepdelve

Deepdelve makes all its sound today from synthesised tones and noise
(`js/sound.js`) and its music from synthesised bells and drones
(`js/music.js`). This folder is for real recorded sounds and composed music to
replace most of it. This file is the brief.

**If you are the agent doing this work: write only into this `sound/` folder,
and change nothing else in the repository.** Code, the offline cache and tests
are wired up separately once the files are here.

Magic stays synthesised: spells, scrolls, wards and the lich's rite need no
samples.

---

## 1. Where things go

```
sound/
  REQUEST.md          this brief (leave it as it is)
  manifest.json       one entry per sound and per music stem (section 6)
  SOURCES.md          where every file came from, and its licence (section 7)
  sfx/                one-shot sounds:     <id>-<n>.ogg and <id>-<n>.m4a
  stingers/           short musical cues:  <id>.ogg and <id>.m4a
  ambience/           looping beds:        <theme>.ogg and <theme>.m4a
  music/<theme>/      layered stems:       <stem>.ogg and <stem>.m4a
  music/title.ogg / title.m4a
  masters/            lossless masters (FLAC), only of work that cannot be downloaded again (section 5)
```

- File names are lowercase, with hyphens. Variations of the same sound are
  numbered from 1: `hit-blade-1`, `hit-blade-2`, `hit-blade-3`.
- Every game-ready file comes in **two formats**, `.ogg` (Vorbis) and `.m4a`
  (AAC-LC), with the same name. The game picks whichever the phone plays best.

---

## 2. Sound effects (`sfx/`)

### What they should sound like

Grounded, close and physical: iron, wood, stone, leather, cloth. Think of a
dark-fantasy dungeon heard from inside a helmet: not cartoonish, not sci-fi,
not over-produced trailer impacts. Keep them **dry, or with only a very short
room**: the game adds the cave around them. Trim each sound so it starts within
5 ms of the file's start, and keep tails short unless noted.

### Tier 1: required

Each **id** below is a sound the game already plays. Give it the number of
variations shown (the game picks one at random, so a sound heard often never
repeats exactly).

| id | variations | what it is | length |
|---|---|---|---|
| `hit-blade` | 3 | a sword or axe biting into a body: meaty, a little steel | ≤ 0.4 s |
| `hit-blunt` | 3 | a mace or club thudding into a body | ≤ 0.4 s |
| `hit-pierce` | 3 | a dagger, spear or arrow punching in | ≤ 0.3 s |
| `hit-fist` | 2 | a fist, or a bear's paw, landing | ≤ 0.3 s |
| `crit` | 2 | a heavy extra layer for a critical blow (a crunch, a sharp sting), played over a hit | ≤ 0.4 s |
| `swing` | 3 | a weapon swung through the air | ≤ 0.35 s |
| `miss` | 3 | a swing that finds nothing: a longer whoosh | ≤ 0.5 s |
| `block` | 3 | a blow caught on a wood-and-iron shield | ≤ 0.5 s |
| `glance` | 2 | a blade scraping off armour | ≤ 0.5 s |
| `hurt` | 3 | the hero taking a blow: body impact, cloth and leather, a sharp breath. **No words and no clearly male or female voice**: the hero can be anyone | ≤ 0.6 s |
| `bow-shoot` | 2 | a bowstring released | ≤ 0.4 s |
| `arrow-hit` | 2 | an arrow thunking into wood or stone | ≤ 0.4 s |
| `door-open` | 2 | a heavy wooden door on iron hinges, swinging open | 0.8–1.2 s |
| `door-close` | 1 | the same door shutting | ≤ 1 s |
| `door-locked` | 2 | a locked door rattled against its bolt | ≤ 0.7 s |
| `door-unlock` | 1 | an iron key turned in a heavy lock: a clunk | ≤ 0.8 s |
| `door-batter` | 3 | a shoulder or heavy blow against a wooden door (the hero forcing it, or a monster battering it from the other side) | ≤ 0.6 s |
| `door-splinter` | 1 | a door bursting apart | ≤ 1.5 s |
| `secret` | 1 | a hidden stone door grinding open | 1–2 s |
| `stairs` | 1 | going down stone stairs: a few footsteps, the air changing | 1–2 s |
| `trap` | 2 | a pressure plate clicking, and a mechanism springing | ≤ 0.8 s |
| `collapse` | 1 | a passage roof coming down behind you: rock falling, dust settling | 2–3 s |
| `fountain` | 1 | water scooped and drunk from a stone fountain | ≤ 1.5 s |
| `step-stone` | 6 | one booted footstep on dungeon stone | ≤ 0.3 s |
| `step-water` | 4 | one step wading through shallow water | ≤ 0.5 s |
| `bump` | 2 | walking into a wall: a dull shoulder against stone | ≤ 0.3 s |
| `pickup` | 2 | picking something up: leather and cloth, a small clink | ≤ 0.4 s |
| `gold` | 3 | a handful of coins scooped up | ≤ 0.6 s |
| `drink` | 2 | a potion: a cork pulled, a gulp | ≤ 1 s |
| `eat` | 2 | a bite of hard bread or dried meat | ≤ 0.8 s |
| `read` | 2 | a parchment scroll unrolled | ≤ 0.8 s |
| `rest` | 1 | settling down to rest: cloth, a long breath out | ≤ 1.5 s |
| `ui-tap` | 2 | a button pressed: a soft, very short tick of wood or leather, quiet | ≤ 0.1 s |
| `ui-page` | 2 | a screen or panel opening: a soft page turn | ≤ 0.4 s |
| `ui-error` | 1 | something that cannot be done: a muted, dull knock | ≤ 0.3 s |

### Tier 2: wanted, after Tier 1 is done

**Creature voices**, 2 variations each, as `voice-<family>-<n>`. The game plays
them lower for bigger creatures, so record them at a natural middle size:

| family | for | family | for |
|---|---|---|---|
| `growl` | rats, wolves | `roar` | orcs, ogres, trolls, minotaurs |
| `shriek` | bats | `chant` | cultists (wordless, murmured) |
| `squelch` | slimes | `rasp` | the basilisk |
| `hiss` | spiders | `chitter` | the rustmaw (insect-like) |
| `grunt` | goblins | `bark` | dogs |
| `rattle` | skeletons | `howl` | wolves |
| `moan` | zombies, ghouls | `lament` | a fallen hero's shade (wordless, sorrowful) |
| `wail` | wraiths | | |

**Deaths**, by what the creature is made of, 1–2 variations each, as
`death-<kind>-<n>`: `blood` (a body falling), `rot` (a corpse collapsing wetly),
`bone` (a skeleton clattering apart), `goo` (a slime bursting), `ichor` (an
insect crushed), `ecto` (a ghost dissipating), `spore` (a fungus bursting in a
puff), `rust` (a metal-shelled beast crumbling).

**Distant sounds** the floors play now and then, as `far-<name>-<n>`, quiet and
roomy: `drip` ×3, `chain` ×2 (a chain swaying somewhere), `rumble` ×2, `wind` ×2
(a gust through a passage), `creak` ×2, `bones` ×1 (bones shifting), `moan` ×1,
`clatter` ×1 (goblins' pots and a thrown stone, far off).

---

## 3. Stingers (`stingers/`)

Short musical cues, stereo, in the music's style (section 4). Each one ends
cleanly with no loop.

| id | when | length | feeling |
|---|---|---|---|
| `level-up` | the hero gains a level | 2–3 s | a warm lift, brief triumph |
| `death` | the hero dies | 3–5 s | a low, final fall |
| `victory` | the Heart of the Mountain is claimed and the run won | 6–10 s | hard-won, glowing, resolving |
| `champion` | a named champion appears | 2–3 s | a dread hit: low brass or drums |
| `boss-fall` | the lich or the Goblin Warlord falls | 3–5 s | a great weight breaking |
| `floor` | arriving on a new floor | 2–3 s | a quiet, deep, unresolved breath |

---

## 4. Music (`music/`)

### How the game uses it

The game already follows the fight in moods: **quiet** (nothing near), **wary**
(something awake and close), **fight** (blows exchanged) and **champion/boss**
(a named champion, a fallen hero's shade, or a boss). Each floor theme
therefore needs **four layered stems** that play *together*, in sync, with
layers faded in and out as the mood changes:

| stem | plays when | what it is |
|---|---|---|
| `explore` | always | sparse and ambient: texture, space, an occasional melodic fragment. It must bear 20 minutes without tiring. |
| `tension` | wary and above, over `explore` | a low pulse like a held breath, sustained low strings or drones, a touch of dissonance |
| `fight` | fight and above, over both | percussion (frame drums, hand drums, low toms) and a driving ostinato in low strings or plucked instruments |
| `boss` | champion or boss, over all three | low brass, a wordless low choir, heavier drums. In `warrens` this is the Goblin Warlord's war drums |

Each theme also needs a **`resolve`** stinger, 3–5 s, played as a fight ends:
coming home to the theme's home note.

**The stems of one theme must:**
- share the same tempo, key and length, and all start on bar 1;
- have **exactly the same number of samples**;
- loop seamlessly at sample level, with no fade at the ends and no click at the seam;
- sound right alone (`explore`), in any of the stacks (`explore + tension`,
  `+ fight`, `+ boss`), and fading between those stacks over about 2 seconds.

16 bars of 4/4 is a good length (32 for a slow theme). Write the bar count, the
tempo and the loop length into `manifest.json`.

### The themes

Tier 1 is required; tier 2 is wanted after it. The suggested keys follow the
scales the game's synthesised music already uses, so the new music keeps each
place's character.

| theme | floors | key and mode | tempo | character |
|---|---|---|---|---|
| **Tier 1** | | | | |
| `halls` | Grey Halls, Brown Catacombs, Mossy Depths, Blue Vaults: the upper dungeon | D Dorian | about 84 | cold stone, plain, lonely; the main theme |
| `crypts` | Crimson Crypts, The Ossuary: the Crypts road | E Phrygian (the flat second's dread) | about 76 | bone, incense, slow dread |
| `warrens` | The Warrens: the goblins' road | G minor pentatonic | about 100 | rough, rhythmic, crude percussion |
| `sanctum` | Obsidian Sanctum: the lich's hall; `boss` is the lich's fight | C, with D♭, E, F, G, A♭ and B (double harmonic) | about 72 | strange, ritual, cold majesty |
| **Tier 2** | | | | |
| `darkelf` | The Dark Elf Halls | C♯ Hungarian minor | about 80 | cold, elegant; far-off temple chimes |
| `greyhold` | The Grey Hold, the dwarves' hold | F natural minor | about 88 | heavy and low; hammer on an anvil now and then |
| `marsh` | The Sunless Marsh, the lizardfolk's | A natural minor | about 70 | slow and wet; low croaks, water |

### `title`

A 30–45 s cue that plays once, on the first tap at the title screen, over the
key art: it rises out of silence into a warm, simple statement of a 4–5 note
motif, then fades back to silence. Use that motif as the game's own, and let
it echo in the themes (in `explore` especially), so the music sounds like one
game.

### Style

Dark-fantasy, mostly acoustic and small: low strings, cello, solo viola or
fiddle, hammered dulcimer, bells (the game's music has always been built on
bells, so keep them), frame drums and hand drums, low wordless male choir,
horn, drones. **Avoid:** EDM, synth leads, a modern drum kit, electric guitar,
sung words, epic trailer clichés (constant braams and risers).

---

## 5. Technical specification

| | sound effects | stingers, ambience, music |
|---|---|---|
| channels | mono | stereo |
| sample rate | 48 kHz (44.1 kHz acceptable) | 48 kHz (44.1 kHz acceptable) |
| `.ogg` | Vorbis, quality 4 (about 96–128 kbps) | Vorbis, quality 4–5 |
| `.m4a` | AAC-LC, 96 kbps | AAC-LC, 128 kbps |
| peak level | −1 dBFS, normalised per file | true peak ≤ −1 dBTP |
| loudness | (the game sets each one's level) | the full four-stem mix around −18 LUFS integrated; stems keep their balance, not normalised one by one |

**Ambience** (Tier 2, `ambience/<theme>.*`): a 30–60 s seamless loop for each
music theme, very quiet and roomy, with nothing that draws attention.
`halls`: cold air, distant drips. `crypts`: deeper stone, faint whispers
without words. `warrens`: distant scurrying and clatter. `sanctum`: a low
magical hum. `darkelf`: cold air, distant chimes. `greyhold`: distant hammers,
a forge's breath. `marsh`: water, insects, frogs.

**Size budget**, per format: Tier 1 together under 15 MB; everything under
25 MB; no single sound effect over 100 KB.

**Masters:** don't commit the originals of anything that can be downloaded
again (record the address in `SOURCES.md` instead). For work that can't be
downloaded again (composed, performed or generated), commit a FLAC master in
`sound/masters/`, keeping the folder under 60 MB.

---

## 6. `manifest.json`

One entry per id, listing its files, so the game can be wired up without
guessing:

```json
{
  "sfx": {
    "hit-blade": { "files": ["sfx/hit-blade-1", "sfx/hit-blade-2", "sfx/hit-blade-3"], "tier": 1 },
    "door-open": { "files": ["sfx/door-open-1", "sfx/door-open-2"], "tier": 1 }
  },
  "stingers": {
    "level-up": { "file": "stingers/level-up", "seconds": 2.6 }
  },
  "ambience": {
    "halls": { "file": "ambience/halls", "seconds": 48.0 }
  },
  "music": {
    "halls": {
      "bpm": 84, "key": "D dorian", "bars": 16, "samples": 2194286, "sampleRate": 48000,
      "stems": { "explore": "music/halls/explore", "tension": "music/halls/tension", "fight": "music/halls/fight", "boss": "music/halls/boss" },
      "resolve": "music/halls/resolve"
    }
  },
  "title": { "file": "music/title", "seconds": 38.0 }
}
```

Paths leave out the extension: every one exists as both `.ogg` and `.m4a`.

---

## 7. Licences and `SOURCES.md`

The repository may be public, so every file must be under a licence that lets
it be **redistributed** inside a game's source:

- **Allowed:** CC0 (preferred), CC-BY 3.0 or 4.0 (keep the attribution), work
  you compose or perform yourself, and output of a generation tool whose terms
  allow commercial use and redistribution.
- **Not allowed:** CC-BY-NC, CC-BY-ND, CC-BY-SA, "free for personal use",
  licences that forbid redistributing the raw files (for example Pixabay's and
  most bundle licences such as Sonniss GDC), and anything taken from another
  game, film or show.
- Good places to look: Kenney (CC0), OpenGameArt and Freesound (filtered to CC0
  or CC-BY), the Free Music Archive (CC0 or CC-BY only).

In `SOURCES.md`, list **every file** with its source address (or "composed" /
"generated"), the author, the licence and a link to it, and what was done to
it (trimmed, layered, pitched, normalised). For generated audio, also give the
tool, the model if it is shown, the date, the prompt and a link to the tool's
terms. Gather the attribution lines that CC-BY needs into one section at the
end, ready to go in the game's credits.

---

## 8. Checklist before handing it over

- [ ] Every Tier 1 sound effect, every stinger, and the four Tier 1 music themes, with all their stems and `resolve`.
- [ ] Every file in both `.ogg` and `.m4a`, named as above.
- [ ] Sound effects mono, trimmed to start at once, peaks at −1 dBFS.
- [ ] Each theme's stems the same length to the sample; each loop seamless when played on repeat; all stacks checked together.
- [ ] No words or clearly gendered voice in `hurt`; no sung words anywhere.
- [ ] `manifest.json` complete and matching the files on disk.
- [ ] `SOURCES.md` covers every file; every licence is on the allowed list.
- [ ] The size budgets are kept.
- [ ] Nothing outside `sound/` changed.

## What happens next (not for the sound agent)

Once the files are here, `js/sound.js` loads each sample with the synthesised
sound kept as a fallback (and for magic). `js/music.js` plays the stems in step
and fades layers with the mood it already tracks, keeping the game's existing
crossfades and ducking (under a level gained, under the lich's words). The
files go into the offline cache, loaded floor by floor so a phone fetches only
what it needs, and the browser tests check that every id plays.
