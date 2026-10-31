'use strict';
// Frozen fitting/performance comparison. Both renderer modules use the same
// actual Assets singleton and reviewed image bytes; this is not native play.
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),{chromium}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server');
const {startGame,artReady,watchForErrors,expect}=require(root+'/test/browser/helpers');
const base=process.env.RENDER_BASE||'6fd81ea5443caea2729daeed428f290b392eb766',old=execFileSync('git',['show',base+':js/renderer.js'],{cwd:root,encoding:'utf8'}),current=process.env.RENDER_CONTROL==='1'?old:fs.readFileSync(root+'/js/renderer.js','utf8');
const oldWorld=execFileSync('git',['show',base+':js/paintedworld.js'],{cwd:root,encoding:'utf8'});
const rate=Number(process.env.RENDER_RATE||4),batch=Number(process.env.RENDER_BATCH||10),rounds=Number(process.env.RENDER_ROUNDS||8),timingOnly=process.env.RENDER_TIMING_ONLY==='1';
const out=path.resolve(process.env.RENDER_OUTPUT||path.join(__dirname,'comparison.json'));
(async()=>{const server=http.createServer((req,res)=>{const code=req.url==='/js/renderer-baseline.js'?old.replace("from './paintedworld.js'","from './paintedworld-baseline.js'"):req.url==='/js/paintedworld-baseline.js'?oldWorld:req.url==='/js/renderer-candidate.js'?current:null;if(code){res.setHeader('Content-Type','application/javascript');res.end(code);}else serve(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:{width:390,height:844}}),errors=watchForErrors(page);
 await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off',calm:'1'}))localStorage.setItem('deepdelve.'+k,v);});
 await startGame(page,{seed:'combat-clarity'});await artReady(page);
 await page.evaluate(async()=>{
  Game.update=()=>{};Renderer.render=()=>{};
  const {Renderer:B}=await import('/js/renderer-baseline.js'),{Renderer:C}=await import('/js/renderer-candidate.js');window.__pair=[B,C];window.__canvases=window.__pair.map(()=>document.createElement('canvas'));window.__pair.forEach((r,i)=>{r.init(window.__canvases[i],464);r.setCalm(true);});
  const m=await import('/js/paintedworld.js'),old=await import('/js/paintedworld-baseline.js');window.__paintState=()=>Object.fromEntries([...[...Object.entries(m.paintedWorldState())].map(([k,v])=>['current:'+k,v]),...[...Object.entries(old.paintedWorldState())].map(([k,v])=>['old:'+k,v])]);for(const module of [m,old])for(const k of ['blood','ash','ice','oil'])module.paintedGroundDecal(k,1);
  for(const t of Assets.themes){void t.wall;void t.door;void t.torchFrames;for(let i=0;i<7;i++)t.floorOf(i);for(let i=0;i<4;i++)t.ceilOf(i);}
 });
 await page.waitForFunction(()=>Object.values(window.__paintState()).every(s=>s==='ready'),null,{timeout:60000});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate});
 const result=await page.evaluate(({batch,rounds,timingOnly})=>{
  const {T}=Dungeon,w=15,h=15,rs=Game.renderState(10000),fx={...rs.fx,view:null,arriveAt:-1e9,doorShut:{},doorFire:{},stains:{},frost:[],vents:[],rocks:[],texts:[],spells:[],corpses:[],bits:[],boss:null},now=10000;
  const scene=(region,kind)=>{
   const tiles=new Uint8Array(w*h).fill(T.FLOOR);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!x||!y||x===w-1||y===h-1||y===5)tiles[y*w+x]=T.WALL;
   tiles[5*w+7]=T.DOOR_OPEN;tiles[5*w+8]=kind==='unlit'||kind==='dark'?T.WALL:T.TORCH;
   return{...Game.level(),w,h,tiles,theme:region,roomId:new Int16Array(w*h),rooms:[{x:1,y:1,w:13,h:13,shape:'box'}],piece:null,pieces:[],caved:[],lights:kind==='unlit'||kind==='dark'?[]:[{x:8,y:5}],dressing:[],remains:[],monsters:[],npcs:[],items:{},fields:kind==='flooded'?{'7,7':{k:'ice',until:1e12}}:{},explored:new Uint8Array(w*h).fill(1),seen:new Uint8Array(w*h).fill(1),locks:{},pools:[],twist:['dark','flooded','overgrown'].includes(kind)?kind:null,stairsUp:null,stairsDown:null};
  };
  const pixels=[],kinds=['normal','unlit','dark','flooded','overgrown'];
  const originalRandom=Math.random;let randomSeed=0;Math.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
  if(!timingOnly)for(const height of[160,320,464]){window.__pair.forEach(r=>r.setHeight(height));for(let region=0;region<13;region++)for(const kind of kinds)for(const angle of[0,.27,.9])for(const light of[{calm:true,at:10000},{calm:false,at:10000},{calm:false,at:10411},{calm:false,at:13333}]){
   const L=scene(region,kind),cam={x:7.5,y:8.5,angle:-Math.PI/2+angle};
   const materials=[['#5a0608',.16],['#16130f',.42],['#3a2a12',.46],['#a8cce4',.46],['#2c3c4c',.34]];
   fx.stains[L.depth]=Array.from({length:60},(_,i)=>{const[c,r]=materials[i%5],d=.8+(i%6)*.45,side=((i%10)-4.5)*.22;return{x:7.5+side,y:8.5-d,r,c,seed:i,material:i%5===3?'ice':i%5===2?'oil':null,solo:i%5===1,wet:i%5===4,at:0};});
   for(const r of window.__pair){r.setCalm(light.calm);randomSeed=12345;r.render(L,cam,[],fx,light.at);randomSeed=12345;r.render(L,cam,[],fx,light.at);}
   const arrays=window.__canvases.map(c=>new Uint32Array(c.getContext('2d').getImageData(0,0,320,height).data.buffer));let changed=0;for(let i=0;i<arrays[0].length;i++)if(arrays[0][i]!==arrays[1][i])changed++;
   pixels.push({height,region,kind,angle,calm:light.calm,at:light.at,changed});
  }}
  Math.random=originalRandom;window.__pair.forEach(r=>r.setCalm(true));
  console.log('Compared '+pixels.length+' frozen pixel views');
  const benchmarks=[];
  if(timingOnly)for(const c of window.__canvases)for(let i=0;i<4;i++)c.getContext('2d').getImageData(0,0,320,c.height);
  window.__pair.forEach(r=>r.setHeight(464));
  for(const[region,kind]of[[0,'normal'],[0,'unlit'],[6,'flooded'],[10,'dark'],[11,'overgrown']]){
   const L=scene(region,kind),cam={x:7.5,y:8.5,angle:-1.3},samples=[[],[]];
   for(const r of window.__pair)for(let i=0;i<(timingOnly?100:30);i++)r.render(L,cam,[],fx,now);
   for(let round=0;round<rounds;round++)for(const which of(round%2?[1,0]:[0,1])){const start=performance.now();for(let i=0;i<batch;i++)window.__pair[which].render(L,cam,[],fx,now);samples[which].push((performance.now()-start)/batch);}
   const median=a=>[...a].sort((a,b)=>a-b)[a.length/2|0],medians=samples.map(median);benchmarks.push({region,kind,samples,medianMs:medians,gainPercent:100*(medians[0]-medians[1])/medians[0]});
  }
  return{pixels,benchmarks};
 },{batch,rounds,timingOnly});
 expect(errors).toEqual([]);const data={base,rate,batch,rounds,timingOnly,identicalSourceControl:process.env.RENDER_CONTROL==='1',baselineWorldSHA256:crypto.createHash('sha256').update(oldWorld).digest('hex'),candidateWorldSHA256:crypto.createHash('sha256').update(fs.readFileSync(root+'/js/paintedworld.js')).digest('hex'),baseSHA256:crypto.createHash('sha256').update(old).digest('hex'),candidateSHA256:crypto.createHash('sha256').update(current).digest('hex'),scope:'Sixty mixed wet marks, frozen native assets/materials/geometry and four Calm/flicker snapshots; presentation-only particle RNG reset for identical fitting views. Module comparison, not native gameplay or frame-rate budget. Diagnostic timing settings recorded separately; alternating renderer order. Timing-only runs warm each case100times; readback canvases match the fitting matrix, not native-play FPS.',...result,errors};fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n');
 console.log(JSON.stringify({views:result.pixels.length,changed:result.pixels.filter(r=>r.changed).length,benchmarks:result.benchmarks.map(b=>({kind:b.kind,medianMs:b.medianMs,gain:b.gainPercent}))}));
 if(result.pixels.some(r=>r.changed))throw Error('Frozen renderer pixels changed');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
