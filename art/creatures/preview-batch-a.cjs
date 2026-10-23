'use strict';
// Capture the integrated atlases through the real runtime loader and renderer.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { serve } = require('../../test/server');
const { startGame, faceOpenGround, placeMonster, artReady, watchForErrors } = require('../../test/browser/helpers');
const folder = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'generation-batch-a.json')));
const kinds = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(manifest.creatures);
const reviewPoses = kind => ['idle', 'windup', ...(kind === 'zombie' ? ['hurt', 'blink']
  : ['goblin', 'orc', 'ogre'].includes(kind) ? ['stepB'] : [])];
const output = path.join(folder, 'batch-a-preview', 'dungeon');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const server = http.createServer(serve);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const results = [];
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
    for (const width of [390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1,
        serviceWorkers: 'block', baseURL: `http://127.0.0.1:${server.address().port}` });
      const page = await context.newPage();
      const errors = watchForErrors(page);
      await page.addInitScript(() => {
        for (const [k, v] of Object.entries({ sound: 'off', samples: 'off', prelude: 'off' }))
          localStorage.setItem(`deepdelve.${k}`, v);
      });
      await startGame(page, { seed: 'combat-clarity', name: 'Atlas review' });
      await page.evaluate(() => { Game.level().monsters.length = 0; });
      if (await faceOpenGround(page, 3) < 3) throw new Error('No clear preview corridor');
      await artReady(page, Object.fromEntries(kinds.map(k => [k, reviewPoses(k).filter(p => p !== 'idle')])));
      await page.evaluate(async kinds => {
        const { paintedCreature } = await import('/js/paintedcreatures.js');
        window.__batchPainted = paintedCreature;
        for (const k of kinds) paintedCreature(Assets.sprites[k]);
      }, kinds);
      await page.waitForFunction(kinds => kinds.every(k =>
        window.__batchPainted(Assets.sprites[k]) !== Assets.sprites[k]), kinds);
      for (const kind of kinds) {
        await page.evaluate(() => { Game.level().monsters.length = 0; });
        await placeMonster(page, kind, 1, { hp: 999, maxHp: 999 });
        for (const pose of reviewPoses(kind)) {
          const metrics = await page.evaluate(({ kind, pose }) => {
            const G = Game.state(), monster = Game.level().monsters[0], now = performance.now();
            delete monster.windup;
            if (pose === 'windup') monster.windup = { kind: 'attack', at: G.t - 100, until: G.t + 1e6 };
            const rs = Game.renderState(now);
            const sprite = rs.sprites.find(s => s.maxHp === 999);
            if (!sprite) throw new Error('Preview creature missing from render state');
            const fallback = ['idle', 'windup'].includes(pose) ? Assets.sprites[kind] : Assets.sprites[kind][pose];
            if (!fallback) throw new Error(`Unsupported preview pose: ${kind}:${pose}`);
            sprite.img = fallback;
            sprite.reaction = null;
            // Use the existing procedural pose object as the loader's lookup key.
            // Motion timing remains untouched; this is a frozen review capture.
            const expected = pose === 'windup' ? fallback.windup : fallback;
            const painted = window.__batchPainted(expected);
            if (painted === expected)
              throw new Error('Atlas has not decoded');
            if (!window.__batchOriginalRender) window.__batchOriginalRender = Renderer.render;
            Renderer.render = () => window.__batchOriginalRender(rs.level, rs.cam, rs.sprites, rs.fx, now);
            Renderer.render();
            UI.refreshHud();
            return { kind, pose, shown: Renderer.shown, intent: Renderer.intent };
          }, { kind, pose });
          // Let HUD intent and its ResizeObserver settle before capturing the
          // next creature; otherwise its text can retain the preceding warning.
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          Object.assign(metrics, await page.evaluate(() => ({ shown: Renderer.shown, intent: Renderer.intent })));
          if (!metrics.shown.length) throw new Error(`${kind}: creature not drawn`);
          if (pose === 'windup' && !metrics.shown.some(s => s.markSize > 0))
            throw new Error(`${kind}: attack warning missing`);
          await page.screenshot({ path: path.join(output, `${width}-${kind}-${pose}.png`) });
          results.push({ width, ...metrics });
        }
      }
      if (errors.length) throw new Error(errors.join('\n'));
      await context.close();
      console.log(`Captured ${kinds.length} creatures at ${width}px with attack warnings`);
    }
    for (const width of [390, 320]) {
      const context = await browser.newContext({ viewport: { width: width*4, height: 740 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const origin = `http://127.0.0.1:${server.address().port}`;
      const cards = kinds.map(kind => `<article><b>${kind} · idle / preparation</b><div>${['idle','windup'].map(pose =>
        `<img src="${origin}/art/creatures/batch-a-preview/dungeon/${width}-${kind}-${pose}.png">`).join('')}</div></article>`).join('');
      await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#20242c;color:#f5e7ce;font:14px monospace;display:grid;grid-template-columns:repeat(5,1fr)}article{min-width:0}b{display:block;height:24px;padding:4px;font-size:11px}article div{display:flex}img{width:50%;height:auto;display:block}</style>${cards}`);
      await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
      await page.screenshot({ path: path.join(output, `${width}-overview.png`), fullPage: true });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'review.json'), JSON.stringify({
      mode: 'integrated runtime loader and renderer; no substituted modules or atlases', console_errors: [], results,
    }, null, 2) + '\n');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
