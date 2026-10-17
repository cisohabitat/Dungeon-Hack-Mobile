// The old caches speak through four marks. Their clues are kept with the
// story's tables; a seed changes the marks' order, never what a clue means.
export const PUZZLE_MARKS = ['Ash', 'Bell', 'Crown', 'Wave'];
export const PUZZLE_KINDS = ['runes', 'torches', 'seals'];
export const PUZZLE_WORDS = {
  runes: { title: 'The four runes', text: 'Four marks are cut into the lid. Press them in the order of the inscription.', clue: 'The carving reads, from first to last:' },
  torches: { title: 'The watchfires', text: 'Four small braziers guard the catch. Light those named in the inscription and leave the others dark.', clue: 'Only these watchfires must burn:' },
  seals: { title: 'The keeper\'s seal', text: 'One of four seals releases the catch. The inscriptions tell the truth.', clue: 'The keeper wears neither {a} nor {b}. The {c} seal belongs to a false keeper.' },
  found: 'An old cache rests here. Use examines its catch; you may leave it and return.',
  solved: 'The catch releases. The cache is open.',
  rewards: 'Choose one share of the cache. A draught or piece of gear replaces some of its coins; any coins left come with it. Take the treasure from the floor when you are ready.',
  chosen: 'Your share waits in the open cache. Step onto it or Take to collect it.',
  gold: 'Keep the gold and gems',
  potion: 'Potion of Healing',
  gear: 'Unidentified gear',
  unknown: 'Its make is hidden until worn, studied or appraised.',
  wrong: 'The catch holds. Read the inscription and try again; nothing is lost.',
  reset: 'The marks are cleared. Try again.',
  hint: 'There is no time limit or penalty. The dungeon waits while you read. Leave for later to return to the same cache.',
};
