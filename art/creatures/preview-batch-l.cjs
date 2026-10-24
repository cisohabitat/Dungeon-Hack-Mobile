'use strict';
// Review-only substitutions after checking the actual dressing render selection.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{serve}=require('../../test/server');
const {startGame,faceOpenGround,artReady,watchForErrors,placeMonster}=require('../../test/browser/helpers');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'generation-batch-l.json'),'utf8'));
const keys=Object.keys(manifest.scenes),output=path.join(__dirname,'batch-l-preview','dungeon');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const captures=[],audits=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  for(const width of [390,320]){
   const origin=`http://127.0.0.1:${server.address().port}`,context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',baseURL:origin}),page=await context.newPage(),errors=watchForErrors(page);
   await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem(`deepdelve.${k}`,v);});
   await startGame(page,{seed:'combat-clarity',name:'Room dressing review',puzzles:true});
   await page.evaluate(()=>{const L=Game.level();L.monsters=[];L.npcs=[];L.dressing=[];L.remains=[];L.snares={};L.items={};});
   if(await faceOpenGround(page,3)<3)throw new Error('No clear preview corridor');
   await artReady(page,Object.fromEntries([...keys.map(k=>'dress_'+k),'mimic'].map(k=>[k,[]])));
   await page.locator('#floor-card').evaluate(el=>el.style.display='none');
   const audit=await page.evaluate(async keys=>{
    const {DRESSING,SIZE,BY_WALL}=await import('/js/dressing.js'),{regionalProp}=await import('/js/regionalprops.js');
    const excluded=['flames','ripple','snare','remains_bones','remains_staves','remains_shards','remains_husk'];
    if(JSON.stringify(Object.keys(DRESSING).filter(k=>!excluded.includes(k)).sort())!==JSON.stringify([...keys].sort()))throw new Error('Batch L inventory mismatch');
    const expected={barrel:.66,oilcask:.66,anvil:.5,chest:.6,crate:.62,shackles:.5,bones:.5,rubble:.55,candles:.46,mushrooms:.5,urn:.58};
    for(const k of keys)if(SIZE[k]!==expected[k])throw new Error('Dressing scale drift');
    const aliases=[['crypt_lid',{road:'crypts',name:''},'rubble'],['iron_scrap',{people:'dwarves'},'rubble'],['roots',{name:'Mossy Depths'},'rubble'],['elf_shards',{people:'elves'},'rubble'],['reed_bundle',{people:'marsh'},'mushrooms']];
    for(const [expected,theme,kind]of aliases){if(regionalProp(theme,kind)!==expected||regionalProp(theme,kind,true)!==kind)throw new Error('Regional alias/landed rubble mismatch');}
    window.__batchLFrames={};window.__batchLSizes=SIZE;Game.update=()=>{};
    for(const kind of keys){
     const image=new Image();image.src='/art/creatures/batch-l-preview/'+kind+'.webp';await image.decode();if(image.naturalWidth!==256||image.naturalHeight!==256)throw new Error('Invalid static export');
     const cell=document.createElement('canvas');cell.width=cell.height=256;const ctx=cell.getContext('2d');ctx.drawImage(image,0,0);
     const pixels=ctx.getImageData(0,0,256,256).data;let top=256;for(let p=3;p<pixels.length;p+=4)if(pixels[p]>32){top=Math.floor((p-3)/4/256);break;}
     const levels=[0,.25,.45,.62,.78].map(alpha=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.drawImage(cell,0,0);if(alpha){g.globalCompositeOperation='source-atop';g.globalAlpha=alpha;g.fillStyle='#000';g.fillRect(0,0,256,256);}return c;});
     window.__batchLFrames[kind]={w:256,h:256,top:top/256,levels,flash:cell,near:null};
    }
    window.__batchLOriginalRender=Renderer.render;
    return{inventory:keys,excluded,scales:expected,by_wall:[...BY_WALL],regional_aliases:aliases.map(([alias,theme,kind])=>({kind,alias,fallen:kind}))};
   },keys);audits.push({width,...audit});
   const cases=keys.map(kind=>({id:'dress_'+kind,kind,mode:'dressing'})).concat([
    {id:'mimic-barrel',kind:'barrel',mode:'mimic',disguise:'barrel'},
    {id:'mimic-chest',kind:'chest',mode:'mimic',disguise:'chest'},
    {id:'mimic-default',kind:'barrel',mode:'mimic',disguise:null},
    {id:'puzzle-chest',kind:'chest',mode:'puzzle'}
   ]);
   for(const entry of cases)for(const distance of [1,3]){
    await page.evaluate(()=>{const L=Game.level();L.monsters=[];L.dressing=[];L.items={};L.puzzle=null;});
    if(entry.mode==='mimic')await placeMonster(page,'mimic',distance,{hp:999,maxHp:999,awake:true,disguised:true,disguise:entry.disguise,dox:.08,doy:-.04});
    const metrics=await page.evaluate(({entry,distance})=>{
     const L=Game.level(),p=Game.player(),D=Dungeon.DIRS[p.dir],x=p.x+D[0]*distance,y=p.y+D[1]*distance;
     // fell retains ordinary rubble despite the current theme's regional alias.
     if(entry.mode==='dressing')L.dressing=[{k:entry.kind,x,y,ox:.08,oy:-.04,fell:true}];
     if(entry.mode==='mimic'&&entry.disguise===null)delete L.monsters[0].disguise;
     if(entry.mode==='puzzle'){L.puzzle={x,y,solved:false};L.items[`${x},${y}`]=[{id:'gold',puzzle:true}];}
     const now=performance.now(),rs=Game.renderState(now),ox=entry.mode==='puzzle'?0:.08,oy=entry.mode==='puzzle'?0:-.04;
     const s=rs.sprites.find(s=>s.x===x+.5+ox&&s.y===y+.5+oy&&s.img===Assets.sprites['dress_'+entry.kind]);
     const expectedScale=entry.mode==='puzzle'?.5:window.__batchLSizes[entry.kind];
     if(!s||s.scale!==expectedScale||s.yOff!==0||s.onFloor!==true||(entry.mode!=='puzzle'&&s.dress!==true))throw new Error('Actual dressing identity/offset/scale/flags mismatch '+entry.id);
     if(entry.mode==='mimic'&&rs.sprites.some(s=>s.uid===L.monsters[0].uid))throw new Error('Concealed Mimic exposed');
     s.img=window.__batchLFrames[entry.kind];s.procedural=true;rs.fx={...rs.fx,arriveAt:-1e9};
     Renderer.render=()=>window.__batchLOriginalRender(rs.level,rs.cam,rs.sprites,rs.fx,now);Renderer.render();UI.refreshHud(true);
     if(!Renderer.order.includes('floor')||(entry.mode!=='puzzle'&&Renderer.drawnDressing()<1))throw new Error('Dressing draw missing '+entry.id);
     return{distance,scale:s.scale,x:s.x,y:s.y,yOff:s.yOff,onFloor:s.onFloor,dress:!!s.dress,light:Renderer.lightOf(L,x,y)};
    },{entry,distance});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const file=`${width}-${entry.id}-${distance}.png`;await page.screenshot({path:path.join(output,file)});captures.push({width,...entry,...metrics,file});
   }
   if(errors.length)throw new Error(errors.join('\n'));await context.close();
   const overview=await browser.newPage({viewport:{width:1080,height:844}});
   await overview.setContent('<style>body{margin:0;background:#20242c;color:white;font:11px monospace;display:grid;grid-template-columns:repeat(6,180px)}figure{margin:0;width:180px}img{width:180px}figcaption{height:28px;padding:3px}</style>'+captures.filter(c=>c.width===width).map(c=>`<figure><figcaption>${c.id} / ${c.distance} tile</figcaption><img src="${origin}/art/creatures/batch-l-preview/dungeon/${c.file}"></figure>`).join(''));
   await overview.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await overview.screenshot({path:path.join(output,`${width}-overview.png`),fullPage:true});await overview.close();
   console.log(`Reviewed eleven dressing keys, three concealed Mimic cases and locked puzzle chest at ${width}px near/far`);
  }
  fs.writeFileSync(path.join(output,'review.json'),JSON.stringify({mode:'review-only frozen render-frame substitutions; actual dress_* selection checked before override; black-wash review levels do not reproduce procedural emissive masks; no runtime integration or interaction outcomes tested',console_errors:[],audits,captures},null,2)+'\n');
 }finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})().catch(e=>{console.error(e);process.exitCode=1;});
