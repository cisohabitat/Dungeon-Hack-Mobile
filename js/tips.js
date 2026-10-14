// The first-moment tips: one short line the first time each thing happens, on
// this device (ui.js shows them and keeps which have been seen). Kept apart
// from the screens so the narrator's every word can be read in one place
// (tools/narrative.mjs, docs/NARRATIVE.md). A few say which way to step, and
// for that borrow two of the view's own helpers.

/**
 * @param {{asideWay: (widest?: boolean) => string, canStep: (turn: number) => boolean}} h
 * @returns {Record<string, string | ((widest?: boolean) => string)>}
 */
export function makeTips({ asideWay, canStep }) {
  return {
    // the first press of a controller in the dungeon: what each part of it does
    pad: 'A controller: the stick or d-pad steps and turns, <b>LB</b>/<b>RB</b> step aside, <b>A</b> attacks, <b>X</b> uses, <b>Y</b> casts, <b>B</b> takes what is underfoot, <b>LT</b> drinks. <b>View</b> reaches the bottom row; <b>Menu</b> pauses.',
    controls: 'Move with the arrows, or swipe the view. <b>⚔ Attack</b> strikes what is in front of you; <b>✋ Use</b> does whatever it says.',
    // the first fight is walked through a step at a time: face it, strike it,
    // step back from its blow (with time slowed while that is learnt)
    face: 'Something is coming, and not from in front. <b>Turn to face it</b>: the red chevron at the edge of the view points the way.',
    monster: 'Something is coming. When it is in front of you, tap <b>⚔ Attack</b> to strike it.',
    dodge: '<b>A warning mark!</b> Its blow is coming: <b>step back ↓</b> now and it hits empty air.',
    dodgeside: (/** @type {boolean} */ widest) => `<b>A warning mark!</b> Its blow is coming, and there is a wall behind you: <b>step aside</b> ${asideWay(widest)} now and it hits empty air.`,
    dodgelunge: (/** @type {boolean} */ widest) => `<b>A warning mark!</b> Its blow is coming, and this one lunges after a step back: <b>step aside</b> ${asideWay(widest)} now and it hits empty air.`,
    dodgelungeflank: (/** @type {boolean} */ widest) => `<b>A warning mark!</b> Its blow is coming from your side, and this one lunges after a step away: step <b>${widest || (canStep(0) && canStep(2)) ? 'forward or back</b> (↑ or ↓)' : canStep(0) ? 'forward</b> (↑)' : 'back</b> (↓)'}, out of its line, and it hits empty air.`,
    lunged: 'It <b>lunged after you</b>: a rat, a ghoul or a wraith follows a step straight away from it. Step <b>out of its line</b> instead, to the side of it, and it hits empty air.',
    dodged: 'It hit empty air. <b>Step in</b> and strike before it draws back again. Every mark is a blow coming, and each foe has its own answer: the Bestiary keeps them.',
    // (the first arrow: a step back from an archer is a step along its line, the one answer the coached fight did not teach)
    shot: '<b>An arrow is drawn</b> from down the line. Step <b>aside, out of its line</b>, or close in and strike: stepping back only keeps you in it.',
    late: 'Too slow: that one landed. Step back <b>the moment</b> a warning mark appears, and the blow misses.',
    trick: 'A <b>violet spiked mark</b> means a trick <b>armour will not turn</b>: get out of the way. The log says what is coming, and the <b>Bestiary</b> (Journal) records each trick.',
    gaze: 'Its eyes blaze: <b>turn away!</b> A basilisk\'s gaze turns to stone only whoever is looking at it.',
    dazzle: 'Its wings are beginning to shine: <b>turn away!</b> The flare dazzles only whoever is looking at it, and a dazzled hero\'s blows go wide a while.',
    fetch: 'A <b>lookout</b> is running for help: when it reaches the others it <b>whistles them awake</b>. Bring it down <b>before it gets there</b>: an arrow, a snare, a spell, or a quick chase.',
    hex: 'It is chanting a <b>hex</b>: <b>strike it</b> to break the chant, or <b>get out of its sight</b> before it ends. On a caster the hex binds the tongue (no spells); on anyone else it slows steps and blows.',
    snatch: 'Its hand darts for your <b>purse</b>: <b>step back</b>, and it closes on air. Robbed, bring it down <b>before it gets away</b>, and it drops your gold.',
    pike: 'It levels its pike down its line. <b>Close in</b> under the point, or <b>step out of its line</b>: the pike reaches two squares, so a step back only keeps you on it.',
    rust: 'It means to bite your armour. <b>Step back!</b> A rustmaw\'s bite rusts metal for good, though a trader\'s forge can mend it.',
    claw: 'A numbing claw reaches for you. <b>Step back</b> out of reach, or <b>strike</b>: a blow that lands knocks the claw aside.',
    crush: 'It heaves up a crushing blow, too heavy for armour. <b>Step back</b> and it smashes the floor, wide open.',
    webspit: 'It rears back to spit a web. <b>Step out of its line</b>, to one side.',
    charge: 'It lowers its head to charge down the line. <b>Step aside</b>, or pull a <b>door</b> shut across its path: it slams into the door, wide open.',
    horn: 'He means to sound a horn and call his kin. <b>Strike him</b> before he does: any wound cuts the call short.',
    blink: 'It has stepped back into the world <b>at your back</b>. <b>Turn round</b> to face it before it bites, and it is caught open.',
    guard: 'Its blades are crossed in a guard. <b>Hold your blow</b>: strike into it and it answers with a cut. Wait, and the guard falls open.',
    sweep: 'Its tail is coiled to <b>sweep your legs</b>. <b>Step back</b> out of its reach: the tail lashes empty air and leaves it wide open. Stay, and it may knock you flat.',
    swell: 'It mutters a working and begins to <b>swell</b>. <b>Strike it</b> now: any wound breaks the working. Grown, it hits half as hard again until it shrinks: give it room.',
    aimed: 'It is taking <b>careful aim</b> down its line. <b>Step out of its line</b>, to one side, before it looses: the bolt hits twice as hard.',
    quills: 'Its quills are up. <b>Hold your blow</b> until they sink: every blow struck into them bites you back. An arrow or a spell from further off is safe.',
    drowned: 'A <b>drowned one</b> has risen out of the water to seize you. <b>Step back</b> as it lurches and it grabs the air. Watch the black water for a <b>ripple</b> that does not settle: one lies under it.',
    vents: 'A <b>glowing crack</b> is heating up: when it flares, fire sheets over it and the <b>four squares beside it</b>. Step clear of the glow. <b>Cold</b> seals a crack a while.',
    stamp: 'The <b>Heartforged</b> has its hammer up: when it comes down, fire runs out along the floor down <b>all four of its lines</b>. <b>Step off its lines</b>, to where it would have to turn to face you, and it is left open.',
    flare: 'An <b>emberling</b> is blazing white-hot: it is about to <b>flare</b> and set the stones round it alight. <b>Step two squares off</b>, or strike it with <b>cold</b> to quench it.',
    tremors: 'The ground is shuddering: <b>rock is coming down</b> where the floor is ringed with grit, <b>your square too</b>. Step onto one that is not marked. It falls on your foes as well, and they never look up.',
    mimic: 'A barrel that <b>creaks</b> with nothing near is a <b>mimic</b>. <b>Strike it from where you stand</b>: caught shut, it takes the blow twice over. Touch it, or stand beside it, and it seizes you.',
    eyeless: 'An <b>eyeless stalker</b>: it hunts by sound. <b>Stand still</b> and it loses you (turning on the spot makes no sound). Every step, blow or spell tells it where you are.',
    fire: '<b>Fire!</b> It spreads over moss and spilt oil and burns whatever stands in it, <b>you too</b>: step out of it. It burns out, and leaves ash that will not burn again.',
    cask: 'An <b>oil cask</b>: the barrel painted red with a flame. Break it and lamp oil spills round it; a fire spell landing on it, or a flaming blow or arrow striking something on it, sets the oil alight.',
    water: 'Standing water carries <b>lightning</b> to everything in it within two squares (you too, if you are wading close), and <b>cold</b> freezes it, holding fast whatever stands there.',
    spores: 'A <b>puffcap</b>. Strike it from beside it and it bursts in <b>spores</b> that poison. <b>Shoot it</b> or cast at it from further off, or put <b>fire</b> on your blade first: fire oil sears the spores.',
    snare: 'A <b>kobold</b> is setting a wire <b>snare</b> on the square before you. It is seen where it <b>glints</b>: go round it, or stand before it and press <b>Use</b> to spring it safely. Its snares go slack when it dies.',
    firepot: 'A <b>lit pot of oil</b>. <b>Step aside</b>, out of its line: it bursts in flames where you stood and on the square behind, and burns there a while.',
    chill: 'A <b>grave-cold</b> creeping over the stones at your feet. <b>Step aside</b>, out of its line: stay and you are frozen fast a moment.',
    storm: 'Lightning called down into the <b>water</b> you stand in. <b>Get out of the water</b>; on a flooded floor, <b>step aside</b>: the water beside you still carries half of it, but no more.',
    firearrow: 'A <b>burning arrow</b>, aimed at your feet: what you stand on will burn. <b>Step aside</b>, then keep clear as the flames spread.',
    breath: 'Fire kindles in its throat. <b>Step in close</b>, under its jaws, or <b>out of its line</b>. Stepping back keeps you in the fire.',
    drink: 'Her cold hand reaches in to drink your life. <b>Step back!</b> What she takes from your maximum hit points is gone for good.',
    web: 'You are caught in a web. <b>Fire burns it away</b>: cast a fire spell to be free at once, or push against it to tear free.',
    webtear: 'You are caught in a web. <b>Push against it</b>: tap any arrow, again and again, to tear free.',
    opening: '<b>An opening!</b> You answered its trick: your next blow at it cannot miss and lands hard. Strike now.',
    take: 'Something lies here. Tap <b>✋ Take</b> to pick it up.',
    stairs: 'Stairs down. Tap <b>Descend</b> when you are ready. The Heart waits at the bottom.',
    examine: 'Something to deal with. Tap <b>Examine</b>: every choice shows its odds before you commit.',
    trade: 'A trader. Tap <b>Trade</b> to buy, sell, and use the forge: it sharpens a weapon or strengthens armour, and mends rust.',
    unknown: 'A <b>?</b> in your pack means you do not know how good that gear is. <b>Study</b> it, or have a trader appraise it: cursed gear will not come off once worn.',
    quickscroll: 'A scroll worth reading <b>now</b>, or an oil for a bare blade as a fight starts, waits at the left end of the log, under the view: <b>one tap</b> uses it.',
    hurt: 'You are badly hurt. Tap the <b>bottle</b> beside your life bar to drink a healing potion, or <b>Rest</b> when nothing is near.',
    shade: 'A <b>shade</b>: one of your own heroes, risen where they fell, and it fights as they did. Lay it to rest and what they wore is yours.',
    drum: 'He raises his drumstick to call his warband. <b>Strike him</b> before the beat and the call dies.',
    throne: 'He sits his <b>throne</b>: his shield-bearers turn every blow meant for him. <b>Cut them down</b> and he must come down, or throw a <b>spell</b> over their heads.',
    oil: 'An <b>oil</b> in your pack. Open the pack and choose <b>Coat weapon</b>, or tap the flask at the left end of the log as a fight starts: it rides on your next 20 blows that land.',
    job: 'The trader\'s <b>job</b> is on this floor: the line under your bars shows how it goes. Leave the floor with it undone and it is lost; the next trader you meet pays for it done.',
    blooded: 'Your companion has learned a <b>trick</b>. It grows with every new floor it comes down at your side; the <b>Hero</b> sheet says what it knows and what comes next.',
    bear: 'You are a <b>bear</b>: claws for your blows, and a <b>hide</b> that takes blows before you do (its time and thickness are on the status line). Any <b>other spell</b> lets the bear go.',
    mastered: 'You have <b>mastered your path</b>. Your capstone is listed under Path on the <b>Hero</b> sheet, with what it does.',
    dice: 'Every blow is a roll of the dice. To see the numbers behind each one in the log, turn on <b>Combat rolls</b> in the <b>Menu</b>.',
  };
}
