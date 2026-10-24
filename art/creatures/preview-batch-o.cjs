'use strict';
// Review-only material booth. Baseline texture proxy; actual game files unchanged.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{serve}=require('../../test/server');
const {startGame,artReady,watchForErrors}=require('../../test/browser/helpers');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'generation-batch-o.json'),'utf8'));
const output=path.join(__dirname,'batch-o-preview','dungeon');fs.mkdirSync(output,{recursive:true});
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const captures=[],audits=[];
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
for(const width of [390,320]){
 const origin=`http://127.0.0.1:${server.address().port}`,context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',baseURL:origin}),page=await context.newPage(),errors=watchForErrors(page);
 await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem(`deepdelve.${k}`,v);});await startGame(page,{seed:'combat-clarity',name:'Surface material review'});await artReady(page,{});await page.locator('#floor-card').evaluate(el=>el.style.display='none');
 const audit=await page.evaluate(async manifest=>{
  const {THEMES,KEY_COLORS}=await import('/js/data.js');if(THEMES.length!==13||Object.keys(manifest.sheets).length!==13||Assets.TEX!==64||Assets.FLOOR_LEVELS!==8)throw new Error('Surface/theme format changed');
  Game.update=()=>{};window.__batchOOriginalRender=Renderer.render;window.__batchOMaterials={};window.__batchOOriginals=[...Assets.themes];const materials=[];
  for(const [key,sheet]of Object.entries(manifest.sheets)){
   const material={};if(THEMES[sheet.theme_index].name!==sheet.theme)throw new Error('Theme mapping changed');
   for(const part of ['wall','floor','ceiling']){
    const im=new Image();im.src='/art/creatures/batch-o-preview/'+key+'_'+part+'.png';await im.decode();if(im.naturalWidth!==64||im.naturalHeight!==64)throw new Error('Non-native texture');
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);const d=ctx.getImageData(0,0,64,64).data;
    for(let i=3;i<d.length;i+=4)if(d[i]!==255)throw new Error('Nonopaque material');
    if(part==='wall')material.wall=c;
    else{
     const levels=Array.from({length:8},(_,l)=>{const f=1-l/7,a=new Uint32Array(4096);for(let i=0;i<4096;i++)a[i]=(0xff000000|((d[i*4+2]*f)|0)<<16|((d[i*4+1]*f)|0)<<8|((d[i*4]*f)|0))>>>0;return a;});
     for(let l=0;l<8;l++)for(let i=0;i<4096;i++){
      const a=levels[l][i];for(let j=0;j<3;j++)if(((a>>>(j*8))&255)!==((d[i*4+j]*(1-l/7))|0))throw new Error('Darkness encoding mismatch');
      if((a>>>24)!==255||(l===7&&a!==0xff000000))throw new Error('Darkness opacity/black mismatch');
     }
     material[part]=levels;
    }
   }
   window.__batchOMaterials[key]=material;
   const t=Assets.themes[sheet.theme_index],stateNames=['door','stairsDown','stairsUp','stairArch','stairsUpBack','stairsDownBack','cellDoor','fountain','fountainDry','wallCracked','wallB','wallDamp','rock','fallen'];
   const state=Object.fromEntries(stateNames.map(k=>[k,t[k]])),locked=Object.fromEntries(Object.keys(KEY_COLORS).map(k=>[k,t.locked[k]])),cellLocked=Object.fromEntries(Object.keys(KEY_COLORS).map(k=>[k,t.cellLocked(k)]));
   material.integrity={state,locked,cellLocked,floors:Array.from({length:7},(_,k)=>t.floorOf(k)),roofs:Array.from({length:4},(_,k)=>t.ceilOf(k))};
   materials.push({key,theme:sheet.theme,theme_index:sheet.theme_index,wall:[64,64],levels_per_surface:8,entries_per_level:4096,floor_ceiling_bytes:2*8*4096*4,preserved_state_names:stateNames,lock_colours:Object.keys(KEY_COLORS),nonbase_floor_kinds:[1,2,3,4,5,6],nonbase_roof_kinds:[1,2,3]});
  }
  return{materials,levels_verified:13*2*8,format:'opaque native64; eight Uint32 darkness levels using existing truncation formula',scope:'controlled material booth with neutral look metadata; no native regional geometry or architecture replacement'};
 },manifest);audits.push({width,...audit});
 for(const [key,sheet]of Object.entries(manifest.sheets)){
  const metrics=await page.evaluate(({key,sheet})=>{
   const original=window.__batchOOriginals[sheet.theme_index],m=window.__batchOMaterials[key];
   // Neutral look metadata isolates the commissioned base ceiling, even for the
   // Warrens whose normal rooms select beams. No shipped variant is replaced.
   const proxy=new Proxy(original,{get(t,k){if(['wall','wallB','wallDamp','wallCracked'].includes(k))return m.wall;if(k==='decor')return[];if(k==='theme')return{...t.theme,face:'material-review'};if(k==='floor')return m.floor;if(k==='ceil')return m.ceiling;if(k==='floorOf')return n=>n===0?m.floor:t.floorOf(n);if(k==='ceilOf')return n=>n===0?m.ceiling:t.ceilOf(n);return t[k];}});
   Assets.themes[sheet.theme_index]=proxy;
   const integrity=m.integrity;
   for(const name of ['door','stairsDown','stairsUp','stairArch','stairsUpBack','stairsDownBack','cellDoor','fountain','fountainDry'])if(proxy[name]!==integrity.state[name])throw new Error('State-bearing architecture changed');
   for(const k of Object.keys(integrity.locked))if(proxy.locked[k]!==integrity.locked[k]||proxy.cellLocked(k)!==integrity.cellLocked[k])throw new Error('Lock binding changed');
   for(let k=1;k<7;k++)if(proxy.floorOf(k)!==integrity.floors[k])throw new Error('Nonbase floor changed');
   for(let k=1;k<4;k++)if(proxy.ceilOf(k)!==integrity.roofs[k])throw new Error('Nonbase roof changed');
   const T=Dungeon.T,w=9,h=13,tiles=new Uint8Array(w*h).fill(T.FLOOR);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x===0||y===0||x===w-1||y===h-1)tiles[y*w+x]=T.WALL;
   const level={...Game.level(),w,h,tiles,theme:sheet.theme_index,roomId:new Int16Array(w*h),rooms:[{x:1,y:1,w:7,h:11,shape:'box'}],piece:null,pieces:[],caved:[],lights:[],dressing:[],remains:[],monsters:[],npcs:[],items:{},explored:new Uint8Array(w*h).fill(1),seen:new Uint8Array(w*h).fill(1),locks:{},doors:{},pools:[],twist:null};
   window.__batchOBooth={level,key};return{state_bindings_preserved:true,lock_bindings_preserved:true,nonbase_kinds_preserved:true,baseline_wall_variants_unified_for_booth:true,neutral_look_metadata:true};
  },{key,sheet});
  for(const view of ['corridor','close-wall']){
   const render=await page.evaluate(view=>{const {level}=window.__batchOBooth,rs=Game.renderState(performance.now()),now=performance.now(),cam=view==='corridor'?{x:4.5,y:9.5,angle:-Math.PI/2}:{x:6.5,y:9.5,angle:0};const fx={...rs.fx,arriveAt:-1e9};Renderer.render=()=>window.__batchOOriginalRender(level,cam,[],fx,now);Renderer.render();return{camera:cam,drawn_floor_kinds:Renderer.looks.floors};},view);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const file=`${width}-${key}-${view}.png`;await page.screenshot({path:path.join(output,file)});captures.push({width,key,theme:sheet.theme,view,...metrics,...render,file});
  }
  await page.evaluate(index=>{const t=window.__batchOOriginals[index];Assets.themes[index]=t;const m=window.__batchOMaterials[window.__batchOBooth.key];for(const[k,v]of Object.entries(m.integrity.state))if(t[k]!==v)throw new Error('Original cached state mutated');},sheet.theme_index);
 }
 if(errors.length)throw new Error(errors.join('\n'));await context.close();
 const overview=await browser.newPage({viewport:{width:1080,height:844}});await overview.setContent('<style>body{margin:0;background:#20242c;color:white;font:11px monospace;display:grid;grid-template-columns:repeat(6,180px)}figure{margin:0;width:180px}img{width:180px}figcaption{height:32px;padding:3px}</style>'+captures.filter(c=>c.width===width).map(c=>`<figure><figcaption>${c.theme}<br>${c.view}</figcaption><img src="${origin}/art/creatures/batch-o-preview/dungeon/${c.file}"></figure>`).join(''));await overview.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await overview.screenshot({path:path.join(output,`${width}-overview.png`),fullPage:true});await overview.close();console.log(`Reviewed thirteen material sets at ${width}px in corridor/close views; darkness formats and original architecture bindings preserved`);
}
fs.writeFileSync(path.join(output,'review.json'),JSON.stringify({mode:'review-only native64 material proxy in controlled9x13 booth, neutral base look metadata, unified baseline wall variants and no decals; originals restored; no live loader/offline/performance/native region claim',console_errors:[],audits,captures},null,2)+'\n');
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
