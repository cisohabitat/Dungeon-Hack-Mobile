'use strict';
// Review-only regional pictures on forced themes; no loader/gameplay changes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{serve}=require('../../test/server');
const {startGame,faceOpenGround,artReady,watchForErrors}=require('../../test/browser/helpers');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'generation-batch-m.json'),'utf8'));
const keys=Object.keys(manifest.scenes),output=path.join(__dirname,'batch-m-preview','dungeon');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const captures=[],audits=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  for(const width of [390,320]){
   const origin=`http://127.0.0.1:${server.address().port}`,context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',baseURL:origin}),page=await context.newPage(),errors=watchForErrors(page);
   await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem(`deepdelve.${k}`,v);});
   await startGame(page,{seed:'combat-clarity',name:'Regional art review'});
   await page.evaluate(()=>{const L=Game.level();L.monsters=[];L.npcs=[];L.dressing=[];L.remains=[];L.snares={};L.items={};L.puzzle=null;});
   if(await faceOpenGround(page,3)<3)throw new Error('No clear preview corridor');
   await artReady(page,Object.fromEntries([...keys,'rubble','mushrooms'].map(k=>['dress_'+k,[]])));
   await page.locator('#floor-card').evaluate(el=>el.style.display='none');
   const audit=await page.evaluate(async keys=>{
    const {REGIONAL_PROPS,regionalProp}=await import('/js/regionalprops.js'),{THEMES}=await import('/js/data.js'),{SIZE}=await import('/js/dressing.js');
    if(JSON.stringify(Object.keys(REGIONAL_PROPS).sort())!==JSON.stringify([...keys].sort()))throw new Error('Regional inventory mismatch');
    if(SIZE.rubble!==.55||SIZE.mushrooms!==.5)throw new Error('Saved-kind scales changed');
    const expected={
     'Grey Halls':['rubble','mushrooms'],'Brown Catacombs':['crypt_lid','mushrooms'],
     'Mossy Depths':['roots','mushrooms'],'Blue Vaults':['elf_shards','mushrooms'],
     'Crimson Crypts':['crypt_lid','mushrooms'],'Obsidian Sanctum':['elf_shards','mushrooms'],
     'The Ossuary':['crypt_lid','mushrooms'],'The Warrens':['roots','mushrooms'],
     'The Dark Elf Halls':['elf_shards','mushrooms'],'The Grey Hold':['iron_scrap','mushrooms'],
     'The Sunless Marsh':['rubble','reed_bundle'],'The Drowned Halls':['rubble','mushrooms'],
     'The Old Forges':['iron_scrap','mushrooms']};
    if(THEMES.length!==Object.keys(expected).length)throw new Error('Theme inventory changed');
    const mappings=[];
    for(const [themeIndex,theme]of THEMES.entries())for(const [i,savedKind]of ['rubble','mushrooms'].entries()){
     const actual=regionalProp(theme,savedKind,false),wanted=expected[theme.name]?.[i];
     if(actual!==wanted||regionalProp(theme,savedKind,true)!==savedKind)throw new Error('Regional mapping/fell bypass mismatch '+theme.name);
     mappings.push({themeIndex,theme:theme.name,savedKind,kind:actual,fallen:savedKind});
    }
    // Branch precedence when more than one selector matches.
    const overlap=[{theme:{road:'crypts',people:'dwarves'},kind:'crypt_lid'},{theme:{people:'elves',region:'forge'},kind:'iron_scrap'},{theme:{name:'Mossy Depths',face:'glass'},kind:'elf_shards'}];
    for(const c of overlap)if(regionalProp(c.theme,'rubble')!==c.kind)throw new Error('Regional precedence changed');
    window.__batchMFrames={};window.__batchMSizes=SIZE;Game.update=()=>{};
    for(const kind of keys){
     const image=new Image();image.src='/art/creatures/batch-m-preview/'+kind+'.webp';await image.decode();if(image.naturalWidth!==256||image.naturalHeight!==256)throw new Error('Invalid static export');
     const cell=document.createElement('canvas');cell.width=cell.height=256;const ctx=cell.getContext('2d');ctx.drawImage(image,0,0);
     const pixels=ctx.getImageData(0,0,256,256).data;let top=256;for(let p=3;p<pixels.length;p+=4)if(pixels[p]>32){top=Math.floor((p-3)/4/256);break;}
     const levels=[0,.25,.45,.62,.78].map(alpha=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.drawImage(cell,0,0);if(alpha){g.globalCompositeOperation='source-atop';g.globalAlpha=alpha;g.fillStyle='#000';g.fillRect(0,0,256,256);}return c;});
     window.__batchMFrames[kind]={w:256,h:256,top:top/256,levels,flash:cell,near:null};
    }
    window.__batchMOriginalRender=Renderer.render;
    return{inventory:keys,mappings,precedence:overlap,cases:mappings.filter(c=>keys.includes(c.kind))};
   },keys);audits.push({width,...audit});
   if(audit.cases.length!==11)throw new Error('Expected eleven regional theme mappings');
   for(const entry of audit.cases)for(const distance of [1,3]){
    const metrics=await page.evaluate(({entry,distance})=>{
     const L=Game.level(),p=Game.player(),D=Dungeon.DIRS[p.dir],x=p.x+D[0]*distance,y=p.y+D[1]*distance;
     L.theme=entry.themeIndex;L.lights=[...(L.lights||[])]; // Rebuild the existing light field, without adding lights.
     const d={k:entry.savedKind,x,y,ox:.08,oy:-.04,fell:false};L.dressing=[d];const before=JSON.stringify(d),now=performance.now();
     const find=(rs,kind)=>rs.sprites.find(s=>s.x===x+.5+.08&&s.y===y+.5-.04&&s.img===Assets.sprites['dress_'+kind]);
     d.fell=true;const fallen=find(Game.renderState(now),entry.savedKind);
     if(!fallen||fallen.scale!==window.__batchMSizes[entry.savedKind])throw new Error('Actual fallen dressing bypass mismatch');
     d.fell=false;const rs=Game.renderState(now),s=find(rs,entry.kind);
     if(!s||s.scale!==window.__batchMSizes[entry.savedKind]||s.yOff!==0||s.onFloor!==true||s.dress!==true||JSON.stringify(d)!==before)throw new Error('Actual regional selection/size/offset/flags/saved record mismatch');
     s.img=window.__batchMFrames[entry.kind];s.procedural=true;rs.fx={...rs.fx,arriveAt:-1e9};
     Renderer.render=()=>window.__batchMOriginalRender(rs.level,rs.cam,rs.sprites,rs.fx,now);Renderer.render();UI.refreshHud(true);
     if(!Renderer.order.includes('floor')||Renderer.drawnDressing()<1)throw new Error('Regional dressing visibility missing');
     return{distance,scale:s.scale,x:s.x,y:s.y,yOff:s.yOff,onFloor:s.onFloor,dress:s.dress,light:Renderer.lightOf(L,x,y),saved_record_unchanged:true,fallen_selection_checked:true};
    },{entry,distance});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const file=`${width}-${entry.themeIndex}-${entry.kind}-${distance}.png`;await page.screenshot({path:path.join(output,file)});captures.push({width,...entry,...metrics,file});
   }
   if(errors.length)throw new Error(errors.join('\n'));await context.close();
   const overview=await browser.newPage({viewport:{width:1080,height:844}});
   await overview.setContent('<style>body{margin:0;background:#20242c;color:white;font:11px monospace;display:grid;grid-template-columns:repeat(6,180px)}figure{margin:0;width:180px}img{width:180px}figcaption{height:40px;padding:3px}</style>'+captures.filter(c=>c.width===width).map(c=>`<figure><figcaption>${c.theme}<br>${c.kind} / ${c.distance} tile</figcaption><img src="${origin}/art/creatures/batch-m-preview/dungeon/${c.file}"></figure>`).join(''));
   await overview.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await overview.screenshot({path:path.join(output,`${width}-overview.png`),fullPage:true});await overview.close();
   console.log(`Reviewed five regional keys across eleven theme mappings at ${width}px near/far; all thirteen themes and fell bypass checked`);
  }
  fs.writeFileSync(path.join(output,'review.json'),JSON.stringify({mode:'review-only frozen frames and forced theme indices on one fixed layout; actual regional selection checked before override; no runtime/offline integration or region generation claims',console_errors:[],audits,captures},null,2)+'\n');
 }finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})().catch(e=>{console.error(e);process.exitCode=1;});
