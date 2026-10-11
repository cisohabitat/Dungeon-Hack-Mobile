'use strict';
// Play by controller (pad.js): from the title into the dungeon and about it,
// every overlay steered by the ring, and a choice that must be made kept open.
const { test } = require('@playwright/test');
const { watchForErrors, usePad, padPress, padStick, startGame, clearBoons, faceOpenGround, expect } = require('./helpers');

/** The quiet start the other specs have: no tips, no first-time card. */
async function quietStart(page) {
  await page.addInitScript(() => {
    if (localStorage.getItem('deepdelve.tipsOff') === null) localStorage.setItem('deepdelve.tipsOff', '1');
    if (localStorage.getItem('deepdelve.firstSeen') === null) localStorage.setItem('deepdelve.firstSeen', '1');
  });
}
const ringed = page => page.evaluate(() => (document.activeElement && (document.activeElement.id || document.activeElement.textContent.trim().slice(0, 30))) || '');

test.describe('controller', () => {
  test('a controller alone starts a run from the title, plays it, and reaches the bar, the pack, the log and the Menu', async ({ page }) => {
    const errors = watchForErrors(page);
    await quietStart(page);
    await usePad(page);
    await page.goto('/');
    // the first press rings the button the screen is mostly for; A presses it
    await padPress(page, 'A');
    await expect.poll(() => ringed(page)).toBe('btn-new');
    await expect(page.locator('body')).toHaveClass(/\bpad\b/);
    await padPress(page, 'A');
    await expect(page.locator('#screen-create')).toBeVisible();
    // on the new hero's page the ring is on Descend already
    await expect.poll(() => ringed(page)).toBe('c-begin');
    // and moves up the page from it, to something else
    await padStick(page, 0, -1);
    await expect.poll(() => ringed(page)).not.toBe('c-begin');
    // down goes on down the page (the pinned foot is its end), and the ring finds its way back to Descend
    await ringTo(page, '#c-begin');
    await padPress(page, 'A');
    await expect(page.locator('#screen-prologue')).toBeVisible();
    await expect.poll(() => ringed(page)).toBe('pro-begin');
    await padPress(page, 'A');
    await expect(page.locator('#screen-game')).toBeVisible();
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state() && !Game.preludeOn());

    // in the dungeon: the d-pad turns, the stick steps, A swings
    const dir0 = await page.evaluate(() => Game.player().dir);
    await padPress(page, 'RIGHT');
    await expect.poll(() => page.evaluate(() => Game.player().dir)).toBe((dir0 + 1) % 4);
    await padPress(page, 'LEFT');
    await expect.poll(() => page.evaluate(() => Game.player().dir)).toBe(dir0);
    const swung = await page.evaluate(() => Game.player().nextAttack || 0);
    await padPress(page, 'A');
    await expect.poll(() => page.evaluate(() => Game.player().nextAttack || 0)).toBeGreaterThan(swung);

    // View puts the ring on the buttons along the bottom; across to the Pack, and A opens it
    await padPress(page, 'VIEW');
    await expect.poll(() => ringed(page)).toBe('Map');
    await padPress(page, 'RIGHT');
    await expect.poll(() => ringed(page)).toBe('Pack');
    await padPress(page, 'A');
    await expect(page.locator('#ov-inv')).toHaveClass(/open/);
    // the ring comes into the pack with it, and B closes it
    await expect.poll(() => page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('#ov-inv'))).toBe(true);
    await padPress(page, 'B');
    await expect(page.locator('#ov-inv')).not.toHaveClass(/open/);
    // back in the dungeon, A swings again rather than pressing a button
    await expect.poll(() => page.evaluate(() => Game.player().nextAttack || 0)).toBeGreaterThan(0);
    // the left stick's click opens the log; Menu the Menu; B shuts each
    await padPress(page, 'LS');
    await expect(page.locator('#ov-log')).toHaveClass(/open/);
    await padPress(page, 'B');
    await expect(page.locator('#ov-log')).not.toHaveClass(/open/);
    await padPress(page, 'MENU');
    await expect(page.locator('#ov-menu')).toHaveClass(/open/);
    await padPress(page, 'MENU');
    await expect(page.locator('#ov-menu')).not.toHaveClass(/open/);
    expect(errors).toEqual([]);
  });
});

test.describe('controller in the dungeon\'s choices', () => {
  test('a level\'s choice and an encounter hold against B until answered by the ring, and a trader answers to it too', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchForErrors(page);
    await usePad(page);
    await startGame(page, { seed: 'pad-choices' });
    await clearBoons(page);
    // a level's choice: B does not put it away; the ring picks a card and A takes it
    await page.evaluate(() => Game.testLevel());
    await expect(page.locator('#ov-boons')).toHaveClass(/open/);
    await padPress(page, 'B');
    await expect(page.locator('#ov-boons')).toHaveClass(/open/);
    await page.waitForTimeout(800);   // (the choice is guarded a moment after it opens)
    for (let i = 0; i < 6 && await page.locator('#ov-boons.open').count(); i++) {
      await ringTo(page, await page.locator('.spread-stat').count() ? '.spread-stat:not(.full)' : '#boon-list .boon');
      await padPress(page, 'A');
      await page.waitForTimeout(450);
    }
    await expect(page.locator('#ov-boons')).not.toHaveClass(/open/);

    // an encounter, met with X (Use): B does not leave it unanswered; the last choice, then B
    const placed = await page.evaluate(() => {
      for (let d = 0; d < 6; d++) {
        const L = Game.level(), p = Game.player(), T = Dungeon.T;
        const e = L.npcs.find(n => n.kind === 'encounter');
        if (e) {
          L.monsters.length = 0;
          for (let k = 0; k < 4; k++) {
            const [dx, dy] = Dungeon.DIRS[k];
            if (L.tiles[(e.y - dy) * L.w + (e.x - dx)] === T.FLOOR) { p.x = e.x - dx; p.y = e.y - dy; p.dir = k; return true; }
          }
        }
        L.monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts');
      }
      return false;
    });
    expect(placed).toBe(true);
    await padPress(page, 'X');
    await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
    await padPress(page, 'B');
    await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
    await page.waitForTimeout(800);
    await ringTo(page, '#enc-choices .enc-choice:last-child');
    await padPress(page, 'A');
    await expect.poll(() => page.evaluate(() => !!(Game.currentEncounter() && Game.currentEncounter().result))).toBe(true);
    await padPress(page, 'B');
    await expect(page.locator('#ov-encounter')).not.toHaveClass(/open/);
    await clearBoons(page);

    // a trader stepped into: the shop opens, the ring is in it, B closes it
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0; L.npcs.length = 0;
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.npcs.push({ id: 'merchant', x: p.x + dx, y: p.y + dy, markup: 2, stock: [], greeted: false });
    });
    await padPress(page, 'UP');
    await expect(page.locator('#ov-shop')).toHaveClass(/open/);
    await expect.poll(() => page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('#ov-shop'))).toBe(true);
    await padPress(page, 'B');
    await expect(page.locator('#ov-shop')).not.toHaveClass(/open/);
    expect(errors).toEqual([]);
  });

  test('at the divided stair the ring picks the road', async ({ page }) => {
    const errors = watchForErrors(page);
    await usePad(page);
    await startGame(page, { seed: 'play-fork' });
    await clearBoons(page);
    await page.evaluate(() => { for (let d = 1; d < 3; d++) { Game.level().monsters.length = 0; Game.descend(); } });
    await page.evaluate(() => { const L = Game.level(), p = Game.player(); L.monsters.length = 0; p.x = L.downStart.x; p.y = L.downStart.y; p.dir = (L.downStart.dir + 2) % 4; });
    const depth = await page.evaluate(() => Game.state().depth);
    await padPress(page, 'UP');
    await expect(page.locator('#ov-fork')).toHaveClass(/open/);
    await page.waitForTimeout(500);
    await ringTo(page, '#ov-fork .fork-choice');
    await padPress(page, 'A');
    await expect.poll(() => page.evaluate(() => Game.state().depth)).toBe(depth + 1);
    expect(await page.evaluate(() => Game.state().route)).toBeTruthy();
    expect(errors).toEqual([]);
  });
});

/** Steer the ring to el by looking where it is, as a player would: up or down to its row, then across. */
async function ringTo(page, selector) {
  for (let i = 0; i < 60; i++) {
    const way = await page.evaluate(sel => {
      const t = document.querySelector(sel), a = document.activeElement;
      if (!t) return 'missing';
      if (a === t) return 'there';
      if (!a || a === document.body) return 'A';
      const q = t.getBoundingClientRect(), r = a.getBoundingClientRect();
      if (q.top >= r.bottom - 2) return 'DOWN';
      if (q.bottom <= r.top + 2) return 'UP';
      return q.left >= r.right - 2 ? 'RIGHT' : 'LEFT';
    }, selector);
    if (way === 'there') return;
    if (way === 'missing') throw new Error(`no ${selector} on the screen`);
    await padPress(page, way, 60);
  }
  throw new Error(`the ring never reached ${selector}`);
}

test.describe('controller, start to finish', () => {
  test('a whole delve is played on a controller alone: made, walked, fought, won, and back to the title', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchForErrors(page);
    await quietStart(page);
    // the Menu's testing tools unfolded, as the other specs keep them
    await page.addInitScript(() => { if (localStorage.getItem('deepdelve.testsOpen') === null) localStorage.setItem('deepdelve.testsOpen', '1'); });
    await usePad(page);
    await page.goto('/');
    await padPress(page, 'A');
    await padPress(page, 'A');
    await expect(page.locator('#screen-create')).toBeVisible();
    // a quick delve, few monsters, no locked doors or traps: every choice made by the ring
    await ringTo(page, '#c-levels');
    // LB steps a list back through its choices, A on through them, pressed until it shows what is wanted
    const stepTo = async (sel, button, want) => {
      for (let i = 0; i < 12 && await page.locator(sel).inputValue() !== want; i++) await padPress(page, button);
      await expect(page.locator(sel)).toHaveValue(want);
    };
    await stepTo('#c-levels', 'LB', '2');
    await ringTo(page, '#c-monsters');
    await padPress(page, 'A');
    await expect(page.locator('#c-monsters')).toHaveValue('many');
    await stepTo('#c-monsters', 'A', 'few');
    for (const box of ['#c-locked', '#c-traps']) {
      await ringTo(page, box);
      await padPress(page, 'A');
      await expect(page.locator(box)).not.toBeChecked();
    }
    await ringTo(page, '#c-begin');
    await padPress(page, 'A');
    await expect(page.locator('#screen-prologue')).toBeVisible();
    await ringTo(page, '#pro-begin');
    await padPress(page, 'A');
    await expect(page.locator('#screen-game')).toBeVisible();
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    // endless life from the Menu's testing tools, turned on by pad as a tester would (A twice: the
    // second press says yes to a run that will not count): the test is of the controls, not the fight
    await padPress(page, 'MENU');
    await expect(page.locator('#ov-menu')).toHaveClass(/open/);
    await ringTo(page, '#m-test-hp');
    await padPress(page, 'A');
    await padPress(page, 'A');
    await expect.poll(() => page.evaluate(() => Game.testingOn('hp'))).toBe(true);
    await padPress(page, 'B');
    await expect(page.locator('#ov-menu')).not.toHaveClass(/open/);

    // then the delve itself: the test looks at the floor and decides, and every move goes through the pad
    const blocked = new Set();
    let last = '', still = 0;
    const deadline = Date.now() + 240_000;
    for (;;) {
      if (Date.now() > deadline) throw new Error('the delve was not finished in four minutes');
      if (await page.locator('#screen-end').isVisible()) break;
      const look = await page.evaluate(([blockedList]) => {
        const G = Game.state(), open = document.querySelector('.overlay.open');
        if (open) {
          const id = open.id.slice(3);
          if (id === 'boons') return { act: 'boon', spread: !!document.querySelector('.spread-stat') };
          if (id === 'encounter') return { act: Game.currentEncounter() && !Game.currentEncounter().result ? 'answer' : 'B' };
          return { act: 'B' };
        }
        if (!G || G.status !== 'playing') return { act: 'wait' };
        const L = Game.level(), p = Game.player(), T = Dungeon.T, D = Dungeon.DIRS, levels = G.opts.levels;
        const at = (x, y) => L.tiles[y * L.w + x];
        const foeAt = (x, y) => L.monsters.find(m => m.x === x && m.y === y && m.hp > 0);
        // something in front is struck; something awake beside or behind is turned to
        const [fx, fy] = D[p.dir];
        if (foeAt(p.x + fx, p.y + fy)) return { act: 'attack' };
        for (let k = 0; k < 4; k++) {
          const m = foeAt(p.x + D[k][0], p.y + D[k][1]);
          if (m && m.awake) return { act: (k - p.dir + 4) % 4 === 3 ? 'turnL' : 'turnR' };
        }
        // where to: the stairs down, the keeper, then the Heart
        const boss = L.monsters.find(m => MONSTERS[m.id] && MONSTERS[m.id].boss && m.hp > 0);
        const heartKey = Object.keys(L.items).find(k => L.items[k].some(it => it.t === 'artifact'));
        /** @type {Array<[number, number, number]>} squares to stand on, and which way to face from them (-1: any) */
        let goals = [];
        if (G.depth < levels && L.downStart) goals = [[L.downStart.x, L.downStart.y, (L.downStart.dir + 2) % 4]];
        else if (boss) goals = [0, 1, 2, 3].map(k => [boss.x - D[k][0], boss.y - D[k][1], k]);
        else if (heartKey) { const [hx, hy] = heartKey.split(',').map(Number); goals = [[hx, hy, -1]]; }
        if (!goals.length) return { act: 'wait' };
        const here = goals.find(([gx, gy]) => gx === p.x && gy === p.y);
        if (here) {
          if (here[2] < 0 || here[2] === p.dir) return { act: G.depth < levels ? 'forward' : 'attack' };
          return { act: (here[2] - p.dir + 4) % 4 === 3 ? 'turnL' : 'turnR' };
        }
        // the shortest way there over open floor and doors
        const walk = (x, y) => { const t = at(x, y); return (t === T.FLOOR || t === T.DOOR || t === T.DOOR_OPEN) && !blockedList.includes(`${x},${y}`); };
        const goalSet = new Set(goals.map(([gx, gy]) => `${gx},${gy}`));
        const prev = new Map([[`${p.x},${p.y}`, null]]), queue = [[p.x, p.y]];
        let found = null;
        while (queue.length && !found) {
          const [x, y] = queue.shift();
          for (let k = 0; k < 4; k++) {
            const nx = x + D[k][0], ny = y + D[k][1], key = `${nx},${ny}`;
            if (prev.has(key) || !walk(nx, ny)) continue;
            prev.set(key, `${x},${y}`);
            if (goalSet.has(key)) { found = key; break; }
            queue.push([nx, ny]);
          }
        }
        if (!found) return { act: 'lost', where: `${p.x},${p.y}` };
        let stepKey = found;
        while (prev.get(stepKey) !== `${p.x},${p.y}`) stepKey = prev.get(stepKey);
        const [sx, sy] = stepKey.split(',').map(Number);
        const k = D.findIndex(([dx, dy]) => dx === sx - p.x && dy === sy - p.y);
        const turn = (k - p.dir + 4) % 4;
        return { act: turn === 0 ? 'forward' : turn === 1 ? 'turnR' : turn === 3 ? 'turnL' : 'back', next: stepKey, where: `${p.x},${p.y},${p.dir}` };
      }, [[...blocked]]);

      if (look.act === 'boon') {
        // the choice waits a moment after it opens, so a stray press cannot make it
        await page.waitForTimeout(800);
        if (look.spread) { await ringTo(page, '.spread-stat:not(.full)'); await padPress(page, 'A'); await page.waitForTimeout(400); continue; }
        await ringTo(page, '#boon-list .boon');
        await padPress(page, 'A');
      } else if (look.act === 'answer') {
        await page.waitForTimeout(800);
        await ringTo(page, '#enc-choices .enc-choice:last-child');
        await padPress(page, 'A');
      } else if (look.act === 'B') await padPress(page, 'B');
      else if (look.act === 'attack') await padPress(page, 'A', 120);
      else if (look.act === 'turnL') await padPress(page, 'LEFT');
      else if (look.act === 'turnR') await padPress(page, 'RIGHT');
      else if (look.act === 'forward' || look.act === 'back') {
        await padPress(page, look.act === 'forward' ? 'UP' : 'DOWN');
        // walked into something that did not give: kick it, then try another way round
        if (look.where === last) { if (++still >= 3) { blocked.add(look.next); still = 0; await padPress(page, 'A'); } }
        else still = 0;
        last = look.where;
      } else if (look.act === 'lost') { blocked.clear(); await padPress(page, 'X'); }
      else await page.waitForTimeout(150);
    }

    // the end of the delve, and the ring takes the hero back to the title
    await expect(page.locator('#end-title')).toContainText(/./);
    expect(await page.evaluate(() => `${Game.state().status}: ${document.getElementById('end-cause').textContent}`)).toMatch(/^won/);
    await ringTo(page, '#end-title-btn');
    await padPress(page, 'A');
    await expect(page.locator('#screen-title')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('keyboard', () => {
  test('T takes what lies underfoot, L opens the log, an overlay opened from the keys takes the focus, and Escape is every screen\'s Back', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'keys' });
    await clearBoons(page);
    // something the hero put down, which walking over leaves: T lifts it
    await page.evaluate(() => { const p = Game.player(), L = Game.level(), k = `${p.x},${p.y}`; L.monsters.length = 0; (L.items[k] = L.items[k] || []).push({ t: 'dagger', q: 1, e: 0, left: 1 }); });
    const before = await page.evaluate(() => Game.player().inv.length);
    await page.keyboard.press('KeyT');
    await expect.poll(() => page.evaluate(() => Game.player().inv.length)).toBe(before + 1);
    await page.keyboard.press('KeyL');
    await expect(page.locator('#ov-log')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#ov-log')).not.toHaveClass(/open/);
    // Tab starts inside what the keys opened, not behind it
    await page.keyboard.press('KeyI');
    await expect(page.locator('#ov-inv')).toHaveClass(/open/);
    expect(await page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('#ov-inv'))).toBe(true);
    await page.keyboard.press('Escape');
    // out of the dungeon: Escape goes back from the help, the Hall and the new hero's page alike
    await page.evaluate(() => { Game.save(true); });
    await page.goto('/');
    for (const [open, screen] of [['#btn-help', '#screen-help'], ['#btn-hall', '#screen-hall'], ['#btn-new', '#screen-create']]) {
      if (!(await page.locator(open).isVisible())) continue;
      await page.click(open);
      if (open === '#btn-new' && await page.locator('#screen-confirm').isVisible()) await page.click('#confirm-replace');
      await expect(page.locator(screen)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#screen-title')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});

test('a stick held as the hero dies is let go of for them: the next hero stands still (C1)', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchForErrors(page);
  await usePad(page);
  await startGame(page, { seed: 'held-death' });
  await clearBoons(page);
  await faceOpenGround(page, 2);
  // the stick held forward, and not let go of from the test's side until the hero lies dead
  await page.evaluate(() => { window.__pad.axes[1] = -1; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { Game.hurtPlayer(9999, 'The dark takes them', null, 'probe'); });
  await page.waitForFunction(() => Game.state().status === 'dead');
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__pad.axes[1] = 0; });
  await expect(page.locator('#screen-end')).toBeVisible({ timeout: 15_000 });
  await page.click('#end-new');
  await expect(page.locator('#screen-create')).toBeVisible();
  await page.fill('#c-seed', 'held-death-2');
  await page.click('#c-begin');
  await page.click('#pro-begin');
  await expect(page.locator('#screen-game')).toBeVisible();
  await clearBoons(page);
  await faceOpenGround(page, 3);
  const before = await page.evaluate(() => { const p = Game.player(); return [p.x, p.y]; });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => { const p = Game.player(); return [p.x, p.y]; })).toEqual(before);
  expect(errors).toEqual([]);
});
