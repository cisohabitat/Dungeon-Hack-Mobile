'use strict';
const { test } = require('@playwright/test');
const { errs, shot, note, logTail, startUI, clearBoons, descendTo } = require('./pt2-util');
const { BOT, play } = require('./pt2-bot');
const T = 'e';

test('Thief on Easy: down to the lich and the Heart', async ({ page }) => {
  const E = errs(page, T);
  await startUI(page, { cls: 'Thief', diff: 'easy', seed: 'pt2-win', levels: '4' });
  await clearBoons(page);
  await page.waitForTimeout(600);
  await shot(page, 'e01-thief-start');
  await page.evaluate(BOT);
  await page.evaluate(() => { const p = Game.player(); p.maxHp = 500; p.hp = 500; p.gold = 300; });
  const d = await descendTo(page, 4);
  await clearBoons(page);
  await page.evaluate(() => { const p = Game.player(); p.maxHp = 500; p.hp = 500; });
  note(T, { depth: d, isFinal: await page.evaluate(() => Game.level().isFinal) });
  await page.waitForTimeout(600);
  await shot(page, 'e02-final-floor');
  // walk toward the lich, taking pictures as the fight unfolds
  let shots = 0, lastPhase = -1;
  const r0 = await play(page, { goal: 'artifact', doneFn: "Game.state().status !== 'playing' || Game.level().monsters.some(m => m.id === 'lich' && m.awake && Math.abs(m.x - Game.player().x) + Math.abs(m.y - Game.player().y) <= 4)", budget: 900 });
  note(T, { r0 });
  for (let round = 0; round < 200; round++) {
    const st = await page.evaluate(() => { const G = Game.state(); const l = Game.level().monsters.find(m => m.id === 'lich'); return { status: G.status, lich: l ? { hp: l.hp, max: l.maxHp, phase: l.phase || 0, dist: Math.abs(l.x - G.player.x) + Math.abs(l.y - G.player.y), wind: l.windup && l.windup.move } : null, hp: G.player.hp }; });
    if (st.status !== 'playing') { note(T, 'status ' + st.status); break; }
    if (st.lich && (st.lich.phase !== lastPhase || (st.lich.wind && shots < 10)) && shots < 10) { await shot(page, `e03-lich-${shots}-p${st.lich.phase}${st.lich.wind ? '-' + st.lich.wind : ''}`); note(T, { st, log: await logTail(page, 4) }); lastPhase = st.lich.phase; shots++; }
    if (!st.lich) {
      note(T, 'lich down ' + JSON.stringify(st));
      await page.waitForTimeout(300);
      await shot(page, 'e04-lich-down');
      note(T, { lichDownLog: await logTail(page, 5) });
      const r2 = await play(page, { goal: 'artifact', doneFn: "Game.state().status !== 'playing'", budget: 600 });
      note(T, { r2 });
      break;
    }
    await play(page, { goal: 'artifact', doneFn: "Game.state().status !== 'playing' || !Game.level().monsters.some(m => m.id === 'lich') || Game.level().monsters.some(m => m.id === 'lich' && m.windup)", budget: 15 });
    await page.evaluate(() => { const p = Game.player(); if (p.hp < 200) p.hp = 500; });
  }
  await page.waitForTimeout(200);
  await shot(page, 'e05-heart-light');
  await page.waitForSelector('#screen-end.active', { timeout: 30000 });
  await page.waitForTimeout(1000);
  await shot(page, 'e06-victory');
  const sc = page.locator('#screen-end');
  await sc.evaluate(el => el.scrollTo(0, el.scrollHeight / 2)); await page.waitForTimeout(200); await shot(page, 'e07-victory-mid');
  await sc.evaluate(el => el.scrollTo(0, el.scrollHeight)); await page.waitForTimeout(200); await shot(page, 'e08-victory-bottom');
  note(T, { title: await page.textContent('#end-title'), trophy: await page.textContent('#end-trophy'), trophyVis: await page.locator('#end-trophy').isVisible() });
  await page.click('#end-title-btn');
  await page.click('#btn-hall'); await page.waitForTimeout(300);
  await shot(page, 'e09-hall-trophy');
  note(T, { trophies: await page.textContent('#trophy-count') });
  await page.click('#hall-relics'); await page.waitForTimeout(300); await shot(page, 'e10-codex-after-win');
  await page.click('#relics-back'); await page.click('#hall-back');
  await page.click('#btn-new'); await page.waitForTimeout(300);
  await page.locator('.bg-card[data-bg="returned"]').scrollIntoViewIfNeeded();
  await shot(page, 'e11-new-game-after-easy-win');
  note(T, { returnedDisabled: await page.locator('.bg-card[data-bg="returned"]').isDisabled() });
  E.dump();
});
