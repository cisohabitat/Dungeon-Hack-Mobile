'use strict';
// Running native actions with supplied nearby objects/resources. Angle views
// below are separate, frozen geometry fixtures; neither substitutes paintings.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../../..');
const {chromium}=require(root+'/node_modules/playwright');
const {serve}=require(root+'/test/server');
const {startGame,faceOpenGround,watchForErrors,expect}=require(root+'/test/browser/helpers');
const output=path.resolve(process.env.INTERACTION_OUTPUT||path.join(__dirname,'captures'));
fs.mkdirSync(output,{recursive:true});
const records=[];
async function frames(page,label,count=12){
 const rows=await page.evaluate(async count=>{
  const rows=[];for(let i=0;i<count;i++){
   await new Promise(r=>requestAnimationFrame(r));const rs=Game.renderState(performance.now());
   rows.push({index:i,columns:Renderer.doorColumns,shut:rs.fx.doorShut,tile:Game.level().tiles[window.__q.y*Game.level().w+window.__q.x],pixels:[0,3,7,11].includes(i)?document.querySelector('#view').toDataURL():null});
  }return rows;
 },count);
 for(const row of rows)if(row.pixels){const file=label+'-'+row.index+'.png';fs.writeFileSync(path.join(output,file),Buffer.from(row.pixels.split(',')[1],'base64'));row.file=file;delete row.pixels;}
 return rows;
}
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 for(const width of[320,390,740])for(const kind of(process.env.INTERACTION_KINDS?.split(',')||['door','battered','gate-key','burn','secret','chest','snare','levers'])){
  const context=await browser.newContext({baseURL:process.env.INTERACTION_BASE_URL||`http://127.0.0.1:${server.address().port}`,viewport:{width,height:width===740?360:width===320?667:844}});
  const page=await context.newPage(),errors=watchForErrors(page),label=width+'-'+kind;
  await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});
  await startGame(page,{seed:'door-continuity',name:'Interaction review'});expect(await faceOpenGround(page,2)).toBeGreaterThanOrEqual(2);
  await page.evaluate(async kind=>{
   const G=Game.state();G.levels[G.depth]={...Game.level(),monsters:[],npcs:[],dressing:[],remains:[],items:{},fields:{},traps:{},snares:{},puzzle:null,piece:null,doorBlows:{},locks:{}};
   const L=Game.level(),p=Game.player(),[dx,dy]=Dungeon.DIRS[p.dir],x=p.x+dx,y=p.y+dy,key=x+','+y;window.__q={x,y,key};p.hp=p.maxHp=999;p.nextAttack=0;
   if(['door','battered','gate-key','burn','secret'].includes(kind)){
    L.tiles[y*L.w+x]=kind==='secret'?Dungeon.T.SECRET:kind==='gate-key'?Dungeon.T.DOOR_LOCKED:Dungeon.T.DOOR;
    L.tiles[(y+dx)*L.w+x-dy]=Dungeon.T.WALL;L.tiles[(y-dx)*L.w+x+dy]=Dungeon.T.WALL;
   }
   if(kind==='gate-key'){L.piece={kind:'cells',room:0};L.rooms[0]={x:1,y:1,w:L.w-2,h:L.h-2,shape:'box'};L.roomId.fill(0);L.locks[key]='silver';p.inv.push({t:'key',color:'silver',q:1,e:0});}
   if(kind==='battered')L.doorBlows[key]=2;
   if(kind==='chest')L.dressing=[{k:'chest',x,y,ox:0,oy:0,loot:[{t:'gold',q:23}]}];
   if(kind==='snare'){L.snares[key]=true;L.traps[key]='snare';}
   if(kind==='levers')L.npcs=[{kind:'encounter',id:'levers',x,y,done:false}];
   const t=Assets.themes[L.theme];void t.door;void t.cellDoor;void t.locked.silver;t.cellLocked('silver');
   const {PAINTED}=await import('/js/paintedcatalog.js');window.__interactionState=(await import('/js/paintedworld.js')).paintedWorldState;
   window.__interactionUrls=[PAINTED.themes[L.theme].door,PAINTED.themes[L.theme].cellDoor];
   for(const k of['dress_chest','dress_snare','lever_door','remains_staves']){void Assets.sprites[k]?.url;if(PAINTED.static[k])window.__interactionUrls.push(PAINTED.static[k]);}
  },kind);
  await page.waitForFunction(()=>window.__interactionUrls.filter(Boolean).every(p=>window.__interactionState()[p]==='ready'));
  await page.waitForTimeout(2700);await page.screenshot({path:path.join(output,label+'-before.png')});
  let moving=[],closing=[],outcome;
  if(kind==='burn'){
   await page.evaluate(()=>{const G=Game.state(),L=Game.level();L.fields[window.__q.key]={k:'fire',fuel:'door',until:G.t+750,spread:1e12,burn:1e12,gen:0};});
   await page.waitForTimeout(300);await page.screenshot({path:path.join(output,label+'-burning.png')});
   await page.waitForFunction(()=>!!Game.level().burntDoors?.[window.__q.key]);moving=await frames(page,label+'-fall');
  }else{
   await page.evaluate(()=>Game.input('use'));moving=await frames(page,label+'-action');
   if(['door','battered','gate-key'].includes(kind)){
    await page.waitForFunction(()=>!Game.renderState(performance.now()).fx.doorShut);
    await page.evaluate(()=>Game.input('use'));closing=await frames(page,label+'-close');
   }
   if(kind==='levers'){
    await expect(page.locator('#ov-encounter')).toHaveClass(/open/);await page.locator('#enc-art').evaluate(i=>i.decode());
    await page.screenshot({path:path.join(output,label+'-choices.png')});await page.waitForTimeout(750);await page.locator('.enc-choice').nth(Number(process.env.INTERACTION_LEVER_CHOICE||2)).click();
    await page.screenshot({path:path.join(output,label+'-result.png')});outcome=await page.evaluate(()=>Game.currentEncounter().result.text);
    await page.waitForTimeout(750);await page.locator('#enc-choices .primary').click();
   }
  }
  await page.waitForTimeout(1100);await page.screenshot({path:path.join(output,label+'-after.png')});
  const final=await page.evaluate(()=>{const L=Game.level(),q=window.__q;return{tile:L.tiles[q.y*L.w+q.x],sliding:Renderer.doorColumns,blows:L.doorBlows[q.key],burnt:!!L.burntDoors?.[q.key],field:L.fields[q.key]?.k,chest:L.dressing.some(d=>d.k==='chest'),loot:L.items[q.key],snare:!!L.snares[q.key],trap:!!L.traps[q.key],lock:L.locks[q.key]};});
  if(kind==='chest'){expect(final.chest).toBe(false);expect(final.loot).toEqual([{t:'gold',q:23}]);}
  if(kind==='snare'){expect(final.snare).toBe(false);expect(final.trap).toBe(false);}
  if(kind==='secret')expect(final.tile).toBe(3);
  if(kind==='burn'){expect(final.burnt).toBe(true);expect(final.field).toBe('ash');expect(final.sliding).toBe(0);}
  if(['door','battered','gate-key'].includes(kind)){expect(final.tile).toBe(2);expect(moving.some(f=>f.columns>0)).toBe(true);expect(closing.some(f=>f.columns>0)).toBe(true);}
  expect(errors).toEqual([]);records.push({width,kind,moving,closing,final,outcome,errors,scope:'Native commands, updates and renderer; nearby objects/resources supplied, no asset substitutions.'});await context.close();console.log(label+' passed');
 }
 // A fresh page for controlled side views: no claim of live traversal here.
 for(const width of(process.env.INTERACTION_ANGLES==='0'?[]:[320,390,740])){
  const context=await browser.newContext({baseURL:process.env.INTERACTION_BASE_URL||`http://127.0.0.1:${server.address().port}`,viewport:{width,height:width===740?360:844}}),page=await context.newPage(),errors=watchForErrors(page);
  await startGame(page,{seed:'door-angle-review'});
  await page.evaluate(async()=>{Game.update=()=>{};window.__angleRender=Renderer.render;window.__angleState=(await import('/js/paintedworld.js')).paintedWorldState;for(const n of[0,6,10]){const t=Assets.themes[n];void t.door;void t.cellDoor;void t.locked.silver;t.cellLocked('silver');}});
  await page.waitForFunction(()=>Object.values(window.__angleState()).every(s=>s==='ready'));
  for(const region of[0,6,10])for(const cell of[false,true])for(const axis of['x','y'])for(const side of[-1,1]){
   const label=`${width}-angle-${region}-${cell?'gate':'door'}-${axis}-${side}`;
   const metrics=await page.evaluate(({region,cell,axis,side})=>{
    const T=Dungeon.T,w=11,h=11,x=5,y=5,tiles=new Uint8Array(w*h).fill(T.FLOOR);
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(!xx||!yy||xx===w-1||yy===h-1||(axis==='y'?yy===y:xx===x))tiles[yy*w+xx]=T.WALL;
    tiles[y*w+x]=T.DOOR_OPEN;
    const L={...Game.level(),w,h,tiles,theme:region,roomId:new Int16Array(w*h),rooms:[{x:1,y:1,w:9,h:9,shape:'box'}],piece:cell?{kind:'cells',room:0}:null,pieces:[],caved:[],lights:[],dressing:[],remains:[],monsters:[],npcs:[],items:{},explored:new Uint8Array(w*h).fill(1),seen:new Uint8Array(w*h).fill(1),locks:{},doorBlows:{'5,5':2},fields:{},pools:[],twist:null,stairsUp:null,stairsDown:null};
    const cam=axis==='y'?{x:5.78,y:5.5+side*1.35}:{x:5.5+side*1.35,y:5.78};cam.angle=Math.atan2(5.5-cam.y,5.5-cam.x);
    const now=10000,rs=Game.renderState(now),fx={...rs.fx,view:null,arriveAt:-1e9,doorShut:{[y*w+x]:{shut:.65,lock:'silver'}},doorFire:{}};
    Renderer.render=()=>window.__angleRender(L,cam,[],fx,now);Renderer.render();return{columns:Renderer.doorColumns,jambs:Renderer.looks.jambs,cam};
   },{region,cell,axis,side});
   expect(metrics.columns).toBeGreaterThan(0);await page.locator('#view').screenshot({path:path.join(output,label+'.png')});records.push({width,region,cell,axis,side,...metrics,file:label+'.png',scope:'Frozen supplied geometry and 65% leaf; native shipped loader/rendering, no source substitutions.'});
  }
  expect(errors).toEqual([]);await context.close();
 }
 fs.writeFileSync(path.join(output,'evidence.json'),JSON.stringify({sourceCommit:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),records},null,2)+'\n');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
