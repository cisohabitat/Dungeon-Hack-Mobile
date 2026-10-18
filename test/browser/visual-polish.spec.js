'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, faceOpenGround, placeMonster, artReady, watchForErrors } = require('./helpers');

async function scene(page) {
  await page.addInitScript(() => { localStorage.setItem('deepdelve.sound', 'off'); localStorage.setItem('deepdelve.prelude', 'off'); });
  await startGame(page, { seed: 'visual-polish', permadeath: false });
  await page.evaluate(() => { Game.level().monsters.length = 0; });
  expect(await faceOpenGround(page, 2)).toBeGreaterThanOrEqual(2);
  await artReady(page);
}

test('cached attack and recovery poses respect wind-ups, expiry and Calm view @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await scene(page);
  await placeMonster(page, 'orc', 1, { hp: 999, maxHp: 999, awake: true, nextAct: 1e12 });
  await artReady(page);
  const result = await page.evaluate(async () => {
    const { Dice, Odds } = await import('/js/rng.js');
    const m = Game.level().monsters[0], art = Assets.sprites.orc, now = performance.now();
    const before = [Dice.s, Odds.s], state = JSON.stringify(m);
    m.flashUntil = -1e9; m.lungeAt = now;
    const sprite = at => Game.renderState(at).sprites.find(s => s.maxHp === 999);
    const strike = sprite(now + 50), early = sprite(now - 1), gone = sprite(now + 131);
    m.flashAt = now; m.flashUntil = now + 130;
    const hit = sprite(now + 140), recover = sprite(now + 300), settled = sprite(now + 391);
    const ctx = document.querySelector('#view').getContext('2d'), rs = Game.renderState(now + 300);
    const paint = (calm, reaction) => {
      Renderer.setCalm(calm);
      Renderer.render(rs.level, rs.cam, rs.sprites.map(s => ({ ...s, reaction: reaction ? s.reaction : null })), rs.fx, now + 300);
      return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
    };
    const diff = calm => { const a = paint(calm, false), b = paint(calm, true); return a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0); };
    const normal = diff(false), calm = diff(true);
    m.windup = { at: Game.state().t - 800, until: Game.state().t + 200, kind: 'melee' };
    const warning = sprite(now + 300);
    Renderer.setCalm(false);
    const next = Game.renderState(now + 300);
    Renderer.render(next.level, next.cam, next.sprites, next.fx, now + 300);
    const marked = Renderer.shown.some(s => s.markSize > 0);
    Object.assign(m, JSON.parse(state)); delete m.windup;
    return { strike: strike.reaction === art.strike, early: !!early.reaction, gone: !!gone.reaction, hit: hit.img === art.hurt, recover: recover.reaction === art.recover, settled: !!settled.reaction, normal, calm, warning: warning.tell > 0 && !warning.reaction && marked, dice: Dice.s === before[0] && Odds.s === before[1] };
  });
  expect(result).toMatchObject({ strike: true, early: false, gone: false, hit: true, recover: true, settled: false, calm: 0, warning: true, dice: true });
  expect(result.normal).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('regional props change the painting while saved scenery, scale and dice stay fixed', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await scene(page);
  const result = await page.evaluate(async () => {
    const { Dice, Odds } = await import('/js/rng.js'), { regionalProp } = await import('/js/regionalprops.js');
    const L = Game.level(), p = Game.player(), [dx, dy] = Dungeon.DIRS[p.dir];
    L.dressing = [{ x: p.x + dx * 2, y: p.y + dy * 2, ox: -0.25, oy: 0, k: 'rubble' }, { x: p.x + dx * 2, y: p.y + dy * 2, ox: 0.25, oy: 0, k: 'mushrooms' }];
    const saved = JSON.stringify(L.dressing), before = [Dice.s, Odds.s], now = performance.now();
    const view = document.querySelector('#view'), sheet = document.createElement('canvas');
    sheet.width = view.width * 3; sheet.height = (view.height + 22) * 2;
    const ctx = sheet.getContext('2d'); ctx.font = '13px sans-serif';
    const themes = ['Brown Catacombs', 'The Grey Hold', 'The Sunless Marsh', 'Mossy Depths', 'Blue Vaults', 'The Old Forges'];
    const frames = themes.map((name, i) => {
      L.theme = THEMES.findIndex(t => t.name === name);
      const rs = Game.renderState(now), sprites = rs.sprites.filter(s => s.dress);
      Renderer.render(rs.level, rs.cam, rs.sprites, rs.fx, now);
      const x = i % 3 * view.width, y = Math.floor(i / 3) * (view.height + 22);
      ctx.fillStyle = '#15121a'; ctx.fillRect(x, y, view.width, view.height + 22); ctx.fillStyle = '#eee'; ctx.fillText(name, x + 6, y + 16); ctx.drawImage(view, x, y + 22);
      return { name, kinds: L.dressing.map(d => regionalProp(THEMES[L.theme], d.k)), positions: sprites.map(({ x, y, scale, yOff }) => ({ x, y, scale, yOff })) };
    });
    const unchanged = JSON.stringify(L.dressing) === saved;
    L.dressing.push({ x: p.x + dx * 2, y: p.y + dy * 2, ox: 0, oy: 0, k: 'rubble', fell: true });
    const fallen = Game.renderState(now).sprites.filter(s => s.dress).at(-1);
    return { frames, saved: unchanged, fallen: fallen.img === Assets.sprites.dress_rubble, dice: Dice.s === before[0] && Odds.s === before[1], sheet: sheet.toDataURL().split(',')[1] };
  });
  expect(result.saved).toBe(true); expect(result.dice).toBe(true);
  expect(result.fallen, 'a cave-in still leaves the same stones that fell').toBe(true);
  for (const f of result.frames) expect(f.positions, f.name).toEqual(result.frames[0].positions);
  expect(result.frames.map(f => f.kinds)).toEqual([['crypt_lid', 'mushrooms'], ['iron_scrap', 'mushrooms'], ['rubble', 'reed_bundle'], ['roots', 'mushrooms'], ['elf_shards', 'mushrooms'], ['iron_scrap', 'mushrooms']]);
  await testInfo.attach('regional-props', { body: Buffer.from(result.sheet, 'base64'), contentType: 'image/png' });
  if (process.env.POLISH_REVIEW_DIR) require('fs').writeFileSync(process.env.POLISH_REVIEW_DIR + '/regional-props.png', Buffer.from(result.sheet, 'base64'));
  expect(errors).toEqual([]);
});

test('non-elemental magic has distinct shapes, fades and keeps Calm impacts still @mobile', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { makeSpellFx } = await import('/js/spellfx.js');
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 200;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); let calm = false;
    const spells = makeSpellFx({ W: 320, H: 200, ctx, get calm() { return calm; } });
    const looks = [['missile', '#8cf', 0.5], ['missile', '#8c4', 0.5], ['smite', '#ffd', 0.08], ['smite', '#6b3', 0.08], ['buff', '#adf', 0], ['buff', '#ff8', 0], ['buff', '#c95', 0], ['heal', '#8f8', 0], ['swarm', '#bc8', 0.3]];
    const sheet = document.createElement('canvas'); sheet.width = 320 * 3; sheet.height = 222 * 6; const sc = sheet.getContext('2d'); sc.font = '13px sans-serif';
    const out = looks.map(([style, color, impact], i) => {
      const paint = phase => {
        ctx.clearRect(0, 0, 320, 200);
        spells.drawSpells({ spells: [{ style, color, impact, born: 100, until: 1100, pts: [{}] }] }, 100 + phase * 1000, () => ({ x: 160, y: 110, r: 150 }));
        const a = ctx.getImageData(0, 0, 320, 200).data;
        let n = 0, light = 0, minY = 200, maxY = -1, hash = 2166136261;
        for (let j = 0; j < a.length; j += 4) if (a[j + 3]) { n++; light += a[j + 3]; minY = Math.min(minY, Math.floor(j / 4 / 320)); maxY = Math.max(maxY, Math.floor(j / 4 / 320)); hash = Math.imul(hash ^ j, 16777619); }
        return { n, light, minY, maxY, hash: hash >>> 0 };
      };
      const capture = (row, label) => { const x = i % 3 * 320, y = (Math.floor(i / 3) * 2 + row) * 222; sc.fillStyle = '#18151e'; sc.fillRect(x, y, 320, 222); sc.drawImage(canvas, x, y + 22); sc.fillStyle = '#eee'; sc.fillText(`${style} ${color} ${label}`, x + 6, y + 16); };
      calm = false; const normal = paint(impact + (1 - impact) * 0.3); capture(0, 'normal');
      calm = true;
      const before = impact ? paint(impact * 0.5) : null, early = paint(impact + (1 - impact) * 0.15); capture(1, 'calm');
      const same = paint(impact + (1 - impact) * 0.15), late = paint(impact + (1 - impact) * 0.7), gone = paint(1);
      return { style, color, normal, before, early, same, late, gone, composite: ctx.globalCompositeOperation };
    });
    return { out, sheet: sheet.toDataURL().split(',')[1] };
  });
  for (const r of result.out) {
    expect(r.early.n, r.color).toBeGreaterThan(0); expect(r.same).toEqual(r.early);
    expect(r.early.minY).toBeGreaterThan(85); expect(r.early.maxY).toBeLessThan(199);
    expect(r.late.light).toBeLessThan(r.early.light); expect(r.late.minY).toBe(r.early.minY); expect(r.late.maxY).toBe(r.early.maxY);
    if (r.before) expect(r.before.n).toBe(0);
    expect(r.gone.n).toBe(0); expect(r.composite).toBe('source-over');
  }
  expect(new Set(result.out.map(r => r.early.hash)).size).toBe(9);
  await testInfo.attach('magic-shapes', { body: Buffer.from(result.sheet, 'base64'), contentType: 'image/png' });
  if (process.env.POLISH_REVIEW_DIR) require('fs').writeFileSync(process.env.POLISH_REVIEW_DIR + '/magic-shapes.png', Buffer.from(result.sheet, 'base64'));
  expect(errors).toEqual([]);
});

test('treasure inspection shows known grades and usable art without revealing hidden quality @mobile', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await scene(page);
  await page.evaluate(() => {
    Game.player().inv = [{ t: 'longsword', q: 1, e: 1, pw: 'keen', h: true }, { t: 'longsword', q: 1, e: 1, pw: 'keen' }, { t: 'battleaxe', q: 1, e: 1, u: 'ogres_toll' }, { t: 'towershield', q: 1, e: 1, u: 'bastion' }];
  });
  await page.click('[data-open="inv"]');
  for (const [i, grade, word] of [[0, 'plain', ''], [1, 'rare', 'Rare'], [2, 'relic', 'Relic'], [3, 'legend', 'Legendary']]) {
    await page.locator('#inv-grid button').nth(i).click();
    const detail = page.locator('#item-detail');
    await expect(detail).toHaveAttribute('data-grade', grade);
    if (word) await expect(detail.locator('.grade-word')).toHaveText(word);
    else { await expect(detail.locator('.grade-word')).toHaveCount(0); await expect(detail).toContainText('Its quality is unknown'); }
    expect(await detail.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(detail.getByRole('button', { name: 'Drop', exact: true })).toBeVisible();
  }
  await page.screenshot({ path: testInfo.outputPath('treasure-inspection.png') });
  if (process.env.POLISH_REVIEW_DIR) await page.screenshot({ path: process.env.POLISH_REVIEW_DIR + '/treasure-inspection.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.locator('.item-showcase > img').evaluate(img => getComputedStyle(img).animationName)).toBe('none');
  const frames = await page.evaluate(() => {
    const selected = document.querySelector('#inv-grid .slot.sel'), picture = document.querySelector('.item-showcase > img');
    return { selected: getComputedStyle(selected).borderRadius, picture: getComputedStyle(picture).borderRadius, width: document.documentElement.scrollWidth <= innerWidth };
  });
  expect(frames).toEqual({ selected: '8px', picture: '8px', width: true });
  expect(errors).toEqual([]);
});

for (const [cls, entries] of [
  ['Mage', [['magic_missile', 'missile', 650, 0.5], ['shield', 'buff', 600, 0]]],
  ['Cleric', [['smite', 'smite', 560, 0.08], ['bless', 'buff', 600, 0], ['protection', 'buff', 600, 0], ['cure_light', 'heal', 800, 0], ['cure_serious', 'heal', 850, 0]]],
  ['Druid', [['thorn_lash', 'missile', 600, 0.5], ['entangle', 'smite', 560, 0.08], ['mending_moss', 'heal', 800, 0], ['wild_shape', 'buff', 700, 0]]],
]) test(`${cls} magic keeps its actual cost and timing with readable effects in the dungeon`, async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await page.addInitScript(() => { localStorage.setItem('deepdelve.sound', 'off'); localStorage.setItem('deepdelve.prelude', 'off'); });
  await startGame(page, { seed: 'polish-spells', cls });
  await page.evaluate(() => { Game.level().monsters.length = 0; const p = Game.player(); p.level = 10; p.maxHp = p.maxSp = p.sp = 999; p.hp = 100; });
  expect(await faceOpenGround(page, 2)).toBeGreaterThanOrEqual(2);
  await placeMonster(page, 'orc', 1, { hp: 999, maxHp: 999, nextAct: 1e12 }); await artReady(page);
  const result = await page.evaluate(entries => {
    const view = document.querySelector('#view'), sheet = document.createElement('canvas'), ctx = sheet.getContext('2d');
    sheet.width = view.width * 2; sheet.height = (view.height + 22) * entries.length; ctx.font = '13px sans-serif';
    const before = JSON.stringify(Game.level().dressing);
    const out = entries.map(([id, style, duration, impact], i) => {
      const p = Game.player(), m = Game.level().monsters[0], spell = Game.knownSpells().find(s => s.id === id);
      p.nextAttack = 0; const sp = p.sp, hp = m.hp;
      Game.castSpell(spell);
      const fx = Game.renderState(performance.now()).fx, effect = fx.spells.at(-1);
      for (const [col, phase] of [[0, impact ? impact * 0.7 : 0.15], [1, impact + (1 - impact) * 0.2]]) {
        const now = effect.born + (effect.until - effect.born) * phase, rs = Game.renderState(now);
        Renderer.render(rs.level, rs.cam, rs.sprites, { ...rs.fx, spells: [effect] }, now);
        ctx.fillStyle = '#15121a'; ctx.fillRect(col * view.width, i * (view.height + 22), view.width, view.height + 22);
        ctx.fillStyle = '#eee'; ctx.fillText(id + (col ? ' · impact' : ' · casting'), col * view.width + 6, i * (view.height + 22) + 16);
        ctx.drawImage(view, col * view.width, i * (view.height + 22) + 22);
      }
      return { id, style: effect.style, duration: effect.until - effect.born, impact: effect.impact, cost: sp - p.sp, expectedCost: spell.cost, damage: hp - m.hp, flash: m.flashAt - effect.born, bolt: spell.kind === 'bolt', expected: { style, duration, impact } };
    });
    return { out, dressing: before === JSON.stringify(Game.level().dressing), sheet: sheet.toDataURL().split(',')[1] };
  }, entries);
  for (const r of result.out) {
    expect(r.style, r.id).toBe(r.expected.style); expect(r.duration, r.id).toBeCloseTo(r.expected.duration, 4); expect(r.impact, r.id).toBe(r.expected.impact); expect(r.cost, r.id).toBe(r.expectedCost);
    if (r.bolt) { expect(r.damage, r.id).toBeGreaterThan(0); expect(r.flash, r.id).toBeCloseTo(Math.round(r.duration * r.impact), 4); }
  }
  expect(result.dressing).toBe(true);
  await testInfo.attach(`${cls}-magic`, { body: Buffer.from(result.sheet, 'base64'), contentType: 'image/png' });
  if (process.env.POLISH_REVIEW_DIR) require('fs').writeFileSync(`${process.env.POLISH_REVIEW_DIR}/${cls.toLowerCase()}-magic.png`, Buffer.from(result.sheet, 'base64'));
  expect(errors).toEqual([]);
});

test('every named treasure has distinct cached art and matching held shapes @mobile', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await scene(page);
  const result = await page.evaluate(async () => {
    const { RELICS } = await import('/js/relics.js');
    const { namedSprite, namedBase } = await import('/js/namedart.js');
    const { heldParts, carriedParts, POSES } = await import('/js/heldart.js');
    const { GRIPS } = await import('/js/itemart.js');
    const { Dice, Odds } = await import('/js/rng.js');
    const snapshot = JSON.stringify(Game.state()), dice = [Dice.s, Odds.s];
    const sheet = document.createElement('canvas'); sheet.width = 700; sheet.height = Math.ceil(Object.keys(RELICS).length / 7) * 180;
    const cx = sheet.getContext('2d'); cx.fillStyle = '#19161f'; cx.fillRect(0, 0, sheet.width, sheet.height); cx.font = '10px sans-serif';
    const out = Object.entries(RELICS).map(([id, r], i) => {
      const key = namedSprite(id), base = ITEMS[r.t].sprite, s = Assets.sprites[key], b = Assets.sprites[base];
      const x = i % 7 * 100, y = Math.floor(i / 7) * 180;
      cx.drawImage(s.levels[0], x + 18, y + 2, 64, 64); cx.fillStyle = '#ede2c9'; cx.fillText(id, x + 2, y + 85, 96);
      const poses = GRIPS[base] ? Object.keys(POSES).every(p => !!heldParts(key, p, 'fighter', !!ITEMS[r.t].twoHanded)) : true;
      let held = true;
      if (GRIPS[base]) held = JSON.stringify(heldParts(key, 'rest', 'fighter')) !== JSON.stringify(heldParts(base, 'rest', 'fighter'));
      if (['shortbow', 'longbow'].includes(base)) {
        const a = heldParts(key, 'rest', 'ranger'), plain = heldParts(base, 'rest', 'ranger');
        held = JSON.stringify(a.parts) !== JSON.stringify(plain.parts) && JSON.stringify(a.marks) === JSON.stringify(plain.marks);
      }
      if (ITEMS[r.t].kind === 'shield') {
        const a = carriedParts(key, 'mage'), plain = carriedParts(base, 'mage');
        held = !!a && JSON.stringify(a.parts) !== JSON.stringify(plain.parts) && JSON.stringify(a.anchor) === JSON.stringify(plain.anchor);
      }
      const frame = ITEMS[r.t].kind === 'shield' ? Assets.carried(key, 'mage') : (GRIPS[base] || ['shortbow', 'longbow'].includes(base)) ? Assets.held(key, 'rest', 'fighter', !!ITEMS[r.t].twoHanded) : null;
      if (frame) { const scale = Math.min(80 / frame.img.width, 75 / frame.img.height); cx.drawImage(frame.img, x + 50 - frame.img.width * scale / 2, y + 95, frame.img.width * scale, frame.img.height * scale); }
      return { id, key, distinct: s.url !== b.url, stable: s === Assets.sprites[Game.spriteFor({ t: r.t, u: id, e: r.e, q: 1 })], base: namedBase(key) === base, poses, held, url: s.url };
    });
    return { out, unchanged: snapshot === JSON.stringify(Game.state()) && dice[0] === Dice.s && dice[1] === Odds.s, sheet: sheet.toDataURL().split(',')[1] };
  });
  expect(result.unchanged).toBe(true);
  expect(new Set(result.out.map(r => r.url)).size).toBe(result.out.length);
  for (const r of result.out) expect(r, r.id).toMatchObject({ distinct: true, stable: true, base: true, poses: true, held: true });
  await testInfo.attach('named-treasure', { body: Buffer.from(result.sheet, 'base64'), contentType: 'image/png' });
  if (process.env.POLISH_REVIEW_DIR) require('fs').writeFileSync(process.env.POLISH_REVIEW_DIR + '/named-treasure.png', Buffer.from(result.sheet, 'base64'));
  expect(errors).toEqual([]);
});

test('named pictures agree in floor treasure, pack inspection and the discovered codex', async ({ page }) => {
  const errors = watchForErrors(page);
  await scene(page);
  const urls = await page.evaluate(async () => {
    const { RELICS } = await import('/js/relics.js');
    const { Progress } = await import('/js/progress.js');
    const { renderCodex } = await import('/js/hall.js');
    const ids = ['bastion', 'red_harvest', 'cinderheart', 'rimebound', 'ninth_circle', 'emberwood', 'oakheart', 'heartroot'];
    const p = Game.player(); p.inv = ids.map(u => ({ t: RELICS[u].t, u, e: RELICS[u].e, q: 1 }));
    const L = Game.level(); L.items = Object.fromEntries(p.inv.map((it, i) => [`${p.x + i},${p.y}`, [it]]));
    const rs = Game.renderState(performance.now());
    const el = document.createElement('div');
    renderCodex(el); const hidden = !el.querySelector('[data-relic="bastion"] img');
    for (const id of ids) Progress.noteRelic(id);
    renderCodex(el);
    return { hidden, rows: p.inv.map(it => {
      const s = Assets.sprites[Game.spriteFor(it)];
      return { url: s.url, floor: rs.sprites.some(p => p.onFloor && p.img === s), codex: el.querySelector(`[data-relic="${it.u}"] img`).getAttribute('src') === s.url };
    }) };
  });
  expect(urls.hidden).toBe(true);
  await page.click('[data-open="inv"]');
  for (const [i, row] of urls.rows.entries()) {
    expect(row.floor).toBe(true); expect(row.codex).toBe(true);
    await page.locator('#inv-grid button').nth(i).click();
    await expect(page.locator('#item-detail .item-showcase img')).toHaveAttribute('src', row.url);
  }
  expect(errors).toEqual([]);
});
