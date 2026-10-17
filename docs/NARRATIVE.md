# Deepdelve: everything the narrator says

Made by `node tools/narrative.mjs` from the tables in `js/`; do not edit it here. Fix a line
in its table, write this again, and read it against `docs/VOICE.md`. Each heading names the
table its lines come from.

## Title facts (FUN_FACTS)

The title theme is called "Torchlight at the Threshold".

Each of the six hero classes has a backstory of its own.

A dungeon seed lets you return to the same layout with the same dungeon settings.

The bestiary has a painted portrait for every creature.

A warning mark over a monster tells you that a blow is coming.

The map remembers ground you have seen. Stone and darkness keep the rest hidden.

## The old caches (PUZZLE_WORDS)

### runes

- *title*: The four runes
- *text*: Four marks are cut into the lid. Press them in the order of the inscription.
- *clue*: The carving reads, from first to last:

### torches

- *title*: The watchfires
- *text*: Four small braziers guard the catch. Light those named in the inscription and leave the others dark.
- *clue*: Only these watchfires must burn:

### seals

- *title*: The keeper's seal
- *text*: One of four seals releases the catch. The inscriptions tell the truth.
- *clue*: The keeper wears neither {a} nor {b}. The {c} seal belongs to a false keeper.
- *found*: An old cache rests here. Use examines its catch; you may leave it and return.
- *solved*: The catch releases. The cache is open.
- *wrong*: The catch holds. Read the inscription and try again; nothing is lost.
- *reset*: The marks are cleared. Try again.
- *hint*: There is no time limit or penalty. The dungeon waits while you read. Leave for later to return to the same cache.

## The prologue (PROLOGUE)

For nine hundred years the Heart of the Mountain burned in the dark beneath Karrathal, and the valley above it never knew a killing frost.

Three winters ago it went out. The wells came up black. The orchards died standing. The old road filled with people walking the other way.

The delving guilds sent crews down the Deepdelve to find out why. None of the crews came back, and after the fourth the guilds stopped sending them.

What is down there now wears their faces.

## The six heroes (CLASSES)

### Fighter (fighter)

You found the blade in a heap of broken armour. Its edge was gone, but the tang held. You spent a winter setting it right and wearing cuts into a wooden post. When the guilds stopped sending crews below, you wrapped the grip in fresh leather and took it down from the wall.

### Cleric (cleric)

You kept a candle burning through the first winter without the Heart. People came to warm their hands above it, though it gave almost no heat. One night you felt an answering warmth through the flagstones. You lifted the candle. The warmth stayed below.

### Mage (mage)

You copied the old smiths' workings until the ink stained your hands. Every account of the first fire ended with the same page cut out. Then a word you had copied began to glow in the dark. You packed the unfinished book and followed the light beneath the mountain.

### Thief (thief)

You bought a chalk map for a copper, mostly for the dry paper wrapped round it. The map showed a door beneath Karrathal that no guild survey marked. Beside it someone had written your name. You tried washing the words away. They were still there when the paper dried.

### Ranger (ranger)

You followed a wounded animal by the drops it left on stone. At a sealed stair the blood stopped, but the tracks went on beneath the door. You waited there until morning with an arrow on the string. Nothing came out. You returned with a lamp and enough cord to find the way back.

### Druid (druid)

You carried an acorn through three winters in which nothing took root. One night it split in your palm. Its root bent towards the mountain, even when you turned your hand. You wrapped it in damp cloth and followed where it pointed. Beneath the first stair, it put out a leaf.

## Who the hero was (BACKGROUNDS)

### The Oathbroken (oathbroken)

- *blurb*: You ran. The line held without you, and it cost them.
- *story*: You were sworn to the valley guard, and at Cairn Ford you ran. Forty held the ford without you and none of them walked home. No one in the valley has said the word coward to your face. They do not have to.
- *motive*: You came down here to spend what is left of yourself well.
- *after*: They went down to spend what was left of themselves well.

### The Tombwise (tombwise)

- *blurb*: You have opened graves for a living. You know their tricks.
- *story*: You have been opening other people's graves since you were eleven, and you are still alive, which puts you ahead of most in the trade. You know what a false flagstone sounds like. You know which walls are lying.
- *motive*: You came down here because it is the largest grave anyone has ever offered you.
- *after*: They went down because it was the largest grave anyone had ever offered them.

### The Ashborn (ashborn)

- *blurb*: Your village burned the night the mountain stirred.
- *story*: When the mountain first shifted, the fires came up through the floor of your village and took it in a night. You carried two children out and went back for a third. You are told you should not have survived the third trip.
- *motive*: You came down here to make certain it never does that again.
- *after*: They went down to make certain the mountain never did that again.

### The Cloistered (cloistered)

- *blurb*: Raised among books. You know every draught by sight.
- *story*: You were left at the door of the Hollow Library as an infant and raised among its shelves. You can name any draught by the cast of its light and any scroll by the hand that wrote it. You have also never held a weapon in anger.
- *motive*: You came down here because the last four chapters of the story are missing.
- *after*: They went down because the last four chapters of the story were missing.

### The Deep-born (deepborn)

- *blurb*: Born under stone. The dark does not notice you.
- *story*: You were born in the lower galleries and did not see open sky until you were nineteen. You still find it too large. Down here you move the way the people down here move, and the dark takes longer to work out that you are not part of it.
- *motive*: You came down here because it is the only place that has ever felt like a ceiling and not a lid.
- *after*: They went down because it was the only place that had ever felt like a ceiling and not a lid.

### The Debtor (debtor)

- *blurb*: Sold down the delve to clear a debt. Paid in advance.
- *story*: Your father's debt outlived him and came looking for you. The house that bought it offered a choice: the delve, or the work gangs on the coast. They paid you in advance, which told you what they expect to get back.
- *motive*: You came down here owing a debt you intend to close in person.
- *after*: They went down owing a debt they meant to close in person.

### The Returned (returned)

- *blurb*: You have been down before, and you came back up.
- *story*: You have been to the bottom of the Deepdelve and walked out again, which nobody else in the valley can say. You do not talk about what you saw on the last floor or who you left on the way. You keep one good draught back for the bad hour, and the Lampfolk, who remember you, let you sleep by their lamp for nothing.
- *motive*: You came down here again because the mountain is not finished with you.
- *after*: They went down again because the mountain was not finished with them.

### The Heartsworn (heartsworn)

- *blurb*: You held the Heart once. It has not let go of you.
- *story*: You carried the Heart of the Mountain up out of the dark once, on the hardest road there is, and felt it beat against your ribs the whole way. Since then a second pulse has kept time under your own, slow and warm, and your wounds close faster than they should. Lately it has begun to pull downward.
- *motive*: You came down here because the Heart is calling you back, and you mean to learn why.
- *after*: They went down because the Heart was calling them back, and they meant to learn why.

### The Lorekeeper (lorekeeper)

- *blurb*: You have read every account of the delve that survives.
- *story*: You have spent your life with the delvers' accounts, the boastful and the broken alike, and you know what they found down there and how they used it. You have never been down yourself. You know exactly how much that matters, and how little.
- *motive*: You came down here to see whether any of it was true.
- *after*: They went down to see whether any of the old accounts were true.

### The Legend-Seeker (seeker)

- *blurb*: You came for the old arms, not the Heart.
- *story*: Every delver who never came back took something with them: a blade with a name, a shield that held a gate. You have spent years learning which, and where they went down. The Heart is someone else's errand.
- *motive*: You came down here for what the last ones carried.
- *after*: They went down for what the last ones carried, not the Heart.

## The crews' pages (JOURNAL)

### Act I: those who came before

**The last delver's page** (page 22)

A guild warrant, a hundred years old, with my name on it. I have stopped reading it. I keep it for the back, which is where I draw the floors. You fed me, so here is yours. The warm thing is lower than they think. It is always lower than they think.

**A guild roster, water-stained** (page 0)

Fourth crew. Fourteen names, eleven struck through in a different hand. At the bottom someone has written: "the struck ones still answer to their names. do not use their names."

**A guild notice, nailed up** (page 8)

By order of the Delving Guilds of Karrathal: a fourth crew will go down the Deepdelve to learn why the Heart has gone dark. Pay is triple. The guilds are not answerable for crews who do not come back. Underneath, in charcoal: none have.

**A surveyor's note** (page 1)

The gallery plans are wrong below the second floor. Not old-wrong. Someone has been cutting new passages and they are cutting them from the inside out.

**The last crew's log** (page 6)

Day nineteen. We are not lost. We have mapped it twice and both maps are right. The delve is longer on the way out than it was on the way in. Whatever was done to the Heart, it was done to the distance as well.

**A letter, never sent** (page 2)

Mira — the Heart is not out. I have stood in the vault and felt it beating through the rock. It has been taken down, not extinguished. Something carried it deeper and it is still warm. Tell the guild. Tell them it is still warm.

### Act II: down the Crypts

**A page torn from a ledger** (page 3)

He was the delve's own archivist. Nine hundred years of it in his head and no one thought that strange. He asked for the Heart to study. The guild said no. The guild has been saying no for four hundred years.

**From the archivist's daybook** (page 9)

The guild's founding, and every year of it since, in my own hand. I do not tire and I do not age while I keep my desk beside the vault. The Heart keeps me. I should like to know what it would make of the rest of them.

**Minutes of the guild council** (page 10)

Item: the archivist's request for the Heart, for study. Refused, as every year. Item: he has asked in the same words, in the same hand, every year of the guild's records. No one at the table could remember him young.

**A prayer, scratched into the wall** (page 4)

Not to any god of the valley. The letters run the wrong way and the last line reads: he says the mountain will keep us warm forever. he says we only have to stop.

**A novice's account of the last sermon** (page 11)

He came to the Hollow Chapel the winter the Heart went down. He said it was cold above and would be colder, and that below, beside the Heart, no one need ever grow old, or hungry, or afraid. Only still. Half the chapel went with him. Mother Orla went to bring them back.

**The archivist's last entry** (page 12)

I have carried it down to where the dead lie quiet. They do not need it to be warm. They need it to keep them, and it does. The crews will come. Let them come. I will keep them too. I will keep everyone.

### Act II: down the Warrens

**Goblin marks on a tunnel wall** (page 13)

Daubed in soot, a crew's reading written under them: BIG FIRE COME DOWN. DEAD MAN CARRY IT. WE TAKE. KING SIT ON IT. KING NOT COLD. KING NOT STOP.

**A child's drawing** (page 5)

A crooked figure with a crown, holding something round and red, standing over small figures lying down. On the back, in an adult hand: "she has never been below the third floor. she has never seen him. ask how she knows."

**Notes on the goblins** (page 14)

They will not say its name. They call it the Stopping Fire. A goblin who sleeps too near it does not wake, and does not die either: they stack them at the back of the hall. So the king beats his drum all night, and every goblin who hears it has to get up and move.

**A Lampfolk ledger, copied out** (page 15)

Sold to the dead man in the cold halls: lamp oil, forty measures, for his dead to see by. Sold to the drum-king: nothing. He does not buy. He takes. Note: do not sleep in the drum-king's hall, however warm.

**Scratched inside a goblin shield** (page 16)

drum good. drum mean get up. get up mean not stop. not stop mean not like the ones at the back.

**A rubbing from a stone in the orc halls** (page 17)

Under the orcs' marks, older letters, square and deep: the old smiths' hand. THE FIRE IS OURS. WE LIT IT TO BE WARM. WE STAYED TO BE WARM. WE STAYED.

### Act III: the Heart

**The first page of the guilds' charter** (page 18)

Here the guilds found the Heart of the Mountain: the first fire of the old smiths, lit at the root of the mountain before there were people in the valley. Its warmth rises through the stone and keeps the valley from the frost. It keeps more than that. Whatever stays beside it does not grow old, or change, or die: it is kept. The smiths stayed. Let no one stay. Let no one hold it long.

**A single line, cut deep** (page 7)

IT WILL LET YOU TAKE IT. THAT IS THE PART NOBODY WRITES DOWN.

### The peoples' own pages

**A prayer-tablet from the dark elves' temple** (page 19, the elves)

Goddess, keep the warm fire far from us. When it rested in our halls the grandmothers of our grandmothers did not die. They did not move. Your webs grew over them where they sat, and they are sitting still.

**Graven over the Grey Hold's gate** (page 20, the dwarves)

WE ARE WHAT IS LEFT OF THE SMITHS WHO WOULD NOT STAY. THE FIRE GOES HOME TO THE FORGE THAT MADE IT, WHOEVER CARRIES IT DOWN. LET IT GO HOME. DO NOT FOLLOW.

**Marks pressed into the marsh mud** (page 21, the marsh)

A crew's reading, under the claw-marks: once warm water came up from below. Eggs did not hatch. Eggs did not rot. Mothers waited, many lives of mothers. Then the warm went down again, and the eggs hatched, and we were glad of the cold.

## The roads (ROUTES)

### the Crypts (crypts)

- *choice*: Down into the Crypts
- *desc*: Old burial halls, cold and quiet: the dead, and what feeds on them. The traders here keep more for curses and poison, and its last floor holds a relic found nowhere else.
- *tells*: Cold is its weapon: the wraith's grave-chill, which silver and a steady heart answer.
- *after*: They went down by the Crypts, among the old dead, and for a long while after they could not sleep without a lamp lit.

### the Warrens (warrens)

- *choice*: Down into the Warrens
- *desc*: Goblin tunnels and orc halls, loud and crowded, and bigger things further down. The traders here deal in arms, and its last floor holds a relic found nowhere else.
- *tells*: Weight is its weapon: things that charge and crowd, which fire oil and a wall behind answer.
- *after*: They went down through the Warrens, and were still picking goblin arrowheads out of their pack a month later.

## The places

### Walls (THEMES)

- *Grey Halls*: Cold stone halls stretch into darkness.
- *Brown Catacombs*: The air is thick with dust and old bones.
- *Mossy Depths*: Water drips and moss clings to every stone.
- *Blue Vaults*: A chill wind moans through these vaults.
- *Crimson Crypts*: The walls here are stained a rusty red.
- *Obsidian Sanctum*: Black glass walls hum with a terrible power.
- *The Ossuary*: The dead are stacked to the roof here, skull upon skull.
- *The Warrens*: Rough tunnels, dug by many small hands and propped with timber.
- *The Dark Elf Halls*: Black stone laid true, and violet lamps. You have come into the country of the dark elves.
- *The Grey Hold*: Square-cut granite, and far off the ring of hammers. You have come into the hold of the grey dwarves.
- *The Sunless Marsh*: Black water among rotting reeds, and walls of wattle daubed with mud. You have come into the marsh of the lizardfolk.
- *The Drowned Halls*: Black water stands in halls that were dry once, and something moves beneath it.
- *The Old Forges*: Cold anvils stand in rows, and the cracks in the floor still glow. These were the old smiths' forges, before there was a valley.

### Floor twists (TWISTS)

- *Dark, on arriving*: The torches on this floor have burnt out. It is hard to see, and hard to be seen. Somewhere in the dark, something is clicking.
- *Dark, while there*: Most torches here are out: less to see by, but sleeping things notice you a square later. Eyeless stalkers hunt here by sound: stand still and they lose you
- *Flooded, on arriving*: Black water stands ankle-deep on this floor. Everything here wades, you too. Here and there a ripple spreads where nothing moves.
- *Flooded, while there*: Black water: you and everything here move a quarter slower. The drowned lie under it, seen only as a ripple, and rise at whoever comes near
- *Restless dead, on arriving*: The dead do not lie still on this floor. You can hear them walking.
- *Restless dead, while there*: Many of this floor's creatures have risen from the dead
- *Goblin market, on arriving*: Goblin voices haggle somewhere on this floor: a market, and a trader who undersells.
- *Goblin market, while there*: A trader here, selling cheaper than most
- *Tremors, on arriving*: The floor shivers under your feet, and grit patters down from the roof. This deep, the rock overhead is restless.
- *Tremors, while there*: Now and then the ground shudders and rock falls from the roof: the squares it will land on are marked first, yours among them. Step off. It falls on your foes too, and they never look up
- *Smouldering, on arriving*: The air down here is hot and tastes of iron. Cracks in the floor glow red, and now and then one breathes out a sheet of flame. Something small and burning skitters in the dark.
- *Smouldering, while there*: Glowing cracks heat up and flare fire over their square and the four beside it: when one brightens, step clear. Cold seals a crack a while. Emberlings live here: step back when one blazes up, or strike it with cold
- *Overgrown, on arriving*: Roots have broken up through the stone here, and moss lies thick over everything. Pale caps grow among the stones, and something larger and fungal shuffles in the dark.
- *Overgrown, while there*: Moss hides the traps: harder to spot (not for a druid, who reads the ground). Pale caps to eat grow here, and puffcaps that burst in spores at a blow from beside them. A druid is at home: their spells cost a point less

### Set pieces (PIECE_VARIANTS)

- *cells, gaol*: Rows of cells line a narrow aisle. Some of the doors still hold.
- *cells, kennels*: Low cells with gnawed bars and chains at the walls: kennels. Whatever was kept here was not kept for its company.
- *cells, stores*: The cells were made storerooms long ago: crates and casks stand where the prisoners sat.
- *shrine, altar*: A shrine: a ring of pillars about a worn altar, and water in a basin at its back.
- *shrine, defiled*: A shrine, defiled: its candles stamped out and bones heaped about the altar. The water in the basin still runs clean.
- *shrine, kept*: A shrine someone still keeps: fresh candles about the altar, and sealed urns left as offerings.
- *cistern, pillared*: An old cistern. Pillars stand in shallow water, which carries lightning and freezes under cold.
- *cistern, brimming*: A cistern brimming over: water across the whole floor, and old casks fetched up against the pillars. It carries lightning and freezes under cold.
- *cistern, silted*: An old cistern, mostly silted up: pale toadstools grow in the mud, and only a few pools are left.
- *forge, cold*: The old smiths' forge: a row of hearths in the back wall, cold a long while, anvils worn hollow, and a trough of black water for the quench. They left something by the doors.
- *forge, banked*: The old smiths' forge. One hearth is still banked, the fire low in it after all this time, as if someone meant to come back. They left something by the doors.
- *rubble, fallen*: Half this hall has come down. Something was left at the back of the fallen stone.
- *rubble, buried*: The roof came down on someone here: bones show among the fallen stone. Something was left at the back of it.
- *rubble, shored*: Someone tried to shore this fallen hall up with crates and casks, and gave up. Something was left at the back of the stone.

## Voices in the deep

### Wick, of the Lampfolk (WICK)

- *first*: One of the Lampfolk, older than the rest, with a brass lamp and a scarf the colour of rust, looks up from its pack. "Wick, they call me, for I have burned a long time. Coin for goods, sun-walker. And I remember faces."
- *again*: Wick lifts its brass lamp and looks you over with its great pale eyes. "Another of you."
- *won*: "The last of you was {who}. Went down, and came up again with the Heart, they say. A sun-walker who lives is good for trade."
- *quenched*: "The last of you was {who}. Put it out, they say, with the smiths' own water. The deep is colder for it, and the ones it kept lie down at last. I lit a lamp for all of them."
- *kept*: "The last of you was {who}. Went down, and stayed. They keep it now, down there, and the valley is warm. I do not go so far down any more."
- *fell*: "The last of you was {who}. Got as far as floor {depth}{killer}. I kept a lamp lit for them a while."
- *killer*: , and {killer} the rest of the way
- *gone*: "The last of you was {who}. I never heard what became of them."
- *regular*: "You are getting to be a regular, you sun-walkers. A tenth off, for the face."
- *tale 1*: We were here before the first stair was cut. Your kind came down with picks and called the deep place the Heart of the Mountain. We never called it anything. You do not name the floor you stand on.
- *tale 2*: Why the lamps? Our eyes were made for a little light, not for none. One of us whose lamp goes out sits down where it is and waits. Sometimes for a long time.
- *tale 3*: Nothing down here harms the ones it buys from. No one made it a rule. The goblins learned it, and the dead learned it, and the thing at the bottom learned it too.
- *tale 4*: Old Fennick keeps mules. Do not ask where he gets them, nor where they go.
- *tale 5*: The dark elves pay in a coin no one else will take. We take it. Coin is coin, and they remember who would not.
- *tale 6*: There was a sun-walker before you, long before: came down for the Heart, like all of you. Did not come up again. Did not die, either. That is all I will say on it.
- *tale 7*: We trade with whatever pays. That is not the same as liking it. Some of what pays, I would see buried.
- *tale 8*: Every sun-walker who comes up again owes the dark one lamp. Most forget to pay it. Not you, I think.
- *tale 9*: The grey dwarves dug deeper than you will ever go. They stopped when the stone grew warm. Dwarves do not stop for much.
- *tale 10*: Goblins steal. Everyone says it as if it were news. What they steal they bring to me, and I sell it back to you. Think about that on the stairs.
- *tale 11*: The water in the drowned halls was not always there. It came up one winter and did not go down. Some of what lives in it was there before the water. Some came with it.
- *tale 12*: A barrel that creaks with nothing near it is no barrel. My grandmother told me that. She lost a hand learning it.
- *tale 13*: The lizard people do not trade. They give, and they remember what you gave back. It is a slower way of doing business. It lasts longer.
- *tale 14*: The old smiths meant the Heart a home, not a cage. Things made for one purpose find another down here.
- *tale 15*: We do not bury our dead. We leave their lamps lit where they sat down, as long as the oil lasts. If you see a lamp burning in an empty room, walk round it.
- *tale 16*: Once in a long while one of you comes down who is not looking for the Heart. Those are the ones I worry about.
- *tale 17*: The goblins have a word for you. It means the ones who go down and come up. They have no word for the ones who only go down. There are too many.
- *tale 18*: I have sold the same sword four times. It keeps coming back to me off the floors, a little more notched each time. So do you, in a way.
- *tale 19*: The dark has rules, sun-walker. Fire is a guest: it stays as long as it is fed. Water is a landlord: it never leaves. Cold is a debt, and it is always paid.
- *tale 20*: That is nineteen. My mother knew twenty. The last she never told me: she said I would hear it at the bottom. I have never been to the bottom. Perhaps one day you will tell it to me.
- *done*: I have told you all I know, sun-walker. The rest of it is down there.

### The keepers of the Heart (MONSTERS, speech)

- *Dread Lich*: A cold voice fills the hall: "Another thief, come for my Heart. Stay, then. Stay for ever."
- *Heartforged*: Something vast and dark at the far end of the hall lifts its head, and a furnace opens in its chest. Iron grinds on iron as it stands, and the Heart burns in the fire inside it. It says nothing at all.
- *Goblin Warlord*: A great goblin in a crown of hammered gold heaves himself up from a heap of plunder, the Heart glowing among it. "Grisk was my sister's boy. You will make me a fine footstool."

### The champions (MONSTERS, named)

**Grisk the Goblin King**

- *on arriving*: Somewhere on this floor, Grisk the Goblin King holds court.
- *waking*: A goblin in a crown of bent spoons climbs off his heap of plunder. "Who comes before Grisk?"
- *falling*: Grisk the Goblin King is dead, and his crown rolls away across the floor!

**Vessra the Web-Mother**

- *on arriving*: Somewhere on this floor, Vessra the Web-Mother waits at the heart of her web.
- *waking*: Something vast unfolds its legs in the dark. The Web-Mother has felt you on her threads.
- *falling*: Vessra the Web-Mother is dead! She curls up, and her threads go slack all through the floor.

**Ushgar the Orc Warchief**

- *on arriving*: War drums, somewhere on this floor: Ushgar the Orc Warchief is mustering.
- *waking*: Ushgar the Orc Warchief bellows a challenge and paws the ground.
- *falling*: Ushgar the Orc Warchief is dead, and the war drums fall silent!

**Morrow the Ghoul Lord**

- *on arriving*: The stink of an old feast drifts up the stair. Morrow the Ghoul Lord is at table somewhere on this floor.
- *waking*: Morrow the Ghoul Lord lifts its head from its meal and smiles, with far too many teeth.
- *falling*: Morrow the Ghoul Lord is destroyed, and its long feast is over!

**Orla the Hollow Abbess**

- *on arriving*: A cold hymn carries through the stone. Orla the Hollow Abbess keeps her vigil somewhere on this floor.
- *waking*: The hymn stops. Orla the Hollow Abbess turns her empty hood towards you.
- *falling*: Orla the Hollow Abbess is destroyed! She comes apart like mist in the sun, and the hymn ends.

**Gorrum the Troll-Father**

- *on arriving*: The floor shakes with slow footsteps. Gorrum the Troll-Father walks this floor.
- *waking*: Gorrum the Troll-Father smells you, and lumbers towards the scent.
- *falling*: Gorrum the Troll-Father is dead! He topples like a felled oak, and this time nothing grows back.

**Skarrow the Elder Wyrm**

- *on arriving*: The air on the stair is hot and smells of cinders. Skarrow the Elder Wyrm lairs somewhere on this floor.
- *waking*: Coals stir in the dark, and open, and are eyes. Skarrow the Elder Wyrm uncoils from her hoard.
- *falling*: Skarrow the Elder Wyrm is dead! The fire in her throat gutters out, and her hoard goes dark.

**Vaelith the High Priestess**

- *on arriving*: Violet lamps, and a far-off chanting. Vaelith, High Priestess of the dark elves, keeps her temple somewhere on this floor.
- *waking*: The chanting stops. Vaelith the High Priestess turns from her altar, and her warriors draw their blades.
- *falling*: Vaelith the High Priestess is dead! The violet lamps gutter, and somewhere a great many dark elves fall silent.

**Hissra the Marsh-Mother**

- *on arriving*: Black water, rotting reeds, and a low hissing that comes from everywhere. Hissra, the Marsh-Mother of the lizardfolk, keeps this floor.
- *waking*: The hissing stops. Hissra the Marsh-Mother rises out of the reeds, and her shamans begin to chant.
- *falling*: Hissra the Marsh-Mother is dead! The reeds go still, and the lizardfolk slip away into the water.

**Durgrim the Forge-Thane**

- *on arriving*: The ring of hammers, far off, and the smell of a forge. Durgrim, Forge-Thane of the grey dwarves, holds this floor.
- *waking*: The hammers stop. Durgrim the Forge-Thane sets down his tongs, takes up his hammer, and his arbalests wind their crossbows.
- *falling*: Durgrim the Forge-Thane is dead! His forge-fire sinks to embers, and the hold goes quiet.

## Encounters (ENCOUNTERS)

### Under the Rubble (buried)

A fall of stone has half buried a man in a guild tabard. One hand still moves. "Please," he says. "I know this floor. I can show you the way down."

- **Heave the stones off him**
  - *passed*: The stones grind aside. He sits up coughing, presses a chalk map of the floor into your hands, and limps off towards the stairs.
  - *failed*: The pile shifts the wrong way and comes down on both of you. He does not move again.
- **Keep him talking while you dig**
  - *passed*: He talks you through where each stone will slide. When he is free he tells you where the last crew hid their stores, and draws you the floor.
  - *failed*: He panics and thrashes and the pile settles on him for good. Getting clear of it takes a long time.
- **Work out how the pile will fall**
  - *passed*: You read the stones, pull the one that matters, and the rest slide away from him instead of onto him. He draws you the floor in chalk before he goes.
  - *failed*: You pull the wrong stone. It is not only him the pile lands on.
- **Leave him**
  - You step past. After a while he stops asking.

### A Shrine to the Old Stone (shrine)

A squat idol, older than the delve, sits in a niche worn smooth by hands. The offerings at its feet are fresh. Someone still comes down here to pray.

- **Leave an offering of gold**
  - The coins are gone when you look again. For a while you feel watched over.
- **Offer your blood**
  - *passed*: The stone drinks, and gives something back. You feel harder to kill.
  - *failed*: The stone drinks. Nothing comes back but a chill.
- **Pray with empty hands**
  - *passed*: Warmth from nowhere. Your wounds close and your head clears.
  - *failed*: When you open your eyes your purse is lighter. The idol has not moved.
- **Leave it be**
  - You leave the old stone to whoever still tends it.

### The Spider Altar (spider_altar)

A black altar under a canopy of webs, and on it a great spider carved from obsidian, its eyes two garnets the size of plums. Bowls of dark wine stand before it, still full. The elves pray here before they hunt.

- **Drink from the bowls**
  - *passed*: The wine is bitter and very old, and it does not want you. You keep it down. Your wounds close, and for a while blows seem to slide off you.
  - *failed*: The wine fights back. Whatever is in it was never meant for you.
- **Prise the garnets from its eyes**
  - *passed*: The stones come away with a soft click, heavy and warm. No one comes.
  - *failed*: The altar shrieks as the first stone moves, and the halls answer. Blades are coming.
- **Cast the spider down**
  - *passed*: It goes over and breaks across the stones. Somewhere in the halls a voice cries out, and goes quiet.
  - *failed*: It will not move, and the effort costs you. Something in the dark has seen you try.
- **Leave it be**
  - You leave the spider to its prayers.

### The Great Anvil (dwarf_forge)

A forge cut into the living rock, its coals still red, and before it an anvil as long as a coffin, black and worn bright on top. Ingots of dark iron lie stacked beside it, and a cask of the dwarves' ale stands open.

- **Temper your weapon on it**
  - *passed*: You heat it in their coals and work it on their anvil until it rings true. It comes out better than it went in.
  - *failed*: The hammer is heavier than any you have lifted, and it slips. The coals bite your hands, and the ringing carries.
- **Take the ingots**
  - *passed*: You slide the top bars into your pack without a sound. Dark iron is worth its weight in silver anywhere.
  - *failed*: The stack goes over with a crash like a bell. Boots are running, and hammers are coming down off the walls.
- **Drink from the cask**
  - *passed*: It is black and bitter and strong enough to strip paint, and it puts iron in your arm. Your wounds stop hurting, and your blows land true.
  - *failed*: It is very much stronger than you are. The room tilts, and stays tilted a while.
- **Leave it be**
  - You leave the anvil to the smiths who will come back to it.

### A Clutch of Eggs (egg_clutch)

A mound of warm black mud half out of the water, and pressed into its top a dozen leathery eggs the size of a man's head. Something has been turning them. It is not here now.

- **Take an egg to sell**
  - *passed*: It is heavier than it looks, and warm. Somebody up in the valley will pay well for it, and ask no questions.
  - *failed*: The mound shifts under your hand and the eggs roll. Something in the reeds has seen, and is hissing for the others.
- **Warm your hands at the mound**
  - *passed*: The heat in the mud soaks into you, and the ache of the dark goes out of your bones.
  - *failed*: The mud stinks, and something in it bites. Your hand swells.
- **Smash the eggs**
  - *passed*: It is ugly work, and quick. Somewhere in the marsh a great voice cries out, and keeps crying.
  - *failed*: The shells are tougher than they look, and the noise carries. The marsh goes quiet, and then not.
- **Leave them be**
  - You leave the eggs to whatever turns them.

### A Vigil Lamp (vigil)

Someone kept a lamp burning here, at the edge of the last halls, and left a bowl beneath it. Coins shine in the bowl. Whatever keeps the lamp lit still answers what is left there.

- **Leave gold for a ward against the cold**
  - The flame leans towards you, and the chill of the halls ahead eases off your skin.
- **Leave gold for a sure hand**
  - The flame steadies, and so does your grip.
- **Leave a fortune for both, and the flame's warmth**
  - The lamp flares white. You go on warded and sure, and lighter by a fortune.
- **Pray by the light with empty hands**
  - *passed*: The light settles on you like a hand. Your wounds close.
  - *failed*: The lamp gutters and says nothing.
- **Go on without it**
  - You leave the lamp to whoever still tends it.

### A Vigil Lamp, Out (vigil_dark)

Someone kept a lamp burning here once, at the edge of the last halls. It is cold now, and the bowl beneath it holds dust and a few coins no one came back for. Nothing here answers.

- **Go on**
  - You leave the dark lamp where it stands.

### Words Cut in the Wall (runes)

A slab of dark stone stands out from the wall, cut deep with the archivist's cramped hand. The letters seem to crawl when you are not looking at them straight.

- **Read them**
  - *passed*: A catalogue: every draught and scroll the guild ever stored, and what each one looked like. You will know them now.
  - *failed*: The letters bite. You come to on the floor with blood in your mouth.
- **Trace them with a fingertip**
  - *passed*: Under your finger they settle into a plan of this floor, and stay settled in your head.
  - *failed*: The stone hums. Somewhere far off, things that were sleeping stir.
- **Leave them**
  - Some words are better left unread.

### A Wounded Goblin (mercy)

A goblin sits against the wall clutching a wound, a knife held out in a shaking hand. It does not want to fight. "Mercy," it croaks, in something like your tongue.

- **Spare it, and ask what it knows**
  - *passed*: Between gasps it tells you where its tribe keeps its shinies and which way the stairs lie. Then it is gone into the dark.
  - *failed*: It spits at you and scrambles away. You are not sure it understood a word.
- **Lift its purse while it pleads**
  - *passed*: It never feels a thing. Its purse is heavier than a goblin's has any right to be.
  - *failed*: It is not as weak as it looks. The knife finds you before it runs.
- **Finish it**
  - It is quick. It is not something you will tell anyone about.
- **Leave it**
  - You leave it to its wound and whatever finds it next.

### The Fourth Crew's Strongbox (cache)

An iron-bound box bearing the fourth crew's mark, chained to a ring in the floor. The lock has rusted. The chain has not.

- **Force the lid**
  - *passed*: The hasp tears free. Whatever the fourth crew died protecting, it is yours now.
  - *failed*: The lid holds, and the clang rolls away down every corridor. Everything on this floor heard that.
- **Pick the lock**
  - *passed*: A patient minute, and a soft click.
  - *failed*: A needle in the keyhole. Your fingers go numb.
- **Leave it**
  - Whatever is in there, the fourth crew did not live to spend it either.

### Someone Calls Your Name (voice)

From the dark ahead a voice, warm and familiar, says your name. It knows it. You have not told anyone down here your name.

- **Answer it**
  - *passed*: You answer, and hold on to yourself while you do. The voice falters, and something that was only pretending to be a person flees from you.
  - *failed*: You answer. Something is taken, and you do not get it back.
- **Give it a false name**
  - *passed*: It repeats the name you gave it, pleased, and follows the wrong scent into the dark.
  - *failed*: It knows. Something cold comes out of the dark for you.
- **Name the thing that is calling**
  - *passed*: You know these from the crews' pages. You say what it is, plainly, and it comes apart like smoke.
  - *failed*: You name the wrong thing. It laughs, in your voice, and something cold brushes past you in the dark.
- **Say nothing**
  - It calls three more times, each time closer, and then gives up.

### A Garden of Pale Caps (fungus)

Pale mushrooms grow thick on something that was once a person. They smell of warm bread.

- **Eat your fill**
  - *passed*: They taste as good as they smell. You feel full and whole.
  - *failed*: They taste as good as they smell, and then they do not.
- **Pick the safe ones for later**
  - *passed*: You know which caps are which. You wrap two good handfuls for the road.
  - *failed*: You cannot tell the good ones from the bad, and leave them all.
- **Leave them**
  - Whatever it was, it has fed enough already.

### The Gambler's Bones (gambler)

A skeleton sits against the wall, grinning, a cup of dice in its lap and a note pinned through its ribs: BEAT ME AND TAKE THE POT. There is a pot, and a good deal of gold in it.

- **Roll against him**
  - *passed*: Your dice come up higher. The skeleton does not seem to mind.
  - *failed*: His dice come up higher. You could swear the grin widens.
- **Just take the pot**
  - *passed*: Quick hands. The gold is in your purse before the bones can object.
  - *failed*: The bones object. They get up.
- **Watch his dice for the trick**
  - *passed*: His dice are loaded. You swap in your own before the throw, and the pot is yours.
  - *failed*: You watch a long while and see nothing. Whatever the trick is, it is better than you.
- **Leave him to his game**
  - He will find another player. He has time.

### The Captive (prisoner)

A man hangs in chains from rings in the wall, stripped to his shirt, a goblin brand fresh on his arm. His eyes open when your light reaches him. "They will be back," he whispers. "Please."

- **Break the chains**
  - *passed*: The rings tear out of the stone. He is weak, but he knows this floor, and where they stack their plunder.
  - *failed*: The chains hold, and the rattle carries. Something is coming to see what the noise was.
- **Pick the shackles**
  - *passed*: Cheap goblin locks. He presses a healing draught into your hand, the one thing they did not find on him.
  - *failed*: A pin snaps in the lock. The tripwire his captors left does not.
- **Ask what he knows first**
  - *passed*: He talks fast: which corridors are trapped, where the stairs lie, who took his sword. You free him when he is done.
  - *failed*: He is too far gone to make sense. You free him anyway, and he stumbles off into the dark.
- **Leave him**
  - You leave him to his chains. His voice follows you a long way.

### An Old Well (well)

A ring of worked stone, older than the delve, with a rope going down into a darkness that echoes. Coins glint on the lip, left by others who passed this way.

- **Toss in a coin and make a wish**
  - *passed*: The coin rings off the stone a long way down. Something down there listens, and luck settles on your shoulders.
  - *failed*: The coin falls without a sound. You are not sure anything is listening.
- **Climb down the rope**
  - *passed*: At the bottom, in a hand-span of water, a hundred years of offerings. You fill your pockets and climb back up.
  - *failed*: The rope parts halfway down. The water breaks your fall, mostly.
- **Draw a bucket and drink**
  - *passed*: The water is cold enough to hurt, and clean. Your wounds ache, then ease.
  - *failed*: Something lives in the water, and now it lives in you.
- **Leave it**
  - You leave the coins where they lie.

### The Archivist's Shelves (shelves)

Shelves cut into the rock, still bowed under the archivist's books. Most have rotted to pulp. A few have not, and one spine is lettered in gold leaf.

- **Search for anything still useful**
  - *passed*: Behind a rotted ledger, a scroll case sealed with the archive's wax. The scroll inside is whole.
  - *failed*: The shelf you lean on gives way. Books, and then the shelf, come down on you.
- **Read the archivist's own journal**
  - *passed*: Page after page on this floor: where the damp gets in, where the old crews dug, where the stairs are. You read it twice.
  - *failed*: The last pages are not in the archivist's hand, and reading them makes your skin crawl. You put it down too late.
- **Take the gilt book to sell**
  - It is heavier than it looks. A trader will pay for gold leaf, and you pocket the loose leaves now.
- **Leave them**
  - You leave the archive to its slow rot.

### A Sleeping Ogre (sleeper)

An ogre sleeps across the passage on a bed of stolen coin, snoring like a rockfall. One hand is still wrapped around its club.

- **Creep past and fill your purse**
  - *passed*: You go through its hoard a coin at a time, between snores. It never stirs.
  - *failed*: A coin slides. The snoring stops.
- **Crack its skull while it sleeps**
  - *passed*: One blow, with everything you have behind it. It never wakes.
  - *failed*: Its skull is thicker than your arm. It wakes up angry.
- **Let it sleep**
  - You find another way round, very quietly.

### A Mirror in the Dark (mirror)

A tall mirror in a gilt frame stands where no mirror should be. Your reflection lowers its lantern a moment after you lower yours.

- **Look deep into it**
  - *passed*: It shows you as you could be, and for a moment you are. Something of it stays with you.
  - *failed*: The reflection smiles, and you do not. You feel thinner, somehow, when you look away.
- **Talk to your reflection**
  - *passed*: It answers, in your own voice, and tells you where the dangers on this floor are waiting.
  - *failed*: It answers with something that is not a word, and something steps out of the frame after you.
- **Smash it**
  - *passed*: It shatters, and something like a sigh goes out of the room. The gilt frame is worth a little.
  - *failed*: The glass does not break. Your hand does, a little.
- **Turn it to the wall**
  - You turn it round without looking and walk on.

### A Wired Chest (wired)

A painted chest sits alone in the open, which is the first warning. The second is the wire running from its lid into a hole in the wall.

- **Disarm the trap**
  - *passed*: You find the spring, wedge it, and lift the lid on a trap that will never fire.
  - *failed*: The wire goes taut under your fingers. The darts are quicker than you.
- **Work out where the darts will fly**
  - *passed*: You open it from the side, at arm's length. The darts rattle off the far wall.
  - *failed*: You were wrong about the side.
- **Wrench it open and take the darts**
  - *passed*: The darts hurt, and you do not care. Everything inside is yours.
  - *failed*: The darts hurt a great deal. You get the lid open, eventually.
- **Leave it**
  - Whoever set that trap can keep what is in it.

### The Goblin Toll (toll)

A goblin in a dented helmet stands beside a hand-painted sign and holds out a cup. "Toll!" it says, very pleased with itself. Behind it, others watch from the dark.

- **Pay the toll**
  - It bites the coin, nods and whistles. The ones in the dark melt away, and it points you the quick way down.
- **Scare it off**
  - *passed*: You loom. It squeaks, drops the cup and runs, and so do the ones in the dark.
  - *failed*: It is braver than it looks, and so are its friends.
- **Tell it you are the new toll-collector**
  - *passed*: It hands you the cup, salutes, and marches off to tell the others. The cup is half full.
  - *failed*: It does not believe you. It whistles.
- **Back away and find another road**
  - You back off. Its jeering follows you down the passage.

### The Lever Door (levers)

A squat stone door is set in the rock, and beside it three iron levers stand in a row, each worn bright at the grip. Someone has scratched marks over them, and crossed most of the marks out.

- **Work out the order from the marks**
  - *passed*: Left, right, middle. Something heavy rolls aside in the wall and the door swings in on a small vault, dry and untouched.
  - *failed*: Wrong. Darts spit from holes in the frame before you can step back.
- **Put your shoulder to the door**
  - *passed*: Stone grinds on stone, and gives. The vault is yours, but the noise of it rolls away down every passage on the floor.
  - *failed*: It will not move, and you have wrenched something trying.
- **Leave the levers alone**
  - Whoever made the marks did not get in either. You leave the door to the next one.

### A Lost Mule (mule)

A mule stands in the passage with its head low and its packs askew, a frayed rope hanging from its halter where someone let go of it. It looks at you, and then at the dark, as if it would rather you.

- **Take its rope and lead it on**
  - It falls in behind you, nosing at your pack. You tie it where the traders pass; the next of them below will know whose it is.
- **Strip its packs and send it off**
  - Rope, a pot, a lamp, some coin and one thing worth having. The mule trots off lighter, and does not look back.
- **Let it lead you, as it knows the way**
  - *passed*: You give it its head. It picks its way through the passages without a wrong turn, and you learn the floor as it goes.
  - *failed*: It bolts the moment the rope is slack, and you lose an hour chasing it.
- **Leave it be**
  - You leave it to find its own way. It watches you go.

### The Pale One (bargain)

Something made of candle-smoke waits where the passage narrows. It has no face, but you know it is smiling. "Strength," it says, "for a little of what you will owe the one below. Everyone who goes down owes it something."

- **Take its strength**
  - Cold runs down your arms and settles in your hands. Far below, something stirs, and is pleased.
- **Tell it no, and mean it**
  - *passed*: It comes apart like smoke in a draught, and you feel clearer for having refused it.
  - *failed*: It laughs, and the cold of it gets into you anyway.
- **Walk past it**
  - It watches you go. It has all the time in the world.

### The Kept Smith (smith)

An old dwarf sits at a cold anvil with his hammer raised, so still that dust lies along his arm. Only his eyes move. "One of the smiths who stayed," he says, his lips barely moving. "We lit it to be warm, and stayed to be warm, and here I am. You are going down to it. I have two things to give, sun-walker, and you may carry only one."

- **Take the quench**
  - He opens his other hand, slowly, as if it has been shut a long time: a stone flask of black water, cold as the deep. "Pour it on the fire and it goes out, for good. Everything it keeps will lie down at last, me with it. The valley will have to find its own warmth."
- **Ask how the smiths stayed**
  - "You hold it," he says, "and you do not let go. It asks nothing else. Hold it, and it keeps the valley warm for as long as you keep it." He looks at the dust on his hands. "As long as that."
- **Leave him at his anvil**
  - You go on. Behind you, very slowly, the hammer begins to come down.

### The Heart of the Mountain (heart)

The Heart of the Mountain lies before you, beating slow and red, warm as a living thing. Its keeper is down. What you do now is the whole of the delve.

- **Put it out with the smiths' quench**
  - You choose the cold.
- **Stay, and keep it**
  - You choose to stay.
- **Lift it and carry it up**
  - You choose the day.

### The Third Crew's Last Stand (laststand)

A wall of shields across the passage, and behind it the third crew, where they fell holding it. Their banner is still up. Whatever they held this line against, it did not come through.

- **Search the fallen**
  - *passed*: You go carefully, and find what they carried: a purse, and something better.
  - *failed*: One of them was not quite finished dying. A cold hand closes on your wrist.
- **Read their captain's last orders**
  - *passed*: A map of the floor, marked with every place they lost someone. You will not make their mistakes.
  - *failed*: The ink has run too far to read.
- **Raise their banner and take heart**
  - *passed*: You set the banner straight. For a while it feels as if they march with you.
  - *failed*: The pole snaps in your hands. It feels like a bad sign.
- **Bury them**
  - It takes a long time, and you go hungry for it. It was the right thing to do.
- **Leave them to their watch**
  - You step over the shields and go on. They have held their line long enough.

### The Ossuary (ossuary)

The walls of this chamber are built of skulls, thousands of them, set in patient rows. In the middle stands a reliquary of green bronze, and every empty eye in the room seems turned towards it.

- **Pray for the dead**
  - *passed*: You say the old words for them, and the room grows easier to stand in. Something of their long quiet goes with you.
  - *failed*: The words come out wrong. Two of the walls' builders climb down to correct you.
- **Open the reliquary**
  - *passed*: The catch gives without a sound. Inside, on rotten velvet, the saint's things, and the offerings of those who came to them.
  - *failed*: A needle in the catch, and something green on it.
- **Read the names on the wall**
  - *passed*: Under the skulls, the names, and under the names, where each was found. It reads like a map of the floor, and it is one.
  - *failed*: The script is older than any you know.
- **Walk softly through**
  - You keep your eyes down and your steps quiet, and the dead let you go.

### The War-Camp (warcamp)

Cookfires, a rack of spears, a spit with something turning on it. The Warrens' war-camp is almost empty: only an orc sentry, dozing on an upturned drum with a cleaver across his knees.

- **Rob the weapon rack**
  - *passed*: You take the best of the rack and are gone before the sentry stops snoring.
  - *failed*: A spear topples, and the whole rack goes with it. The sentry wakes up furious.
- **Kick the drum out from under him**
  - *passed*: He goes down hard and does not get up, and the camp's stew is yours. You feel equal to anything down here.
  - *failed*: He is quicker than he looked. The cleaver finds you on its way past.
- **Wake him, and say you bring orders**
  - *passed*: He is too sleepy to argue. He tells you which tunnels the patrols use, and pays the messenger's fee.
  - *failed*: He does not believe a word. He beats on his drum instead.
- **Slip past the camp**
  - You go round by the back tunnels. The stew smelled good.

### The Duellist's Ghost (duelist)

A pale swordsman stands in the middle of the passage, a blade of mist held low. He salutes you with it. "One pass," he says, in a voice like wind through a keyhole. "Only one. It has been so long."

- **Cross blades with him**
  - *passed*: Mist rings on steel. He gives ground, laughing without a sound, and you come away knowing something about your own arm.
  - *failed*: His blade passes through your guard and through you. It is cold for a long time after.
- **Match his footwork**
  - *passed*: Step for step, and his blade never finds you. He lowers it and bows, and you find your feet are lighter.
  - *failed*: You step where he wanted you to. The flat of the mist-blade takes you across the ribs.
- **Bow, and ask his name**
  - *passed*: He tells you, and how he died, and what he was carrying. It is still where he fell, a little further on.
  - *failed*: He has forgotten it. He fades, looking puzzled, before you can say you are sorry.
- **Walk around him**
  - He lets you pass, blade still raised, waiting for someone else.

### The Spider's Larder (larder)

Bundles of grey silk hang from the ceiling like fruit, turning slowly. Most are still. One has a sword hilt poking out of it. One, near the back, is moving.

- **Cut down the one with the sword**
  - *passed*: One clean stroke and it drops into your arms. The owner has no more use for their things.
  - *failed*: The whole web shivers when you cut. Its keepers come down to see.
- **Free the one that moves**
  - *passed*: You tear the silk apart and a half-smothered delver of the fourth crew falls out, gasping. She presses her last draught on you and runs for the stairs.
  - *failed*: The silk will not tear. Something large comes down its thread to find out why the larder is shaking.
- **Burn the webs down**
  - *passed*: The silk goes up like paper. When the smoke clears, what the spiders kept is lying on the floor.
  - *failed*: The fire takes, and so does the smoke. You stagger out coughing, singed.
- **Back away quietly**
  - You leave the larder to its keepers. Something up there turns to watch you go.

### A Lamp Gone Out (lampfolk)

One of the Lampfolk sits hunched against the wall, its lamp cold in its lap and its great eyes dim as ash. "Sun-walker?" it says, turning the wrong way. "The flame went out. We do not see without it."

- **Coax the wick alight**
  - *passed*: A spark, a breath, and the flame stands up. Its eyes brighten with it. It touches your hand, very lightly, and says it will tell the others.
  - *failed*: The oil catches all at once and flares across your hands. It goes out again, and its owner sighs.
- **Talk it back to the light**
  - *passed*: You talk it along the wall, step by step, to a torch still burning. It lights the lamp from it, and draws you the way it came in the dust.
  - *failed*: It does not trust a voice in the dark. It gathers up its pack and shuffles away from you, and you spend a long while getting your bearings again.
- **Give it oil from your own flask**
  - It fills the lamp from your flask, lights it, and bows until its pack nearly tips it over.
- **Take its pack while it cannot see**
  - *passed*: You lift the pack and go. Behind you it calls out, again and again, and then goes quiet.
  - *failed*: It knows the weight of its own pack. The lamp-staff cracks across your knuckles, and it runs, shrieking, into the dark.
- **Leave it in the dark**
  - You go on. Its dim eyes follow the sound of your feet.

### The Cold Forge (forge)

A dwarf-built forge, long cold, with a half-made blade still lying on the anvil. The bellows are cracked but whole. Someone meant to come back and finish it.

- **Work the bellows and finish the blade**
  - *passed*: The coals take, the iron glows, and the old work comes true under your hammer. It is a better blade than you had any right to make.
  - *failed*: The bellows give out in a gout of sparks. You beat out the burning in your sleeve, and the blade cracks as it cools.
- **Read the maker's marks**
  - *passed*: A ward-rune, cut in the anvil's face to draw bad magic out of the iron. It still works: you feel something let go of you as you trace it.
  - *failed*: The marks are in a smith's cant you do not know. You learn only that the maker was proud of them.
- **Prise the gold wire off the hilt**
  - It comes away in a bright tangle. Whoever made the blade would not thank you.
- **Leave it for its maker**
  - You leave the blade where it lies, in case they do come back.

### A Still Black Pool (pool)

Water has found its way down here and stopped, black and perfectly still, in a basin of worn stone. Something pale glints on the bottom. Your reflection looks back at you a moment longer than it should.

- **Drink**
  - *passed*: It is cold enough to hurt, and clean. You feel it all the way down, and your wounds close behind it.
  - *failed*: It tastes of iron and old things. Your stomach turns over.
- **Dive for what glints**
  - *passed*: It is deeper than it looks. You come up gasping with something in your fist that the water kept for a long time.
  - *failed*: The cold takes the breath out of you. You come up empty-handed, half drowned and shaking.
- **Hold your reflection's gaze**
  - *passed*: It blinks first. You come away steadier, as if you had been shown where you are weakest.
  - *failed*: You look away first. For a long while after, you feel that something is still looking.
- **Leave the water be**
  - You leave the pool as you found it. Its surface does not so much as tremble.

### An Unwatched Pot (cookpot)

A goblin cook-pot hangs over a low fire, bubbling, and there is no goblin anywhere. A ladle sticks out of it. Something in the stew has a lot of legs.

- **Eat your fill**
  - *passed*: It is better than it looks, which is not saying much. You feel you could walk for a day.
  - *failed*: The legs were a warning. You bring most of it back up.
- **Wait for the cook, out of sight**
  - *passed*: The cook comes back humming, and never sees you. Its purse is heavier than its stew.
  - *failed*: The cook comes back with friends, and they smell you before they see you.
- **Tip it over and search the dregs**
  - The fire hisses out in a cloud of stinking steam. At the bottom, among the bones, something that was not food. The noise carries.
- **Leave the goblins their supper**
  - You leave the pot bubbling. Somebody will be glad of it.

### The Weeping Knight (statue)

A stone knight kneels on a plinth, head bowed, water running from its eyes in two thin lines down the moss. The sword across its knees is not stone. It is real steel, and bright.

- **Prise the sword out of its hands**
  - *passed*: Stone fingers crack, one by one, and the sword is yours. The weeping stops.
  - *failed*: The grip does not give, and your hands slip down the edge.
- **Kneel beside it and swear to finish its task**
  - *passed*: You do not know what the task was. It seems not to matter. You rise feeling that someone old and patient is at your back.
  - *failed*: You kneel a long time. The stone does not answer.
- **Read the plinth**
  - *passed*: A name, a vow, and a plan of this floor cut underneath, from the days when the knights still kept it.
  - *failed*: The moss has eaten most of it. You make out the word "never", and nothing else.
- **Leave it to its grief**
  - You walk on. Behind you, the water keeps running.

### The Idol's Eyes (idol)

A grinning idol of green stone sits cross-legged in an alcove, its eyes two cut rubies as big as your thumb. The floor in front of it is scorched in a neat circle.

- **Prise out the rubies**
  - *passed*: One, then the other, and nothing happens. You do not wait around to find out why.
  - *failed*: The scorched circle was a warning. Fire leaps from the idol's mouth.
- **Find the trap before you touch it**
  - *passed*: A pressure plate under the idol's knee. You wedge it with a dagger and take the rubies at your leisure.
  - *failed*: You find it by leaning on it. The fire only catches the edge of you.
- **Smash it open**
  - *passed*: The idol splits down the middle with a crack that carries a long way. Coins spill out of its belly.
  - *failed*: Your blow glances off, and the idol breathes fire at you for the insult.
- **Leave it grinning**
  - You leave the idol its eyes. They follow you down the passage.

### A Starving Hound (stray)

A brown hound lies curled in a corner, all ribs, a frayed collar round its neck and a name scratched on the tag. It lifts its head as you come near, and its tail moves once against the stone.

- **Share your food with it**
  - It eats from your hand, slowly, as if it cannot believe it. When you move on, it gets up and follows.
- **Call it to you**
  - *passed*: It comes, low and wary, and pushes its nose into your hand. It is yours now, or you are its.
  - *failed*: It shies from your hand and slinks off into the dark, and does not come back.
- **Leave it be**
  - You leave it curled in its corner. It watches you go.

### A Caged Goblin (caged)

An iron cage stands against the wall, and a scrawny goblin with a broken chain on one wrist is pressed to its bars. "Let me out," it hisses, "and I open every lock down here for you. Every one. I find the traps too. Nobody finds traps like me."

- **Wrench the bars apart**
  - *passed*: The bars bend with a shriek of iron. The goblin squeezes out, bows far too low, and falls in behind you.
  - *failed*: The bars hold, and your shoulder does not thank you for trying. The goblin sighs at you.
- **Pick the padlock**
  - *passed*: The padlock falls open. "Not bad," says the goblin, stepping out, "for a big one." It falls in behind you.
  - *failed*: The lock beats you. The goblin tuts, loudly, and turns its back.
- **Leave it caged**
  - It curses you in three languages as you go, one of them its own.

### A Sellsword for Hire (hire)

Someone leans against the wall with both hands on the pommel of a greatsword planted point-down before them, a kettle hat pushed back. "Going down? So am I, for pay. I am slow, I am hard to kill, and anything that comes for you comes through me."

- **Pay their price**
  - They weigh the purse, nod once, and get to their feet. "Lead on, then."
- **Haggle them down to half**
  - *passed*: They laugh, and spit, and shake on it. "Half, and you buy the drinks when we come up."
  - *failed*: They push your coin back across the crate. "Not for that. Not for anyone." And they will not hear another word.
- **Ask what they have seen down here**
  - "Mind the floor," they say, and tell you where they have seen others step wrong.
- **Leave them to their wait**
  - They shrug, and go back to watching the dark.

### A Dark Elf Outcast (exile)

A dark elf stands with their back to the wall, two curved blades hanging loose in their hands, in leather gone brown with wear, the silver of their house cut from it. Their eyes are amber, not red. "Going down? Two floors under you are my people, who would flay me for the colour of my eyes. I know their ways, and I will sell them to you."

- **Pay their price**
  - They take the gold without counting it and slide the blades home. "Their halls, then. I will show you where they keep their knives."
- **Promise them the High Priestess**
  - *passed*: "Vaelith." They say it as if it tastes of blood. "For that I would come for nothing." They get to their feet.
  - *failed*: "Everyone promises that," they say, "and their skulls hang in her temple." They turn their face to the wall.
- **Ask about the halls below**
  - "Hold your blow when a warrior crosses its blades. Burn the webs. And trust no spell of yours to land on one of us." They tell you where they last saw traps laid.
- **Leave them to the dark**
  - They watch you go with their amber eyes, and do not move.

### A Healer by a Dead Lamp (stray_healer)

Someone in a grey-green hooded robe kneels by a lamp that has gone out, winding a bandage round their own forearm and holding the end in their teeth. An open satchel spills dried herbs on the stone. "My party went on without me," they say round the bandage. "Or I went on without them. Either way, I mend people, and there is nobody down here to mend."

- **Share your food, and ask them along**
  - They eat as if they had forgotten how, knot the bandage, shoulder the satchel and take up their staff. "Lead on. Try not to need me."
- **Ask them to come with you**
  - *passed*: "Better than sitting here in the dark," they say, and get to their feet. "I will keep you on yours."
  - *failed*: "I do not know you," they say, "and I have been left once already." But they bind your worst cut before you go.
- **Ask them to see to your wounds**
  - They clean and bind what the dark has done to you, humming as they work, and will not take a coin.
- **Leave them to their lamp**
  - They nod, and go back to their bandage.

### The Forge-Spirit (forgespirit)

An anvil black with age stands on a stump of rock, and over it hangs a fire with no fuel under it. As you come near, the fire turns, and two eyes open in it. "Iron," it says, in a voice like a bellows. "Bring me iron. I am hungry, and I have not worked in an age."

- **Thrust your blade into its fire**
  - It takes the blade and your blood with it. The metal comes out ringing, darker than it went in.
- **Lay your armour on its anvil**
  - It eats the gold like kindling, and works the armour with hands of flame until the seams glow and set.
- **Work its bellows for it**
  - *passed*: You work the bellows until your arms shake. It roars with the joy of it, and gives back both blade and coat the better for it.
  - *failed*: The bellows kick back, and a tongue of its fire licks out at you.
- **Leave it to its fire**
  - It watches you go, and turns back to its empty anvil.

### The Heartwell (heartwell)

A shaft drops away into the dark, ringed with stones worn smooth by hands. Up out of it comes a warm red light, and a slow sound like a heartbeat: the Heart, somewhere far below. The air over it shimmers.

- **Lean over and breathe its warmth**
  - *passed*: The heat goes into you like strong wine and stays. You feel the stronger for it, and whole.
  - *failed*: The heat sears your throat and lungs, and you reel back coughing.
- **Drop gold down the shaft**
  - The coins fall a long way, and the beat below quickens, once. Your hand is steadier for a while.
- **Sit and warm yourself a while**
  - You rest your back against the warm stones and let the beat slow your own. The time passes, and so does some of the hurt.
- **Leave it beating**
  - You leave the Heart's warmth behind and go on into the cold.

### The Last Delver (lastdelver)

A wasted figure in the rags of a fine coat crouches over a fire of bones, muttering. They came down for the Heart, long ago, and never went back up. They look at you with eyes too bright. "Another one. Have you brought anything to eat?"

- **Share a meal with them**
  - They eat like a starving thing, then draw the floor for you in the ash with a bone, every trap marked. "I know every stone of it," they say. "Every stone."
- **Ask what lies below**
  - *passed*: You let them talk, and pick out what is true. They name every flask and blade you carry, and what each will do.
  - *failed*: Their muttering rises to a shriek that rings down every passage. Things stir all over the floor.
- **Rob them while they mutter**
  - *passed*: Their pack has been gathering for years: the best of what a delver carries, and they never notice it go.
  - *failed*: They catch your wrist with a grip like iron, rake your face, and scream. Things stir all over the floor.
- **Leave them to their fire**
  - You leave them muttering over the bones. They do not look up.

### A Warm Egg (wyrmegg)

In a nest of ash and gnawed bones lies an egg the size of a shield, scaled like a pine cone and warm to the touch. Something inside it shifts as you come near.

- **Smash it before it hatches**
  - It takes three blows. What is inside never draws breath, but somewhere far off on this floor something huge roars, and keeps roaring.
- **Prise off a shard of its shell**
  - *passed*: The shard comes away clean. Under the nest, among the bones, lies what the last thief to try it dropped.
  - *failed*: The shell gives, and something inside snaps at your fingers through the gap.
- **Warm your hands at it**
  - The egg is as warm as a hearth. You stand by it a while, and feel better for it.
- **Leave it be**
  - You leave the egg to its nest, and whatever laid it.

### The Mapmaker (mapmaker)

A skeleton in a surveyor's coat sits against the wall, a satchel of rolled maps in its lap and a measuring chain wound round its arm. One bony finger still points down the passage.

- **Take the map of this floor**
  - It is the right floor, and most of it is true.
- **Follow where the finger points**
  - *passed*: Scratched marks on the wall, then a loose stone, and behind it the mapmaker's own cache.
  - *failed*: Wherever it was pointing, you do not find it. The walk costs you.
- **Bury the mapmaker with its maps**
  - *passed*: It is hard work in this rock, but you do it. You feel lighter for it.
  - *failed*: The ground is stone. You give up with raw hands, and leave the mapmaker as you found it.
- **Leave it pointing**
  - You leave the mapmaker to watch the passage for the next one.

## The endings (ENDINGS)

### VICTORY (take)

- *in the Hall*: Claimed the Heart
- *what they did*: lifted the Heart of the Mountain
- *lifting it, 1*: You lift the Heart of the Mountain. Its light pours out between your fingers, over the walls, up through the stone.
- *lifting it, 2*: It beats against your palms like a living thing: the first fire of the old smiths, that warms whatever is near it and keeps whatever stays.
- *the last line*: The light carries you up out of the mountain and into the day. The Heart is yours.
- *the story after, 1*: {name} came up out of the Deepdelve carrying the Heart of the Mountain, which is a sentence nobody in the valley has been able to write for three winters.
- *the story after, 2*: The Heart is the first fire of the old smiths: it warms whatever is near it, and keeps whatever stays. The valley will be warm again, and nobody in it means to stand too close.

### THE FIRE GOES OUT (quench)

- *in the Hall*: Quenched the Heart
- *what they did*: put out the Heart of the Mountain for good
- *lifting it, 1*: You unstop the smiths' flask and pour the black water over the Heart of the Mountain. It hisses, and fights, and beats once more against the cold.
- *lifting it, 2*: Then it goes dark. All through the deep, the things it kept lie down at last: the first fire of the old smiths, that warmed whatever was near it and kept whatever stayed, keeps nothing now.
- *the last line*: You climb up out of the mountain by your own lamp, and come out into a cold grey dawn.
- *the story after, 1*: {name} came up out of the Deepdelve with nothing in their hands, and told the valley that the Heart of the Mountain was out for good.
- *the story after, 2*: It was the first fire of the old smiths: it warmed whatever was near it, and kept whatever stayed. Nothing down there is kept now. The valley will have to learn the cold, and the dead of the four crews are only dead.

### KEPT (keep)

- *in the Hall*: Stayed to keep the Heart
- *what they did*: stayed below to keep the Heart of the Mountain
- *lifting it, 1*: You take up the Heart of the Mountain, and hold it, and do not let go. It asks nothing else.
- *lifting it, 2*: Its warmth goes into you and up through the stone: the first fire of the old smiths, that warms whatever is near it and keeps whatever stays. You stay.
- *the last line*: Far above, a thaw comes to the valley. Down here the hall is warm, and you are not tired, and you will not be.
- *the story after, 1*: {name} never came up out of the Deepdelve. They stayed beside the Heart of the Mountain, and hold it still.
- *the story after, 2*: The Heart is the first fire of the old smiths: it warms whatever is near it, and keeps whatever stays. The valley is warm again, and will be for as long as someone keeps it. Somewhere below, someone does.

## What the Bestiary knows (BESTIARY)

- *Giant Rat*: Big as a dog and never alone for long. From the second floor down they come in twos and threes, and the square is clear only when the last one drops. A rat pounces after whoever backs away from its bite: step aside, not back.
- *Cave Bat*: Quick, weak and hard to hit, it flutters above your blade. It bites fast, so its warning is short: watch for the mark and step back early.
- *Green Slime*: A slow heap of green that eats whatever it rolls over, bones included.
- *Cave Spider*: Its bite is venomous. It prefers to hang back in a corridor and let its web do the work.
- *Goblin*: Small, mean and brave in numbers. Goblins go about in groups and swing together in a quick volley, and never draw back the same way twice: one blow comes quick, the next slow.
- *Skeleton*: Bones held together by something that will not let them rest. Undead: holy magic burns it twice as badly.
- *Zombie*: Slow and stupid, and stronger than it looks. Undead: holy magic burns it twice as badly.
- *Orc*: A trained soldier, heavier and surer than a goblin. It likes a long straight corridor, and it varies its swing: watch the blow, not the beat.
- *Ghoul*: It eats the dead and would like you to be one. Its plain blows lunge after a hero who backs away; a step to the side leaves it biting air. Undead: holy magic burns it twice as badly.
- *Wraith*: A cold shape that drifts above the floor, hard to land a blow on. Its touch is the grave's own cold, and a Ring of Warmth takes half of it. It drifts after a hero who backs away and strikes anyway: slip aside instead. Undead: holy magic burns it twice as badly.
- *Ogre*: Huge, slow and very strong. Its club hits like a falling wall.
- *Troll*: Long-armed and hungry, and very hard to kill: its wounds close as you watch.
- *Minotaur*: The master of the deep halls, bull-headed and tireless. It hits harder than anything but the lich.
- *Kobold Trapper*: A small, scaled, sharp-snouted thing that lives by its traps. It will not stand and fight if it can step back and throw instead.
- *Goblin Archer*: A goblin with a bow, shooting from four squares away down a straight line. It draws before it looses; step out of the line, or close in, since a step back only keeps you in it.
- *Basilisk*: A heavy, many-legged lizard of the lower halls. Whatever meets its eyes when they flare is stone for a while.
- *Rustmaw*: A burrowing beetle the size of a dog. It eats metal, and leaves rust in its tracks.
- *Dark Acolyte*: A servant of the dark who hurls bolts of shadow from five squares off.
- *Blink Hound*: A lean grey hound of the deep, all ribs and pale eyes. It hunts by stepping out of the world and back into it wherever its prey is not looking.
- *Quillback*: A squat, heavy beast with a mantle of long dark quills and a temper to match. Its quills burn.
- *Glimmer Moth*: A pale moth as broad as a hand is wide, drawn to any light, the hero's own included. Its wings are dusted with something that shines.
- *Thornhog*: A low, bristling hog of the upper halls, nosing for grubs and short of temper. Its quills burn.
- *Gutter Imp*: A small grey thing with long ears and a longer grin, that lives in the drains. It has learned a trick from something deeper down.
- *Goblin Cutpurse*: A thin goblin in a dark hood, light on its feet, with a sack at its belt that clinks. It is not here to fight you.
- *Goblin Lookout*: A goblin with a bone whistle on a cord round its neck, posted where it can see who comes. It is quick, and it does not fight if it can run.
- *Goblin Hexer*: A goblin in a cap of rat skulls, with a bundle of bones on a stick that it shakes at whatever it dislikes. It dislikes most things.
- *Goblin Pikeman*: A goblin with a pike twice its height, which it holds out in front of it as if it were afraid of what it might meet. It is.
- *Drowned One*: Something that went into the black water and did not come out, bloated and pale. It lies under the surface with only a ripple to show for it. Undead: holy magic burns it twice as badly; the water keeps fire off it, and carries lightning in.
- *Dark Elf Warrior*: A dark elf in black mail, grey-skinned and white-haired, with a curved blade in each hand. They are quick, and they fight as if they had been taught to by someone who would kill them for doing it badly.
- *Dark Elf Mage*: A dark elf in robes the colour of a bruise, who keeps well back and lets the warriors do the dying. It throws violet fire from afar, and steps away from anyone who comes close.
- *Lizardfolk Warrior*: A man-sized lizard on its hind legs, green and brown and crested, with a spear, a shield of turtle-shell and a tail as thick as a man's leg, which it uses.
- *Lizardfolk Shaman*: A lizardfolk in a cloak of reeds and a headdress of bones, with a staff hung with charms. It keeps behind the warriors, chanting.
- *Marsh-Mother*: The Marsh-Mother of the lizardfolk, half again the size of her warriors, her crest gone white with age and her neck hung with the teeth of everything she has eaten.
- *Grey Dwarf*: A dwarf as grey as the rock, bald and broad, with an iron-coloured beard in braids to the belt, in mail too heavy for anyone taller to carry. Slow, sure and very hard to hurt.
- *Grey Dwarf Arbalest*: A grey dwarf with a crossbow as long as itself, which keeps behind the warriors and winds and looses, winds and looses, without hurry.
- *Forge-Thane*: The Forge-Thane of the grey dwarves, older than their hold, his beard bound in copper rings and his hammer the one that made their gates. Two arbalests stand at his back.
- *High Priestess*: The High Priestess of the dark elves, crowned in silver spiders, who has kept their temple for longer than the Heart has been gone. Her warriors die for her without being asked.
- *Emberling*: A knot of cooling rock the size of a dog, crusted black and split with cracks that glow like a forge. It lives where the deep floors smoulder, and fire is its home: it barely feels it. Cold hurts it badly.
- *Mimic*: A thing that has learned to look like a barrel, staves, hoops and all, and waits among the real ones for someone to come and open it. Some have learned to be a vault's chest, and keep what the chest held.
- *Eyeless Stalker*: A long pale hunter of the dark floors, with no eyes at all: a smooth, blind head and a mouth full of needles. It hears everything.
- *Puffcap*: A fungus the size of a crouching man, grown up out of the moss on stubby roots. It shuffles after warm things, slowly.
- *Cave Wyrm*: A young drake of the deepest halls, wingless and heavy, scaled like rusted iron. Fire does little to it; cold bites.
- *Shade*: One of your own, who fell in an earlier delve and did not stay down. It keeps the floor where it died, over the bones and the gear it died in, and it fights the way it did in life: a fighter's shade charges, a mage's throws cold fire, a cleric's mends itself, a thief's is quick and follows a step back, a ranger's shoots. Undead: holy magic burns it twice as badly. Lay it to rest and its gear is yours.
- *Heartforged*: Deeper than the lich or the Warlord ever came, the Heart rests where it was made, and the thing the old smiths built to keep it keeps it still: an iron giant twice a man's height, a furnace burning in its chest, a hammer in its fist. Fire does it little harm. Cold bites deep.
- *Goblin Warlord*: Grisk was only his sister's boy. The Warlord of the Warrens wears a crown of hammered gold, beats a war-drum that every goblin in the deep comes running to, and has dragged the Heart into his own hall. Break the beat by striking him; cut down his shield-bearers and he must leave his throne; and when he kicks open his war-chest, keep your head.
- *Dread Lich*: The dread thing that keeps the Heart of the Mountain. Its touch drains life and reaches two squares down a straight line, so one step back is not enough: step aside. It does not flee.
- *Goblin King*: Grisk crowned himself with bent spoons and a bucket, and no goblin on his floor has dared to laugh. He fights like one of them, only bigger, and he never fights alone for long.
- *Web-Mother*: The mother of every spider in the upper halls, as broad as a cart. Her whole floor is her web, and she feels every step taken on it.
- *Orc Warchief*: Ushgar holds the middle floors by the simple rule of running over anyone who argues. Goblin runners carry his drums.
- *Ghoul Lord*: The oldest ghoul in the delve, and the fattest. It has been eating the fourth crew since they came down. Undead: holy magic burns it twice as badly.
- *Hollow Abbess*: She led the valley's prayers in the Hollow Chapel before the Heart went out, and she is praying still. Undead: holy magic burns her twice as badly.
- *Elder Wyrm*: The oldest of the deep's wyrms, grown too big for the passages she made, sleeping on a hoard of the fourth crew's steel. Fire does little to her; cold bites.
- *Troll-Father*: Father, grandfather and great-grandfather to every troll on the lower floors, and hungrier than all of them together.

## First-moment tips (tips.js)

- *pad*: A controller: the stick or d-pad steps and turns, **LB**/**RB** step aside, **A** attacks, **X** uses, **Y** casts, **B** takes what is underfoot, **LT** drinks. **View** reaches the bottom row; **Menu** pauses.
- *controls*: Move with the arrows, or swipe the view. **⚔ Attack** strikes what is in front of you; **✋ Use** does whatever it says.
- *face*: Something is coming, and not from in front. **Turn to face it**: the red chevron at the edge of the view points the way.
- *monster*: Something is coming. When it is in front of you, tap **⚔ Attack** to strike it.
- *dodge*: **A warning mark!** Its blow is coming: **step back ↓** now and it hits empty air.
- *dodgeside*: **A warning mark!** Its blow is coming, and there is a wall behind you: **step aside** (← or →) now and it hits empty air.
- *dodgelunge*: **A warning mark!** Its blow is coming, and this one lunges after a step back: **step aside** (← or →) now and it hits empty air.
- *dodgelungeflank*: **A warning mark!** Its blow is coming from your side, and this one lunges after a step away: step **forward or back** (↑ or ↓), out of its line, and it hits empty air.
- *lunged*: It **lunged after you**: a rat, a ghoul or a wraith follows a step straight away from it. Step **out of its line** instead, to the side of it, and it hits empty air.
- *dodged*: It hit empty air. **Step in** and strike before it draws back again. Every mark is a blow coming, and each foe has its own answer: the Bestiary keeps them.
- *shot*: **An arrow is drawn** from down the line. Step **aside, out of its line**, or close in and strike: stepping back only keeps you in it.
- *late*: Too slow: that one landed. Step back **the moment** a warning mark appears, and the blow misses.
- *trick*: A **violet spiked mark** means a trick **armour will not turn**: get out of the way. The log says what is coming, and the **Bestiary** (Journal) records each trick.
- *gaze*: Its eyes blaze: **turn away!** A basilisk's gaze turns to stone only whoever is looking at it.
- *dazzle*: Its wings are beginning to shine: **turn away!** The flare dazzles only whoever is looking at it, and a dazzled hero's blows go wide a while.
- *fetch*: A **lookout** is running for help: when it reaches the others it **whistles them awake**. Bring it down **before it gets there**: an arrow, a snare, a spell, or a quick chase.
- *hex*: It is chanting a **hex**: **strike it** to break the chant, or **get out of its sight** before it ends. On a caster the hex binds the tongue (no spells); on anyone else it slows steps and blows.
- *snatch*: Its hand darts for your **purse**: **step back**, and it closes on air. Robbed, bring it down **before it gets away**, and it drops your gold.
- *pike*: It levels its pike down its line. **Close in** under the point, or **step out of its line**: the pike reaches two squares, so a step back only keeps you on it.
- *rust*: It means to bite your armour. **Step back!** A rustmaw's bite rusts metal for good, though a trader's forge can mend it.
- *claw*: A numbing claw reaches for you. **Step back** out of reach, or **strike**: a blow that lands knocks the claw aside.
- *crush*: It heaves up a crushing blow, too heavy for armour. **Step back** and it smashes the floor, wide open.
- *webspit*: It rears back to spit a web. **Step out of its line**, to one side.
- *charge*: It lowers its head to charge down the line. **Step aside**, or pull a **door** shut across its path: it slams into the door, wide open.
- *horn*: He means to sound a horn and call his kin. **Strike him** before he does: any wound cuts the call short.
- *blink*: It has stepped back into the world **at your back**. **Turn round** to face it before it bites, and it is caught open.
- *guard*: Its blades are crossed in a guard. **Hold your blow**: strike into it and it answers with a cut. Wait, and the guard falls open.
- *sweep*: Its tail is coiled to **sweep your legs**. **Step back** out of its reach: the tail lashes empty air and leaves it wide open. Stay, and it may knock you flat.
- *swell*: It mutters a working and begins to **swell**. **Strike it** now: any wound breaks the working. Grown, it hits half as hard again until it shrinks: give it room.
- *aimed*: It is taking **careful aim** down its line. **Step out of its line**, to one side, before it looses: the bolt hits twice as hard.
- *quills*: Its quills are up. **Hold your blow** until they sink: every blow struck into them bites you back. An arrow or a spell from further off is safe.
- *drowned*: A **drowned one** has risen out of the water to seize you. **Step back** as it lurches and it grabs the air. Watch the black water for a **ripple** that does not settle: one lies under it.
- *vents*: A **glowing crack** is heating up: when it flares, fire sheets over it and the **four squares beside it**. Step clear of the glow. **Cold** seals a crack a while.
- *stamp*: The **Heartforged** has its hammer up: when it comes down, fire runs out along the floor down **all four of its lines**. **Step off its lines**, to where it would have to turn to face you, and it is left open.
- *flare*: An **emberling** is blazing white-hot: it is about to **flare** and set the stones round it alight. **Step two squares off**, or strike it with **cold** to quench it.
- *tremors*: The ground is shuddering: **rock is coming down** where the floor is ringed with grit, **your square too**. Step onto one that is not marked. It falls on your foes as well, and they never look up.
- *mimic*: A barrel or a chest that **creaks** with nothing near is a **mimic**. **Strike it from where you stand**: caught shut, it takes the blow twice over. Touch it, or stand beside it, and it seizes you.
- *eyeless*: An **eyeless stalker**: it hunts by sound. **Stand still** and it loses you (turning on the spot makes no sound). Every step, blow or spell tells it where you are.
- *fire*: **Fire!** It spreads over moss and spilt oil and burns whatever stands in it, **you too**: step out of it. It burns out, and leaves ash that will not burn again.
- *cask*: An **oil cask**: the barrel painted red with a flame. Break it and lamp oil spills round it; a fire spell landing on it, or a flaming blow or arrow striking something on it, sets the oil alight.
- *water*: Standing water carries **lightning** to everything in it within two squares (you too, if you are wading close), and **cold** freezes it, holding fast whatever stands there.
- *spores*: A **puffcap**. Strike it from beside it and it bursts in **spores** that poison. **Shoot it** or cast at it from further off, or put **fire** on your blade first: fire oil sears the spores.
- *snare*: A **kobold** is setting a wire **snare** on the square before you. It is seen where it **glints**: go round it, or stand before it and press **Use** to spring it safely. Its snares go slack when it dies.
- *firepot*: A **lit pot of oil**. **Step aside**, out of its line: it bursts in flames where you stood and on the square behind, and burns there a while.
- *chill*: A **grave-cold** creeping over the stones at your feet. **Step aside**, out of its line: stay and you are frozen fast a moment.
- *storm*: Lightning called down into the **water** you stand in. **Get out of the water**; on a flooded floor, **step aside**: the water beside you still carries half of it, but no more.
- *firearrow*: A **burning arrow**, aimed at your feet: what you stand on will burn. **Step aside**, then keep clear as the flames spread.
- *breath*: Fire kindles in its throat. **Step in close**, under its jaws, or **out of its line**. Stepping back keeps you in the fire.
- *drink*: Her cold hand reaches in to drink your life. **Step back!** What she takes from your maximum hit points is gone for good.
- *web*: You are caught in a web. **Fire burns it away**: cast a fire spell to be free at once, or push against it to tear free.
- *webtear*: You are caught in a web. **Push against it**: tap any arrow, again and again, to tear free.
- *opening*: **An opening!** You answered its trick: your next blow at it cannot miss and lands hard. Strike now.
- *take*: Something lies here. Tap **✋ Take** to pick it up.
- *stairs*: Stairs down. Tap **Descend** when you are ready. The Heart waits at the bottom.
- *examine*: Something to deal with. Tap **Examine**: every choice shows its odds before you commit.
- *trade*: A trader. Tap **Trade** to buy, sell, and use the forge: it sharpens a weapon or strengthens armour, and mends rust.
- *unknown*: A **?** in your pack means you do not know how good that gear is. **Study** it, or have a trader appraise it: cursed gear will not come off once worn.
- *quickscroll*: A scroll worth reading **now**, or an oil for a bare blade as a fight starts, waits at the left end of the log, under the view: **one tap** uses it.
- *hurt*: You are badly hurt. Tap the **bottle** beside your life bar to drink a healing potion, or **Rest** when nothing is near.
- *shade*: A **shade**: one of your own heroes, risen where they fell, and it fights as they did. Lay it to rest and what they wore is yours.
- *drum*: He raises his drumstick to call his warband. **Strike him** before the beat and the call dies.
- *throne*: He sits his **throne**: his shield-bearers turn every blow meant for him. **Cut them down** and he must come down, or throw a **spell** over their heads.
- *oil*: An **oil** in your pack. Open the pack and choose **Coat weapon**, or tap the flask at the left end of the log as a fight starts: it rides on your next 20 blows that land.
- *job*: The trader's **job** is on this floor: the line under your bars shows how it goes. Leave the floor with it undone and it is lost; the next trader you meet pays for it done.
- *blooded*: Your companion has learned a **trick**. It grows with every new floor it comes down at your side; the **Hero** sheet says what it knows and what comes next.
- *bear*: You are a **bear**: claws for your blows, and a **hide** that takes blows before you do (its time and thickness are on the status line). Any **other spell** lets the bear go.
- *mastered*: You have **mastered your path**. Your capstone is listed under Path on the **Hero** sheet, with what it does.
- *dice*: Every blow is a roll of the dice. To see the numbers behind each one in the log, turn on **Combat rolls** in the **Menu**.
