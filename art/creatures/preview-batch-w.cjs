'use strict';
// Actual shipped screens and outcomes, isolated setup fixtures, no replacement art.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{serve}=require('../../test/server');
const {expect,watchForErrors,clearBoons}=require('../../test/browser/helpers');
const out=path.join(__dirname,'batch-w-preview');fs.mkdirSync(out,{recursive:true});
const galleriesOnly=process.argv.includes('--galleries');
const modes=[{name:'390',width:390,height:844},{name:'320',width:320,height:667},{name:'landscape',width:851,height:393},{name:'desktop',width:1280,height:800},{name:'390-double',width:390,height:844,big:true},{name:'320-double',width:320,height:667,big:true}];
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const captures=[],audits=[];
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const origin=`http://127.0.0.1:${server.address().port}`;
 async function context(m,first=false){const ctx=await browser.newContext({viewport:{width:m.width,height:m.height},baseURL:origin}),page=await ctx.newPage(),errors=watchForErrors(page);await page.addInitScript(({big,first})=>{const flags={sound:'off',samples:'off',prelude:'off',tipsOff:'1',textSize:big?'4':'1'};if(!first)flags.firstSeen='1';for(const[k,v]of Object.entries(flags))localStorage.setItem('deepdelve.'+k,v);},{big:!!m.big,first});return{ctx,page,errors};}
 async function record(page,m,name,extra={}){
  await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));await Promise.all([...document.images].filter(i=>i.getClientRects().length).map(i=>i.decode().catch(()=>{})));});
  const metrics=await page.evaluate(()=>({font:getComputedStyle(document.documentElement).fontSize,horizontal_overflow:document.documentElement.scrollWidth>innerWidth+1,title_art:UI.titleArt(),visible_images:[...document.images].filter(i=>i.getClientRects().length).map(i=>({src:i.getAttribute('src')?.startsWith('data:')?'procedural fallback':i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})),end_title:document.querySelector('#screen-end.active #end-title')?.textContent||null}));
  if(metrics.horizontal_overflow||metrics.visible_images.some(i=>!i.loaded))throw Error('Screen overflow/image failure '+m.name+' '+name);
  const file=m.name+'-'+name+'.png';
  if(extra.pending_load){
   if(await page.evaluate(()=>document.fonts.size)!==0)throw Error('Pending-load capture expects system fonts only');
   const cdp=await page.context().newCDPSession(page);try{const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,file),Buffer.from(shot.data,'base64'));}finally{await cdp.detach();}
  }else await page.screenshot({path:path.join(out,file)});captures.push({mode:m.name,name,file,...extra,...metrics});
 }
 async function begin(page,cls='fighter'){
  await page.goto('/');await page.click('#btn-new');await page.click('[data-cls="'+cls+'"]');await page.click('#c-customise > summary');await page.fill('#c-seed','batch-w-screen-audit');await page.selectOption('#c-levels','4');await page.click('#c-begin');await expect(page.locator('#screen-prologue')).toBeVisible();
 }
 async function enter(page){await page.click('#pro-begin');await expect(page.locator('#screen-game')).toBeVisible();await page.evaluate(()=>{Game.level().monsters=[];Game.level().npcs=[];});await page.waitForFunction(()=>Assets.sprites['portrait_'+Game.player().cls].levels[0].width===512);}
 async function share(page,m,name){const[download]=await Promise.all([page.waitForEvent('download'),page.click('#end-card')]);const bytes=fs.readFileSync(await download.path());if(bytes.readUInt32BE(16)!==800||bytes.readUInt32BE(20)!==420)throw Error('Unexpected native share format');const file=m.name+'-'+name+'.png';fs.writeFileSync(path.join(out,file),bytes);captures.push({mode:m.name,name,file,native_export:[800,420]});}
 async function victory(page,how){
  await clearBoons(page);await page.evaluate(how=>{
   while(Game.state().depth<4){Game.level().monsters=[];Game.descend();if(Game.forkPending())Game.chooseRoute('crypts');}
   const G=Game.state(),L=Game.level(),p=Game.player();L.monsters=[];L.npcs=[];
   if(how==='quench')p.inv.push({t:'quench',q:1,e:0});if(how==='keep')G.threads={...(G.threads||{}),smithway:true};
   const entry=Object.entries(L.items).find(([,v])=>v.some(i=>i.t==='artifact'));if(!entry)throw Error('Native final-floor Heart missing');[p.x,p.y]=entry[0].split(',').map(Number);Game.takeItem(entry[1].find(i=>i.t==='artifact'));
  },how);
  if(how!=='take'){
   await expect(page.locator('#ov-encounter')).toHaveClass(/open/);const label=how==='quench'?/Put it out with/:/Stay, and keep it/;const choice=page.getByRole('button',{name:label});await expect(choice).not.toHaveClass(/arming/);await choice.click();
  }
  await expect(page.locator('#screen-end')).toBeVisible({timeout:10000});const state=await page.evaluate(()=>({status:Game.state().status,ending:Game.state().ending,depth:Game.state().depth,face:document.querySelector('#end-face').getAttribute('src'),text:document.querySelector('#end-text').textContent}));if(state.status!=='won'||state.ending!==how||state.depth!==4)throw Error('Native ending mismatch');return state;
 }
 if(!galleriesOnly){
 for(const m of modes){
  const{ctx,page,errors}=await context(m);await page.goto('/');await page.waitForFunction(()=>UI.titleArt()?.ready);await expect(page.locator('#screen-title')).not.toHaveClass(/opening/);await record(page,m,'title');
  await page.evaluate(()=>localStorage.setItem('deepdelve.calm','1'));await page.reload();await page.waitForFunction(()=>UI.titleArt()?.ready&&UI.titleArt().still);await record(page,m,'title-calm');await page.evaluate(()=>localStorage.removeItem('deepdelve.calm'));
  await begin(page,'mage');await page.waitForFunction(()=>document.querySelector('#pro-face').complete&&document.querySelector('#pro-face').naturalWidth===512);await record(page,m,'prologue');await enter(page);
  await page.evaluate(()=>Game.hurtPlayer(99999,'the screen-art audit'));await expect(page.locator('#screen-end')).toBeVisible();await expect(page.locator('#end-face')).toHaveClass(/fallen/);await record(page,m,'death');await share(page,m,'death-share');
  await begin(page,'ranger');await enter(page);const state=await victory(page,'take');await expect(page.locator('#end-face')).not.toHaveClass(/fallen/);await record(page,m,'victory',state);await share(page,m,'victory-share');
  if(errors.length)throw Error(errors.join('\n'));audits.push({mode:m.name,viewport:[m.width,m.height],text:m.big?32:16,outcomes:['death','take'],console_errors:[]});await ctx.close();console.log('Native major screens '+m.name);
 }
 for(const m of modes.slice(0,2))for(const how of ['quench','keep']){
  const{ctx,page,errors}=await context(m);await begin(page,'cleric');await enter(page);const state=await victory(page,how);await record(page,m,'ending-'+how,state);await share(page,m,'ending-'+how+'-share');if(errors.length)throw Error(errors.join('\n'));await ctx.close();
 }
 // A delayed title illustration is a temporary existing fallback, not a missing loading scene.
 {const m=modes[0],{ctx,page,errors}=await context(m);let release;const gate=new Promise(r=>release=r);await page.route('**/img/keyart-*.webp',async route=>{await gate;await route.continue();});try{await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>UI.titleArt()&&!UI.titleArt().ready);await expect(page.locator('#screen-title')).not.toHaveClass(/opening/);await record(page,m,'title-loading',{pending_load:true});release();await page.waitForFunction(()=>UI.titleArt()?.ready);await record(page,m,'title-recovered');}finally{release();}if(errors.length)throw Error(errors.join('\n'));await ctx.close();}
 for(const m of modes.slice(0,2)){
  const{ctx,page,errors}=await context(m,true);await page.goto('/');await page.waitForFunction(()=>UI.titleArt()?.ready);await record(page,m,'first-visit');await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.evaluate(async()=>{for(const p of ['img/keyart-portrait.webp','img/keyart-landscape.webp'])if(!await caches.match('./'+p))throw Error('Key art cache missing');});await ctx.setOffline(true);await page.reload();await page.waitForFunction(()=>UI.titleArt()?.ready);await record(page,m,'offline-title');await page.setViewportSize({width:851,height:393});await page.waitForFunction(()=>UI.titleArt()?.ready&&UI.titleArt().which==='landscape');await record(page,{...m,name:m.name+'-offline-sideways'},'title');await ctx.setOffline(false);if(errors.length)throw Error(errors.join('\n'));await ctx.close();
 }
 }else{const prior=JSON.parse(fs.readFileSync(path.join(out,'captures.json')));captures.push(...prior.captures);audits.push(...prior.audits);}
 for(const group of [...modes.map(m=>m.name),'390-offline-sideways','320-offline-sideways']){
  const items=captures.filter(c=>c.mode===group),ov=await browser.newPage({viewport:{width:1280,height:300}});await ov.setContent('<style>body{margin:0;background:#20242c;color:white;font:12px monospace;display:grid;align-content:start;align-items:start;grid-template-columns:repeat(6,210px)}figure{margin:0}img{width:210px}figcaption{height:26px}</style>'+items.map(c=>`<figure><figcaption>${c.name}</figcaption><img src="${origin}/art/creatures/batch-w-preview/${c.file}"></figure>`).join(''));await ov.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await ov.screenshot({path:path.join(out,group+'-overview.png'),fullPage:true});await ov.close();
 }
 fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify({mode:'Actual shipped UI, native death/Heart selection/download/offline flows; isolated setup removes foes and positions hero, no image substitution, no renderer or outcome overrides',audits,captures,console_errors:[]},null,2)+'\n');
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
