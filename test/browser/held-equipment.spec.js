'use strict';
const {test,expect}=require('@playwright/test');
const {startGame,watchForErrors}=require('./helpers');

for(const height of [160,360]) test(`held equipment keeps its object inside the ${height}-pixel view @mobile`,async({page})=>{
 const errors=watchForErrors(page);await startGame(page,{seed:'held-equipment-fit',cls:'Fighter'});
 const result=await page.evaluate(async height=>{
  const {GRIPS}=await import('/js/itemart.js'),{RELICS}=await import('/js/relics.js'),{namedSprite,namedBase}=await import('/js/namedart.js');
  const {Dice,Odds}=await import('/js/rng.js');
  const oldHeight=Renderer.H,oldCalm=Renderer.calm,ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage;
  const held=Assets.held,carried=Assets.carried,frames=new Map(),bad=[];let checked=0;
  const state=Game.renderState(performance.now()),before=JSON.stringify(Game.state()),dice=[Dice.s,Odds.s];
  const fx={...state.fx,swingAt:-1e9,offAt:-1e9,castAt:-1e9,readAt:-1e9,useAt:-1e9,throwAt:-1e9,bashAt:-1e9,arriveAt:-1e9,damageUntil:0};
  try{
   Renderer.setHeight(height);Renderer.setCalm(true);
   Assets.held=(...args)=>{const f=held(...args);if(f)frames.set(f.img,f);return f;};
   Assets.carried=(...args)=>{const f=carried(...args);if(f)frames.set(f.img,f);return f;};
   ctx.drawImage=function(image,x,y,w,h,...rest){const f=frames.get(image);if(f?.at.min&&f.at.max){const lo=f.at.min,hi=f.at.max;const box=[x+lo[0]*w/image.width,y+lo[1]*h/image.height,x+hi[0]*w/image.width,y+hi[1]*h/image.height];if(box.some((v,i)=>i<2?v<1:v>(i===2?Renderer.W:Renderer.H)-1))bad.push({id:fx.view.weapon||fx.view.shield,box});checked++;}return draw.call(this,image,x,y,w,h,...rest);};
   const ids=[...Object.keys(GRIPS),'shortbow','longbow',...Object.keys(RELICS).map(namedSprite).filter(id=>held(id,'rest','fighter',false))];
   for(const id of ids){fx.view={weapon:id,two:/staff|greatsword$/.test(id),drawn:['shortbow','longbow'].includes(namedBase(id)),shield:null,offhand:null,cls:'fighter',walk:0,steps:0};Renderer.render(state.level,state.cam,state.sprites,fx,10000);}
   for(const id of ['buckler','shield','towershield','quillshield','relic_sisters_buckler','legend_rimebound']){fx.view={weapon:null,two:false,drawn:false,shield:id,offhand:null,cls:'fighter',walk:0,steps:0};Renderer.render(state.level,state.cam,state.sprites,fx,10000);}
   return {bad,checked,state:JSON.stringify(Game.state())===before,dice:Dice.s===dice[0]&&Odds.s===dice[1]};
  }finally{ctx.drawImage=draw;Assets.held=held;Assets.carried=carried;Renderer.setHeight(oldHeight);Renderer.setCalm(oldCalm);}
 },height);
 expect(result.bad).toEqual([]);expect(result.checked).toBeGreaterThan(30);expect(result.state).toBe(true);expect(result.dice).toBe(true);expect(errors).toEqual([]);
});

test('bow grips follow fitted nocks, release matches combat, and action hands are not duplicated @mobile',async({page})=>{
 const errors=watchForErrors(page);await startGame(page,{seed:'held-release',cls:'Ranger'});
 const result=await page.evaluate(()=>{
  const rs=Game.renderState(performance.now()),ctx=document.querySelector('#view').getContext('2d');
  const old={held:Assets.held,draw:ctx.drawImage,move:ctx.moveTo,line:ctx.lineTo,begin:ctx.beginPath,stroke:ctx.stroke,fill:ctx.fillRect},rows=[];
  let frames=new Map(),draws=[],path=[],string=null,arrow=0,calls=[],shaft=null;
  try{
   Assets.held=(...a)=>{calls.push(a);const f=old.held(...a);if(f)frames.set(f.img,{f,id:a[0],pose:a[1]});return f;};
   ctx.drawImage=function(img,x,y,w,h,...r){if(frames.has(img))draws.push({...frames.get(img),x,y,w,h});return old.draw.call(this,img,x,y,w,h,...r);};
   ctx.beginPath=function(){path=[];return old.begin.call(this);};ctx.moveTo=function(x,y){path.push([x,y]);return old.move.call(this,x,y);};ctx.lineTo=function(x,y){path.push([x,y]);return old.line.call(this,x,y);};
   ctx.stroke=function(){if(this.strokeStyle==='#e8e0cc'&&path.length===3)string=path.slice();if(this.strokeStyle==='#b08858'&&path.length===2){const m=this.getTransform();shaft=path.map(([x,y])=>[m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f]);}return old.stroke.call(this);};
   ctx.fillRect=function(...a){if(this.fillStyle==='#e04838')arrow++;return old.fill.call(this,...a);};
   const fx={...rs.fx,swingAt:10000,swingMs:300,offAt:-1e9,castAt:-1e9,readAt:-1e9,useAt:-1e9,throwAt:-1e9,bashAt:-1e9,arriveAt:-1e9,damageUntil:0,view:{weapon:'longbow',two:true,drawn:true,shield:null,offhand:null,cls:'ranger',steps:0,walk:0}};
   Renderer.setCalm(false);Renderer.setHeight(160);
   for(const u of [0,.001,.159,.161,.3,.5,.719,.721,.8,.95,.999,1]){
    draws=[];string=null;arrow=0;shaft=null;Renderer.render(rs.level,rs.cam,rs.sprites,fx,10000+u*300);
    const bow=draws.find(d=>d.id==='longbow'),hand=draws.find(d=>d.id===null),tip=key=>[bow.x+bow.f.at[key][0]*bow.w/bow.f.img.width,bow.y+bow.f.at[key][1]*bow.h/bow.f.img.height];
    const grip=[hand.x+hand.f.ax*hand.w/hand.f.img.width,hand.y+hand.f.ay*hand.h/hand.f.img.height];
    const rest=[bow.x+(bow.f.ax-2)*bow.w/bow.f.img.width,bow.y+(bow.f.ay-8)*bow.h/bow.f.img.height];
    const shaftGap=shaft?Math.abs((shaft[1][0]-shaft[0][0])*(shaft[0][1]-rest[1])-(shaft[0][0]-rest[0])*(shaft[1][1]-shaft[0][1]))/Math.hypot(shaft[1][0]-shaft[0][0],shaft[1][1]-shaft[0][1]):null;
    rows.push({u,arrow,grip,bowGrip:bow.x+bow.f.ax*bow.w/bow.f.img.width,width:Renderer.W,shaftGap,shaftPastRest:shaft?shaft[1][0]<rest[0]:null,endpoints:[tip('top'),tip('bot')].map((p,i)=>Math.hypot(p[0]-string[i*2][0],p[1]-string[i*2][1])),gripGap:Math.abs(hand.x+hand.f.ax*hand.w/hand.f.img.width-string[1][0])});
   }
   fx.swingAt=-1e9;fx.castAt=10000;const start=[];for(const at of [10000,10000.1]){draws=[];Renderer.render(rs.level,rs.cam,rs.sprites,fx,at);start.push(draws.find(d=>d.id==='longbow').y);}draws=[];Renderer.render(rs.level,rs.cam,rs.sprites,fx,10260);const castHands=draws.length;const castJump=Math.abs(start[1]-start[0]);
   fx.castAt=-1e9;fx.view={...fx.view,weapon:'throwknife',drawn:false,two:false};fx.swingAt=10000;
   const knife=[];for(const id of ['throwknife','relic_vashti']){fx.view.weapon=id;const row=[];for(const u of [.399,.401]){calls=[];Renderer.render(rs.level,rs.cam,rs.sprites,fx,10000+u*300);row.push(calls.some(a=>a[0]===id));}knife.push(row);}
   return {rows,castHands,knife,castJump};
  }finally{Assets.held=old.held;ctx.drawImage=old.draw;ctx.moveTo=old.move;ctx.lineTo=old.line;ctx.beginPath=old.begin;ctx.stroke=old.stroke;ctx.fillRect=old.fill;}
 });
 for(const row of result.rows){for(const gap of row.endpoints)expect(gap).toBeLessThan(1.5);if(row.u>=.16&&row.u<.72)expect(row.gripGap).toBeLessThan(1.5);expect(row.arrow>0).toBe(row.u<.72||row.u===1);if(row.shaftGap!==null){expect(row.shaftGap).toBeLessThan(1.5);expect(row.shaftPastRest).toBe(true);}}
 const drawn=result.rows.find(r=>r.u===.5);expect(drawn.bowGrip/drawn.width).toBeGreaterThan(.4);expect(drawn.bowGrip/drawn.width).toBeLessThan(.5);expect(drawn.grip[0]/drawn.width).toBeGreaterThan(.72);
 const resting=result.rows.find(r=>r.u===0);expect(resting.grip[0]/resting.width).toBeGreaterThan(.8);
 for(const [a,b] of [[0,.001],[.159,.161]]){const p=result.rows.find(r=>r.u===a),q=result.rows.find(r=>r.u===b);expect(Math.hypot(p.grip[0]-q.grip[0],p.grip[1]-q.grip[1])).toBeLessThan(2);}
 const before=result.rows.find(r=>r.u===.719),after=result.rows.find(r=>r.u===.721);expect(Math.hypot(before.grip[0]-after.grip[0],before.grip[1]-after.grip[1])).toBeLessThan(2);
 const end=result.rows.find(r=>r.u===.999),idle=result.rows.find(r=>r.u===1);expect(Math.hypot(end.grip[0]-idle.grip[0],end.grip[1]-idle.grip[1])).toBeLessThan(2);
 expect(result.castHands).toBe(2);expect(result.castJump).toBeLessThanOrEqual(1);expect(result.knife).toEqual([[true,false],[true,false]]);expect(errors).toEqual([]);
});

test('cached bow flex and surface glints respect Calm view and preserve existing named silhouettes @mobile',async({page})=>{
 const errors=watchForErrors(page);await startGame(page,{seed:'held-calm',cls:'Mage'});
 const result=await page.evaluate(()=>{
  const rs=Game.renderState(performance.now()),ctx=document.querySelector('#view').getContext('2d'),stroke=ctx.stroke,held=Assets.held,oldCalm=Renderer.calm;
  const fx={...rs.fx,swingAt:-1e9,offAt:-1e9,readAt:-1e9,useAt:-1e9,throwAt:-1e9,bashAt:-1e9,arriveAt:-1e9,damageUntil:0,castAt:10000,view:{weapon:'relic_emberwood',two:true,drawn:false,shield:null,offhand:null,cls:'mage',steps:0,walk:0}};
  let glints=0,poses=[];
  try{
   ctx.stroke=function(){if(this.strokeStyle==='#efa365')glints++;return stroke.call(this);};
   Assets.held=(...a)=>{poses.push(a[1]);return held(...a);};
   const paint=calm=>{glints=0;Renderer.setCalm(calm);Renderer.render(rs.level,rs.cam,rs.sprites,fx,10260);return glints;};
   const lit=paint(false),calm=paint(true);
   fx.castAt=-1e9;fx.swingAt=10000;fx.view={...fx.view,weapon:'mythic_horizon',drawn:true};
   poses=[];Renderer.setCalm(false);Renderer.render(rs.level,rs.cam,rs.sprites,fx,10180);const flex=poses.includes('bowfull'),raisedX=Renderer.hands[0][0];
   poses=[];Renderer.setCalm(true);Renderer.render(rs.level,rs.cam,rs.sprites,fx,10180);const still=!poses.includes('bowfull')&&!poses.includes('bowdraw'),calmBow=Renderer.hands[0].slice();
   fx.swingAt=-1e9;Renderer.render(rs.level,rs.cam,rs.sprites,fx,10180);const calmBowStill=calmBow.every((v,i)=>v===Renderer.hands[0][i]);
   const a=held('mythic_horizon','bowfull','ranger',false),b=held('mythic_horizon','rest','ranger',false);
   const hidden=Game.spriteFor({t:'throwknife',u:'vashti',e:2,q:1,h:true});
   return {lit,calm,flex,still,calmBowStill,aimShift:raisedX-calmBow[0],cached:a===held('mythic_horizon','bowfull','ranger',false),different:a.img.toDataURL()!==b.img.toDataURL(),hidden};
  }finally{ctx.stroke=stroke;Assets.held=held;Renderer.setCalm(oldCalm);}
 });
 expect(result.lit).toBeGreaterThan(0);expect(result.calm).toBe(0);expect(result.flex).toBe(true);expect(result.still).toBe(true);expect(result.calmBowStill).toBe(true);expect(result.aimShift).toBeGreaterThan(50);expect(result.cached).toBe(true);expect(result.different).toBe(true);expect(result.hidden).toBe('relic_vashti');expect(errors).toEqual([]);
});

test('fitted shields and foci leave floor loot visible in a tall view @mobile',async({page})=>{
 const errors=watchForErrors(page);await startGame(page,{seed:'bow-clear',cls:'Fighter'});
 const rows=await page.evaluate(()=>{
  Game.skipPrelude();const L=Game.level(),p=Game.player(),[dx,dy]=Dungeon.DIRS[p.dir],ctx=document.querySelector('#view').getContext('2d'),height=Renderer.H,calm=Renderer.calm;
  for(const k of [1,2,3])L.tiles[(p.y+dy*k)*L.w+p.x+dx*k]=Dungeon.T.FLOOR;L.monsters=[];L.dressing=[];L.npcs=[];
  const key=[p.x+dx,p.y+dy].join(','),previous=L.items[key];
  function pixels(shield){const images=[];for(const present of [true,false]){if(present)L.items[key]=[{t:'ring_protect'}];else delete L.items[key];const rs=Game.renderState(10000),fx={...rs.fx,swingAt:-1e9,offAt:-1e9,castAt:-1e9,readAt:-1e9,useAt:-1e9,throwAt:-1e9,bashAt:-1e9,arriveAt:-1e9,damageUntil:0,view:{...rs.fx.view,weapon:shield?'longsword':null,shield,offhand:null,two:false,drawn:false,lantern:false}};Renderer.render(rs.level,rs.cam,rs.sprites,fx,10000);images.push(ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data);}let n=0;for(let i=0;i<images[0].length;i+=4)if(Math.abs(images[0][i]-images[1][i])+Math.abs(images[0][i+1]-images[1][i+1])+Math.abs(images[0][i+2]-images[1][i+2])>24)n++;return n;}
  try{Renderer.setHeight(360);Renderer.setCalm(true);const clear=pixels(null);return ['shield','towershield','buckler','quillshield','legend_bastion','spellbook','crystal_orb'].map(id=>({id,clear,visible:pixels(id)}));}
  finally{if(previous)L.items[key]=previous;else delete L.items[key];Renderer.setHeight(height);Renderer.setCalm(calm);}
 });
 for(const row of rows){expect(row.clear).toBeGreaterThan(40);expect(row.visible/row.clear, row.id).toBeGreaterThan(.95);}expect(errors).toEqual([]);
});
