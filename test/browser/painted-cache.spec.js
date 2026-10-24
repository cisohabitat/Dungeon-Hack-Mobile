'use strict';
const {test,expect}=require('@playwright/test');
const {watchForErrors}=require('./helpers');

test('a late painted floor replaces an already-rendered fallback without changing the level @mobile',async({page})=>{
 let release;const gate=new Promise(r=>release=r),errors=watchForErrors(page);
 await page.route('**/img/materials/grey_halls_floor.png',async route=>{await gate;await route.continue();});
 try{
  await page.addInitScript(()=>{localStorage.setItem('deepdelve.firstSeen','1');localStorage.setItem('deepdelve.tipsOff','1');localStorage.setItem('deepdelve.prelude','off');});
  // The deliberately blocked image keeps the load event open; DOM readiness
  // still allows the player to enter and render the first level.
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.click('#btn-new');await page.click('#c-begin');await expect(page.locator('#screen-prologue')).toBeVisible();await page.click('#pro-begin');await expect(page.locator('#screen-game')).toBeVisible();
  await page.evaluate(async()=>{Game.update=()=>{};Renderer.setCalm(true);window.__cacheState=(await import('/js/paintedworld.js')).paintedWorldState;});
  await page.waitForFunction(()=>Object.entries(window.__cacheState()).filter(([url])=>url.includes('/materials/')&&!url.endsWith('/grey_halls_floor.png')).every(([,s])=>s==='ready'));
  const before=await page.evaluate(()=>{
   const T=Dungeon.T,w=9,h=11,tiles=new Uint8Array(w*h).fill(T.FLOOR);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x===0||y===0||x===w-1||y===h-1)tiles[y*w+x]=T.WALL;
   const level={...Game.level(),w,h,tiles,theme:0,roomId:new Int16Array(w*h),rooms:[{x:1,y:1,w:7,h:9,shape:'box'}],piece:null,pieces:[],caved:[],fields:[],snares:[],lights:[],dressing:[],remains:[],monsters:[],npcs:[],items:{},explored:new Uint8Array(w*h).fill(1),seen:new Uint8Array(w*h).fill(1),locks:{},doors:{},features:{},pools:[],twist:null,stairsUp:null,stairsDown:null};
   window.__cacheLevel=level;window.__cacheLevelBytes=JSON.stringify(level);
   const rs=Game.renderState(10000);window.__cacheFx={...rs.fx,arriveAt:-1e9,doorShut:{},doorFire:{},trap:null,status:{},view:{weapon:null,shield:null,offhand:null,cls:'fighter',two:false,drawn:false,walk:0,steps:0}};
   window.__cacheDraw=()=>{Renderer.render(level,{x:4.5,y:7.5,angle:-Math.PI/2},[],window.__cacheFx,10000);const c=document.querySelector('#view'),d=c.getContext('2d').getImageData(0,c.height/2,c.width,c.height/3).data;let h=2166136261;for(const v of d)h=Math.imul(h^v,16777619);return h>>>0;};
   return {hash:window.__cacheDraw(),revision:Assets.themes[0].artRevision};
  });
  release();
  await page.waitForFunction(()=>window.__cacheState()['img/materials/grey_halls_floor.png']==='ready');
  const after=await page.evaluate(()=>({hash:window.__cacheDraw(),revision:Assets.themes[0].artRevision,levelUnchanged:JSON.stringify(window.__cacheLevel)===window.__cacheLevelBytes}));
  expect(after.revision).toBeGreaterThan(before.revision);expect(after.hash).not.toBe(before.hash);expect(after.levelUnchanged).toBe(true);expect(errors).toEqual([]);
 }finally{release();}
});
