const fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../..');
const {chromium}=require(root+'/node_modules/playwright');
const {serve}=require(root+'/test/server');
const {startGame,artReady,watchForErrors}=require(root+'/test/browser/helpers');
const snapshot=fs.readFileSync((process.env.KEEPER_BASELINE||root)+'/js/dungeon.js','utf8'),snapshotHash=require('crypto').createHash('sha256').update(snapshot).digest('hex');
const uiRoot=process.env.KEEPER_UI_BASELINE||root;const uiFiles=['bossart.js','overlay.js','motion.js'];const uiSnapshots=Object.fromEntries(uiFiles.map(f=>[f,fs.readFileSync(uiRoot+'/js/'+f,'utf8')]));
const out=process.env.KEEPER_OUT||path.join(__dirname,'native-reproduced');fs.mkdirSync(out,{recursive:true});
const cases=[{id:'lich',levels:8,route:'crypts'},{id:'warlord',levels:8,route:'warrens'},{id:'heartforged',levels:12,route:'crypts'}];
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const records=[];
try{for(const presentation of [{width:320},{width:740},{width:320,big:true}])for(const c of cases.filter(c=>!process.env.KEEPER_ONE||(c.id==='heartforged'&&presentation.width===320&&!presentation.big))){
 const {width,big=false}=presentation;const ctx=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:{width,height:width===740?360:667}}),page=await ctx.newPage(),errors=watchForErrors(page);
 await page.addInitScript(big=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off',...(big?{textSize:'4',calm:'1'}:{})}))localStorage.setItem('deepdelve.'+k,v);},big);
 await page.route('**/js/dungeon.js',r=>r.fulfill({contentType:'application/javascript',body:snapshot}));for(const f of uiFiles)await page.route('**/js/'+f,r=>r.fulfill({contentType:'application/javascript',body:uiSnapshots[f]}));
 await startGame(page,{seed:process.env.KEEPER_SEED||'aaa3-generated-rooms',levels:String(c.levels),name:'Keeper approach',buy:true});
 await page.evaluate(c=>{Game.setTesting({hp:true});Game.testFloor(c.levels,c.route);},c);
 const setup=await page.evaluate(()=>{const L=Game.level(),r=L.rooms.find(r=>r.shape==='sanctum'),p=Game.player(),entry={x:r.x-2,y:r.y+3,dir:1};if(L.tiles[entry.y*L.w+entry.x]!==Dungeon.T.FLOOR)throw Error('No legal approach pose');Object.assign(p,entry);for(const color of new Set(Object.values(L.locks)))p.inv.push({t:'key',color,q:10});Game.save(true);if(!Game.load())throw Error('Could not load approach');return{room:r,entry,monsters:L.monsters.map(m=>({uid:m.uid,id:m.id,x:m.x,y:m.y}))};});
 const frames=[];
 for(let n=0;n<9;n++){
  if(await page.locator('#ov-boss.open').count())await page.locator('#ov-boss .big[data-close]').click();
  await artReady(page);await page.waitForTimeout(200);if(await page.locator('#ov-boss.open').count()){await page.screenshot({path:path.join(out,`${c.id}-${width}${big?'-double-calm':''}-${n}-intro.png`)});await page.locator('#ov-boss .big[data-close]').click();await page.waitForTimeout(100);}
  const file=`${c.id}-${width}${big?'-double-calm':''}-${n}.png`;await page.screenshot({path:path.join(out,file)});
  const state=await page.evaluate(async()=>({bar:Game.renderState(performance.now()).fx.boss,faceState:(await import('/js/bossart.js')).bossFaceState?.(Game.renderState(performance.now()).fx.boss?.portrait),position:{x:Game.player().x,y:Game.player().y,dir:Game.player().dir},status:Game.state().status,shown:Renderer.shown,monsters:Game.level().monsters.map(m=>({uid:m.uid,id:m.id,x:m.x,y:m.y,awake:m.awake})),log:Game.state().log.slice(-4).map(l=>l.m)}));frames.push({file,...state});
  if(n<8){await page.evaluate(()=>Game.input('forward'));await page.waitForTimeout(350);}
 }
 let offline=null;if(process.env.KEEPER_OFFLINE){await page.evaluate(async()=>{Game.save(true);await navigator.serviceWorker.register('/sw.js');});await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});await ctx.setOffline(true);await page.reload();await page.click('#btn-continue');await page.waitForFunction(async()=> (await import('/js/bossart.js')).bossFaceState('heartforged')==='ready');await page.screenshot({path:path.join(out,'heartforged-offline.png')});offline=await page.evaluate(()=>({status:Game.state().status,bar:Game.renderState(performance.now()).fx.boss,source:'Installed cache after actual offline reload; supplied initial pose/HP/keys.'}));}
 if(errors.length)throw Error(errors.join('\n'));records.push({...c,width,big,snapshotHash,setup,frames,offline,presentationHashes:Object.fromEntries(['bossart.js','overlay.js','motion.js','game.js'].map(f=>[f,require('crypto').createHash('sha256').update(fs.readFileSync(uiRoot+'/js/'+f)).digest('hex')])),scope:'Generated final floor, supplied legal pose two squares before hall, testing HP and supplied matching door keys, native forward inputs and running updates; shipped assets; not unassisted play or physical-device evidence.'});await ctx.close();fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(records,null,2)+'\n');console.log(c.id,width,'captured');
}}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});
