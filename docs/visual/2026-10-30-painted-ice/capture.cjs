'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,process.env.ICE_OUTPUT||'native');
const {chromium}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server');
const {startGame,artReady,faceOpenGround,placeMonster,watchForErrors,expect}=require(root+'/test/browser/helpers');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const sources=Object.fromEntries(['js/release.js','js/renderer.js','js/paintedworld.js','js/elements.js','js/paintedcatalog.js','img/decals/ice.png'].map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}),records=[];
 try{for(const width of [320,390]){
  const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:{width,height:width===320?667:844}}),page=await context.newPage(),errors=watchForErrors(page);
  await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});
  await startGame(page,{seed:'combat-clarity',name:'Ice review'});await page.evaluate(()=>{Game.level().monsters=[];Game.player().hp=Game.player().maxHp=9999;});
  expect(await faceOpenGround(page,3)).toBeGreaterThanOrEqual(3);await artReady(page);
  const release=await page.evaluate(async()=>{const r=await import('/js/release.js');return{version:r.RELEASE_VERSION,build:r.BUILD_NUMBER};});
  const fixture=await page.evaluate(()=>{const p=Game.player(),L=Game.level(),[dx,dy]=Dungeon.DIRS[p.dir],x=p.x+dx*2,y=p.y+dy*2;L.dressing=(L.dressing||[]).filter(d=>d.k!=='puddle');L.fields={[x+','+y]:{k:'ice',until:Game.state().t+60000}};return{x,y};});
  await page.evaluate(async()=>{window.__icePaint=(await import('/js/paintedworld.js')).paintedGroundDecal;});
  await expect.poll(()=>page.evaluate(()=>!!window.__icePaint('ice',1))).toBe(true);
  await page.evaluate(()=>{const images=new Set(Array.from({length:101},(_,i)=>window.__icePaint('ice',i/100))),ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage;window.__iceDraws=0;ctx.drawImage=function(img,...args){if(images.has(img))window.__iceDraws++;return draw.call(this,img,...args);};});
  for(const calm of [false,true]){await page.evaluate(c=>Renderer.setCalm(c),calm);await page.waitForTimeout(500);const file=`${width}-${calm?'calm':'normal'}.png`;await page.screenshot({path:path.join(out,file)});records.push({width,...release,calm,file,fixture,suppliedFieldDuration:60000});}
  // A real consumed Frost scroll freezes a supplied puddle under a passive foe.
  await page.evaluate(({x,y})=>{Renderer.setCalm(false);const L=Game.level();L.fields={};L.dressing=[...L.dressing,{k:'puddle',x,y,ox:0,oy:0,r:.34}];},fixture);
  const monster=await placeMonster(page,'orc',2,{hp:999,maxHp:999,nextAct:1e12});expect(monster).not.toBeNull();
  const cast=await page.evaluate(()=>{const p=Game.player(),it={t:'scroll_frost',q:1,e:0},started=Game.state().t;p.inv.push(it);Game.useItem(it);return{started,consumed:!p.inv.includes(it)};});expect(cast.consumed).toBe(true);
  await expect.poll(()=>page.evaluate(({x,y})=>Game.fieldAt(x,y)?.k,fixture),{timeout:5000}).toBe('ice');
  const frozen=await page.evaluate(({x,y})=>({field:{...Game.fieldAt(x,y)},t:Game.state().t}),fixture);
  // Clear the fixture foe after the real strike so its feet do not cover ice.
  await page.evaluate(()=>{Game.level().monsters=[];});
  for(const calm of [false,true]){await page.evaluate(c=>Renderer.setCalm(c),calm);await page.waitForTimeout(300);const file=`${width}-real-freeze-${calm?'calm':'normal'}.png`;await page.screenshot({path:path.join(out,file)});records.push({width,...release,calm,file,actualFreeze:true,cast,frozen,fixture,monster:monster.uid});}
  const beforeStep=await page.evaluate(()=>({x:Game.player().x,y:Game.player().y,dir:Game.player().dir}));
  await page.keyboard.press('ArrowUp');await page.waitForTimeout(500);
  const approach=await page.evaluate(()=>({x:Game.player().x,y:Game.player().y}));expect(approach).not.toEqual({x:beforeStep.x,y:beforeStep.y});
  const nearFile=`${width}-ice-approach.png`;await page.screenshot({path:path.join(out,nearFile)});records.push({width,...release,file:nearFile,actualApproach:true,beforeStep,approach,fixture});
  await expect.poll(()=>page.evaluate(({x,y})=>Game.fieldAt(x,y),fixture),{timeout:12000}).toBeNull();
  const thaw=await page.evaluate(({x,y})=>({t:Game.state().t,puddle:Game.level().dressing.some(d=>d.k==='puddle'&&d.x===x&&d.y===y),draws:window.__iceDraws}),fixture);expect(thaw.puddle).toBe(true);expect(thaw.draws).toBeGreaterThan(0);expect(thaw.t).toBeGreaterThanOrEqual(frozen.field.until);
  const file=`${width}-real-thaw.png`;await page.screenshot({path:path.join(out,file)});records.push({width,...release,file,actualThaw:true,thaw,fixture});
  expect(errors).toEqual([]);await context.close();
 }
 for(const[file,hash]of Object.entries(sources))expect(createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')).toBe(hash);
 fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({scope:'Native running Game/Renderer/Assets. Comparison supplies60s ice field, cleared monsters and safety. Action consumes Frost scroll against supplied passive999HP Orc in supplied canonical .34 puddle; clears foe after actual strike for visibility, then observes original ice expiry restoring visible puddle. No renderer/update/image/clock substitution. Not unassisted gameplay or physical-device approval.',sources,records},null,2)+'\n');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
