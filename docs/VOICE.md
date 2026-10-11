# The narrator's voice

Deepdelve has one narrator. The prologue, the backgrounds, the crews' pages, the
encounters, Wick, the champions, the endings, the Bestiary and the first-moment tips
are all one voice, and `docs/NARRATIVE.md` puts every line of it in one place so it can
be read through as one thing. Read a new line against this page before it goes in, and
write `NARRATIVE.md` again (`node tools/narrative.mjs`); `test/run.js` fails while it is
stale, and `test/rules-voice.js` holds the rules a machine can check.

## Who is speaking

- **The narrator talks to the hero, in the second person and the present tense.** "You
  heave the stones off him." Never "the player", never "your character".
- **What happened before the hero is told in the past**: the prologue, the crews' pages,
  the backgrounds' stories, Wick's tales.
- **The story after a run is told of the hero, in the third person and the past**, with
  their name and *they*: "{name} went down to spend what was left of themselves well."
  The narrator never guesses a hero's sex.
- **The people of the deep speak for themselves**, in double quotes, each in their own
  way: Wick dry and slow, the goblin pedlar in clipped shouts, the lich cold and short.
  The narrator does not explain what they mean.

## How it sounds

- **Short and concrete.** Say what is there: the black water, the chalk map, the crown of
  bent spoons. One picture a sentence; two sentences where one would do is one too many.
- **Plain words.** No game words in the story (*HP*, *buff*, *proc*, *DPS*, *aggro*,
  *spawn*, *loot drop*). A tip may name a button or a rule, in bold, because a tip is
  teaching; the rest of the story never does.
- **Dry, not grim for its own sake.** The dark is told flatly and let stand: "What is down
  there now wears their faces." The narrator keeps exclamation marks for a champion's
  fall; the people of the deep may shout in their own words, and a tip may shout a
  warning.
- **British spelling**: colour, armour, grey, centre, honour, defence, towards,
  *-ise* and *-our* throughout.
- **Straight quotes and apostrophes**: `"` and `'`, never the curly ones.

## The words that do not change

| Say | Not |
| --- | --- |
| the Heart of the Mountain, the Heart | the heart (for it), the Mountain's Heart |
| the Deepdelve | the Deep Delve, the dungeon |
| Karrathal, the valley | |
| the old smiths | the Old Smiths, the ancients |
| the delving guilds, a crew | the Guild (except a page's own title) |
| the Lampfolk, one of the Lampfolk | lampfolk, lamp-folk |
| sun-walker (what the Lampfolk call the hero's kind) | sunwalker, surface-dweller |
| the deep (where the Lampfolk live and the dark keeps) | the Underdark |
| dwarves, the Grey Hold; dark elves; lizardfolk | Dwarves, drow (in the story) |
| the Dread Lich, the Goblin Warlord, the Heartforged | |

*Drow* stays only in the names of things the dark elves make (a drow crossbow), where it
is the thing's name.

## What is true

The story agrees with itself. These hold everywhere:

- The Heart of the Mountain is the first fire of the old smiths. It warms whatever is near
  it and keeps whatever stays. It burned beneath Karrathal for nine hundred years and went
  out three winters ago.
- The delving guilds sent four crews down. None came back.
- The Lampfolk were in the deep before the first stair was cut, and trade with whatever
  pays. Nothing in the deep harms the ones it buys from.
- The stair divides about a third of the way down: the Crypts, among the old dead, or the
  Warrens, among the goblins. Below either, the Heart waits with its keeper.
- There are three ways for a delve to end well: carry the Heart up, put it out with the
  smiths' own quench, or stay below and keep it.
