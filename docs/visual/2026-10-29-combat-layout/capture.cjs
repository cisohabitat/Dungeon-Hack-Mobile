'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(root + '/node_modules/playwright');
const { serve } = require(root + '/test/server');
const { startGame, artReady, watchForErrors } = require(root + '/test/browser/helpers');
const out = process.env.CLARITY_OUT || path.join(__dirname, 'native-reproduced');
const shapes = [[320,667,true], [320,568,true], [390,844,true], [740,360,true], [390,844,false]];
const measure = () => {
  const selectors = ['.hud', '.view-col', '.view-wrap', '#view', '#hud-status', '#minimap', '#combat-intent', '#quick-scroll', '#feet', '#log-more', '#log', '.controls', '.bottombar'];
  const boxes = Object.fromEntries(selectors.map(s => {
    const e = document.querySelector(s), r = e.getBoundingClientRect();
    return [s, {x:r.x,y:r.y,w:r.width,h:r.height,hidden:e.hidden,text:e.textContent.slice(0,180)}];
  }));
  const overlap = (a,b) => a.x < b.x+b.w-1 && b.x < a.x+a.w-1 && a.y < b.y+b.h-1 && b.y < a.y+a.h-1;
  return {t:Game.state().t,position:{x:Game.player().x,y:Game.player().y,dir:Game.player().dir},boxes,
    logOverControls:overlap(boxes['#log'],boxes['.controls']),
    quickOverIntent:overlap(boxes['#quick-scroll'],boxes['#combat-intent']),
    conditionSpill:boxes['#hud-status'].h>0 && boxes['#hud-status'].y+boxes['#hud-status'].h>boxes['#view'].y+boxes['#view'].h+1,
    chips:[...document.querySelector('#hud-status').children].map(e => e.textContent),
    messages:Game.state().log.slice(-4).map(e => e.m),
    keeper:Game.renderState(performance.now()).fx.boss};
};
(async () => {
  fs.mkdirSync(out, {recursive:true});
  const server = http.createServer(serve); await new Promise(r => server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  const records = [];
  try {
    for (const [width,height,big] of shapes.filter(s => !process.env.CLARITY_CASE || `${s[0]}x${s[1]}` === process.env.CLARITY_CASE)) {
      const ctx = await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:{width,height}});
      const page = await ctx.newPage(), errors = watchForErrors(page), label = `${width}x${height}-${big?'double-calm':'normal'}`;
      await page.addInitScript(big => {
        for (const [k,v] of Object.entries({sound:'off',samples:'off',prelude:'off',...(big?{textSize:'4',calm:'1'}:{})}))localStorage.setItem('deepdelve.'+k,v);
      }, big);
      await startGame(page,{seed:'aaa3-generated-rooms',levels:'12',name:'Keeper approach',buy:true});
      const setup = await page.evaluate(() => {
        Game.setTesting({hp:true}); Game.testFloor(12,'crypts');
        const L=Game.level(),r=L.rooms.find(r=>r.shape==='sanctum'),p=Game.player();
        const entry={x:r.x-2,y:r.y+3,dir:1};
        if(L.tiles[entry.y*L.w+entry.x]!==Dungeon.T.FLOOR)throw Error('Illegal entry');
        Object.assign(p,entry);for(const color of new Set(Object.values(L.locks)))p.inv.push({t:'key',color,q:10});
        Game.save(true);if(!Game.load())throw Error('Could not load supplied entry');
        return {entry,room:r};
      });
      const frames=[];
      for(let n=0;n<9;n++) {
        if(await page.locator('#ov-boss.open').count())await page.locator('#ov-boss .big[data-close]').click();
        await artReady(page);await page.waitForTimeout(200);
        if(await page.locator('#ov-boss.open').count())await page.locator('#ov-boss .big[data-close]').click();
        const file=`${label}-${n}.png`;await page.screenshot({path:path.join(out,file)});frames.push({file,...await page.evaluate(measure)});
        if(n<8){await page.evaluate(()=>Game.input('forward'));await page.waitForTimeout(350);}
      }
      let activeIntent=null;
      if(big && height>width) {
        await page.waitForFunction(()=>!document.querySelector('#combat-intent').hidden,null,{timeout:10000});
        const file=`${label}-intent.png`;await page.screenshot({path:path.join(out,file)});activeIntent={file,...await page.evaluate(measure)};
      }
      if(errors.length)throw Error(errors.join('\n'));
      if([...frames,...(activeIntent?[activeIntent]:[])].some(f=>f.logOverControls||f.quickOverIntent||f.conditionSpill))throw Error(label+': native layout overlap');
      records.push({width,height,big,setup,frames,activeIntent,errors,
        scope:'Generated final floor; supplied legal entry, testing HP and matching keys. Native forward inputs, introductions, foes and frames; shipped art, no source routing or frozen updates. Not unassisted play, listening or a physical device.'});
      fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(records,null,2)+'\n');
      console.log(label,'captured');await ctx.close();
    }
  } finally {await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
