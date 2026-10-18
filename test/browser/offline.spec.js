'use strict';
const {test,expect}=require('@playwright/test');
const http=require('http');
const {serve}=require('../server');
const {watchForErrors}=require('./helpers');
const AxeBuilder=require('@axe-core/playwright').default;

test('core play is ready offline while all recordings are delayed, then voices resume and survive reload @mobile', async({page,context})=>{
  const errors=watchForErrors(page), held=new Set(), counts=new Map();let blocked=true;
  const server=http.createServer((req,res)=>{
    if (/^\/sound\/narration\/.*\.(?:ogg|m4a)$/.test(req.url)) {
      counts.set(req.url,(counts.get(req.url)||0)+1);
      if (blocked) {const entry={req,res};held.add(entry);res.on('close',()=>held.delete(entry));return;}
    }
    serve(req,res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const root=`http://127.0.0.1:${server.address().port}`;
  try {
    await page.addInitScript(()=>{
      for(const [k,v]of Object.entries({firstSeen:'1',tipsOff:'1',sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);
    });
    await page.goto(root);
    await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));
    const status=page.locator('#offline-status');
    await expect(status).toHaveAttribute('data-core','true');
    await expect(status).toContainText('Voice downloading');
    expect(held.size).toBeGreaterThan(0);
    // The worker has claimed the page even though no voice request can finish.
    await context.setOffline(true);await page.reload();
    await expect(status).toContainText('Game ready offline');
    await page.click('#btn-new');await page.click('#c-begin');await page.click('#pro-begin');
    await expect(page.locator('#screen-game')).toBeVisible();
    const dir=await page.evaluate(()=>Game.player().dir);
    await page.locator('[data-act="left"]').click();
    expect(await page.evaluate(()=>Game.player().dir)).not.toBe(dir);
    await page.reload();await expect(status).toContainText('Voice download paused');
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    expect(axe.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
    blocked=false;for(const entry of held)if(!entry.res.destroyed)serve(entry.req,entry.res);held.clear();
    await context.setOffline(false);
    await expect(status).toHaveAttribute('data-voice','ready',{timeout:30000});
    const before=[...counts];await page.reload();
    await expect(status).toContainText('Game and voice ready offline');
    expect([...counts]).toEqual(before);
    await context.setOffline(true);await page.reload();
    await expect(status).toContainText('Game and voice ready offline');
    const range=await page.evaluate(async()=>{
      const r=await fetch('/sound/narration/prologue.m4a',{headers:{Range:'bytes=0-9'}});
      return {status:r.status,length:(await r.arrayBuffer()).byteLength};
    });
    expect(range).toEqual({status:206,length:10});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    for(const entry of held)entry.res.destroy();
    await context.setOffline(false);
    const closed=new Promise(resolve=>server.close(resolve));server.closeAllConnections();await closed;
  }
});
