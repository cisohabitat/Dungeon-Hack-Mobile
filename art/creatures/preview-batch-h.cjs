'use strict';
// Review-only boss variant artwork; actual variant guards and dungeon renderer unchanged.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const {serve}=require('../../test/server');
const {startGame,faceOpenGround,placeMonster,artReady,watchForErrors}=require('../../test/browser/helpers');
const folder=__dirname,poses=['idle','stepA','stepB','windup','strike','recover','hurt'];
const output=path.join(folder,'batch-h-preview','dungeon');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[],variants=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  for(const width of [390,320]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',baseURL:`http://127.0.0.1:${server.address().port}`});const page=await context.newPage(),errors=watchForErrors(page);
   await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem(`deepdelve.${k}`,v);});
   await startGame(page,{seed:'combat-clarity',name:'Boss variant art review'});await page.evaluate(()=>{Game.level().monsters.length=0;Game.update=()=>{};});
   if(await faceOpenGround(page,3)<3)throw new Error('No clear preview corridor');await artReady(page,{heartforged:['windup','strike','recover','hurt','stepA','stepB'],warlord:['windup','strike','recover','hurt','stepA','stepB']});
   variants.push({width,checks:await page.evaluate(async()=>{
    const out=[];
    for(const id of ['heartforged','warlord','lich']) for(const phase of [0,1,2]){
     const mb=Game.mstat({id,phase});
     if(id==='warlord'&&Boolean(mb.ranged)!==(phase===1))throw new Error('Warlord spear phase audit mismatch');
     out.push({id,phase,ranged:!!mb.ranged,speed:mb.speed});
    }
    return out;
   })});
   for(const kind of ['heartforged_open','heartforged_whitehot','warlord_throne','warlord_spear','lich_phase1','lich_phase2','warlord_frenzy']){
   await page.evaluate(()=>{Game.level().monsters.length=0;});
   const id=kind.startsWith('heartforged')?'heartforged':kind.startsWith('lich')?'lich':'warlord';
   const phase=['heartforged_whitehot','lich_phase2','warlord_frenzy'].includes(kind)?2:1;
   await placeMonster(page,id,1,{hp:999,maxHp:999,awake:true,spoke:true,phase,throne:kind==='warlord_throne',wardUntil:kind==='warlord_throne'?1e12:0});
   await page.locator('#floor-card').evaluate(el=>el.style.display='none');
   await page.evaluate(async({kind,id})=>{
    const {POSES}=await import('/js/creatures.js');window.__batchHSupported=POSES[id];
    const image=new Image();image.src=kind.startsWith('lich')?'/img/creatures/lich.webp':kind==='warlord_frenzy'?'/img/creatures/warlord.webp':'/art/creatures/batch-h-preview/'+kind+'.webp';await image.decode();if(image.naturalWidth!==768||image.naturalHeight!==768)throw new Error('Invalid atlas');
    const names=['idle','stepA','stepB','windup','strike','recover','special','hurt','blink'];window.__batchHFrames={};
    names.forEach((name,i)=>{
     const cell=document.createElement('canvas');cell.width=cell.height=256;const ctx=cell.getContext('2d');ctx.drawImage(image,i%3*256,Math.floor(i/3)*256,256,256,0,0,256,256);
     const pixels=ctx.getImageData(0,0,256,256).data;let top=256;for(let p=3;p<pixels.length;p+=4)if(pixels[p]>32){top=Math.floor((p-3)/4/256);break;}
     const levels=[0,.25,.45,.62,.78].map(alpha=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.drawImage(cell,0,0);if(alpha){g.globalCompositeOperation='source-atop';g.globalAlpha=alpha;g.fillStyle='#000';g.fillRect(0,0,256,256);}return c;});
     window.__batchHFrames[name]={w:256,h:256,top:top/256,levels,flash:cell,near:null};
    });
   },{kind,id});
   const selected=kind.startsWith('lich')?['idle','windup','special']:kind==='warlord_frenzy'?['idle','windup','strike','recover']:kind==='warlord_throne'?poses.filter(p=>!p.startsWith('step')):poses;
   for(const pose of selected){
    const metrics=await page.evaluate(({pose,kind})=>{
     if(pose!=='idle'&&!window.__batchHSupported.includes(pose))throw new Error('Unsupported pose');
     const m=Game.level().monsters[0],G=Game.state(),now=performance.now();delete m.windup;
     if(pose==='special')m.windup={kind:'move',move:'nova',at:G.t-100,until:G.t+1e6};
     if(pose==='windup')m.windup={kind:kind.startsWith('heartforged')?'move':kind.startsWith('lich')?'magic':kind==='warlord_frenzy'?'attack':'shot',...(kind.startsWith('heartforged')?{move:'stamp'}:{}),at:G.t-100,until:G.t+1e6};
     const rs=Game.renderState(now),sprite=rs.sprites.find(s=>s.maxHp===999);if(!sprite||!sprite.procedural)throw new Error('Boss phase procedural guard missing');
     if(Boolean(m.throne)!==(kind==='warlord_throne'))throw new Error('Forced throne state drifted');
     const scale=sprite.scale;sprite.img=window.__batchHFrames[pose];sprite.procedural=true;sprite.reaction=null;rs.fx={...rs.fx,arriveAt:-1e9};
     if(!window.__batchHOriginalRender)window.__batchHOriginalRender=Renderer.render;
     Renderer.render=()=>window.__batchHOriginalRender(rs.level,rs.cam,rs.sprites,rs.fx,now);Renderer.render();UI.refreshHud(true);
     return{pose,phase:m.phase,throne:!!m.throne,scale,alpha:sprite.alpha??1,shown:Renderer.shown,intent:Renderer.intent};
    },{pose,kind});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    if(!metrics.shown.length)throw new Error('Boss not drawn');if(pose==='windup'&&!metrics.shown.some(s=>s.markSize>0))throw new Error('Attack warning hidden');
    await page.screenshot({path:path.join(output,`${width}-${kind}-${pose}.png`)});results.push({width,kind,...metrics});
   }
   }
   if(errors.length)throw new Error(errors.join('\n'));await context.close();
   const overview=await browser.newPage({viewport:{width:1260,height:844}}),origin=`http://127.0.0.1:${server.address().port}`;
   const groups=[...new Set(results.filter(r=>r.width===width).map(r=>r.kind))];
   await overview.setContent('<style>body{margin:0;background:#20242c;color:white;font:11px monospace}section{display:flex}figure{margin:0;width:180px}img{width:180px}figcaption{height:28px;padding:3px}</style>'+groups.map(kind=>'<section>'+results.filter(r=>r.width===width&&r.kind===kind).map(r=>`<figure><figcaption>${kind} / ${r.pose}</figcaption><img src="${origin}/art/creatures/batch-h-preview/dungeon/${width}-${kind}-${r.pose}.png"></figure>`).join('')+'</section>').join(''));
   await overview.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await overview.screenshot({path:path.join(output,`${width}-overview.png`),fullPage:true});await overview.close();console.log(`Captured boss variants and reused sheets at ${width}px`);
  }
  fs.writeFileSync(path.join(output,'review.json'),JSON.stringify({mode:'review-only frozen painted-cell substitutions; unchanged actual variant guards and renderer',console_errors:[],variants,results},null,2)+'\n');
 }finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})().catch(e=>{console.error(e);process.exitCode=1;});
