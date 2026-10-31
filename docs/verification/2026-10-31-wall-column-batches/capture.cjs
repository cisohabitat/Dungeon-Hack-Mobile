const fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../..');
const {chromium}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server');
const {startGame,artReady,watchForErrors}=require(root+'/test/browser/helpers');
const out=process.env.AAA3_OUT||path.join(__dirname,'native');fs.mkdirSync(out,{recursive:true});
const cases=[{i:0,n:8,d:1},{i:1,n:8,d:2},{i:2,n:8,d:3},{i:3,n:16,d:4},{i:4,n:6,d:5},{i:5,n:8,d:8,road:'crypts'},{i:6,n:8,d:4,road:'crypts'},{i:7,n:8,d:4,road:'warrens'},{i:8,n:12,d:10},{i:9,n:16,d:11},{i:10,n:16,d:5},{i:11,n:12,d:7},{i:12,n:12,d:8},{i:5,n:8,d:8,road:'warrens',key:'05-warlord'},{i:5,n:12,d:12,road:'crypts',key:'05-heartforged'}];
async function settle(page){
 if(await page.locator('#ov-boss.open').count())await page.locator('#ov-boss .big[data-close]').click();
 await artReady(page);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const records=[];
try{for(const c of cases.filter(c=>(!process.env.AAA3_THEMES||process.env.AAA3_THEMES.split(',').map(Number).includes(c.i))&&(!process.env.AAA3_KEYS||process.env.AAA3_KEYS.split(',').includes(c.key||String(c.i))))){
 const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:{width:Number(process.env.AAA3_WIDTH||390),height:process.env.AAA3_WIDTH==='740'?360:process.env.AAA3_WIDTH==='320'?667:844}}),page=await context.newPage(),errors=watchForErrors(page);
 await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});
 await startGame(page,{seed:'aaa3-generated-rooms',levels:String(c.n),name:'Staging review',buy:true});
 await page.evaluate(c=>{Game.setTesting({hp:true});if(c.d!==1)Game.testFloor(c.d,c.road);},c);
 await page.waitForFunction(i=>Game.level().theme===i,c.i);
 await page.evaluate(async()=>{const t=Assets.themes[Game.level().theme];for(const k of ['wall','door','stairsUp','stairsDown','stairArch','cellDoor','decor','torchFrames'])void t[k];for(let i=0;i<7;i++)t.floorOf(i);for(let i=0;i<4;i++)t.ceilOf(i);window.__aaa3Paint=(await import('/js/paintedworld.js')).paintedWorldState;});
 await page.waitForFunction(()=>Object.values(window.__aaa3Paint()).every(s=>s==='ready'||s==='failed'),null,{timeout:45000});await settle(page);
 for(const stage of ['landmark','treasure']){
  const placement=stage==='entrance'?null:await page.evaluate(stage=>{
   const L=Game.level(),T=Dungeon.T,room=L.piece&&L.rooms[L.piece.room];let target;
   if(stage==='landmark')target=L.monsters.find(m=>MONSTERS[m.id].boss)||(L.region==='forge'&&L.dressing.find(d=>d.k==='rubble'&&!d.fell))||L.piece?.props?.[0]||L.npcs.find(n=>room&&n.x>=room.x&&n.y>=room.y&&n.x<room.x+room.w&&n.y<room.y+room.h)||(room&&{x:Math.floor(room.x+room.w/2),y:Math.floor(room.y+room.h/2)});
   else {const entries=Object.entries(L.items);const e=entries.find(([,v])=>v.some(it=>it.t==='artifact'||it.u))||entries.find(([,v])=>v.some(it=>it.t==='gold'||it.t==='gem'))||entries[0];if(e){const[x,y]=e[0].split(',').map(Number);target={x,y,items:e[1].map(it=>it.t)};}}
   if(!target)return null;
   const floor=(x,y)=>x>=0&&y>=0&&x<L.w&&y<L.h&&[T.FLOOR,T.DOOR_OPEN].includes(L.tiles[y*L.w+x]);
   const candidates=[];
   for(let dir=0;dir<4;dir++)for(const dist of[3,2,1,4]){const[dx,dy]=Dungeon.DIRS[dir],x=target.x-dx*dist,y=target.y-dy*dist;if(!floor(x,y)||L.monsters.some(m=>m.x===x&&m.y===y)||L.npcs.some(n=>n.x===x&&n.y===y))continue;let clear=true;for(let k=1;k<dist;k++)if(!floor(x+dx*k,y+dy*k))clear=false;if(clear)candidates.push({x,y,dir,dist});}
   const at=candidates[0];if(!at)return{target,unreachable:true};const p=Game.player();Object.assign(p,{x:at.x,y:at.y,dir:at.dir});Game.save(true);if(!Game.load())throw Error('Audit pose could not load');return{target,...at};
  },stage);
  await settle(page);await page.waitForTimeout(400);
  const file=`${c.key||String(c.i).padStart(2,'0')}-${stage}.png`;await page.screenshot({path:path.join(out,file)});
  const state=await page.evaluate(()=>({theme:THEMES[Game.level().theme].name,depth:Game.state().depth,twist:Game.level().twist,piece:Game.level().piece,rooms:Game.level().rooms,position:{x:Game.player().x,y:Game.player().y,dir:Game.player().dir},monsters:Game.level().monsters.map(m=>({id:m.id,x:m.x,y:m.y})),dressing:Game.level().dressing,shown:Renderer.shown,paintFailures:Object.entries(window.__aaa3Paint()).filter(([,s])=>s==='failed')}));
  const actions=[];
  if(stage==='landmark'&&process.env.AAA3_ACTIONS==='1'){
   const planned=['right','left'];
   const canWalk=await page.evaluate(()=>{const p=Game.player(),L=Game.level(),[dx,dy]=Dungeon.DIRS[p.dir],x=p.x+dx,y=p.y+dy,k=x+','+y;return L.tiles[y*L.w+x]===Dungeon.T.FLOOR&&!L.monsters.some(m=>m.x===x&&m.y===y)&&!L.npcs.some(n=>n.x===x&&n.y===y)&&!L.items[k]&&!L.traps[k]&&!L.fields?.[k]&&!L.dressing.some(d=>d.x===x&&d.y===y&&['barrel','crate','oilcask'].includes(d.k));});
   if(canWalk)planned.push('forward','back');
   for(const act of planned){
    const before=await page.evaluate(()=>({x:Game.player().x,y:Game.player().y,dir:Game.player().dir}));
    await page.evaluate(act=>Game.input(act),act);await page.waitForTimeout(500);await settle(page);
    const frames=await page.evaluate(async()=>{const rows=[];for(let i=0;i<8;i++){await new Promise(r=>requestAnimationFrame(r));rows.push({cam:Game.renderState(performance.now()).cam,position:{x:Game.player().x,y:Game.player().y,dir:Game.player().dir},status:Game.state().status});}return rows;});
    if(frames.some(f=>f.status!=='playing'))throw Error('Native staging action ended the run');
    const name=`${c.key||String(c.i).padStart(2,'0')}-${act}-native.png`;await page.screenshot({path:path.join(out,name)});actions.push({act,file:name,before,changed:frames.some(f=>f.position.x!==before.x||f.position.y!==before.y||f.position.dir!==before.dir),frames});
   }
  }
  records.push({...c,stage,file,placement,actions,sourceHashes:Object.fromEntries(['renderer.js','motion.js','dungeon.js','regionalprops.js','paintedworld.js','release.js'].map(f=>[f,require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'js',f))).digest('hex')])),...state,scope:stage==='entrance'?'Native generated entrance; safety testing HP, running updates, shipped assets.':'Native generated geometry/population with supplied legal inspection pose via save/load; running updates/shipped assets; not unassisted exploration.'});
 }
 if(errors.length)throw Error(errors.join('\n'));await context.close();fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(records,null,2)+'\n');console.log(c.i+' '+records.at(-1).theme+' captured');
}}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});
