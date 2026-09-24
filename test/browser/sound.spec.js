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
});
