'use strict';
// Review-only remains frames: actual reveal/expiry selection, floor order and loot.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{serve}=require('../../test/server');
const {startGame,faceOpenGround,artReady,watchForErrors,placeMonster}=require('../../test/browser/helpers');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'generation-batch-n.json'),'utf8'));
const keys=Object.keys(manifest.scenes),output=path.join(__dirname,'batch-n-preview','dungeon');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const captures=[],audits=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  for(const width of [390,320]){
   const origin=`http://127.0.0.1:${server.address().port}`,context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',baseURL:origin}),page=await context.newPage(),errors=watchForErrors(page);
   await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem(`deepdelve.${k}`,v);});
   await startGame(page,{seed:'combat-clarity',name:'Remains art review'});
   await page.evaluate(()=>{const L=Game.level();L.monsters=[];L.npcs=[];L.dressing=[];L.remains=[];L.snares={};L.items={};L.puzzle=null;});
   if(await faceOpenGround(page,3)<3)throw new Error('No clear preview corridor');
   await artReady(page,Object.fromEntries([...keys.map(k=>'dress_'+k),'goblin','gold'].map(k=>[k,[]])));
   await page.locator('#floor-card').evaluate(el=>el.style.display='none');
   const audit=await page.evaluate(async keys=>{
    const {DRESSING,SIZE}=await import('/js/dressing.js');
    if(JSON.stringify(Object.keys(DRESSING).filter(k=>k.startsWith('remains_')).sort())!==JSON.stringify([...keys].sort()))throw new Error('Remains inventory mismatch');
    const sizes={remains_bones:.46,remains_staves:.42,remains_shards:.4,remains_husk:.5};
    for(const k of keys)if(SIZE[k]!==sizes[k])throw new Error('Remains SIZE changed');
    window.__batchNFrames={};window.__batchNSizes=SIZE;Game.update=()=>{};Game.state().t=10000;
    for(const kind of keys){
     const image=new Image();image.src='/art/creatures/batch-n-preview/'+kind+'.webp';await image.decode();if(image.naturalWidth!==256||image.naturalHeight!==256)throw new Error('Invalid static export');
     const cell=document.createElement('canvas');cell.width=cell.height=256;const ctx=cell.getContext('2d');ctx.drawImage(image,0,0);
     const pixels=ctx.getImageData(0,0,256,256).data;let top=256;for(let p=3;p<pixels.length;p+=4)if(pixels[p]>32){top=Math.floor((p-3)/4/256);break;}
     const levels=[0,.25,.45,.62,.78].map(alpha=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.drawImage(cell,0,0);if(alpha){g.globalCompositeOperation='source-atop';g.globalAlpha=alpha;g.fillStyle='#000';g.fillRect(0,0,256,256);}return c;});
     window.__batchNFrames[kind]={w:256,h:256,top:top/256,levels,flash:cell,near:null};
    }
    window.__batchNOriginalRender=Renderer.render;
    const timing=[],L=Game.level(),p=Game.player(),D=Dungeon.DIRS[p.dir],now=Game.state().t;
    for(const kind of keys)for(const c of [
     {id:'before-reveal',at:now-449,until:now+1000,expected:false},
     {id:'exact-reveal-boundary',at:now-450,until:now+1000,expected:false},
     {id:'first-visible',at:now-451,until:now+1000,expected:true},
     {id:'expired',at:now-1000,until:now-1,expected:false},
     {id:'exact-expiry',at:now-1000,until:now,expected:false},
     {id:'last-visible',at:now-1000,until:now+1,expected:true},
     {id:'zero-at-fallback',at:0,until:now+1,expected:true}
    ]){
     const r={k:kind,x:p.x+D[0]+.58,y:p.y+D[1]+.46,at:c.at,until:c.until};L.remains=[r];
     const selected=Game.renderState(performance.now()).sprites.some(s=>s.img===Assets.sprites['dress_'+kind]);
     if(selected!==c.expected)throw new Error('Actual remains timing mismatch '+kind+'/'+c.id);timing.push({kind,...c,selected});
    }
    L.remains=[];return{inventory:keys,sizes,timing};
   },keys);audits.push({width,...audit});
   for(const kind of keys)for(const entry of [{mode:'clear',distance:1},{mode:'clear',distance:3},{mode:'loot-and-foe',distance:1}]){
    await page.evaluate(()=>{const L=Game.level();L.monsters=[];L.remains=[];L.items={};});
    if(entry.mode==='loot-and-foe')await placeMonster(page,'goblin',1,{hp:999,maxHp:999,awake:true});
    const metrics=await page.evaluate(({kind,entry})=>{
     const L=Game.level(),p=Game.player(),D=Dungeon.DIRS[p.dir],x=p.x+D[0]*entry.distance,y=p.y+D[1]*entry.distance,t=Game.state().t;
     const r={k:kind,x:x+.58,y:y+.46,at:t-1000,until:t+1000};L.remains=[r];if(entry.mode==='loot-and-foe')L.items[`${x},${y}`]=[{t:'gold',q:8}];
     const before=JSON.stringify(r),now=performance.now(),rs=Game.renderState(now),s=rs.sprites.find(s=>s.x===r.x&&s.y===r.y&&s.img===Assets.sprites['dress_'+kind]);
     if(!s||s.scale!==window.__batchNSizes[kind]||s.yOff!==0||s.onFloor!==true||s.dress||JSON.stringify(r)!==before)throw new Error('Actual remains identity/scale/coordinate/flags/record mismatch');
     const loot=rs.sprites.find(s=>s.img===Assets.sprites.gold),foe=rs.sprites.find(s=>s.maxHp===999);
     if(entry.mode==='loot-and-foe'&&(!loot||!loot.onFloor||!foe||foe.onFloor))throw new Error('Actual loot/foe overlap fixture missing');
     s.img=window.__batchNFrames[kind];s.procedural=true;rs.fx={...rs.fx,arriveAt:-1e9};
     Renderer.render=()=>window.__batchNOriginalRender(rs.level,rs.cam,rs.sprites,rs.fx,now);Renderer.render();UI.refreshHud(true);
     if(!Renderer.order.includes('floor'))throw new Error('Remains floor draw missing');
     if(entry.mode==='loot-and-foe'&&(Renderer.order.indexOf('stand')<Renderer.order.lastIndexOf('floor')||Renderer.shown.length!==1))throw new Error('Floor depth order/standing foe mismatch');
     return{scale:s.scale,x:s.x,y:s.y,yOff:s.yOff,onFloor:s.onFloor,dress:!!s.dress,draw_order:Renderer.order,loot_checked:entry.mode==='loot-and-foe',saved_record_unchanged:true};
    },{kind,entry});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const file=`${width}-${kind}-${entry.mode}-${entry.distance}.png`;await page.screenshot({path:path.join(output,file)});captures.push({width,kind,...entry,...metrics,file});
   }
   if(errors.length)throw new Error(errors.join('\n'));await context.close();
   const overview=await browser.newPage({viewport:{width:1080,height:844}});
   await overview.setContent('<style>body{margin:0;background:#20242c;color:white;font:11px monospace;display:grid;grid-template-columns:repeat(6,180px)}figure{margin:0;width:180px}img{width:180px}figcaption{height:40px;padding:3px}</style>'+captures.filter(c=>c.width===width).map(c=>`<figure><figcaption>${c.kind}<br>${c.mode} / ${c.distance} tile</figcaption><img src="${origin}/art/creatures/batch-n-preview/dungeon/${c.file}"></figure>`).join(''));
   await overview.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await overview.screenshot({path:path.join(output,`${width}-overview.png`),fullPage:true});await overview.close();
   console.log(`Reviewed four remains keys at ${width}px near/far and loot/foe overlap; 28 actual reveal/expiry selections passed`);
  }
  fs.writeFileSync(path.join(output,'review.json'),JSON.stringify({mode:'review-only frozen render-frame substitutions and forced remains records; actual reveal/expiry selection checked; caller deaths/smashes source-audited, not exercised; no runtime/offline integration',console_errors:[],audits,captures},null,2)+'\n');
 }finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})().catch(e=>{console.error(e);process.exitCode=1;});
