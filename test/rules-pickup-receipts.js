// Receipts observe floor transfers without changing their ordinary rules.
module.exports = async function receiptChecks(h) {
  const { start, test } = h;
  const receipts = Game => Game.takeEvents().filter(e => e.startsWith('loot:')).map(e => JSON.parse(e.slice(5)));
  await test('pickup receipts count actual partial stacks and exclude things put down', async () => {
    const { Game } = await start('fighter', 'pickup-receipt');
    const p = Game.player(), L = Game.level(), key = p.x + ',' + p.y;
    p.inv = [{ t: 'potion_heal', q: 4, e: 0 }];
    const stack = { t: 'potion_heal', q: 3, e: 0 }; L.items[key] = [stack]; Game.takeEvents();
    Game.takeItem(stack);
    const first = receipts(Game);
    if (p.inv[0].q !== 5 || stack.q !== 2 || first.length !== 1 || first[0].q !== 1) return 'partial stack receipt differs from transfer';
    Game.takeItem(stack);
    if (receipts(Game).length) return 'full belt produced a receipt';
    Game.dropItem(p.inv[0]); Game.takeItem(L.items[key].find(it => it.left));
    if (receipts(Game).length) return 'taking a dropped item counted as a find';
    return true;
  });
  await test('pickup receipts exclude full packs, direct gifts and guarded treasure', async () => {
    const { Game } = await start('fighter', 'pickup-blocked');
    const p = Game.player(), L = Game.level(), key = p.x + ',' + p.y;
    p.inv = Array.from({ length: Game.INV_MAX }, () => ({ t: 'dagger', q: 1, e: 0 }));
    const it = { t: 'club', q: 1, e: 0 }; L.items[key] = [it]; Game.takeEvents(); Game.takeItem(it);
    if (receipts(Game).length || !L.items[key].includes(it)) return 'full pack receipt';
    p.inv = []; Game.giveItem({ t: 'ration', q: 1, e: 0 });
    if (receipts(Game).length) return 'a gift counted as a floor pickup';
    Game.state().opts.puzzles = true;
    L.puzzle = { x: p.x, y: p.y, solved: false, reward: 'pending' };
    const guarded = { t: 'gold', q: 40, puzzle: true }; L.items[key] = [guarded];
    Game.takeItem(guarded);
    if (receipts(Game).length || !L.items[key].includes(guarded)) return 'guarded treasure produced a receipt';
    return true;
  });
  await test('pickup receipts report actual gold and gems once without changing the purse', async () => {
    const { Game } = await start('thief', 'pickup-gold');
    Game.player().path = 'trickster';
    const p = Game.player(), L = Game.level(), key = p.x + ',' + p.y, gold = p.gold;
    const a = { t: 'gold', q: 27 }, b = { t: 'gem', name: 'opal', q: 19 };
    L.items[key] = [a, b]; Game.takeEvents(); Game.takeItem(a); Game.takeItem(b); Game.takeItem(a);
    const rows = receipts(Game);
    return p.gold === gold + 58 && rows.length === 2 && rows.every(r => r.t === 'gold') && rows.reduce((n, r) => n + r.q, 0) === 58;
  });
  await test('pickup receipts keep differently coloured keys separate', async () => {
    const { Game } = await start('fighter', 'pickup-keys');
    const p = Game.player(), L = Game.level(), key = p.x + ',' + p.y;
    const red = { t: 'key', color: 'red', q: 1 }, blue = { t: 'key', color: 'blue', q: 1 };
    L.items[key] = [red, blue]; Game.takeEvents(); Game.takeItem(red); Game.takeItem(blue);
    const rows = receipts(Game);
    return rows.length === 2 && rows[0].key !== rows[1].key && rows[0].label === 'Red Key' && rows[1].label === 'Blue Key';
  });
};
