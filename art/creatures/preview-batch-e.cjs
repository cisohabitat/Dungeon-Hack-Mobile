'use strict';
// Review-only substitution: shipped runtime bindings and assets stay unchanged.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { serve } = require('../../test/server');
const { startGame, faceOpenGround, placeMonster, artReady, watchForErrors } = require('../../test/browser/helpers');
const folder = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'generation-batch-e.json')));
const kinds = Object.keys(manifest.creatures);
const poses = ['idle', 'windup', 'strike', 'recover', 'hurt', 'blink'];
const output = path.join(folder, 'batch-e-preview', 'dungeon');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const server = http.createServer(serve);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const results = [];
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
    for (const width of [390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block', baseURL: `http://127.0.0.1:${server.address().port}` });
      const page = await context.newPage();
      const errors = watchForErrors(page);
      await page.addInitScript(() => {
        for (const [k,v] of Object.entries({sound:'off',samples:'off',prelude:'off'})) localStorage.setItem(`deepdelve.${k}`,v);
      });
      await startGame(page, { seed: 'combat-clarity', name: 'Shade atlas review' });
      await page.evaluate(() => { Game.level().monsters.length = 0; });
      if (await faceOpenGround(page, 3) < 3) throw new Error('No clear preview corridor');
      await artReady(page, { shade: poses.filter(p => p !== 'idle') });
      await page.waitForFunction(classes => classes.every(cls => {
        const s = Assets.sprites.shade.elite[cls];
        return s && ['windup','strike','recover','hurt','blink'].every(p => s[p]);
      }), kinds);
      await page.locator('#floor-card').evaluate(el => el.style.display = 'none');
      for (const kind of kinds) {
        // Paint the selected preview sheet in place of the normal Shade image.
        const atlas = path.join(folder, 'batch-e-preview', `${kind}.webp`);
        await page.route('**/img/creatures/shade.webp', route => route.fulfill({ path: atlas, contentType: 'image/webp' }));
        // One fresh loader instance per class avoids sharing an earlier class's cache.
        await page.evaluate(async kind => {
          const loader = await import(`/js/paintedcreatures.js?batchE=${kind}`);
          window.__batchEPainted = loader.paintedCreature;
          const s = Assets.sprites.shade.elite[kind];
          window.__batchESprite = s;
          for (const pose of ['idle','windup','strike','recover','hurt','blink']) loader.bindPaintedCreature(pose === 'idle' ? s : s[pose], 'shade', pose);
          loader.paintedCreature(s);
        }, kind);
        await page.waitForFunction(() => window.__batchEPainted(window.__batchESprite) !== window.__batchESprite);
        await page.evaluate(() => { Game.level().monsters.length = 0; });
        await placeMonster(page, 'shade', 1, { hp:999,maxHp:999,awake:true,shade:{cls:kind.slice(6),name:'Fallen '+kind.slice(6),level:1},spoke:true });
        for (const pose of poses) {
          const metrics = await page.evaluate(({kind,pose}) => {
            const m=Game.level().monsters[0], G=Game.state(), now=performance.now();
            delete m.windup;
            if (pose === 'windup') m.windup={kind:'attack',at:G.t-100,until:G.t+1e6};
            const rs=Game.renderState(now), s=rs.sprites.find(s=>s.maxHp===999);
            rs.fx={...rs.fx,arriveAt:-1e9};
            if (!s) throw new Error('Shade missing');
            const key=pose==='idle'?window.__batchESprite:window.__batchESprite[pose];
            const painted=window.__batchEPainted(key);
            if (painted===key) throw new Error('Preview frame not decoded');
            // Frozen review substitution only; no runtime class guard is removed.
            s.img=painted;s.procedural=true;s.reaction=null;
            if (!window.__batchEOriginalRender) window.__batchEOriginalRender=Renderer.render;
            Renderer.render=()=>window.__batchEOriginalRender(rs.level,rs.cam,rs.sprites,rs.fx,now);
            Renderer.render();UI.refreshHud(true);
            return {kind,pose,shown:Renderer.shown,intent:Renderer.intent};
          },{kind,pose});
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          if (!metrics.shown.length) throw new Error(`${kind}:${pose}: not drawn`);
          if (pose==='windup'&&!metrics.shown.some(s=>s.markSize>0)) throw new Error(`${kind}: warning missing`);
          await page.screenshot({path:path.join(output,`${width}-${kind}-${pose}.png`)});
          results.push({width,...metrics});
        }
        await page.unroute('**/img/creatures/shade.webp');
      }
      if(errors.length) throw new Error(errors.join('\n'));
      await context.close();
      const overview=await browser.newPage({viewport:{width:1080,height:844}});
      const origin=`http://127.0.0.1:${server.address().port}`;
      await overview.setContent(`<style>body{margin:0;background:#20242c;color:white;font:11px monospace;display:grid;grid-template-columns:repeat(6,180px)}figure{margin:0}img{width:180px}figcaption{height:28px;padding:3px}</style>`+kinds.flatMap(kind=>poses.map(pose=>`<figure><figcaption>${kind} / ${pose}</figcaption><img src="${origin}/art/creatures/batch-e-preview/dungeon/${width}-${kind}-${pose}.png"></figure>`)).join(''));
      await overview.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
      await overview.screenshot({path:path.join(output,`${width}-overview.png`),fullPage:true});
      await overview.close();
      console.log(`Captured ${kinds.length} class Shades at ${width}px`);
    }
    fs.writeFileSync(path.join(output,'review.json'),JSON.stringify({mode:'review-only image route and explicit pose substitution; no runtime integration',console_errors:[],results},null,2)+'\n');
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
