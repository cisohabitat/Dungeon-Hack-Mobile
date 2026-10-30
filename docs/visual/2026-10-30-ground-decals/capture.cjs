'use strict';
// Native running renderer with supplied blood/ash positions, not a combat win.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../../..');
const {chromium}=require(root+'/node_modules/playwright');
const {serve}=require(root+'/test/server');
const {startGame,artReady,faceOpenGround,placeMonster,clearBoons,watchForErrors,expect}=require(root+'/test/browser/helpers');
const out=path.join(__dirname,process.env.DECAL_OUTPUT||'before');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),records=[];
 try{for(const width of (process.env.DECAL_WIDTHS||'320,390').split(',').map(Number)){
  const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:{width,height:width===320?667:844}}),page=await context.newPage(),errors=watchForErrors(page);
  await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});
  await startGame(page,{seed:'combat-clarity',name:'Ground review'});await page.evaluate(()=>{Game.level().monsters=[];Game.player().hp=Game.player().maxHp=9999;});await faceOpenGround(page,3);await artReady(page);
  const version=await page.evaluate(async()=>{const r=await import('/js/release.js');return{version:r.RELEASE_VERSION,build:r.BUILD_NUMBER};});
  const supplied=await page.evaluate(()=>{
   const p=Game.player(),L=Game.level(),[dx,dy]=Dungeon.DIRS[p.dir],fx=Game.renderState(performance.now()).fx;
   fx.stains[L.depth]=[{x:p.x+.5+dx*1.3-dy*.22,y:p.y+.5+dy*1.3+dx*.22,r:.16,c:'#5a0608',seed:44,at:0},{x:p.x+.5+dx*2.3+dy*.18,y:p.y+.5+dy*2.3-dx*.18,r:.42,c:'#16130f',seed:93,at:0,solo:true}];
   return fx.stains[L.depth];
  });
  for(const calm of [false,true]){await page.evaluate(c=>Renderer.setCalm(c),calm);await page.waitForTimeout(1200);const file=`${width}-${calm?'calm':'normal'}.png`;await page.screenshot({path:path.join(out,file)});records.push({width,calm,file,supplied,...version});}
  // Running movement/rotation, with the same supplied presentation fixtures.
  await page.keyboard.press('ArrowRight');await page.waitForTimeout(400);await page.keyboard.press('ArrowLeft');await page.waitForTimeout(400);
  if(process.env.DECAL_ACTIONS==='1'){
   await page.evaluate(()=>{Renderer.setCalm(false);Game.renderState(performance.now()).fx.stains[Game.level().depth]=[];});
   const monster=await placeMonster(page,'orc',1,{hp:1,maxHp:1,nextAct:1e12});expect(monster).not.toBeNull();let attacks=0;
   for(;attacks<12;attacks++){
    if(await page.evaluate(uid=>!Game.level().monsters.some(m=>m.uid===uid),monster.uid))break;
    await page.locator('[data-act="attack"]').click();await page.waitForTimeout(1100);
   }
   await clearBoons(page);
   const blood=await page.evaluate(()=>Game.renderState(performance.now()).fx.stains[Game.level().depth]);expect(blood.some(s=>s.c==='#5a0608')).toBe(true);
   await page.screenshot({path:path.join(out,`${width}-real-attack.png`)});
   const target=await page.evaluate(()=>{
    const p=Game.player(),L=Game.level(),[dx,dy]=Dungeon.DIRS[p.dir],x=p.x+dx*3,y=p.y+dy*3;
    L.fields||={};L.fields[x+','+y]={k:'oil',until:Game.state().t+60000};
    const scroll={t:'scroll_fire',q:1,e:0};p.inv.push(scroll);Game.useItem(scroll);
    return{x,y,consumed:!p.inv.includes(scroll)};
   });expect(target.consumed).toBe(true);
   await expect.poll(()=>page.evaluate(({x,y})=>Game.fieldAt(x,y)?.k,target),{timeout:5000}).toBe('fire');
   try{await expect.poll(()=>page.evaluate(({x,y})=>Game.fieldAt(x,y)?.k,target),{timeout:10000}).toBe('ash');}
   catch(error){const diagnostic=await page.evaluate(({x,y})=>({t:Game.state().t,field:Game.fieldAt(x,y),paused:UI.paused(),status:Game.state().status,overlays:[...document.querySelectorAll('.overlay.open')].map(e=>({id:e.id,text:e.innerText})),tip:document.querySelector('#tip')?.innerText}),target);fs.writeFileSync(path.join(out,'action-failure.json'),JSON.stringify(diagnostic,null,2)+'\n');throw error;}
   await page.screenshot({path:path.join(out,`${width}-fire-to-ash.png`)});
   await page.keyboard.press('ArrowUp');await page.waitForTimeout(500);await page.keyboard.press('ArrowUp');await page.waitForTimeout(500);
   await page.screenshot({path:path.join(out,`${width}-ash-approach.png`)});
   records.push({width,actions:true,attacks,blood,target,ash:await page.evaluate(({x,y})=>Game.fieldAt(x,y),target),...version,scope:'Actual attack/corpse/blood and consumed fire scroll -> native fire expiry -> ash; two native forward inputs approach the cold field. Supplied1HP passive Orc, hero safety, oil field and scroll; earned talent selected through its real control; original attack/fire clocks, updates and renderer run unchanged.'});
  }
  expect(errors).toEqual([]);await context.close();
 }
 const {createHash}=require('node:crypto'),sources=Object.fromEntries(['js/renderer.js','js/paintedworld.js','img/decals/blood.png','img/decals/ash.png'].map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
 fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({scope:'Native running Game/Renderer/Assets and real turn/attack/read inputs. Comparison frames use supplied stain positions/radii/colours and cleared monsters/safety; action records label their supplied encounter/resources separately. No renderer/update substitution, unassisted/balance or physical-device claim.',sources,records},null,2)+'\n');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
