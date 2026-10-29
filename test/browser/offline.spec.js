'use strict';
const {test,expect}=require('@playwright/test');
const {startOfflineServer}=require('../offline-server.cjs');
const {watchForErrors,artReady}=require('./helpers');
const AxeBuilder=require('@axe-core/playwright').default;

test('core play is ready offline while all recordings are delayed, then voices resume and survive reload @mobile', async({page,context,browserName})=>{
  const errors=watchForErrors(page), server=await startOfflineServer({holdVoices:true});
  const root=server.url;
  // Cut the actual origin connection, retaining native reloads in both engines.
  // WebKit's browser-offline emulation aborts controlled navigations internally;
  // Chromium additionally exercises that emulation after the cache is complete.
  const connection=online=>server.setConnected(online);
  try {
    await page.addInitScript(()=>{
      for(const [k,v]of Object.entries({firstSeen:'1',tipsOff:'1',sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);
    });
    await page.goto(root);
    // Measure installation after the unrelated deferred raster queue settles.
    if(browserName!=='webkit')await artReady(page);
    await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));
    const status=page.locator('#offline-status');
    await expect(status).toHaveAttribute('data-core','true');
    await expect(status).toContainText('Voice downloading');
    expect((await server.stats()).held).toBeGreaterThan(0);
    // The worker has claimed the page even though no voice request can finish.
    await connection(false);await page.reload();
    await expect(status).toContainText('Game ready offline');
    expect((await server.stats()).rejected).toBeGreaterThan(0);
    await page.click('#btn-new');await page.click('#c-begin');await page.click('#pro-begin');
    await expect(page.locator('#screen-game')).toBeVisible();
    const dir=await page.evaluate(()=>Game.player().dir);
    await page.locator('[data-act="left"]').click();
    expect(await page.evaluate(()=>Game.player().dir)).not.toBe(dir);
    await page.reload();await expect(status).toContainText('Voice download paused');
    // Cache status can settle before the menu's entrance fade finishes.
    await expect(page.locator('#screen-title')).not.toHaveClass(/opening/);
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    expect(axe.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
    await server.setVoicesBlocked(false);
    await connection(true);
    await expect(status).toHaveAttribute('data-voice','ready',{timeout:30000});
    const before=(await server.stats()).voiceCounts;await page.reload();
    await expect(status).toContainText('Game and voice ready offline');
    expect((await server.stats()).voiceCounts).toEqual(before);
    await connection(false);
    if(browserName!=='webkit')await context.setOffline(true);
    await page.reload();
    await expect(status).toContainText('Game and voice ready offline');
    const range=await page.evaluate(async()=>{
      const r=await fetch('/sound/narration/prologue.m4a',{headers:{Range:'bytes=0-9'}});
      return {status:r.status,length:(await r.arrayBuffer()).byteLength};
    });
    expect(range).toEqual({status:206,length:10});
    const relicImages=await page.evaluate(async()=>{
      const {RELICS}=await import('/js/relics.js');
      return Promise.all(Object.keys(RELICS).map(async id=>{
        const image=new Image();image.src=`/img/relics/${id}.webp`;
        await image.decode();return image.naturalWidth;
      }));
    });
    expect(relicImages).toHaveLength(47);
    expect(relicImages.every(width=>width===512)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await context.setOffline(false);
    await server.close();
  }
});
