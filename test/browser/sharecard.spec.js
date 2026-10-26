'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, watchForErrors, placeMonster, artReady, descendTo, clearBoons } = require('./helpers');
const fs = require('node:fs');

async function prepare(page) {
  await page.addInitScript(() => {
    for (const [k, v] of Object.entries({ firstSeen: '1', sound: 'off', prelude: 'off', tipsOff: '1', calm: '1' })) localStorage.setItem('deepdelve.' + k, v);
    window.__cardWords = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { window.__cardWords.push(String(text)); return fill.call(this, text, ...args); };
  });
}

async function chooseEnding(page, ending, companion = 'hound') {
  await page.evaluate(companion => {
    const G = Game.state(), p = Game.player(), L = Game.level(); L.monsters.length = 0;
    G.threads.smithway = true; p.inv.push({ t: 'quench', q: 1 });
    G.companion = { kind: companion, name: 'Pip', x: p.x, y: p.y, depth: G.depth, hp: 20, maxHp: 20, mode: 'stay', nextAct: G.t + 1e9, kills: 0, joined: 1 };
    const existing = Object.entries(L.items).find(([, items]) => items.some(i => i.t === 'artifact'));
    if (existing) { [p.x, p.y] = existing[0].split(',').map(Number); G.companion.x = p.x; G.companion.y = p.y; Game.takeItem(existing[1].find(i => i.t === 'artifact')); }
    else { const key = p.x + ',' + p.y, item = { t: 'artifact', q: 1 }; (L.items[key] ||= []).push(item); Game.takeItem(item); }
  }, companion);
  await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
  await page.waitForTimeout(700);
  await page.locator('.enc-choice').nth({ take: 2, quench: 0, keep: 1 }[ending]).click();
  await expect(page.locator('#screen-end')).toBeVisible();
}

async function exportCard(page, testInfo, name) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#end-card')]);
  await download.saveAs(testInfo.outputPath(name + '.png'));
  const png = fs.readFileSync(await download.path());
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([800, 420]);
  return png.toString('base64');
}

async function exactCard(page, base64, won) {
  return page.evaluate(async ({ base64, won }) => {
    const { makeEndScreen } = await import('/js/endscreen.js');
    const { drawShareCard } = await import('/js/sharecard.js');
    const info = makeEndScreen({}).cardInfo(won); await info.prepareArt();
    const expected = drawShareCard(info).getContext('2d').getImageData(0, 0, 800, 420).data;
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 420;
    const g = canvas.getContext('2d'); g.drawImage(image, 0, 0);
    return g.getImageData(0, 0, 800, 420).data.every((v, i) => v === expected[i]);
  }, { base64, won });
}

const keepers = [
  { id: 'lich', name: 'Dread Lich', levels: '4', seed: 'end-won' },
  { id: 'warlord', name: 'Goblin Warlord', levels: '8', seed: 'end-warlord' },
  { id: 'heartforged', name: 'Heartforged', levels: '12', seed: 'end-forge' },
];
const companions = ['hound', 'wolf', 'goblin', 'sellsword', 'mender', 'renegade'];
for (const [n, keeper] of keepers.entries()) for (const [i, ending] of ['take', 'quench', 'keep'].entries()) {
  test(`${keeper.id} ${ending}: native ending exports its actual keeper, symbol and painted companion`, { tag: '@mobile' }, async ({ page }, testInfo) => {
    const errors = watchForErrors(page); await prepare(page);
    await startGame(page, { seed: keeper.seed, levels: keeper.levels, name: 'Mira' });
    await page.evaluate(() => { Game.player().maxHp = 900; Game.player().hp = 900; });
    expect(await descendTo(page, Number(keeper.levels))).toBe(Number(keeper.levels));
    await clearBoons(page);
    expect(await page.evaluate(() => Dungeon.keeperOf(Game.state().opts.levels, Game.state().route))).toBe(keeper.id);
    expect(await page.evaluate(() => Game.level().monsters.filter(m => MONSTERS[m.id].boss).map(m => m.id))).toEqual([keeper.id]);
    const companion = companions[(n * 3 + i) % companions.length];
    await chooseEnding(page, ending, companion);
    const before = await page.evaluate(() => JSON.stringify({ player: Game.player(), opts: Game.state().opts, ending: Game.state().ending, stats: Game.runStats() }));
    const png = await exportCard(page, testInfo, `${keeper.id}-${ending}`);
    expect(await exactCard(page, png, true)).toBe(true);
    const info = await page.evaluate(async ({ ending, companion }) => {
      const { makeEndScreen } = await import('/js/endscreen.js');
      const { paintedCreature } = await import('/js/paintedcreatures.js');
      const { COMPANIONS } = await import('/js/companionbook.js');
      const screen = makeEndScreen({}), info = screen.cardInfo(true); await info.prepareArt();
      const key = { take: 'artifact', quench: 'quench', keep: 'heart_dais' }[ending];
      return { killer: info.killer, outcome: info.outcome, line: screen.runShareLine(true),
        symbol: info.art === Assets.sprites[key].levels[0], paintedSymbol: info.art.width === 256,
        ownCompanion: info.hound.art === paintedCreature(Assets.sprites[COMPANIONS[companion].sprite]).levels[0],
        paintedCompanion: info.hound.art.width === 256, words: window.__cardWords };
    }, { ending, companion });
    expect(info.killer).toBe(`and brought down the ${keeper.name}`);
    expect(info.symbol && info.paintedSymbol && info.ownCompanion && info.paintedCompanion).toBe(true);
    const outcome = { take: 'Claimed the Heart', quench: 'Quenched the Heart', keep: 'Stayed to keep the Heart' }[ending];
    expect(info.outcome).toBe(outcome); expect(info.line).toContain(outcome.charAt(0).toLowerCase() + outcome.slice(1));
    expect(info.words).toContain(info.killer); expect(info.words).toContain(outcome);
    expect(await page.evaluate(() => JSON.stringify({ player: Game.player(), opts: Game.state().opts, ending: Game.state().ending, stats: Game.runStats() }))).toBe(before);
    if (keeper.id === 'lich' && ending === 'take') expect(await page.evaluate(async () => {
      const { makeEndScreen } = await import('/js/endscreen.js'), screen = makeEndScreen({}), G = Game.state(), previous = G.ending;
      G.ending = 'toString'; const info = screen.cardInfo(true), line = screen.runShareLine(true); G.ending = previous;
      return [info.ending, info.outcome, line.includes('claimed the Heart')];
    })).toEqual(['take', 'Claimed the Heart', true]);
    // A companion elsewhere, fallen, or with an unknown imported kind is never drawn.
    expect(await page.evaluate(async () => {
      const { makeEndScreen } = await import('/js/endscreen.js'); const c = Game.state().companion, screen = makeEndScreen({});
      c.depth--; const away = screen.cardInfo(true).hound; c.depth++; c.fallen = true;
      const fallen = screen.cardInfo(true).hound; delete c.fallen; c.kind = 'toString';
      return [away, fallen, screen.cardInfo(true).hound];
    })).toEqual([null, null, null]);
    expect(errors).toEqual([]);
  });
}

for (const id of ['ogre', 'grisk', 'skarrow', 'shade']) {
  test(`${id}: death exports the painted killer while its companion is named only`, { tag: '@mobile' }, async ({ page }, testInfo) => {
    const errors = watchForErrors(page); await prepare(page);
    await startGame(page, { seed: 'card-killer-' + id });
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    expect(await placeMonster(page, id, 1, { nextAct: 1e12 })).not.toBeNull();
    await page.evaluate(id => {
      const G = Game.state(), L = Game.level(), p = Game.player(), m = L.monsters.find(m => m.id === id);
      if (id === 'shade') { m.shade = { cls: 'mage', name: 'Edda', level: 1 }; L.bones = { cls: 'mage', name: 'Edda', x: m.x, y: m.y }; }
      G.companion = { kind: 'mender', name: 'Pip', x: p.x, y: p.y, depth: G.depth, hp: 20, maxHp: 20, mode: 'stay', nextAct: 1e12, kills: 0, joined: 1 };
      Game.hurtPlayer(99999, 'the share-card test', m);
    }, id);
    await expect(page.locator('#screen-end')).toBeVisible();
    const png = await exportCard(page, testInfo, `killer-${id}`);
    expect(await exactCard(page, png, false)).toBe(true);
    expect(await page.evaluate(async id => {
      const { makeEndScreen } = await import('/js/endscreen.js');
      const { paintedCreature } = await import('/js/paintedcreatures.js');
      const info = makeEndScreen({}).cardInfo(false); await info.prepareArt();
      const base = Assets.sprites[MONSTERS[id].sprite], own = id === 'shade' ? base.elite.shade_mage : MONSTERS[id].named ? base.elite[id] : base;
      return { own: info.art === paintedCreature(own).levels[0], painted: info.art.width === 256, companion: info.hound.art, name: info.hound.name };
    }, id)).toEqual({ own: true, painted: true, companion: null, name: 'Pip' });
    expect(errors).toEqual([]);
  });
}

for (const failure of ['corrupt', 'stalled']) {
  test(`${failure} killer art keeps sharing usable and independent`, async ({ page }, testInfo) => {
    const errors = watchForErrors(page); await prepare(page);
    let release; const pending = new Promise(resolve => { release = resolve; });
    await page.route('**/img/creatures/ogre.webp', async route => {
      if (failure === 'stalled') { await pending; await route.continue(); }
      else await route.fulfill({ status: 200, contentType: 'image/webp', body: 'invalid image' });
    });
    await startGame(page, { seed: 'card-load-' + failure });
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    await placeMonster(page, 'ogre', 1, { nextAct: 1e12 });
    await page.evaluate(() => Game.hurtPlayer(99999, 'the card loading test', Game.level().monsters.find(m => m.id === 'ogre')));
    await expect(page.locator('#screen-end')).toBeVisible();
    const png = await exportCard(page, testInfo, failure);
    expect(await page.evaluate(async () => {
      const { makeEndScreen } = await import('/js/endscreen.js');
      return makeEndScreen({}).cardInfo(false).art === Assets.sprites.ogre.levels[0];
    })).toBe(true);
    if (failure === 'stalled') {
      release();
      await expect.poll(() => page.evaluate(async () => {
        const { paintedCreature } = await import('/js/paintedcreatures.js');
        return paintedCreature(Assets.sprites.ogre) !== Assets.sprites.ogre;
      })).toBe(true);
      expect(await exportCard(page, testInfo, 'late-upgrade')).not.toBe(png);
    }
    expect(await page.evaluate(async () => {
      const { paintedCreature, paintedCreatureSettled } = await import('/js/paintedcreatures.js');
      const own = Assets.sprites.wolf;
      for (let n = 0; n < 100; n++) { paintedCreature(own); if (paintedCreatureSettled(own)) return paintedCreature(own) !== own; await new Promise(r => setTimeout(r, 25)); }
      return false;
    })).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('installed offline ending exports its painted dais and companion without network access', async ({ page, context }, testInfo) => {
  const errors = watchForErrors(page); await prepare(page);
  await startGame(page, { seed: 'card-offline' });
  await page.evaluate(() => { Game.level().monsters.length = 0; Game.save(true); });
  await artReady(page);
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30000 }).toBe(true);
  await context.setOffline(true); await page.reload(); await page.click('#btn-continue');
  await expect(page.locator('#screen-game')).toBeVisible();
  await chooseEnding(page, 'keep', 'mender');
  const png = await exportCard(page, testInfo, 'offline-keep');
  expect(await exactCard(page, png, true)).toBe(true);
  expect(await page.evaluate(async () => {
    const { makeEndScreen } = await import('/js/endscreen.js'); const info = makeEndScreen({}).cardInfo(true); await info.prepareArt();
    return [info.art.width, info.hound.art.width];
  })).toEqual([256, 256]);
  expect(errors).toEqual([]);
});

test('corrupt Heart paintings retain the new core fallbacks and independent quench art', async ({ page }, testInfo) => {
  const errors = watchForErrors(page); await prepare(page);
  await page.route('**/img/world/artifact.png', r => r.fulfill({ status: 200, contentType: 'image/png', body: 'invalid image' }));
  await page.route('**/img/world/heart_dais.webp', r => r.fulfill({ status: 200, contentType: 'image/webp', body: 'invalid image' }));
  await startGame(page, { seed: 'heart-fallback' });
  await chooseEnding(page, 'take');
  const png = await exportCard(page, testInfo, 'heart-fallback');
  expect(await exactCard(page, png, true)).toBe(true);
  expect(await page.evaluate(async () => {
    const { paintedWorldState } = await import('/js/paintedworld.js');
    const { makeEndScreen } = await import('/js/endscreen.js');
    const G = Game.state(), screen = makeEndScreen({}); G.ending = 'quench';
    const info = screen.cardInfo(true); await info.prepareArt();
    const state = paintedWorldState();
    return { core: state['img/world/artifact.png'], dais: state['img/world/heart_dais.webp'],
      fallback: Assets.sprites.artifact.url.startsWith('data:image/png'), quench: info.art.width };
  })).toEqual({ core: 'failed', dais: 'failed', fallback: true, quench: 256 });
  expect(errors).toEqual([]);
});
