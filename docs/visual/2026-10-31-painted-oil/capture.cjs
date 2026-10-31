'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),before=process.env.OIL_BEFORE==='1',out=path.join(__dirname,before?'before':'native');
const {chromium}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server');
const {startGame,artReady,faceOpenGround,placeMonster,watchForErrors,expect}=require(root+'/test/browser/helpers');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const files=['js/release.js','js/renderer.js','js/paintedworld.js','js/elements.js','js/items.js','js/paintedcatalog.js',...(before?[]:['img/decals/oil.png'])];
 const sources=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}),records=[];
 try{for(const width of [320,390]){
  const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:{width,height:width===320?667:844}}),page=await context.newPage(),errors=watchForErrors(page);
  await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});
  await startGame(page,{seed:'combat-clarity',name:'Oil review'});await page.evaluate(()=>{Game.level().monsters=[];Game.level().dressing=[];Game.player().hp=Game.player().maxHp=9999;});
  expect(await faceOpenGround(page,3)).toBeGreaterThanOrEqual(3);await artReady(page);
  const release=await page.evaluate(async()=>{const r=await import('/js/release.js');return{version:r.RELEASE_VERSION,build:r.BUILD_NUMBER};});
  const fixture=await page.evaluate(()=>{const p=Game.player(),[dx,dy]=Dungeon.DIRS[p.dir],x=p.x+dx*2,y=p.y+dy*2;Game.level().fields={[x+','+y]:{k:'oil',until:Game.state().t+60000}};return{x,y,origin:{x:p.x,y:p.y}};});
  if(!before){await page.evaluate(async()=>{window.__oilPaint=(await import('/js/paintedworld.js')).paintedGroundDecal;});await expect.poll(()=>page.evaluate(()=>!!window.__oilPaint('oil',1))).toBe(true);}
  await page.evaluate(before=>{
   const images=before?new Set():new Set(Array.from({length:101},(_,i)=>window.__oilPaint('oil',i/100))),ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage,fill=ctx.fill;
   window.__oilEvents=[];ctx.drawImage=function(img,...args){if(images.has(img))window.__oilEvents.push('material');return draw.call(this,img,...args);};
   ctx.fill=function(...args){const m=String(this.fillStyle).match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);if(m&&Number(m[1])>46&&Math.abs(Number(m[4])-.7)<.001)window.__oilEvents.push('sheen');return fill.apply(this,args);};
  },before);
  for(const calm of [false,true]){await page.evaluate(c=>{Renderer.setCalm(c);window.__oilEvents=[];},calm);await page.waitForTimeout(500);const file=`${width}-${calm?'calm':'normal'}.png`;await page.screenshot({path:path.join(out,file)});const events=await page.evaluate(()=>window.__oilEvents);expect(events.filter(e=>e==='sheen').length).toBeGreaterThan(0);if(!before){expect(events.includes('material')).toBe(true);expect(events.lastIndexOf('sheen')).toBeGreaterThan(events.indexOf('material'));}records.push({width,...release,calm,file,fixture,events:events.slice(0,16)});}
  await page.keyboard.press('ArrowUp');await page.waitForTimeout(500);let file=`${width}-approach.png`;await page.screenshot({path:path.join(out,file)});records.push({width,...release,file,actualApproach:true});
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(500);expect(await page.evaluate(()=>({x:Game.player().x,y:Game.player().y}))).toEqual(fixture.origin);
  const thrown=await page.evaluate(()=>{Game.level().fields={};window.__oilEvents=[];const p=Game.player(),it={t:'lamp_oil',q:1,e:0};p.inv.push(it);Game.useItem(it);const landing=Game.renderState(performance.now()).fx.landings.at(-1);return{consumed:!p.inv.includes(it),landing};});expect(thrown.consumed).toBe(true);expect(thrown.landing).toBeTruthy();
  await page.waitForFunction(at=>performance.now()>=at,thrown.landing.at);expect(await page.evaluate(({x,y})=>Game.fieldAt(x,y)?.k,thrown.landing)).toBe('oil');
  await page.keyboard.press('ArrowUp');await page.waitForTimeout(600);file=`${width}-real-spill.png`;await page.screenshot({path:path.join(out,file)});records.push({width,...release,file,actualThrow:true,thrown});
  const monster=await placeMonster(page,'orc',2,{hp:999,maxHp:999,nextAct:1e12});expect(monster).not.toBeNull();
  const cast=await page.evaluate(()=>{const p=Game.player(),it={t:'scroll_fire',q:1,e:0};p.inv.push(it);Game.useItem(it);return{consumed:!p.inv.includes(it)};});expect(cast.consumed).toBe(true);
  await expect.poll(()=>page.evaluate(({x,y})=>Game.fieldAt(x,y)?.k,thrown.landing),{timeout:5000}).toBe('fire');
  const burning=await page.evaluate(({x,y})=>({field:{...Game.fieldAt(x,y)},t:Game.state().t}),thrown.landing);await page.evaluate(()=>{Game.level().monsters=[];});
  file=`${width}-real-fire.png`;await page.screenshot({path:path.join(out,file)});records.push({width,...release,file,actualIgnition:true,cast,burning});
  await expect.poll(()=>page.evaluate(({x,y})=>Game.fieldAt(x,y)?.k,thrown.landing),{timeout:10000}).toBe('ash');
  const ash=await page.evaluate(({x,y})=>({field:{...Game.fieldAt(x,y)},t:Game.state().t}),thrown.landing);expect(ash.t).toBeGreaterThanOrEqual(burning.field.until);
  file=`${width}-real-ash.png`;await page.screenshot({path:path.join(out,file)});records.push({width,...release,file,actualAsh:true,ash});
  expect(errors).toEqual([]);await context.close();
 }
 for(const[file,hash]of Object.entries(sources))expect(createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')).toBe(hash);
 fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({before,scope:'Native running Game/Renderer/Assets and original clocks. Comparison supplies oil field and cleared dressing/monsters/safety. Actual consumed lamp-oil flask lands; native forward movement approaches; real consumed Fire scroll hits supplied passive999HP Orc, then foe is cleared for visibility. Original oil ignition and burn expiry produce ash. Forwarding draw observers only; no renderer/update/image/clock substitution. Not unassisted gameplay or physical-device approval.',sources,records},null,2)+'\n');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
