'use strict';
const {test,expect}=require('@playwright/test');
const {startGame,artReady,watchForErrors}=require('./helpers');

test('reading vellum loads on demand and preserves live writing, clipping and every spell colour @mobile',async({page})=>{
 const errors=watchForErrors(page);let release,requests=0;const gate=new Promise(r=>release=r);
 await page.route('**/img/overlays/reading-scroll.png',async route=>{requests++;await gate;await route.continue();});
 await startGame(page,{seed:'reading-vellum'});expect(requests).toBe(0);
 await page.evaluate(async()=>{
  const {makeSpellFx}=await import('/js/spellfx.js');
  window.__scrollProbe=()=>{
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=360;const ctx=canvas.getContext('2d'),events=[];
   for(const key of ['save','restore','beginPath','rect','clip','arc','moveTo','lineTo','stroke','fillRect']){const original=ctx[key].bind(ctx);ctx[key]=function(...args){if(key!=='fillRect'||!['#2a1c10','#e8d8a8','#d4c090','#b08850','#d8b070'].includes(ctx.fillStyle))events.push([key,...args,...(['fillRect','stroke'].includes(key)?[String(key==='stroke'?ctx.strokeStyle:ctx.fillStyle)]:[])]);return original(...args);};}
   const painter=makeSpellFx({ctx,W:320,H:360,ease:t=>t*t*(3-2*t),put:(_frame,x,y)=>events.push(['hand',x,y])});
   for(const[kind,color]of Object.entries({fire:'#ff7020',frost:'#a8e0ff',lightning:'#e0f0ff',heal:'#60e080',map:'#70b0ff',teleport:'#c080ff',uncurse:'#ffe8a0'}))for(const ru of [0,.16,.25,.4,.61,.62,.7,.9,.999])painter.drawReading({readKind:kind,readColor:color},ru,'fighter',0,0);
   return {events,duration:painter.READ_MS,restored:ctx.globalCompositeOperation==='source-over'&&ctx.globalAlpha===1};
  };
 });
 const fallback=await page.evaluate(()=>window.__scrollProbe());expect(fallback.duration).toBe(1000);expect(fallback.restored).toBe(true);await expect.poll(()=>requests).toBe(1);
 release();await page.evaluate(async()=>{window.__readingScroll=(await import('/js/paintedworld.js')).paintedReadingScroll;});
 await expect.poll(()=>page.evaluate(()=>window.__readingScroll()?.img.width)).toBe(256);
 expect(await page.evaluate(()=>window.__scrollProbe())).toEqual(fallback);expect(requests).toBe(1);
 // The image, including a transparent fringe, is cached once, not painted each frame.
 expect(await page.evaluate(()=>{const a=window.__readingScroll(),b=window.__readingScroll();return a===b&&a.img===b.img&&a.img.getContext('2d').getImageData(0,0,1,1).data[3]===0;})).toBe(true);
 await artReady(page);
 const fit=await page.evaluate(async()=>{
  const{Dice,Odds}=await import('/js/rng.js'),ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage,oldUpdate=Game.update,height=Renderer.H,calm=Renderer.calm,rs=Game.renderState(10000),before=JSON.stringify(Game.state()),dice=[Dice.s,Odds.s],frame=window.__readingScroll(),boxes=[];
  let draws=0;
  try{Game.update=()=>{};ctx.drawImage=function(img,x,y,w,h,...args){if(img===frame.img){draws++;const s=w/256,box=[x+17*s,y+37*s,x+239*s,y+218*s];if(box[0]<0||box[1]<0||box[2]>Renderer.W||box[3]>Renderer.H)boxes.push(box);}return draw.call(this,img,x,y,w,h,...args);};
   for(const h of [160,360,464]){Renderer.setHeight(h);for(const cls of ['fighter','cleric','mage','thief','ranger','druid','spellblade'])for(const quiet of [false,true])for(const ru of [.38,.61,.8]){Renderer.setCalm(quiet);const fx={...rs.fx,swingAt:-1e9,offAt:-1e9,castAt:-1e9,readAt:10000-1000*ru,readKind:'map',readColor:'#70b0ff',useAt:-1e9,throwAt:-1e9,bashAt:-1e9,arriveAt:-1e9,damageUntil:0,view:{weapon:null,cls,two:false,drawn:false,shield:null,offhand:null,lantern:false,walk:0,steps:0}};Renderer.render(rs.level,rs.cam,rs.sprites,fx,10000);}}
   return{draws,boxes,state:JSON.stringify(Game.state())===before,dice:Dice.s===dice[0]&&Odds.s===dice[1]};
  }finally{ctx.drawImage=draw;Game.update=oldUpdate;Renderer.setHeight(height);Renderer.setCalm(calm);}
 });expect(fit).toEqual({draws:126,boxes:[],state:true,dice:true});expect(errors).toEqual([]);
});

test('a corrupt reading parchment retains its complete procedural page and independent painted lantern @mobile',async({page})=>{
 const errors=watchForErrors(page);await page.route('**/img/overlays/reading-scroll.png',r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));
 await startGame(page,{seed:'reading-fallback'});
 await page.evaluate(async()=>{const p=await import('/js/paintedworld.js');window.__scrollPaint=p;p.paintedReadingScroll();p.paintedLantern();});
 await expect.poll(()=>page.evaluate(()=>window.__scrollPaint.paintedWorldState()['img/overlays/reading-scroll.png'])).toBe('failed');
 await expect.poll(()=>page.evaluate(()=>window.__scrollPaint.paintedLantern()?.img.width)).toBe(256);
 const result=await page.evaluate(async()=>{const{makeSpellFx}=await import('/js/spellfx.js'),c=document.createElement('canvas');c.width=320;c.height=360;const ctx=c.getContext('2d'),fill=ctx.fillRect;let page=false,rolls=0;ctx.fillRect=function(...a){if(this.fillStyle==='#e8d8a8')page=true;if(this.fillStyle==='#b08850')rolls++;return fill.apply(this,a);};makeSpellFx({ctx,W:320,H:360,ease:t=>t,put:()=>{}}).drawReading({readKind:'map',readColor:'#70b0ff'},.4,'fighter',0,0);return{page,rolls,fallback:window.__scrollPaint.paintedReadingScroll()===null};});
 expect(result).toEqual({page:true,rolls:2,fallback:true});expect(errors).toEqual([]);
});
