'use strict';
// Review-only barrel artwork; actual variant guards and dungeon renderer unchanged.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const {serve}=require('../../test/server');
const {startGame,faceOpenGround,placeMonster,artReady,watchForErrors}=require('../../test/browser/helpers');
const folder=__dirname,poses=['idle','stepA','stepB','windup','strike','recover','hurt'];
const output=path.join(folder,'batch-g-preview','dungeon');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[],variants=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  for(const width of [390,320]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',baseURL:`http://127.0.0.1:${server.address().port}`});const page=await context.newPage(),errors=watchForErrors(page);
   await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem(`deepdelve.${k}`,v);});
   await startGame(page,{seed:'combat-clarity',name:'Barrel Mimic art review'});await page.evaluate(()=>{Game.level().monsters.length=0;});
   if(await faceOpenGround(page,3)<3)throw new Error('No clear preview corridor');await artReady(page,{mimic:poses.filter(p=>p!=='idle')});
   await placeMonster(page,'mimic',1,{hp:999,maxHp:999,awake:true,disguised:false,disguise:'barrel'});
   const checks=await page.evaluate(()=>{
    const m=Game.level().monsters[0],now=performance.now(),out=[];
    for(const disguise of ['barrel',null,'chest'])for(const concealed of [false,true]){
     if(disguise===null)delete m.disguise;else m.disguise=disguise;m.disguised=concealed;
     const rs=Game.renderState(now),sprite=concealed?rs.sprites.find(s=>s.img===Assets.sprites['dress_'+(disguise||'barrel')]):rs.sprites.find(s=>s.maxHp===999);
     if(!sprite)throw new Error('Variant sprite missing');
     if(concealed){if(!sprite.dress||sprite.img!==Assets.sprites['dress_'+(disguise||'barrel')])throw new Error('Concealment exposed creature');}
     else if(!!sprite.procedural!==(disguise!=='chest'))throw new Error('Existing variant guard changed');
     out.push({disguise:disguise===null?'missing/default':disguise,concealed,procedural:!!sprite.procedural,uses_scenery:!!sprite.dress});
    }
    m.disguise='barrel';m.disguised=false;return out;
   });variants.push({width,checks});
   await page.locator('#floor-card').evaluate(el=>el.style.display='none');
   await page.evaluate(async()=>{
    const {POSES}=await import('/js/creatures.js');window.__batchGSupported=POSES.mimic;
    const image=new Image();image.src='/art/creatures/batch-g-preview/mimic_barrel.webp';await image.decode();if(image.naturalWidth!==768||image.naturalHeight!==768)throw new Error('Invalid atlas');
    const names=['idle','stepA','stepB','windup','strike','recover','special','hurt','blink'];window.__batchGFrames={};
    names.forEach((name,i)=>{
     const cell=document.createElement('canvas');cell.width=cell.height=256;const ctx=cell.getContext('2d');ctx.drawImage(image,i%3*256,Math.floor(i/3)*256,256,256,0,0,256,256);
     const pixels=ctx.getImageData(0,0,256,256).data;let top=256;for(let p=3;p<pixels.length;p+=4)if(pixels[p]>32){top=Math.floor((p-3)/4/256);break;}
     const levels=[0,.25,.45,.62,.78].map(alpha=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.drawImage(cell,0,0);if(alpha){g.globalCompositeOperation='source-atop';g.globalAlpha=alpha;g.fillStyle='#000';g.fillRect(0,0,256,256);}return c;});
     window.__batchGFrames[name]={w:256,h:256,top:top/256,levels,flash:cell,near:null};
    });
   });
   for(const pose of poses){
    const metrics=await page.evaluate(pose=>{
     if(pose!=='idle'&&!window.__batchGSupported.includes(pose))throw new Error('Unsupported pose');
     const m=Game.level().monsters[0],G=Game.state(),now=performance.now();delete m.windup;
     if(pose==='windup')m.windup={kind:'attack',at:G.t-100,until:G.t+1e6};
     const rs=Game.renderState(now),sprite=rs.sprites.find(s=>s.maxHp===999);if(!sprite||!sprite.procedural)throw new Error('Barrel procedural guard missing');
     const scale=sprite.scale;sprite.img=window.__batchGFrames[pose];sprite.procedural=true;sprite.reaction=null;rs.fx={...rs.fx,arriveAt:-1e9};
     if(!window.__batchGOriginalRender)window.__batchGOriginalRender=Renderer.render;
     Renderer.render=()=>window.__batchGOriginalRender(rs.level,rs.cam,rs.sprites,rs.fx,now);Renderer.render();UI.refreshHud(true);
     return{pose,scale,shown:Renderer.shown,intent:Renderer.intent};
    },pose);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    if(!metrics.shown.length)throw new Error('Mimic not drawn');if(pose==='windup'&&!metrics.shown.some(s=>s.markSize>0))throw new Error('Attack warning hidden');
    await page.screenshot({path:path.join(output,`${width}-mimic_barrel-${pose}.png`)});results.push({width,...metrics});
   }
   if(errors.length)throw new Error(errors.join('\n'));await context.close();
   const overview=await browser.newPage({viewport:{width:1260,height:Math.ceil(844*180/width)+32}}),origin=`http://127.0.0.1:${server.address().port}`;
   await overview.setContent('<style>body{margin:0;background:#20242c;color:white;font:11px monospace;display:flex}figure{margin:0;width:180px}img{width:180px}figcaption{height:28px;padding:3px}</style>'+poses.map(p=>`<figure><figcaption>barrel / ${p}</figcaption><img src="${origin}/art/creatures/batch-g-preview/dungeon/${width}-mimic_barrel-${p}.png"></figure>`).join(''));
   await overview.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await overview.screenshot({path:path.join(output,`${width}-overview.png`),fullPage:true});await overview.close();console.log(`Captured barrel Mimic at ${width}px; six existing variant cases passed`);
  }
  fs.writeFileSync(path.join(output,'review.json'),JSON.stringify({mode:'review-only frozen painted-cell substitutions; unchanged actual variant guards and renderer',console_errors:[],variants,results},null,2)+'\n');
 }finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})().catch(e=>{console.error(e);process.exitCode=1;});
