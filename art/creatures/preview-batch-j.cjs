'use strict';
// Review-only scene and encounter-card substitutions; no source gameplay edits.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const {serve}=require('../../test/server');
const {startGame,faceOpenGround,artReady,watchForErrors}=require('../../test/browser/helpers');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'generation-batch-j.json'),'utf8'));
const output=path.join(__dirname,'batch-j-preview','dungeon');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const captures=[],dialogs=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  for(const width of [390,320]){
   const origin=`http://127.0.0.1:${server.address().port}`,context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',baseURL:origin}),page=await context.newPage(),errors=watchForErrors(page);
   await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem(`deepdelve.${k}`,v);});
   await startGame(page,{seed:'combat-clarity',name:'Encounter art review'});await page.evaluate(()=>{Game.level().monsters.length=0;Game.level().npcs.length=0;});
   if(await faceOpenGround(page,3)<3)throw new Error('No clear preview corridor');await artReady(page,Object.fromEntries(Object.keys(manifest.scenes).map(k=>[k,[]])));
   await page.locator('#floor-card').evaluate(el=>el.style.display='none');
   const cases=await page.evaluate(async kinds=>{
    const {ENCOUNTERS}=await import('/js/encounters.js');window.__batchJFrames={};Game.update=()=>{};
    for(const kind of kinds){
     const image=new Image();image.src='/art/creatures/batch-j-preview/'+kind+'.webp';await image.decode();if(image.naturalWidth!==256||image.naturalHeight!==256)throw new Error('Invalid static export');
     const cell=document.createElement('canvas');cell.width=cell.height=256;const ctx=cell.getContext('2d');ctx.drawImage(image,0,0);
     const pixels=ctx.getImageData(0,0,256,256).data;let top=256;for(let p=3;p<pixels.length;p+=4)if(pixels[p]>32){top=Math.floor((p-3)/4/256);break;}
     const levels=[0,.25,.45,.62,.78].map(alpha=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.drawImage(cell,0,0);if(alpha){g.globalCompositeOperation='source-atop';g.globalAlpha=alpha;g.fillStyle='#000';g.fillRect(0,0,256,256);}return c;});
     window.__batchJFrames[kind]={w:256,h:256,top:top/256,levels,flash:cell,near:null};
    }
    window.__batchJOriginalRender=Renderer.render;
    return Object.entries(ENCOUNTERS).filter(([id,e])=>kinds.includes(e.sprite)).map(([id,e])=>({id,kind:e.sprite,title:e.title,choices:e.choices.map(c=>c.label)}));
   },Object.keys(manifest.scenes));
   if(cases.length!==18||cases.filter(c=>c.kind==='wisp').length!==2)throw new Error('Encounter coverage/shared Wisp changed');
   for(const entry of cases){
    for(const distance of [1,3]){
     const metrics=await page.evaluate(({entry,distance})=>{
      const L=Game.level(),p=Game.player(),D=Dungeon.DIRS[p.dir];L.npcs=[{id:entry.id,kind:'encounter',x:p.x+D[0]*distance,y:p.y+D[1]*distance}];
      const n=L.npcs[0],now=performance.now(),rs=Game.renderState(now),sprite=rs.sprites.find(s=>s.x===n.x+.5&&s.y===n.y+.5);
      if(!sprite||sprite.img!==Assets.sprites[entry.kind]||sprite.scale!==.85||sprite.yOff!==0)throw new Error('Actual scene identity/position/scale mismatch');
      sprite.img=window.__batchJFrames[entry.kind];sprite.procedural=true;rs.fx={...rs.fx,arriveAt:-1e9};
      Renderer.render=()=>window.__batchJOriginalRender(rs.level,rs.cam,rs.sprites,rs.fx,now);Renderer.render();UI.refreshHud(true);
      if(!Renderer.order.includes('stand'))throw new Error('Scene draw missing');
      return{distance,scale:sprite.scale,x:sprite.x,y:sprite.y,facing:p.dir,light:Renderer.lightOf(L,n.x,n.y)};
     },{entry,distance});
     await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     await page.screenshot({path:path.join(output,`${width}-${entry.id}-${distance}.png`)});captures.push({width,...entry,...metrics});
    }
    // Move only the preview NPC back beside the hero; Use opens the real choices.
    await page.evaluate(entry=>{
     const p=Game.player(),D=Dungeon.DIRS[p.dir],n=Game.level().npcs[0];n.x=p.x+D[0];n.y=p.y+D[1];
     // Card-only URL substitution, never a loader binding; no choice is answered.
     Game.input('use');
    },entry);
    await page.waitForFunction(()=>!!Game.currentEncounter()&&document.querySelector('#ov-encounter').classList.contains('open'));
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#ov-encounter')).opacity)>=.999);
    const check=await page.evaluate(()=>{
     const e=Game.currentEncounter();return{title:document.querySelector('#enc-title').textContent,choices:e.def.choices.map(c=>c.label),buttons:document.querySelectorAll('#enc-choices button').length,unresolved:e.result===null,actual_card_binding:document.querySelector('#enc-art').getAttribute('src')===Assets.sprites[e.def.sprite].url};
    });
    if(check.title!==entry.title||JSON.stringify(check.choices)!==JSON.stringify(entry.choices)||!check.unresolved||check.buttons<entry.choices.length||!check.actual_card_binding)throw new Error('Encounter choices/card art mismatch '+JSON.stringify({entry,check}));
    await page.locator('#enc-art').evaluate(async(im,kind)=>{im.src='/art/creatures/batch-j-preview/'+kind+'.webp';await im.decode();},entry.kind);await page.screenshot({path:path.join(output,`${width}-${entry.id}-card.png`)});dialogs.push({width,...entry,...check});
    // Harness reset only: abandon unanswered setup state, then dismiss overlay.
    await page.evaluate(()=>Game.closeEncounter());await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('#ov-encounter').classList.contains('open')&&!document.querySelector('#ov-encounter').classList.contains('closing'));
   }
   if(errors.length)throw new Error(errors.join('\n'));await context.close();
   for(const type of ['world','cards']){
    const items=type==='world'?captures.filter(c=>c.width===width).map(c=>({label:c.id+' / '+c.distance+' tile',file:`${width}-${c.id}-${c.distance}.png`})):
     dialogs.filter(c=>c.width===width).map(c=>({label:c.id+' / choices',file:`${width}-${c.id}-card.png`}));
    const overview=await browser.newPage({viewport:{width:1080,height:844}});
    await overview.setContent('<style>body{margin:0;background:#20242c;color:white;font:11px monospace;display:grid;grid-template-columns:repeat(6,180px)}figure{margin:0;width:180px}img{width:180px}figcaption{height:28px;padding:3px}</style>'+items.map(c=>`<figure><figcaption>${c.label}</figcaption><img src="${origin}/art/creatures/batch-j-preview/dungeon/${c.file}"></figure>`).join(''));
    await overview.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await overview.screenshot({path:path.join(output,`${width}-${type}-overview.png`),fullPage:true});await overview.close();
   }
   console.log(`Reviewed 18 encounter mappings at ${width}px, near/far and unanswered cards`);
  }
  fs.writeFileSync(path.join(output,'review.json'),JSON.stringify({mode:'review-only frozen world cells and card URL substitutions; game update frozen; unchanged actual scene selection and choices; unanswered encounter state cleared by harness between cases',console_errors:[],captures,dialogs},null,2)+'\n');
 }finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})().catch(e=>{console.error(e);process.exitCode=1;});
