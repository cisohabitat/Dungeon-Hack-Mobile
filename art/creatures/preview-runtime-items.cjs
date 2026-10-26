'use strict';
// Native shipped item selection, floor palettes and Pack images; no source substitutions.
// Frozen fixture states; actions, independent failure and offline verified separately.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const{chromium}=require('playwright'),{serve}=require('../../test/server'),{startGame,faceOpenGround,watchForErrors}=require('../../test/browser/helpers');
const folder='batch-ac-ah-runtime/items',out=path.join(__dirname,folder),shots=path.join(out,'dungeon');fs.mkdirSync(shots,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'generation-batch-af-items.json')));
const live=Object.keys(manifest.cells).filter(k=>k!=='amulet_tooth'&&k!=='key');
const far=new Set(Object.values(manifest.sheets).map(s=>s.keys.find(k=>live.includes(k))));
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const audits=[],captures=[];
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const origin=`http://127.0.0.1:${server.address().port}`;
for(const width of[390,320]){const context=await browser.newContext({baseURL:origin,viewport:{width,height:width===390?844:667},serviceWorkers:'block'}),page=await context.newPage(),errors=watchForErrors(page);await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off',calm:'1'}))localStorage.setItem('deepdelve.'+k,v);});await startGame(page,{seed:'af-small-item-review'});if(await faceOpenGround(page,3)<3)throw Error('No clear floor corridor');await page.locator('#floor-card').evaluate(e=>e.style.display='none');
const initial=await page.evaluate(async({manifest,folder})=>{
 Game.update=()=>{};Game.recordRuns(false);const L=Game.level();L.monsters=[];L.npcs=[];L.dressing=[];L.remains=[];L.items={};L.fields=[];L.snares=[];L.puzzle=null;
 const{ITEMS,KEY_COLORS}=await import('/js/data.js'),{Dice,Odds}=await import('/js/rng.js'),frames={},render=Renderer.render,looksBefore=JSON.stringify(Game.state().looks),oldKnown={...Game.state().known},lookChecks=[];
 for(const[t,b]of Object.entries(ITEMS))if(Game.state().looks[t]){const item={t,q:1,e:0};Game.state().known[t]=false;const a=Game.spriteFor(item);Game.state().known[t]=true;const z=Game.spriteFor(item);if(['potion','ring','amulet'].includes(b.kind)&&a!==z)throw Error('Identification changed seeded shape '+t);if(t==='amulet_tooth'&&(a==='amulet_tooth'||z==='amulet_tooth'))throw Error('Tooth reserve revealed');lookChecks.push({t,unknown:a,known:z});}Game.state().known=oldKnown;if(JSON.stringify(Game.state().looks)!==looksBefore)throw Error('Native look table changed');
 for(const key of Object.keys(manifest.cells)){if(['key','amulet_tooth'].includes(key))continue;frames[key]=Assets.sprites[key];void frames[key].url;}
 const {paintedWorldState}=await import('/js/paintedworld.js');
 await new Promise((resolve,reject)=>{const until=performance.now()+30000;const poll=()=>{const states=Object.values(paintedWorldState());if(states.every(s=>s==='ready'))resolve();else if(states.includes('failed')||performance.now()>until)reject(Error('Native item decode failed'));else setTimeout(poll,20);};poll();});
 window.__af={frames,render,manifest,ITEMS};window.__afItem=key=>{
  const c=manifest.cells[key],G=Game.state();let it;
  if(c.named){it={t:c.item_t,u:c.relic,e:1,q:1};G.known[it.t]=true;}
  else if(key.startsWith('key_'))it={t:'key',color:key.slice(4),q:1,e:0};
  else{let t=Object.keys(ITEMS).find(t=>ITEMS[t].sprite===key);if(!t)t=key.startsWith('ring_')?'ring_protect':key.startsWith('amulet_')?'amulet_life':null;if(!t)throw Error('No legal item for '+key);it={t,q:1,e:0};if(G.looks[t])G.looks[t]={...G.looks[t],sprite:key,adj:key.replace(/^[^_]+_/,'').replaceAll('_',' ')};G.known[t]=false;}
  if(Game.spriteFor(it)!==key)throw Error('Actual sprite route mismatch '+key+' '+Game.spriteFor(it));return it;
 };
 window.__afFloor=(key,distance)=>{
  const it=window.__afItem(key),L=Game.level(),p=Game.player(),D=Dungeon.DIRS[p.dir],x=p.x+D[0]*distance,y=p.y+D[1]*distance;L.items={[`${x},${y}`]:[it]};const before=JSON.stringify(Game.state()),dice=[Dice.s,Odds.s],now=10000,rs=Game.renderState(now),s=rs.sprites.find(s=>s.img===Assets.sprites[key]),expected=it.t==='artifact'?.4:it.u?.38:.32;
  if(!s||s.scale!==expected||!s.onFloor)throw Error('Native floor mapping/scale '+key);const native={scale:s.scale,onFloor:s.onFloor,yOff:s.yOff,glint:s.glint,treasure:s.treasure};if(s.img!==frames[key])throw Error('Native source mismatch');rs.fx={...rs.fx,view:null,arriveAt:-1e9};let draws=0;const ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage;ctx.drawImage=function(im,...a){if(frames[key].levels.includes(im))draws++;return draw.call(this,im,...a);};try{render(rs.level,rs.cam,rs.sprites,rs.fx,now);}finally{ctx.drawImage=draw;}if(!draws)throw Error('Source floor image not drawn '+key+' '+distance);if(JSON.stringify(Game.state())!==before||Dice.s!==dice[0]||Odds.s!==dice[1])throw Error('Source floor draw changed game/dice');Renderer.render=()=>render(rs.level,rs.cam,rs.sprites,rs.fx,now);return{key,distance,...native,source_draws:draws,state_unchanged:true,dice_unchanged:true};
 };
 return{lookChecks,unchanged_seed_looks:true,reserves:['amulet_tooth','key'],source_frames:Object.keys(frames).length};
},{manifest,folder});const floorChecks=[],packChecks=[];
for(const[keyIndex,key]of live.entries()){
 for(const distance of[1,3]){const metrics=await page.evaluate(({key,distance})=>window.__afFloor(key,distance),{key,distance});floorChecks.push(metrics);if(distance===1||far.has(key)){const file=`${width}-${key}-floor-${distance}.png`;await page.screenshot({path:path.join(shots,file)});captures.push({width,key,mode:'floor',distance,file});}}
 await page.evaluate(key=>{Game.level().items={};Game.player().inv=[window.__afItem(key)];},key);await page.click('[data-open="inv"]');await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#ov-inv')).opacity)>=.999);await page.locator('#inv-grid button.slot.filled').first().click();await page.locator('#item-detail-title').waitFor({state:'visible'});
 const metrics=await page.evaluate(async({key,folder})=>{
  const it=Game.player().inv[0],before=JSON.stringify(it),title=document.querySelector('#item-detail-title').textContent,name=Game.itemName(it),actions=[...document.querySelectorAll('#item-detail .buttons button')].map(b=>b.textContent),slot=document.querySelector('#inv-grid button.slot.filled img'),picture=document.querySelector('#item-detail .item-showcase img');if(title!==name||slot.getAttribute('src')!==Assets.sprites[key].url)throw Error('Native Pack name/slot binding '+key);
  const detailURL=picture?.getAttribute('src'),smallDetail=detailURL===Assets.sprites[key].url;await slot.decode();if(picture){await picture.decode();await Promise.all(picture.getAnimations().map(animation=>animation.finished));}
  if(JSON.stringify(it)!==before||document.querySelector('#item-detail-title').textContent!==title||JSON.stringify([...document.querySelectorAll('#item-detail .buttons button')].map(b=>b.textContent))!==JSON.stringify(actions))throw Error('Pack semantics changed');if(picture&&!smallDetail&&picture.getAttribute('src')!==detailURL)throw Error('Approved large portrait changed');return{key,title,actions,native_small_detail:smallDetail,approved_large_portrait_preserved:!smallDetail,unchanged_item_record:true};
 },{key,folder});packChecks.push(metrics);const file=`${width}-${key}-pack.png`;await page.screenshot({path:path.join(shots,file)});captures.push({width,key,mode:'pack',file});await page.locator('#ov-inv [data-close]').click();await page.waitForFunction(()=>!document.querySelector('#ov-inv').classList.contains('open')&&!document.querySelector('#ov-inv').classList.contains('closing'));
 if(keyIndex%10===9)console.log('AF',width,keyIndex+1,'of',live.length,'native-key floor/Pack source fixtures');
}
if(errors.length)throw Error(errors.join('\n'));audits.push({width,...initial,floorChecks,packChecks,console_errors:[]});await context.close();console.log('AF width complete',width,live.length,'live keys');}
fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify({scope:'Native shipped sprite, palette, floor and Pack bindings; no Assets/floor-frame/DOM picture substitutions. Frozen scene fixtures and explicit per-key seeded-look overrides, separately audited native identification routing. Large portraits preserved. Failure/offline/performance verified separately.',audits,captures,console_errors:[]},null,2)+'\n');
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
