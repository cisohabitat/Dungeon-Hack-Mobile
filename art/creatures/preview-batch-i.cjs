'use strict';
// Static review substitutions; no runtime loader or gameplay changes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const {serve}=require('../../test/server');
const {startGame,faceOpenGround,artReady,watchForErrors}=require('../../test/browser/helpers');
const output=path.join(__dirname,'batch-i-preview','dungeon');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const captures=[],shops=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  for(const width of [390,320]){
   const origin=`http://127.0.0.1:${server.address().port}`,context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',baseURL:origin}),page=await context.newPage(),errors=watchForErrors(page);
   await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem(`deepdelve.${k}`,v);});
   await startGame(page,{seed:'combat-clarity',name:'Trader art review'});await page.evaluate(()=>{Game.level().monsters.length=0;Game.level().npcs.length=0;});
   if(await faceOpenGround(page,3)<3)throw new Error('No clear preview corridor');await artReady(page,{merchant:[],wick:[],pedlar:[]});
   await page.locator('#floor-card').evaluate(el=>el.style.display='none');
   await page.evaluate(async()=>{
    window.__batchIFrames={};
    for(const kind of ['merchant','wick','pedlar']){
     const image=new Image();image.src='/art/creatures/batch-i-preview/'+kind+'.webp';await image.decode();if(image.naturalWidth!==256||image.naturalHeight!==256)throw new Error('Invalid static export');
     const cell=document.createElement('canvas');cell.width=cell.height=256;const ctx=cell.getContext('2d');ctx.drawImage(image,0,0);
     const pixels=ctx.getImageData(0,0,256,256).data;let top=256;for(let p=3;p<pixels.length;p+=4)if(pixels[p]>32){top=Math.floor((p-3)/4/256);break;}
     const levels=[0,.25,.45,.62,.78].map(alpha=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.drawImage(cell,0,0);if(alpha){g.globalCompositeOperation='source-atop';g.globalAlpha=alpha;g.fillStyle='#000';g.fillRect(0,0,256,256);}return c;});
     window.__batchIFrames[kind]={w:256,h:256,top:top/256,levels,flash:cell,near:null};
    }
    window.__batchIOriginalRender=Renderer.render;
   });
   for(const kind of ['merchant','wick','pedlar'])for(const distance of [1,3]){
    const metrics=await page.evaluate(({kind,distance})=>{
     const L=Game.level(),p=Game.player(),D=Dungeon.DIRS[p.dir];L.npcs.length=0;L.twist=kind==='pedlar'?'market':null;
     const n={id:'merchant',x:p.x+D[0]*distance,y:p.y+D[1]*distance,markup:2,stock:[],greeted:true,wick:kind==='wick'};L.npcs.push(n);
     const now=performance.now(),rs=Game.renderState(now),sprite=rs.sprites.find(s=>s.x===n.x+.5&&s.y===n.y+.5);
     if(!sprite||sprite.img!==Assets.sprites[kind]||sprite.scale!==.95)throw new Error('Actual trader identity/scale mismatch');
     sprite.img=window.__batchIFrames[kind];sprite.procedural=true;rs.fx={...rs.fx,arriveAt:-1e9};
     Renderer.render=()=>window.__batchIOriginalRender(rs.level,rs.cam,rs.sprites,rs.fx,now);Renderer.render();UI.refreshHud(true);
     if(!Renderer.order.includes('stand'))throw new Error('Trader draw missing');
     return{kind,distance,scale:sprite.scale,x:sprite.x,y:sprite.y,facing:p.dir,light:Renderer.lightOf(L,n.x,n.y),order:Renderer.order};
    },{kind,distance});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.screenshot({path:path.join(output,`${width}-${kind}-${distance}.png`)});captures.push({width,...metrics});
    if(distance===1){
     const before=await page.evaluate(()=>{const p=Game.player();return{x:p.x,y:p.y};});
     await page.evaluate(()=>Game.input('forward'));await page.waitForFunction(()=>!!Game.currentShop()&&document.querySelector('#ov-shop').classList.contains('open'));
     const check=await page.evaluate(()=>({title:document.querySelector('#shop-title').textContent,x:Game.player().x,y:Game.player().y,opened:!!Game.currentShop()}));
     const title={merchant:'Lampfolk trader',wick:'Wick, of the Lampfolk',pedlar:'Goblin pedlar'}[kind];
     if(check.title!==title||check.x!==before.x||check.y!==before.y)throw new Error('Shop title/collision changed');shops.push({width,kind,...check});
     await page.locator('#ov-shop [data-close]').click();await page.waitForFunction(()=>!Game.currentShop()&&!document.querySelector('#ov-shop').classList.contains('open')&&!document.querySelector('#ov-shop').classList.contains('closing'));
    }
   }
   const precedence=await page.evaluate(()=>{
    const L=Game.level(),n=L.npcs[0];L.twist='market';n.wick=true;const s=Game.renderState(performance.now()).sprites.find(s=>s.x===n.x+.5&&s.y===n.y+.5);
    if(!s||s.img!==Assets.sprites.pedlar)throw new Error('Market must take precedence over Wick flag');return{width:innerWidth,market_wick_flag_uses_pedlar:true};
   });shops.push(precedence);
   if(errors.length)throw new Error(errors.join('\n'));await context.close();
   const overview=await browser.newPage({viewport:{width:1080,height:Math.ceil(844*180/width)+32}});
   await overview.setContent('<style>body{margin:0;background:#20242c;color:white;font:11px monospace;display:flex}figure{margin:0;width:180px}img{width:180px}figcaption{height:28px;padding:3px}</style>'+captures.filter(c=>c.width===width).map(c=>`<figure><figcaption>${c.kind} / ${c.distance} tile</figcaption><img src="${origin}/art/creatures/batch-i-preview/dungeon/${width}-${c.kind}-${c.distance}.png"></figure>`).join(''));
   await overview.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await overview.screenshot({path:path.join(output,`${width}-overview.png`),fullPage:true});await overview.close();console.log(`Captured three static traders at ${width}px; shop/collision and identity precedence passed`);
  }
  fs.writeFileSync(path.join(output,'review.json'),JSON.stringify({mode:'review-only frozen painted-cell substitutions; actual trader selection checked before substitution; shop input uses unchanged game',console_errors:[],captures,shops},null,2)+'\n');
 }finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})().catch(e=>{console.error(e);process.exitCode=1;});
