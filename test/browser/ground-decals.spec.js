'use strict';
const {test,expect}=require('@playwright/test');
const {startGame,artReady,faceOpenGround,watchForErrors}=require('./helpers');

test('ground materials load on demand and stay inside native landing footprints without changing other fields @mobile',async({page})=>{
 const errors=watchForErrors(page),requests=[];let release;
 const gate=new Promise(r=>release=r);
 await page.route('**/img/decals/*.png',async route=>{requests.push(route.request().url());await gate;await route.continue();});
 try{
  await startGame(page,{seed:'combat-clarity'});await page.evaluate(()=>{Game.level().monsters=[];});await faceOpenGround(page,3);await artReady(page);
  expect(requests).toHaveLength(0);
  await page.evaluate(async()=>{
   const {Dice,Odds}=await import('/js/rng.js');
   Game.update=()=>{};const rs=Game.renderState(10000),ctx=document.querySelector('#view').getContext('2d'),p=Game.player(),[dx,dy]=Dungeon.DIRS[p.dir];
   const cases={blood:{c:'#5a0608'},ash:{c:'#16130f',solo:true},nearBlood:{c:'#5a0608',distance:.8,r:.16},nearAsh:{c:'#16130f',solo:true,distance:.5,r:.42},distantDetail:{c:'#5a0608',distance:3,r:.16},goo:{c:'#2a5a1a'},oil:{c:'#3a2a12',material:'oil'},unmarkedOil:{c:'#3a2a12'},oilSheen:{c:'#8e6e2c',solo:true},ice:{c:'#a8cce4',material:'ice'},cold:{c:'#a8cce4'},water:{c:'#2c3c4c',wet:true},glow:{c:'#5a0608',glow:true},future:{c:'#5a0608',at:10001},behind:{c:'#5a0608',behind:true}};
   window.__groundBefore={};window.__groundBoxes=[];window.__groundAlphas=[];window.__groundRules=[];
   // Match renderer calls at one time; the native preview separately keeps the
   // main loop/motes running. A fixed argument alone cannot freeze ambient motes.
   const render=Renderer.render;Renderer.render=()=>{};
   const fx={...rs.fx,stains:{},view:{...rs.fx.view,walk:0,steps:0}};
   const original=ctx.drawImage;
   ctx.drawImage=function(img,...args){if(window.__groundImages?.has(img)){window.__groundBoxes.push(args);window.__groundAlphas.push(this.globalAlpha);}return original.call(this,img,...args);};
   window.__groundProbe=(name,remember=false,quiet=false)=>{
    Renderer.setCalm(quiet);
    const data=cases[name],distance=data.behind?-2:(data.distance??1.3);
    fx.stains[rs.level.depth]=[{x:p.x+.5+dx*distance,y:p.y+.5+dy*distance,r:.32,seed:73,at:0,...data}];
    window.__groundBoxes=[];window.__groundAlphas=[];const identity=window.__groundIdentity();render(rs.level,rs.cam,rs.sprites,fx,10000);window.__groundRules.push(identity===window.__groundIdentity());
    const pixels=ctx.getImageData(0,0,Renderer.W,Renderer.H).data;
    if(remember){window.__groundBefore[name+'|'+quiet]=pixels;return;}
    const before=window.__groundBefore[name+'|'+quiet];let changed=0,outside=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==before[i]||pixels[i+1]!==before[i+1]||pixels[i+2]!==before[i+2]||pixels[i+3]!==before[i+3]){
     changed++;const x=(i/4)%Renderer.W+.5,y=Math.floor(i/4/Renderer.W)+.5;
     if(!window.__groundBoxes.some(([bx,by,w,h])=>((x-bx-w/2)/(w/2+1))**2+((y-by-h/2)/(h/2+1))**2<=1))outside++;
    }
    return {changed,outside,draws:window.__groundBoxes.length,alphas:window.__groundAlphas.slice(),restored:ctx.globalAlpha===1&&ctx.globalCompositeOperation==='source-over'};
   };
   window.__groundIdentity=()=>JSON.stringify([Game.state(),Dice.s,Odds.s]);
   // Offscreen/future and unsupported fields must not initiate either request.
   for(const quiet of [false,true])for(const name of ['distantDetail','goo','unmarkedOil','oilSheen','cold','water','glow','future','behind'])window.__groundProbe(name,true,quiet);
  });
  expect(requests).toHaveLength(0);
  await page.evaluate(()=>{for(const quiet of [false,true]){window.__groundProbe('blood',true,quiet);window.__groundProbe('ash',true,quiet);window.__groundProbe('ice',true,quiet);window.__groundProbe('oil',true,quiet);window.__groundProbe('nearBlood',true,quiet);window.__groundProbe('nearAsh',true,quiet);}});
  await expect.poll(()=>requests.length).toBe(4);release();
  await page.evaluate(async()=>{window.__groundPaint=(await import('/js/paintedworld.js')).paintedGroundDecal;});
  await expect.poll(()=>page.evaluate(()=>!!window.__groundPaint('blood',1)&&!!window.__groundPaint('ash',1)&&!!window.__groundPaint('ice',1)&&!!window.__groundPaint('oil',1))).toBe(true);
  const result=await page.evaluate(()=>{
   const canvases=[];for(const kind of ['blood','ash','ice','oil'])for(let i=0;i<=100;i++)canvases.push(window.__groundPaint(kind,i/100));window.__groundImages=new Set(canvases);
   const output={};for(const quiet of [false,true])for(const name of ['blood','ash','nearBlood','nearAsh','distantDetail','goo','oil','unmarkedOil','oilSheen','ice','cold','water','glow','future','behind'])output[name+'|'+quiet]=window.__groundProbe(name,false,quiet);
   const create=document.createElement;let allocations=0;
   try{document.createElement=function(name,...args){if(name==='canvas')allocations++;return create.call(this,name,...args);};for(let i=0;i<100;i++)for(const kind of ['blood','ash','ice','oil'])window.__groundPaint(kind,.6);}
   finally{document.createElement=create;}
   const oil=window.__groundPaint('oil',1),pixels=oil.getContext('2d').getImageData(0,0,128,128).data;let oilPeakAlpha=0;for(let i=3;i<pixels.length;i+=4)oilPeakAlpha=Math.max(oilPeakAlpha,pixels[i]);
   return{output,allocations,oilPeakAlpha,unchanged:window.__groundRules.every(Boolean),unknown:window.__groundPaint('unknown',1)===null};
  });

  for(const quiet of [false,true])for(const kind of ['blood','ash','ice','oil','nearBlood','nearAsh']){expect(result.output[kind+'|'+quiet].changed,kind+' Calm='+quiet).toBeGreaterThan(5);expect(result.output[kind+'|'+quiet].outside).toBe(0);expect(result.output[kind+'|'+quiet].draws).toBe(1);}
  for(const quiet of [false,true])for(const kind of ['distantDetail','goo','unmarkedOil','oilSheen','cold','water','glow','future','behind'])expect(result.output[kind+'|'+quiet].changed,kind).toBe(0);
  for(const quiet of [false,true])expect(result.output['oil|'+quiet].alphas).toEqual([1]);expect(result.oilPeakAlpha).toBeGreaterThanOrEqual(88);expect(result.oilPeakAlpha).toBeLessThanOrEqual(90);
  expect(Object.values(result.output).every(r=>r.restored)).toBe(true);expect(result.allocations).toBe(0);expect(result.unchanged).toBe(true);expect(result.unknown).toBe(true);expect(requests).toHaveLength(4);expect(errors).toEqual([]);
 }finally{release?.();}
});

for(const corrupt of ['blood','ash','ice','oil'])test(`a corrupt ${corrupt} decal keeps the native fill and the other material independent @mobile`,async({page})=>{
 const errors=watchForErrors(page);
 await page.route(`**/img/decals/${corrupt}.png`,r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));
 await startGame(page,{seed:'ground-fallback'});
 await page.evaluate(async()=>{window.__groundModule=await import('/js/paintedworld.js');for(const kind of ['blood','ash','ice','oil'])window.__groundModule.paintedGroundDecal(kind,1);});
 const other=corrupt==='blood'?'ash':'blood';
 await expect.poll(()=>page.evaluate(kind=>window.__groundModule.paintedGroundDecal(kind,1)?.width,other)).toBe(128);
 await expect.poll(()=>page.evaluate(kind=>window.__groundModule.paintedWorldState()['img/decals/'+kind+'.png'],corrupt)).toBe('failed');
 expect(await page.evaluate(kind=>window.__groundModule.paintedGroundDecal(kind,1),corrupt)).toBeNull();expect(errors).toEqual([]);
});

test('native ice and oil alone receive material, retain sheen and respect replacements and landings @mobile',async({page})=>{
 const errors=watchForErrors(page);await startGame(page,{seed:'combat-clarity'});
 await page.evaluate(()=>{Game.level().monsters=[];});await faceOpenGround(page,3);await artReady(page);
 await page.evaluate(async()=>{window.__icePaint=(await import('/js/paintedworld.js')).paintedGroundDecal;window.__icePaint('ice',1);window.__icePaint('oil',1);});
 await expect.poll(()=>page.evaluate(()=>!!window.__icePaint('ice',1)&&!!window.__icePaint('oil',1))).toBe(true);
 const result=await page.evaluate(async()=>{
  const{Dice,Odds}=await import('/js/rng.js');Game.update=()=>{};const render=Renderer.render;Renderer.render=()=>{};
  const rs=Game.renderState(10000),p=Game.player(),[dx,dy]=Dungeon.DIRS[p.dir],x=p.x+dx*2,y=p.y+dy*2,key=x+','+y;
  const level={...rs.level,fields:{},dressing:[],explored:rs.level.explored.slice()},fx={...rs.fx,stains:{},frost:[],vents:[],rocks:[],landings:[]};
  const images=new Map();for(const kind of ['ice','oil'])for(let i=0;i<=100;i++)images.set(window.__icePaint(kind,i/100),kind);
  const ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage,fill=ctx.fill;let count={ice:0,oil:0,sheen:0};
  ctx.drawImage=function(image,...args){const kind=images.get(image);if(kind)count[kind]++;return draw.call(this,image,...args);};
  ctx.fill=function(...args){const m=String(this.fillStyle).match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);if(m&&Number(m[1])>46&&Number(m[1])>Number(m[2])&&Number(m[2])>Number(m[3])&&Math.abs(Number(m[4])-.7)<.001)count.sheen++;return fill.apply(this,args);};
  const identity=()=>JSON.stringify([Game.state(),Dice.s,Odds.s]),before=identity();
  const probe=(kind,now=10000)=>{count={ice:0,oil:0,sheen:0};level.fields=kind?{[key]:{k:kind,until:20000}}:{};render(level,rs.cam,[],fx,now);return {...count};};
  fx.frost=[{x,y,a:1}];const frost=probe(null);fx.frost=[];
  const ice=probe('ice'),oil=probe('oil'),again=probe('ice'),cleared=probe(null);
  fx.landings=[{x,y,at:10001,was:{}}];const airborne=probe('ice'),landed=probe('ice',10002),airborneOil=probe('oil'),landedOil=probe('oil',10002);
  return{frost,ice,oil,again,cleared,airborne,landed,airborneOil,landedOil,unchanged:identity()===before};
 });
 const empty={ice:0,oil:0,sheen:0},ice={ice:1,oil:0,sheen:0},oil={ice:0,oil:1,sheen:1};expect(result).toEqual({frost:empty,ice,oil,again:ice,cleared:empty,airborne:empty,landed:ice,airborneOil:empty,landedOil:oil,unchanged:true});expect(errors).toEqual([]);
});

test('cached splash geometry matches fresh geometry pixel for pixel and refreshes after a change @mobile',async({page})=>{
 const errors=watchForErrors(page);await startGame(page,{seed:'combat-clarity'});
 await page.evaluate(()=>{Game.level().monsters=[];});await faceOpenGround(page,3);await artReady(page);
 await page.evaluate(async()=>{window.__nativeGroundPaint=await import('/js/paintedworld.js');for(const k of ['blood','ash','ice','oil'])window.__nativeGroundPaint.paintedGroundDecal(k,1);});
 await expect.poll(()=>page.evaluate(()=>['blood','ash','ice','oil'].every(k=>!!window.__nativeGroundPaint.paintedGroundDecal(k,1)))).toBe(true);
 const result=await page.evaluate(async()=>{
  const {Dice,Odds}=await import('/js/rng.js');Game.update=()=>{};
  const render=Renderer.render;Renderer.render=()=>{};
  const rs=Game.renderState(10000),p=Game.player(),[dx,dy]=Dungeon.DIRS[p.dir],ctx=document.querySelector('#view').getContext('2d');
  const colours=['#5a0608','#2a5a1a','#4e5e0e','#2a1a10','#1a3610','#262c1e','#5a2c12','#3a2a12','#a8cce4','#2c3c4c'];
  const stains=Array.from({length:60},(_,i)=>{const d=.7+(i%8)*.8,side=((i%7)-3)*.23;return{x:p.x+.5+dx*d-dy*side,y:p.y+.5+dy*d+dx*side,r:[.08,.16,.42][i%3],c:colours[i%colours.length],seed:i*37,wet:i%colours.length===9,at:0};});
  // Moving this diagnostic camera must not mark new live run tiles explored.
  const cam={...rs.cam},level={...rs.level,lights:[{x:p.x+dx*2,y:p.y+dy*2}],dressing:[],explored:rs.level.explored.slice().fill(1)};
  const fx={...rs.fx,stains:{[rs.level.depth]:stains},spells:[],texts:[],corpses:[],bits:[],drops:[],frost:[],rocks:[],vents:[],boss:null,view:{...rs.fx.view,walk:0,steps:0}};
  const original={sin:Math.sin,cos:Math.cos,ellipse:Path2D.prototype.ellipse,fill:ctx.fill};
  const ellipses=new WeakMap();let native=false,pathBuilds=0,nativeDifferences=0;
  Path2D.prototype.ellipse=function(...args){pathBuilds++;ellipses.set(this,args);return original.ellipse.apply(this,args);};
  ctx.fill=function(path,...args){const ellipse=path&&ellipses.get(path);if(native&&ellipse){this.beginPath();this.ellipse(...ellipse);return original.fill.call(this);}return original.fill.call(this,path,...args);};
  let trig=0,differences=0,views=0;const counts=[];
  for(const k of ['sin','cos'])Math[k]=function(n){trig++;return original[k](n);};
  const identity=()=>JSON.stringify([Game.state(),Dice.s,Odds.s]),before=identity(),height=Renderer.H,quiet=Renderer.calm;
  try{for(const h of [160,360,464])for(const calm of [false,true]){
   Renderer.setHeight(h);Renderer.setCalm(calm);fx.stains[rs.level.depth]=stains;
   render(level,cam,[],fx,10000);render(level,cam,[],fx,10000);
   // The same object changes: a cache must invalidate every geometry input.
   stains[0].x+=.13;stains[0].y-=.07;stains[0].r+=.005;stains[0].seed++;stains[1].c=stains[1].c==='#2a5a1a'?'#5a0608':'#2a5a1a';stains[2].glow=!stains[2].glow;cam.x+=.07;cam.y-=.04;cam.angle+=.17;
   trig=0;render(level,cam,[],fx,10000);const cachedTrig=trig,cached=ctx.getImageData(0,0,320,h).data;
   // Draw each recorded ellipse through the original context path API too.
   // Pixel equality must hold against native rasterization, not just a fresh cache.
   native=true;render(level,cam,[],fx,10000);native=false;
   const nativePixels=ctx.getImageData(0,0,320,h).data;
   for(let i=0;i<cached.length;i++)if(cached[i]!==nativePixels[i])nativeDifferences++;
   const built=pathBuilds;render(level,cam,[],fx,10000);const reused=pathBuilds===built;
   // Fresh identities force the ordinary geometry calculation, with the exact
   // same values, order, native ellipse calls, lighting and alpha compositing.
   fx.stains[rs.level.depth]=stains.map(s=>({...s}));
   trig=0;render(level,cam,[],fx,10000);const freshTrig=trig,fresh=ctx.getImageData(0,0,320,h).data;
   for(let i=0;i<cached.length;i++)if(cached[i]!==fresh[i])differences++;
   // Colour and glow can change with a stationary camera and identical light.
   fx.stains[rs.level.depth]=stains;render(level,cam,[],fx,10000);
   stains[1].c=stains[1].c==='#2a5a1a'?'#5a0608':'#2a5a1a';stains[2].glow=!stains[2].glow;
   render(level,cam,[],fx,10000);const recoloured=ctx.getImageData(0,0,320,h).data;
   fx.stains[rs.level.depth]=stains.map(s=>({...s}));render(level,cam,[],fx,10000);
   const colourFresh=ctx.getImageData(0,0,320,h).data;
   for(let i=0;i<recoloured.length;i++)if(recoloured[i]!==colourFresh[i])differences++;
   // A stationary projection still follows a new torch-flicker time. Fresh
   // identities must produce the same pixels as the warmed geometry cache.
   fx.stains[rs.level.depth]=stains;render(level,cam,[],fx,12000);render(level,cam,[],fx,12000);
   const live=ctx.getImageData(0,0,320,h).data;
   fx.stains[rs.level.depth]=stains.map(s=>({...s}));render(level,cam,[],fx,12000);
   const liveFresh=ctx.getImageData(0,0,320,h).data;
   for(let i=0;i<live.length;i++)if(live[i]!==liveFresh[i])differences++;
   // Reach changes invalidate even cached invisible stains, without camera motion.
   level.twist=level.twist==='dark'?null:'dark';fx.stains[rs.level.depth]=stains;
   render(level,cam,[],fx,12000);const fogged=ctx.getImageData(0,0,320,h).data;
   fx.stains[rs.level.depth]=stains.map(s=>({...s}));render(level,cam,[],fx,12000);
   const fogFresh=ctx.getImageData(0,0,320,h).data;
   for(let i=0;i<fogged.length;i++)if(fogged[i]!==fogFresh[i])differences++;
   counts.push({cached:cachedTrig,fresh:freshTrig,reused});views++;
  }}finally{Math.sin=original.sin;Math.cos=original.cos;Path2D.prototype.ellipse=original.ellipse;ctx.fill=original.fill;Renderer.setHeight(height);Renderer.setCalm(quiet);}
  return{counts,differences,nativeDifferences,pathBuilds,views,unchanged:identity()===before};
 });
 expect(result.counts.every(r=>r.fresh>r.cached)).toBe(true);expect(result.counts.every(r=>r.reused)).toBe(true);expect(result.pathBuilds).toBeGreaterThan(0);expect(result.views).toBe(6);expect(result.differences).toBe(0);expect(result.nativeDifferences).toBe(0);expect(result.unchanged).toBe(true);expect(errors).toEqual([]);
});
