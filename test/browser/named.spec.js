'use strict';
// Named champions: a Goblin King beside the hero wakes, says so, and carries
// his name and life along the top of the view, the way the lich does.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster, killMonster, descendTo } = require('./helpers');

/** How many pixels of the named champion's gold bar show along the top of the view. */
const goldAtTop = () => {
  const c = document.getElementById('view'), d = c.getContext('2d').getImageData(8, 16, Math.round(c.width * 0.6), 5).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] > 120 && d[i + 1] < 190 && d[i + 2] < 90) n++;
  return n;
};

test.describe('named champions', () => {
  test('a named champion beside the hero shows its name and life along the top of the view', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'named-bar' });
    await clearBoons(page);
    await faceOpenGround(page, 2);
    await page.evaluate(() => { const p = Game.player(); p.maxHp = 999; p.hp = 999; Game.level().monsters.length = 0; });
    await page.waitForTimeout(200);
    expect(await page.evaluate(goldAtTop), 'no bar before the champion is there').toBe(0);
    // hurt, so the bar shows a part of it gone; still, so it strikes nothing while we look
    const placed = await placeMonster(page, 'grisk', 1, { hp: 30, maxHp: 50, nextAct: 1e12 });
    expect(placed, 'room in front of the hero for him').not.toBeNull();
    await expect(page.locator('#log')).toContainText('Who comes before Grisk', { timeout: 3000 });
    const bar = await page.evaluate(() => Game.renderState(performance.now()).fx.boss);
    expect(bar.name).toBe('Grisk, the Goblin King');
    expect(bar.named).toBe(true);
    expect([bar.hp, bar.maxHp]).toEqual([30, 50]);
    await page.waitForTimeout(300);
    // drawn: a gold bar about three fifths full across the top of the view
    const gold = await page.evaluate(goldAtTop);
    const full = await page.evaluate(() => Math.round(document.getElementById('view').width * 0.6) * 5);
    expect(gold, 'the gold bar along the top').toBeGreaterThan(full * 0.4);
    expect(gold, 'the bar shows the life he has lost').toBeLessThan(full * 0.8);
    // the status chips make way for it: they sit below the bar, not on its name
    await page.evaluate(() => { Game.player().riposteUntil = Game.state().t + 1e9; });
    await page.waitForTimeout(300);
    const lanes = await page.evaluate(() => {
      const v = document.getElementById('view').getBoundingClientRect(), s = document.getElementById('hud-status').getBoundingClientRect();
      return { chipsTop: s.top - v.top, barBottom: 24 / Renderer.H * v.height, chips: document.getElementById('hud-status').children.length };
    });
    expect(lanes.chips, 'a chip to show').toBeGreaterThan(0);
    expect(lanes.chipsTop, 'the chips below the bar').toBeGreaterThanOrEqual(lanes.barBottom);
    // and it goes when he does
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    await page.waitForTimeout(300);
    expect(await page.evaluate(goldAtTop), 'the bar outlived him').toBe(0);
    expect(errors).toEqual([]);
  });
  test('an earlier hero\'s shade waits over their bones: told of on arrival, named along the top of the view, and laid to rest', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('deepdelve.tipsOff', '1');
      localStorage.setItem('deepdelve.fallen', JSON.stringify({ name: 'Wren', cls: 'mage', level: 4, depth: 2, run: 'an earlier run', killer: 'an orc', gear: [{ t: 'staff', q: 1, e: 1 }] }));
    });
    await startGame(page, { seed: 'shade-look' });
    await clearBoons(page);
    expect(await descendTo(page, 2)).toBe(2);
    await expect(page.locator('#log')).toContainText('Wren the Mage fell on this floor, to an orc,', { timeout: 3000 });
    const found = await page.evaluate(() => {
      const sh = Game.level().monsters.find(m => m.shade);
      return sh ? { uid: sh.uid, pile: (Game.level().items[sh.x + ',' + sh.y] || []).map(it => it.t) } : null;
    });
    expect(found, 'the shade keeps the floor').not.toBeNull();
    expect(found.pile).toEqual(['staff']);
    // two squares in front of the hero and awake, so it speaks; still, so it throws nothing while we look
    await faceOpenGround(page, 2);
    await page.evaluate(uid => {
      const L = Game.level(), p = Game.player(), [dx, dy] = Dungeon.DIRS[p.dir];
      p.maxHp = p.hp = 999;
      const sh = L.monsters.find(m => m.uid === uid);
      L.monsters = [sh];
      Object.assign(sh, { x: p.x + dx * 2, y: p.y + dy * 2, rx: p.x + dx * 2, ry: p.y + dy * 2, fromX: p.x + dx * 2, fromY: p.y + dy * 2, awake: true, nextAct: 1e12 });
    }, found.uid);
    // (the live log gives way to the bestiary's note straight after, so read the log itself)
    await page.waitForFunction(() => Game.state().log.some(e => /The Shade of Wren rises from its bones/.test(e.m)), null, { timeout: 3000 });
    const bar = await page.evaluate(() => Game.renderState(performance.now()).fx.boss);
    expect(bar && bar.name).toBe('Shade of Wren the Mage');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => Renderer.shown.filter(c => c.dist < 2.5).length), 'the shade is drawn in the view').toBe(1);
    // one blow from gone, beside the hero
    await page.evaluate(uid => {
      const L = Game.level(), p = Game.player(), [dx, dy] = Dungeon.DIRS[p.dir];
      Object.assign(L.monsters.find(m => m.uid === uid), { x: p.x + dx, y: p.y + dy, rx: p.x + dx, ry: p.y + dy, fromX: p.x + dx, fromY: p.y + dy, hp: 1 });
    }, found.uid);
    expect(await killMonster(page, found.uid)).toBe(true);
    await page.waitForFunction(() => Game.state().log.some(e => /Wren the Mage is laid to rest at last/.test(e.m)), null, { timeout: 3000 });
    expect(await page.evaluate(() => localStorage.getItem('deepdelve.fallen')), 'forgotten once laid to rest').toBeNull();
    expect(errors).toEqual([]);
  });
});
