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
   const cases={blood:{c:'#5a0608'},ash:{c:'#16130f',solo:true},goo:{c:'#2a5a1a'},oil:{c:'#3a2a12'},ice:{c:'#a8cce4'},water:{c:'#2c3c4c',wet:true},glow:{c:'#5a0608',glow:true},future:{c:'#5a0608',at:10001},behind:{c:'#5a0608',behind:true}};
   window.__groundBefore={};window.__groundBoxes=[];window.__groundRules=[];
   // Match renderer calls at one time; the native preview separately keeps the
   // main loop/motes running. A fixed argument alone cannot freeze ambient motes.
   const render=Renderer.render;Renderer.render=()=>{};
   const fx={...rs.fx,stains:{},view:{...rs.fx.view,walk:0,steps:0}};
   const original=ctx.drawImage;
   ctx.drawImage=function(img,...args){if(window.__groundImages?.has(img))window.__groundBoxes.push(args);return original.call(this,img,...args);};
   window.__groundProbe=(name,remember=false,quiet=false)=>{
    Renderer.setCalm(quiet);
    const data=cases[name],distance=data.behind?-2:1.3;
    fx.stains[rs.level.depth]=[{x:p.x+.5+dx*distance,y:p.y+.5+dy*distance,r:.32,seed:73,at:0,...data}];
    window.__groundBoxes=[];const identity=window.__groundIdentity();render(rs.level,rs.cam,rs.sprites,fx,10000);window.__groundRules.push(identity===window.__groundIdentity());
    const pixels=ctx.getImageData(0,0,Renderer.W,Renderer.H).data;
    if(remember){window.__groundBefore[name+'|'+quiet]=pixels;return;}
    const before=window.__groundBefore[name+'|'+quiet];let changed=0,outside=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==before[i]||pixels[i+1]!==before[i+1]||pixels[i+2]!==before[i+2]||pixels[i+3]!==before[i+3]){
     changed++;const x=(i/4)%Renderer.W+.5,y=Math.floor(i/4/Renderer.W)+.5;
     if(!window.__groundBoxes.some(([bx,by,w,h])=>((x-bx-w/2)/(w/2+1))**2+((y-by-h/2)/(h/2+1))**2<=1))outside++;
    }
    return {changed,outside,draws:window.__groundBoxes.length,restored:ctx.globalAlpha===1&&ctx.globalCompositeOperation==='source-over'};
   };
   window.__groundIdentity=()=>JSON.stringify([Game.state(),Dice.s,Odds.s]);
   // Offscreen/future and unsupported fields must not initiate either request.
   for(const quiet of [false,true])for(const name of ['goo','oil','ice','water','glow','future','behind'])window.__groundProbe(name,true,quiet);
  });
  expect(requests).toHaveLength(0);
  await page.evaluate(()=>{for(const quiet of [false,true]){window.__groundProbe('blood',true,quiet);window.__groundProbe('ash',true,quiet);}});
  await expect.poll(()=>requests.length).toBe(2);release();
  await page.evaluate(async()=>{window.__groundPaint=(await import('/js/paintedworld.js')).paintedGroundDecal;});
  await expect.poll(()=>page.evaluate(()=>!!window.__groundPaint('blood',1)&&!!window.__groundPaint('ash',1))).toBe(true);
  const result=await page.evaluate(()=>{
   const canvases=[];for(const kind of ['blood','ash'])for(let i=0;i<=100;i++)canvases.push(window.__groundPaint(kind,i/100));window.__groundImages=new Set(canvases);
   const output={};for(const quiet of [false,true])for(const name of ['blood','ash','goo','oil','ice','water','glow','future','behind'])output[name+'|'+quiet]=window.__groundProbe(name,false,quiet);
   const create=document.createElement;let allocations=0;
   try{document.createElement=function(name,...args){if(name==='canvas')allocations++;return create.call(this,name,...args);};for(let i=0;i<100;i++)for(const kind of ['blood','ash'])window.__groundPaint(kind,.6);}
   finally{document.createElement=create;}
   return{output,allocations,unchanged:window.__groundRules.every(Boolean),unknown:window.__groundPaint('unknown',1)===null};
  });

  for(const quiet of [false,true])for(const kind of ['blood','ash']){expect(result.output[kind+'|'+quiet].changed).toBeGreaterThan(5);expect(result.output[kind+'|'+quiet].outside).toBe(0);expect(result.output[kind+'|'+quiet].draws).toBe(1);}
  for(const quiet of [false,true])for(const kind of ['goo','oil','ice','water','glow','future','behind'])expect(result.output[kind+'|'+quiet].changed,kind).toBe(0);
  expect(Object.values(result.output).every(r=>r.restored)).toBe(true);expect(result.allocations).toBe(0);expect(result.unchanged).toBe(true);expect(result.unknown).toBe(true);expect(requests).toHaveLength(2);expect(errors).toEqual([]);
 }finally{release?.();}
});

for(const corrupt of ['blood','ash'])test(`a corrupt ${corrupt} decal keeps the native fill and the other material independent @mobile`,async({page})=>{
 const errors=watchForErrors(page);
 await page.route(`**/img/decals/${corrupt}.png`,r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));
 await startGame(page,{seed:'ground-fallback'});
 await page.evaluate(async()=>{window.__groundModule=await import('/js/paintedworld.js');for(const kind of ['blood','ash'])window.__groundModule.paintedGroundDecal(kind,1);});
 const other=corrupt==='blood'?'ash':'blood';
 await expect.poll(()=>page.evaluate(kind=>window.__groundModule.paintedGroundDecal(kind,1)?.width,other)).toBe(128);
 await expect.poll(()=>page.evaluate(kind=>window.__groundModule.paintedWorldState()['img/decals/'+kind+'.png'],corrupt)).toBe('failed');
 expect(await page.evaluate(kind=>window.__groundModule.paintedGroundDecal(kind,1),corrupt)).toBeNull();expect(errors).toEqual([]);
});
