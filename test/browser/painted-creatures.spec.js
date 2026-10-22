'use strict';
const { test, expect } = require('@playwright/test');
const http = require('node:http');
const { serve } = require('../server');
const { startGame, customiseCreation, faceOpenGround, placeMonster, artReady, watchForErrors } = require('./helpers');
const poses = ['idle', 'stepA', 'stepB', 'windup', 'strike', 'recover', 'special', 'hurt', 'blink'];

async function scene(page) {
  await page.addInitScript(() => { localStorage.setItem('deepdelve.sound', 'off'); localStorage.setItem('deepdelve.prelude', 'off'); });
  await startGame(page, { seed: 'combat-clarity', name: 'Art check' });
  await page.evaluate(() => { Game.level().monsters.length = 0; });
  expect(await faceOpenGround(page, 3)).toBeGreaterThanOrEqual(3);
  await placeMonster(page, 'drow_warrior', 1, { hp: 999, maxHp: 999 });
  await artReady(page, { drow_warrior: poses.slice(1) });
}
async function ready(page, elite = '') {
  await page.waitForFunction(async elite => {
    const { paintedCreature } = await import('/js/paintedcreatures.js');
    const base = elite ? Assets.sprites.drow_warrior.elite[elite] : Assets.sprites.drow_warrior;
    return paintedCreature(base) !== base;
  }, elite, { timeout: 10000 });
}

test.describe('painted dungeon creature', () => {
  test.use({ serviceWorkers: 'block' });
  test('nine cached poses retain transparency, lighting, elite colours and dice @mobile', async ({ page }) => {
    const errors = watchForErrors(page); let requests = 0;
    page.on('request', r => { if (r.url().endsWith('/img/creatures/drow_warrior.webp')) requests++; });
    await scene(page); await ready(page);
    const elite = await page.evaluate(() => ELITES[0].prefix); await ready(page, elite);
    const result = await page.evaluate(async ({ poses, elite }) => {
      const { paintedCreature } = await import('/js/paintedcreatures.js');
      const { Dice, Odds } = await import('/js/rng.js');
      const before = [Dice.s, Odds.s], art = Assets.sprites.drow_warrior;
      const read = c => {
        const px = c.getContext('2d').getImageData(0, 0, 256, 256).data;
        let n=0,minX=256,maxX=-1,minY=256,maxY=-1,light=0,hash=2166136261;
        for(let i=0;i<px.length;i+=4){hash=Math.imul(hash^px[i],16777619);if(px[i+3]>32){const x=i/4%256,y=Math.floor(i/4/256);n++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);light+=px[i]+px[i+1]+px[i+2];}}
        return {n,minX,maxX,minY,maxY,light,hash:hash>>>0};
      };
      const frames=poses.map(pose=>{const fallback=pose==='idle'?art:art[pose],p=paintedCreature(fallback);return {pose,cached:p===paintedCreature(fallback),different:p!==fallback,levels:p.levels.length,base:read(p.levels[0]),dark:read(p.levels.at(-1)),flash:read(p.flash)};});
      return {frames,elite:read(paintedCreature(art.elite[elite]).levels[0]).hash!==frames[0].base.hash,other:paintedCreature(Assets.sprites.orc)===Assets.sprites.orc,dice:Dice.s===before[0]&&Odds.s===before[1]};
    }, { poses, elite });
    for(const f of result.frames){
      expect(f.cached&&f.different).toBe(true);expect(f.levels).toBe(5);expect(f.base.n).toBeGreaterThan(3000);
      expect(f.base.minX).toBeGreaterThan(0);expect(f.base.maxX).toBeLessThan(255);expect(f.base.minY).toBeGreaterThan(0);expect(f.base.maxY).toBeLessThan(255);
      expect(f.dark.light).toBeLessThan(f.base.light);expect(f.flash.light).toBeGreaterThan(f.base.light);
    }
    expect(new Set(result.frames.map(f=>f.base.hash)).size).toBe(9);
    expect(Math.max(...result.frames.map(f=>f.base.maxY))-Math.min(...result.frames.map(f=>f.base.maxY))).toBeLessThanOrEqual(2);
    expect(result).toMatchObject({elite:true,other:true,dice:true});expect(requests).toBe(1);expect(errors).toEqual([]);
  });

  test('real wind-ups retain priority, Calm warnings and wall occlusion @mobile', async ({ page }, info) => {
    const errors=watchForErrors(page);await scene(page);await ready(page);
    const result=await page.evaluate(async()=>{
      const {Dice,Odds}=await import('/js/rng.js');const {recordingPrint}=await import('/js/recording.js');
      const G=Game.state(),L=Game.level(),m=L.monsters[0],now=performance.now();
      m.lungeAt=now;m.flashAt=now;m.flashUntil=now+130;m.windup={kind:'move',move:'parry',at:G.t-800,until:G.t+1e6};
      const rs=Game.renderState(now+50),foe=rs.sprites.find(s=>s.maxHp===999);
      const paint=calm=>{Renderer.setCalm(calm);Renderer.render(rs.level,rs.cam,rs.sprites,rs.fx,now+50);return {marked:Renderer.shown.some(s=>s.markSize>0),intent:Renderer.intent};};
      paint(false);const before=recordingPrint(G),dice=[Dice.s,Odds.s];
      const normal=paint(false),calm=paint(true),unchanged=recordingPrint(G)===before&&dice[0]===Dice.s&&dice[1]===Odds.s;
      const idx=m.y*L.w+m.x,tile=L.tiles[idx];L.tiles[idx]=Dungeon.T.WALL;const hidden=paint(true);L.tiles[idx]=tile;Renderer.setCalm(false);paint(false);
      return {normal,calm,hidden,unchanged,priority:!!foe.tell&&foe.special&&!foe.reaction};
    });
    expect(result.priority&&result.unchanged).toBe(true);
    for(const r of [result.normal,result.calm]){expect(r.marked).toBe(true);expect(r.intent).toBe('Dark Elf Warrior · Ready to parry');}
    expect(result.hidden).toEqual({marked:false,intent:''});
    await page.screenshot({path:info.outputPath('painted-guard.png')});expect(errors).toEqual([]);
  });

  for(const kind of ['delayed','corrupt'])test(`${kind} art retains every procedural fallback pose @mobile`,async({page})=>{
    const errors=watchForErrors(page);let release;const held=new Promise(r=>{release=r;});
    await page.route('**/img/creatures/drow_warrior.webp',async route=>{if(kind==='delayed'){await held;await route.continue();}else await route.fulfill({status:200,contentType:'image/webp',body:'invalid image'});});
    try{
      await scene(page);
      const fallback=await page.evaluate(async poses=>{const {paintedCreature}=await import('/js/paintedcreatures.js');const art=Assets.sprites.drow_warrior;return poses.every(p=>{const a=p==='idle'?art:art[p];return a&&paintedCreature(a)===a;})&&Renderer.shown.length>0;},poses);
      expect(fallback).toBe(true);if(kind==='delayed'){release();await ready(page);}expect(errors).toEqual([]);
    }finally{release();}
  });
});

test('painted creature survives an installed offline native reload @mobile',async({page,context,browserName})=>{
  const errors=watchForErrors(page);
  let connected=true,rejected=0;
  const server=http.createServer((req,res)=>{if(!connected){rejected++;req.socket.destroy();return;}serve(req,res);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    await page.addInitScript(()=>{for(const [k,v]of Object.entries({firstSeen:'1',tipsOff:'1',sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));
    await expect(page.locator('#offline-status')).toHaveAttribute('data-core','true');
    // As in offline.spec.js, disconnect the actual origin. WebKit's browser
    // offline emulation aborts controlled navigations before the worker runs.
    connected=false;await page.reload();expect(rejected).toBeGreaterThan(0);
    if(browserName!=='webkit'){await context.setOffline(true);await page.reload();}
    await page.click('#btn-new');await customiseCreation(page);await page.fill('#c-seed','combat-clarity');
    await page.click('#c-begin');await page.click('#pro-begin');
    await expect(page.locator('#screen-game')).toBeVisible();
    await page.evaluate(()=>{Game.level().monsters.length=0;});
    expect(await faceOpenGround(page,3)).toBeGreaterThanOrEqual(3);
    await placeMonster(page,'drow_warrior',1,{hp:999,maxHp:999});
    await artReady(page,{drow_warrior:poses.slice(1)});await ready(page);
    expect(await page.evaluate(async()=>{const r=await fetch('/img/creatures/drow_warrior.webp');return r.ok&&(await r.blob()).size>10000;})).toBe(true);
    expect(errors).toEqual([]);
  }finally{
    await context.setOffline(false);
    const closed=new Promise(resolve=>server.close(resolve));server.closeAllConnections();await closed;
  }
});
