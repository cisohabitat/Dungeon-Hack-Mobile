'use strict';
// Install the current game, save, disconnect, reload and use doors/gates through
// native commands. No intercepted assets or manually injected cache responses.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),root=path.resolve(__dirname,'../../..');
const {chromium}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server');
const {startGame,faceOpenGround,artReady,expect}=require(root+'/test/browser/helpers');
const out=path.join(__dirname,'offline');fs.mkdirSync(out,{recursive:true});
(async()=>{let online=true,rejected=0;const server=http.createServer((req,res)=>{if(!online){rejected++;req.socket.destroy();return;}serve(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),records=[];
try{for(const width of[320,390]){
 online=true;const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});
 await startGame(page,{seed:'door-continuity',name:'Offline door review'});await page.evaluate(()=>{Game.level().monsters=[];Game.save(true);});await artReady(page);
 await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));await expect(page.locator('#offline-status')).toHaveAttribute('data-core','true',{timeout:120000});await expect(page.locator('#offline-status')).toHaveAttribute('data-voice','ready',{timeout:120000});
 online=false;await context.setOffline(true);await page.reload();await page.click('#btn-continue');await expect(page.locator('#screen-game')).toBeVisible();await faceOpenGround(page,2);await page.waitForFunction(()=>!Renderer.arriving);
 const cases=[];
 for(const cell of[false,true]){
  await page.evaluate(async cell=>{const G=Game.state();G.levels[G.depth]={...Game.level(),monsters:[],npcs:[],dressing:[],items:{},fields:{},traps:{},puzzle:null,piece:null,doorBlows:{},locks:{}};const L=Game.level(),p=Game.player(),[dx,dy]=Dungeon.DIRS[p.dir],x=p.x+dx,y=p.y+dy,key=x+','+y;L.tiles[y*L.w+x]=Dungeon.T.DOOR_LOCKED;L.tiles[(y+dx)*L.w+x-dy]=Dungeon.T.WALL;L.tiles[(y-dx)*L.w+x+dy]=Dungeon.T.WALL;if(cell){L.piece={kind:'cells',room:0};L.rooms[0]={x:1,y:1,w:L.w-2,h:L.h-2,shape:'box'};L.roomId.fill(0);}L.locks[key]='silver';L.doorBlows[key]=2;p.inv.push({t:'key',color:'silver',q:1,e:0});window.__offlineDoor={x,y,key};void Assets.themes[L.theme].door;void Assets.themes[L.theme].cellDoor;window.__offlineState=(await import('/js/paintedworld.js')).paintedWorldState;const m=(await import('/js/paintedcatalog.js')).PAINTED.themes[L.theme];window.__offlineUrls=[m.door,m.cellDoor];},cell);
  await page.waitForFunction(()=>window.__offlineUrls.every(p=>window.__offlineState()[p]==='ready'));
  const result=await page.evaluate(()=>{Game.input('use');const L=Game.level(),q=window.__offlineDoor,rs=Game.renderState(performance.now());Renderer.render(rs.level,rs.cam,rs.sprites,rs.fx,performance.now());return{lock:rs.fx.doorShut[q.y*L.w+q.x].lock,tile:L.tiles[q.y*L.w+q.x],blows:L.doorBlows[q.key],columns:Renderer.doorColumns};});
  expect(result.lock).toBe('silver');expect(result.tile).toBe(3);expect(result.blows).toBe(2);expect(result.columns).toBeGreaterThan(0);await page.screenshot({path:path.join(out,`${width}-${cell?'gate':'door'}-opening.png`)});
  await page.waitForFunction(()=>!Game.renderState(performance.now()).fx.doorShut);await page.evaluate(()=>Game.input('use'));await page.waitForFunction(()=>!Game.renderState(performance.now()).fx.doorShut);await page.screenshot({path:path.join(out,`${width}-${cell?'gate':'door'}-closed.png`)});cases.push({cell,...result});
 }
 expect(errors).toEqual([]);records.push({width,cases,offlineReload:true,version:await page.evaluate(async()=> (await import('/js/release.js')).VERSION_ID),errors,rejectedOriginRequests:rejected});await context.setOffline(false);await context.close();console.log(width+' offline doors/gates passed');
}fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(records,null,2)+'\n');}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
