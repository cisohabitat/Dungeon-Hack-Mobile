'use strict';
// Sound is built from WebAudio nodes on the fly, and a sound that throws is
// caught and reported once as a console warning rather than stopping the game.
// Play every one of them, placed and not, over every floor's ambience, and
// make sure none of them complains.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons } = require('./helpers');

test.describe('sound', () => {
  test('every sound and every floor\'s ambience plays without an error', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'sound-all' });
    await clearBoons(page);

    const played = await page.evaluate(async () => {
      if (!Sound.isEnabled()) Sound.toggle();
      Sound.unlock();
      const { fx, far } = Sound.names();
      const shapes = [
        {},
        { dist: 1, pan: -1, who: 'orc', gore: 'bone', tag: 'crit', w: 'mace', spell: 'lightning', ms: 300, kind: 'shot' },
        { dist: 9, pan: 0.7, behind: true, who: 'lich', gore: 'ecto', tag: 'burn', w: 'shortbow', spell: 'bless', ms: 300 },
      ];
      let n = 0;
      for (const name of fx) for (const o of shapes) { Sound.play(name, o); n++; }
      for (const what of far) { Sound.play('far', { what }); n++; }
      for (let theme = 0; theme < 6; theme++) { Sound.setAmbience(theme % 2, theme); await new Promise(r => setTimeout(r, 30)); }
      Sound.stop('rite');
      Sound.heartbeat(0.1, performance.now() + 1e6);
      await new Promise(r => setTimeout(r, 400));
      return n;
    });

    expect(played).toBeGreaterThan(100);
    expect(errors).toEqual([]);
  });
  test('music follows the fight, every instrument plays without an error, and the menu turns it off for good', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'music-fight' });
    await clearBoons(page);
    // every floor's scale in every mood, through real WebAudio
    await page.evaluate(async () => {
      if (!Sound.isEnabled()) Sound.toggle();
      Sound.unlock();
      let t = performance.now() + 1e6;
      for (let theme = 0; theme < THEMES.length; theme++) for (const mood of Music.MOODS) { for (let i = 0; i < 12; i++) { Music.update(mood, theme, t); t += 120; } }
      Music.stop();
      await new Promise(r => setTimeout(r, 300));
    });
    // in play: a goblin awake beside the hero brings in the beat
    const heard = await page.evaluate(async () => {
      const got = [];
      Music.listen(n => got.push(n.k));
      const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
      p.hp = p.maxHp = 999;
      L.monsters.length = 0;
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.monsters.push({ uid: 7, id: 'goblin', x: p.x + dx, y: p.y + dy, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: p.x + dx, ry: p.y + dy, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
      await new Promise(r => setTimeout(r, 1500));
      Music.listen(null);
      return { mood: Music.state().mood, kinds: [...new Set(got)] };
    });
    expect(heard.mood).toBe('fight');
    expect(heard.kinds).toContain('pulse');
    expect(heard.kinds).toContain('thud');
    // the menu turns it off, and it stays off after a reload
    await page.click('[data-open="menu"]');
    await expect(page.locator('#m-music')).toHaveText('Music: On');
    await page.click('#m-music');
    await expect(page.locator('#m-music')).toHaveText('Music: Off');
    await page.click('#ov-menu [data-close]');
    const quiet = await page.evaluate(async () => {
      let n = 0;
      Music.listen(() => n++);
      await new Promise(r => setTimeout(r, 1200));
      Music.listen(null);
      return n;
    });
    expect(quiet, 'notes played with the music off').toBe(0);
    await page.reload();
    expect(await page.evaluate(() => Music.isEnabled())).toBe(false);
    expect(errors).toEqual([]);
  });
});
