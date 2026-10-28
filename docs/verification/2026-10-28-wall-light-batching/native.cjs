'use strict';
// Native movement/casts on supplied nearby terrain; frozen regional views are
// recorded separately. No image substitution, frozen native update or dice stub.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),root=path.resolve(__dirname,'../../..');
const {chromium}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server');
const {startGame,faceOpenGround,placeMonster,artReady,watchForErrors,expect}=require(root+'/test/browser/helpers');
const offline=process.env.LIGHTING_OFFLINE==='1',out=path.resolve(process.env.LIGHTING_OUTPUT||path.join(__dirname,offline?'offline':'captures'));
fs.mkdirSync(out,{recursive:true});
async function frames(page,label){
 const rows=await page.evaluate(async()=>{const rows=[];for(let i=0;i<12;i++){await new Promise(r=>requestAnimationFrame(r));const rs=Game.renderState(performance.now());rows.push({index:i,cam:rs.cam,fields:Object.fromEntries(Object.entries(Game.level().fields||{}).map(([k,f])=>[k,f.k])),pixels:i===0?document.querySelector('#view').toDataURL():null});}return rows;});
 for(const row of rows)if(row.pixels){row.file=label+'-'+row.index+'.png';fs.writeFileSync(path.join(out,row.file),Buffer.from(row.pixels.split(',')[1],'base64'));delete row.pixels;}return rows;
}
(async()=>{
 let online=true;const server=http.createServer((req,res)=>{if(!online){req.socket.destroy();return;}serve(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),records=[];
 try{
 for(const width of(offline?[320,390]:[320,390,740]))for(const kind of(process.env.LIGHTING_KINDS?.split(',')||(offline?['lighting','cold']:['lighting','dark','flooded','overgrown','cold','fire']))){
  online=true;const context=await browser.newContext({baseURL:process.env.LIGHTING_BASE_URL||`http://127.0.0.1:${server.address().port}`,viewport:{width,height:width===740?360:width===320?667:844}}),page=await context.newPage(),errors=watchForErrors(page),label=width+'-'+kind;
  await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});
  await startGame(page,{seed:'combat-clarity',name:'Lighting review',cls:'mage'});
  if(offline){await page.evaluate(()=>{Game.level().monsters=[];Game.save(true);});await artReady(page);await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));await expect(page.locator('#offline-status')).toHaveAttribute('data-core','true',{timeout:120000});await expect(page.locator('#offline-status')).toHaveAttribute('data-voice','ready',{timeout:120000});online=false;await context.setOffline(true);await page.reload();await page.click('#btn-continue');await expect(page.locator('#screen-game')).toBeVisible();}
  expect(await faceOpenGround(page,3)).toBeGreaterThanOrEqual(3);
  await page.evaluate(async kind=>{
   const G=Game.state();G.levels[G.depth]={...Game.level(),monsters:[],npcs:[],dressing:[],remains:[],items:{},fields:{},traps:{},snares:{},puzzle:null,piece:null};
   const L=Game.level(),p=Game.player(),[dx,dy]=Dungeon.DIRS[p.dir],x=p.x+dx*2-dy,y=p.y+dy*2+dx;p.level=10;p.hp=p.maxHp=999;p.sp=p.maxSp=999;p.nextAttack=0;
   L.tiles[y*L.w+x]=kind==='dark'?Dungeon.T.WALL:Dungeon.T.TORCH;L.lights=kind==='dark'?[]:[{x,y}];L.twist=kind==='cold'?'flooded':['flooded','overgrown','dark'].includes(kind)?kind:null;
   window.__lightingOrigin={x:p.x,y:p.y,dir:p.dir};window.__lightingState=(await import('/js/paintedworld.js')).paintedWorldState;
   const m=(await import('/js/paintedcatalog.js')).PAINTED.themes[L.theme],t=Assets.themes[L.theme];void t.wall;void t.door;void t.torchFrames;for(let i=0;i<7;i++)t.floorOf(i);for(let i=0;i<4;i++)t.ceilOf(i);
   window.__lightingUrls=Object.values(m).filter(p=>typeof p==='string'&&window.__lightingState()[p]);
  },kind);
  await page.waitForFunction(()=>window.__lightingUrls.every(p=>window.__lightingState()[p]==='ready'));await artReady(page);await page.waitForTimeout(2700);
  await page.screenshot({path:path.join(out,label+'-before.png')});const stages=[];
  if(kind==='cold'||kind==='fire'){
   expect(await placeMonster(page,'orc',2,{hp:9999,maxHp:9999,nextAct:1e12,awake:true,spoke:true})).not.toBeNull();
   if(kind==='fire'){
    await page.evaluate(()=>{const p=Game.player(),it={t:'lamp_oil',q:1,e:0};p.inv.push(it);Game.useItem(it);});
    await page.waitForFunction(()=>Object.values(Game.level().fields||{}).some(f=>f.k==='oil'));
    await page.waitForFunction(()=>!Game.renderState(performance.now()).fx.landings.some(l=>l.at>performance.now()));
    stages.push({kind:'oil',frames:await frames(page,label+'-oil')});
   }
   await page.evaluate(kind=>{const p=Game.player();p.nextAttack=0;Game.state().blowGate=0;if(kind==='fire'){const scroll={t:'scroll_fire',q:1,e:0};p.inv.push(scroll);Game.useItem(scroll);if(p.inv.includes(scroll))throw Error('Native fire scroll was not consumed');}else{const spell=Game.knownSpells().find(s=>s.id==='cone_cold');if(!spell||!Game.castSpell(spell))throw Error('Native Cone of Cold did not cast');}},kind);
   const field=kind==='cold'?'ice':'fire';await page.waitForFunction(field=>Object.values(Game.level().fields||{}).some(f=>f.k===field),field);
   stages.push({kind:field,frames:await frames(page,label+'-'+field)});
   await page.evaluate(()=>{const G=Game.state(),L=Game.level();L.monsters=[];for(const f of Object.values(L.fields))if(f.k==='ice'||f.k==='fire'){f.until=G.t+1300;if(f.k==='fire'){f.spread=1e12;f.burn=1e12;}}});
  }
  const actions=[];for(const act of['forward','right','left','forward','back']){await page.evaluate(act=>Game.input(act),act);actions.push({act,frames:await frames(page,label+'-'+actions.length+'-'+act)});await page.waitForTimeout(330);}
  await page.waitForTimeout(600);await page.screenshot({path:path.join(out,label+'-after.png')});
  const final=await page.evaluate(()=>({player:{x:Game.player().x,y:Game.player().y,dir:Game.player().dir},origin:window.__lightingOrigin,fields:Object.fromEntries(Object.entries(Game.level().fields||{}).map(([k,f])=>[k,f.k])),wet:Game.wet(Game.player().x,Game.player().y),status:Game.state().status}));
  expect(final.status).toBe('playing');expect(final.player.dir).toBe(final.origin.dir);expect(Math.abs(final.player.x-final.origin.x)+Math.abs(final.player.y-final.origin.y)).toBe(1);
  if(kind==='cold'){expect(Object.values(final.fields)).not.toContain('ice');expect(final.wet).toBe(true);}
  if(kind==='fire'){expect(Object.values(final.fields)).not.toContain('fire');expect(Object.values(final.fields)).toContain('ash');}
  expect(errors).toEqual([]);records.push({width,kind,offline,stages,actions,final,errors,scope:'Native movement, casts, game updates and rendering. Nearby terrain/torch and level10 Mage resources supplied. Hazard lifetime shortened after creation to observe native expiry; no rules/dice/asset substitutions.'});
  await context.setOffline(false);await context.close();online=true;console.log(label+' passed'+(offline?' offline':''));
 }
 if(!offline&&process.env.LIGHTING_REGIONS!=='0')for(const width of[320,390]){
  const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:{width,height:844}}),page=await context.newPage(),errors=watchForErrors(page);
  await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});await startGame(page,{seed:'lighting-regions'});
  await page.evaluate(async()=>{Game.update=()=>{};window.__lightingRender=Renderer.render;window.__lightingState=(await import('/js/paintedworld.js')).paintedWorldState;for(const t of Assets.themes){void t.wall;void t.door;void t.torchFrames;for(let i=0;i<7;i++)t.floorOf(i);for(let i=0;i<4;i++)t.ceilOf(i);}});
  await page.waitForFunction(()=>Object.values(window.__lightingState()).every(s=>s==='ready'));await page.locator('#floor-card').evaluate(el=>el.style.display='none');
  for(let region=0;region<13;region++)for(const twist of[null,'dark','flooded','overgrown']){
   const label=width+'-region-'+region+'-'+(twist||'normal');
   const metrics=await page.evaluate(({region,twist})=>{
    const T=Dungeon.T,w=15,h=15,tiles=new Uint8Array(w*h).fill(T.FLOOR);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!x||!y||x===w-1||y===h-1||y===5)tiles[y*w+x]=T.WALL;tiles[5*w+7]=T.DOOR_OPEN;tiles[5*w+8]=twist==='dark'?T.WALL:T.TORCH;
    const L={...Game.level(),w,h,tiles,theme:region,roomId:new Int16Array(w*h),rooms:[{x:1,y:1,w:13,h:13,shape:'box'}],piece:null,pieces:[],caved:[],lights:twist==='dark'?[]:[{x:8,y:5}],dressing:[],remains:[],monsters:[],npcs:[],items:{},fields:twist==='flooded'?{'7,7':{k:'ice',until:1e12}}:{},explored:new Uint8Array(w*h).fill(1),seen:new Uint8Array(w*h).fill(1),locks:{},pools:[],twist,stairsUp:null,stairsDown:null};
    const now=10000,rs=Game.renderState(now),fx={...rs.fx,view:null,arriveAt:-1e9,doorShut:{},doorFire:{},stains:{},frost:[],vents:[],rocks:[]},cam={x:7.5,y:8.5,angle:-Math.PI/2+.12};Renderer.setCalm(true);Renderer.render=()=>window.__lightingRender(L,cam,[],fx,now);Renderer.render();return{cam,lightAtTorch:Renderer.lightOf(L,8,5),floorKinds:Renderer.looks.floors};
   },{region,twist});
   await page.locator('#view').screenshot({path:path.join(out,label+'.png')});records.push({width,region,twist,...metrics,file:label+'.png',scope:'Frozen geometry, time and Calm view; native painted loader and renderer. Supplied floor variants and ice patch; not generated-room or native-transition evidence.'});
  }
  expect(errors).toEqual([]);await context.close();
 }
 fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({version:JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,records},null,2)+'\n');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
