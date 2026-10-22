'use strict';
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { startGame, faceOpenGround, placeMonster, artReady, watchForErrors } = require('./helpers');

async function setup(page) {
  await page.addInitScript(() => { localStorage.setItem('deepdelve.sound', 'off'); localStorage.setItem('deepdelve.prelude', 'off'); });
  await startGame(page, { seed: 'combat-clarity' });
  await page.evaluate(() => { Game.level().monsters.length = 0; });
  expect(await faceOpenGround(page, 3)).toBeGreaterThanOrEqual(3);
  await placeMonster(page, 'orc', 1, { hp: 999, maxHp: 999 });
  await artReady(page);
}

test('visible enemy intent names attacks, shots, magic and charges without exposing hidden foes @mobile', async ({ page }) => {
  const errors = watchForErrors(page); await setup(page);
  const result = await page.evaluate(async () => {
    const { Dice, Odds } = await import('/js/rng.js');
    const { recordingPrint } = await import('/js/recording.js');
    const G = Game.state(), L = Game.level(), m = L.monsters[0], p = G.player;
    const draw = () => { const rs = Game.renderState(performance.now()); Renderer.render(rs.level, rs.cam, rs.sprites, rs.fx, performance.now()); return Renderer.intent; };
    const readings = [];
    for (const [id, kind, move] of [['orc', 'melee'], ['archer', 'shot'], ['acolyte', 'shot'], ['orc', 'move', 'charge']]) {
      m.id = id; m.windup = { kind, move, at: G.t - 800, until: G.t + 1e6 };
      readings.push(draw());
    }
    m.id = 'archer'; m.windup = null; m.volley = { left: 2, next: G.t + 1e6 };
    const volley = draw(), volleyGlyph = Game.renderState(performance.now()).sprites.find(s => s.maxHp === 999).tellKind;
    m.id = 'orc'; m.volley = null; m.windup = { kind: 'move', move: 'charge', at: G.t - 800, until: G.t + 1e6 };
    m.pack = [{ hp: 20, maxHp: 20 }];
    // Render calls are themselves recorded and reveal visible map columns.
    // Compare the existing outcome print, plus both exact dice states.
    draw();
    const before = recordingPrint(G), dice = [Dice.s, Odds.s];
    const pack = draw(), unchanged = before === recordingPrint(G) && dice[0] === Dice.s && dice[1] === Odds.s;
    const idx = m.y * L.w + m.x, tile = L.tiles[idx]; L.tiles[idx] = Dungeon.T.WALL;
    const occluded = draw(); L.tiles[idx] = tile;
    m.x = p.x - Dungeon.DIRS[p.dir][0]; m.y = p.y - Dungeon.DIRS[p.dir][1]; m.rx = m.x; m.ry = m.y;
    const behind = draw();
    m.x = p.x + Dungeon.DIRS[p.dir][0]; m.y = p.y + Dungeon.DIRS[p.dir][1]; m.rx = m.x; m.ry = m.y;
    m.windup = { kind: 'pet', at: G.t - 500, until: G.t + 1e6 }; const companion = draw();
    return { readings, volley, volleyGlyph, pack, unchanged, occluded, behind, companion };
  });
  expect(result.readings).toEqual(['Orc · Drawing back to strike', 'Goblin Archer · Aiming a shot', 'Dark Acolyte · Casting', 'Orc · Charging']);
  expect(result.volley).toBe('Goblin Archer · Firing a volley'); expect(result.volleyGlyph).toBe('shot');
  expect(result.pack).toBe('Orc · Charging'); expect(result.unchanged).toBe(true);
  expect(result.occluded).toBe(''); expect(result.behind).toBe(''); expect(result.companion).toBe('Orc · Attacking companion');
  await expect(page.locator('#combat-intent')).toContainText('Attacking companion');
  await page.evaluate(() => { Game.level().monsters[0].windup = null; });
  await expect(page.locator('#combat-intent')).toBeHidden(); expect(errors).toEqual([]);
});

test('landed damage and critical hits keep their actual outcome and readable labels @mobile', async ({ page }) => {
  const errors = watchForErrors(page); await setup(page);
  const result = await page.evaluate(() => {
    const p = Game.player(), m = Game.level().monsters[0];
    p.eq.weapon = { t: 'longsword', q: 1, e: 0 };
    let critical = false, damage = false, miss = false;
    for (let i = 0; i < 200 && !(critical && damage && miss); i++) {
      p.nextAttack = 0; Game.input('attack');
      const texts = Game.renderState(performance.now() + 100).fx.texts;
      critical ||= texts.some(t => t.outcome === 'critical'); damage ||= texts.some(t => t.outcome === 'damage'); miss ||= texts.some(t => t.text === 'miss');
    }
    return { critical, damage, miss, hurt: m.hp < 999 };
  });
  expect(result).toEqual({ critical: true, damage: true, miss: true, hurt: true }); expect(errors).toEqual([]);
});

test('critical text fits beside filling warnings in Calm view and large numbers @mobile', async ({ page }, info) => {
  const errors = watchForErrors(page); await setup(page);
  const result = await page.evaluate(() => {
    const m = Game.level().monsters[0], at = performance.now(), G = Game.state();
    m.windup = { kind: 'melee', at: G.t - 800, until: G.t + 200 };
    const rs = Game.renderState(at); rs.fx.texts = [
      { x: m.rx + .5, y: m.ry + .5, text: '18', outcome: 'critical', color: '#ffff44', born: at - 80, until: at + 670, lift: 0 },
      { x: m.rx + .5, y: m.ry + .5, text: '6', outcome: 'damage', color: '#ffffff', born: at - 80, until: at + 670, lift: 1 },
      { x: m.rx + .5, y: m.ry + .5, text: 'miss', color: '#e4e4ee', born: at - 80, until: at + 670, lift: 2 }
    ];
    Renderer.setCalm(true); Renderer.setBigNumbers(true);
    const render = Renderer.render; Renderer.render = () => render(rs.level, rs.cam, rs.sprites, rs.fx, at);
    Renderer.render();
    const numbers = Renderer.numbers, warnings = Renderer.shown.filter(s => s.markSize);
    const edges = [-.65, .65].map(side => {
      rs.fx.texts = [{ ...rs.fx.texts[0], x: m.rx + .5 - Dungeon.DIRS[Game.player().dir][1] * side, y: m.ry + .5 + Dungeon.DIRS[Game.player().dir][0] * side }];
      Renderer.render(); return Renderer.numbers;
    });
    rs.fx.texts = [{ x:m.rx+.5, y:m.ry+.5, text:'18', outcome:'critical', color:'#ffff44', born:at-80, until:at+670, lift:0 }];
    return { numbers, warnings, edges, width: Renderer.W };
  });
  expect(result.numbers.map(n => n.label)).toEqual(['CRIT 18', '−6', 'MISS']);
  for (const n of result.numbers) {
    expect(n.x - n.half).toBeGreaterThanOrEqual(0); expect(n.x + n.half).toBeLessThanOrEqual(result.width);
    for (const w of result.warnings) if (n.y > w.markY - w.markSize && n.y - 23 < w.markY + 2) expect(Math.abs(n.x - w.markX)).toBeGreaterThan(w.markSize * .62 + n.half);
  }
  for (const edge of result.edges) { expect(edge).toHaveLength(1); expect(edge[0].x - edge[0].half).toBeGreaterThanOrEqual(0); expect(edge[0].x + edge[0].half).toBeLessThanOrEqual(result.width); }
  await page.screenshot({ path: info.outputPath('critical-warning.png') }); expect(errors).toEqual([]);
});

test('condition countdowns retain focus, explain themselves and expire with the delve clock @mobile', async ({ page }) => {
  const errors = watchForErrors(page); await setup(page);
  await page.evaluate(() => {
    Game.level().monsters = []; const G = Game.state(), p = G.player;
    p.held = G.t + 14000; p.heldBy = 'down'; p.webbed = G.t + 12000; p.dazzled = G.t + 11000;
    p.hexed = { kind: 'silence', until: G.t + 15000 }; p.riposteUntil = G.t + 10000;
  });
  for (const name of ['Knocked down', 'Webbed', 'Dazzled', 'Silenced', 'Riposte ready']) await expect(page.locator('#hud-status button', { hasText: name })).toHaveText(new RegExp(`${name} \\d+s`));
  const chip = page.locator('#hud-status button', { hasText: 'Webbed' }); await chip.focus();
  const before = await chip.textContent(); await expect(chip).not.toHaveText(before); await expect(chip).toBeFocused();
  await chip.click(); await expect(page.locator('#journal-list')).toContainText('Trying to move tears at the web');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const G = Game.state(), p = G.player; p.webbed = p.held = p.dazzled = p.riposteUntil = G.t - 1; p.hexed = null; });
  await expect(page.locator('#hud-status button.bad')).toHaveCount(0); expect(errors).toEqual([]);
});

test('death advice explains the recorded source, includes conditions and escapes hostile text @mobile', async ({ page }, info) => {
  const errors = watchForErrors(page); await setup(page);
  await page.evaluate(() => {
    Game.level().monsters = []; const G = Game.state(), p = G.player;
    p.poison = { until: G.t + 20000, next: G.t + 1e6 }; p.hp = 1;
    Game.hurtPlayer(3, 'The poison burns in your veins.', null, 'poison');
  });
  await expect(page.locator('#screen-end')).toBeVisible();
  await expect(page.locator('#end-cause')).toContainText('poison');
  await expect(page.locator('#end-lesson')).toContainText('does not remove poison');
  await page.locator('#end-lesson summary').click(); await expect(page.locator('#end-lesson')).toContainText('Poisoned');
  const pure = await page.evaluate(async () => {
    const { deathLesson } = await import('/js/delveguide.js'), { Dice, Odds } = await import('/js/rng.js');
    const G = Game.state(); G.lastAttacker.name = '<img src=x onerror=alert(1)>'; const before = JSON.stringify(G), dice = [Dice.s, Odds.s];
    const html = deathLesson(); return !html.includes('<img') && before === JSON.stringify(G) && dice[0] === Dice.s && dice[1] === Odds.s;
  });
  expect(pure).toBe(true); await page.screenshot({ path: info.outputPath('death-lesson.png') }); expect(errors).toEqual([]);
});

test('crowded combat keeps conditions bounded, touch targets reachable and the view accessible @mobile', async ({ page }, info) => {
  const errors = watchForErrors(page); await setup(page);
  await page.evaluate(() => {
    const G = Game.state(), p = G.player, m = Game.level().monsters[0];
    p.poison = { until: G.t + 1e6, next: G.t + 1e6 }; p.webbed = p.dazzled = p.riposteUntil = G.t + 1e6;
    p.hexed = { kind: 'slow', until: G.t + 1e6 };
    for (const key of ['ac', 'hit', 'might', 'boon_ac', 'crew_hit']) p.effects[key] = { amount: 2, until: G.t + 1e6 };
    m.windup = { kind: 'move', move: 'charge', at: G.t - 500, until: G.t + 1e6 };
  });
  await expect(page.locator('#combat-intent')).toContainText('Charging');
  for (const [width, height, large] of [[320,568,false],[390,844,false],[844,390,false],[320,568,true],[844,390,true]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(large => { document.body.classList.toggle('big-text', large); document.documentElement.style.fontSize = large ? '32px' : ''; }, large);
    await expect.poll(() => page.evaluate(() => document.querySelector('#hud-status').clientHeight)).toBeLessThanOrEqual(height < width ? 44 : 96);
    const geometry = await page.evaluate(() => {
      const chips = document.querySelector('#hud-status');
      return { overflow: document.documentElement.scrollWidth > innerWidth, scroll: chips.scrollHeight > chips.clientHeight || chips.scrollWidth > chips.clientWidth,
        targets: [...chips.querySelectorAll('button')].every(b => b.getBoundingClientRect().width >= 44 && b.getBoundingClientRect().height >= 44), view: document.querySelector('#view').getBoundingClientRect().height };
    });
    expect(geometry.overflow).toBe(false); expect(geometry.targets).toBe(true); expect(geometry.scroll).toBe(true); expect(geometry.view).toBeGreaterThan(40);
    await page.screenshot({ path: info.outputPath(`crowded-${width}-${large}.png`) });
  }
  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(() => { document.body.classList.remove('big-text'); document.documentElement.style.fontSize = ''; });
  const audit = await new AxeBuilder({ page }).include('#screen-game').analyze();
  expect(audit.violations.filter(v => ['serious','critical'].includes(v.impact))).toEqual([]); expect(errors).toEqual([]);
});
