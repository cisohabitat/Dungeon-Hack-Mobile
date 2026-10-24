'use strict';
const {test,expect}=require('@playwright/test');
const {startGame,artReady,watchForErrors,faceOpenGround,placeMonster}=require('./helpers');

test('approved world, equipment and material exports load through their native callers @mobile',async({page})=>{
 test.setTimeout(120000);const errors=watchForErrors(page);await startGame(page,{seed:'painted-delivery'});
 await page.evaluate(()=>{Game.level().monsters=[];Game.update=()=>{};});
 await artReady(page,{shade:['windup','strike','recover','hurt','blink'],dog:['sit','windup','hurt'],wolf:['sit'],scrag:['sit'],sellsword:['sit'],mender:['sit','heal'],renegade:['sit']});
 // Class gear is prepared after the base Shade; WebKit can reach the base readiness first.
 await page.waitForFunction(()=>['mage','cleric','ranger','thief','druid','spellblade'].every(cls=>!!Assets.sprites.shade.elite?.['shade_'+cls]?.windup),null,{timeout:60000,polling:200});
 await page.evaluate(async()=>{const {PAINTED}=await import('/js/paintedcatalog.js'),{paintedHeld,paintedCarried,paintedImpact}=await import('/js/paintedworld.js'),{paintedCreature}=await import('/js/paintedcreatures.js');
 for(const key of Object.keys(PAINTED.static)){if(!Assets.sprites[key]?.url)throw Error('Unbound static '+key);}
 for(const m of Object.values(PAINTED.held))paintedHeld(m.id,m.pose,m.cls,m.two,false);
 for(const meta of Object.values(PAINTED.carried))paintedCarried(meta.id,meta.cls);
 for(const f of ['fire','frost'])paintedImpact(f,0);
 for(const cls of ['mage','cleric','ranger','thief','druid','spellblade']){const s=Assets.sprites.shade.elite['shade_'+cls];if(!s)throw Error('Missing shade '+cls);paintedCreature(s);}
 for(const key of ['dog','wolf','scrag','sellsword','mender','renegade']){paintedCreature(Assets.sprites[key]);paintedCreature(Assets.sprites[key].sit);}
 paintedCreature(Assets.sprites.mender.heal);
 });
 await expect.poll(()=>page.evaluate(async()=>{const {PAINTED}=await import('/js/paintedcatalog.js'),{paintedWorldState}=await import('/js/paintedworld.js');return Object.keys(PAINTED.static).every(k=>Assets.sprites[k].url===PAINTED.static[k])&&Object.values(paintedWorldState()).every(s=>s==='ready');}),{timeout:30000}).toBe(true);
 await expect.poll(()=>page.evaluate(async()=>{const {paintedCreature}=await import('/js/paintedcreatures.js');return ['mage','cleric','ranger','thief','druid','spellblade'].every(c=>{const s=Assets.sprites.shade.elite['shade_'+c];return paintedCreature(s)!==s;})&&['dog','wolf','scrag','sellsword','mender','renegade'].every(k=>paintedCreature(Assets.sprites[k].sit)!==Assets.sprites[k].sit)&&paintedCreature(Assets.sprites.mender.heal)!==Assets.sprites.mender.heal;})).toBe(true);
 const result=await page.evaluate(async()=>{const {PAINTED}=await import('/js/paintedcatalog.js'),{paintedHeld,paintedCarried}=await import('/js/paintedworld.js');return {statics:Object.keys(PAINTED.static).length,held:Object.values(PAINTED.held).every(m=>!!paintedHeld(m.id,m.pose,m.cls,m.two,false)),guards:[paintedHeld('longsword','rest','mage',false,false),paintedHeld('longsword','rest','fighter',false,true),paintedHeld('legend_longsword','rest','fighter',false,false),paintedCarried('runeshield','mage')].every(v=>v===null),surfaces:Assets.themes.every(t=>t.floorOf(0).length===8&&t.ceilOf(0).length===8&&t.floorOf(0)[7].every(v=>v===0xff000000)),url:Assets.sprites.dress_ripple.url};});
 expect(result.statics).toBeGreaterThan(70);expect(result.held&&result.guards&&result.surfaces).toBe(true);expect(result.url).toBe('img/world/dress_ripple.png');expect(errors).toEqual([]);
});

test('boss equipment and class shades follow live state without revealing concealed creatures @mobile',async({page})=>{
 const errors=watchForErrors(page);await startGame(page,{seed:'combat-clarity'});await faceOpenGround(page,3);await artReady(page,{shade:['windup'],warlord:['windup','strike'],heartforged:['windup'],mimic:['windup']});await page.evaluate(()=>{Game.update=()=>{};Game.level().monsters=[];});
 for(const id of ['heartforged','warlord','mimic','shade']){await page.evaluate(()=>Game.level().monsters=[]);await placeMonster(page,id,1,{hp:999,maxHp:999,awake:true,spoke:true,disguised:false});const rows=await page.evaluate(id=>{const m=Game.level().monsters[0],G=Game.state(),now=performance.now(),read=()=>Game.renderState(now).sprites.find(s=>s.maxHp===999);if(id==='heartforged')return [0,1,2].map(phase=>{m.phase=phase;return read().paintedKind;});if(id==='mimic'){m.disguise='barrel';const key=read().paintedKind;m.disguised=true;return[key,!read()];}if(id==='shade'){m.shade={cls:'mage'};return[!read().procedural,read().img===Assets.sprites.shade.elite.shade_mage];}m.phase=1;m.throne=true;const a=read().paintedKind;m.throne=false;m.windup={kind:'shot',at:G.t,until:G.t+1000};const b=read().paintedKind;m.windup=null;const interrupted=read().paintedKind;m.windup={kind:'shot',at:G.t,until:G.t+1000};read();m.windup=null;m.lungeAt=now;const release=read().paintedKind;m.phase=2;return[a,b,interrupted,release,read().paintedKind];},id);expect(rows).toEqual(id==='heartforged'?['','heartforged_open','heartforged_whitehot']:id==='mimic'?['mimic_barrel',true]:id==='shade'?[true,true]:['warlord_throne','warlord_spear','','warlord_spear','']);}
 expect(errors).toEqual([]);
});

test('a corrupt painted world image retains its own fallback while other pictures load @mobile',async({page})=>{
 await page.route('**/img/world/merchant.webp',r=>r.fulfill({status:200,contentType:'image/webp',body:'corrupt'}));
 await page.route('**/img/creatures/shade_mage.webp',r=>r.fulfill({status:200,contentType:'image/webp',body:'corrupt'}));
 await page.route('**/img/held/fighter-longsword-windup.png',r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));
 await startGame(page,{seed:'painted-fallback'});await artReady(page,{shade:['windup']});
 await page.waitForFunction(()=>Assets.sprites.shade.elite.shade_mage?.windup&&Assets.sprites.shade.elite.shade_thief?.windup);
 await page.evaluate(async()=>{const {paintedCreature}=await import('/js/paintedcreatures.js');void Assets.sprites.merchant.url;void Assets.sprites.pedlar.url;paintedCreature(Assets.sprites.shade.elite.shade_mage);paintedCreature(Assets.sprites.shade.elite.shade_thief);Assets.held('longsword','rest','fighter',false);});
 await expect.poll(()=>page.evaluate(()=>Assets.sprites.pedlar.url)).toBe('img/world/pedlar.webp');
 await expect.poll(()=>page.evaluate(async()=>{const {paintedCreature}=await import('/js/paintedcreatures.js');const s=Assets.sprites.shade.elite.shade_thief;return paintedCreature(s)!==s;})).toBe(true);
 await expect.poll(()=>page.evaluate(async()=>{const {paintedWorldState}=await import('/js/paintedworld.js');return paintedWorldState()['img/held/fighter-longsword-windup.png'];})).toBe('failed');
 const result=await page.evaluate(async()=>{const {paintedCreature}=await import('/js/paintedcreatures.js'),{paintedHeld}=await import('/js/paintedworld.js');const s=Assets.sprites.shade.elite.shade_mage;return{world:Assets.sprites.merchant.url.startsWith('data:image/'),class:paintedCreature(s)===s,wholeWeapon:paintedHeld('longsword','rest','fighter',false,false)===null,proceduralWeapon:!!Assets.held('longsword','rest','fighter',false)};});
 expect(result).toEqual({world:true,class:true,wholeWeapon:true,proceduralWeapon:true});
});

test('ordinary painted shields follow exact equipment pairs and survive a native offline reload @mobile',async({browser,browserName},testInfo)=>{
 let connected=true;const http=require('node:http'),{serve}=require('../server');
 const server=http.createServer((req,res)=>{if(!connected){req.socket.destroy();return;}serve(req,res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:testInfo.project.use.viewport,isMobile:true,hasTouch:true}),page=await context.newPage();
 try{
 const errors=watchForErrors(page);await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});await startGame(page,{seed:'painted-shields'});
 const pairs=[['fighter','shield'],['cleric','shield'],['thief','buckler']];
 for(const[cls,id]of pairs){await page.evaluate(({cls,id})=>{const p=Game.player(),item={t:id,q:1,e:0};p.cls=cls;p.inv.push(item);if(Game.canEquip(item))throw Error('Illegal test kit');Game.equip(item);},{cls,id});
  await expect.poll(()=>page.evaluate(()=>{const p=Game.player();return Assets.carried(p.eq.shield.t,p.cls)?.img.width;})).toBe(256);
  const key=await page.evaluate(()=>Game.renderState(performance.now()).fx.view.shield);expect(key).toBe(id);
 }
 const guards=await page.evaluate(async()=>{const{paintedCarried}=await import('/js/paintedworld.js');return [['fighter','buckler'],['thief','shield'],['mage','shield'],['fighter','legend_bastion'],['fighter','towershield']].every(([cls,id])=>paintedCarried(id,cls)===null);});expect(guards).toBe(true);
 await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await expect.poll(()=>page.evaluate(async()=>{for(const key of ['fighter-shield','cleric-shield','thief-buckler'])if(!await caches.match('./img/held/'+key+'.png'))return false;return true;}),{timeout:30000}).toBe(true);
 connected=false;if(browserName!=='webkit')await context.setOffline(true);await page.reload();await page.waitForFunction(()=>typeof Assets!=='undefined');
 for(const[cls,id]of pairs)await expect.poll(()=>page.evaluate(({cls,id})=>Assets.carried(id,cls)?.img.width,{cls,id})).toBe(256);
 connected=true;if(browserName!=='webkit')await context.setOffline(false);expect(errors).toEqual([]);
 }finally{await context.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
});

test('one corrupt ordinary shield retains its procedural fallback independently @mobile',async({page})=>{
 await page.route('**/img/held/fighter-shield.png',r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));
 await startGame(page,{seed:'painted-shield-fallback'});
 await page.evaluate(()=>{Assets.carried('shield','fighter');Assets.carried('shield','cleric');Assets.carried('buckler','thief');});
 await expect.poll(()=>page.evaluate(()=>Assets.carried('shield','cleric')?.img.width)).toBe(256);
 await expect.poll(()=>page.evaluate(()=>Assets.carried('buckler','thief')?.img.width)).toBe(256);
 await expect.poll(()=>page.evaluate(async()=>{const{paintedWorldState}=await import('/js/paintedworld.js');return paintedWorldState()['img/held/fighter-shield.png'];})).toBe('failed');
 expect(await page.evaluate(()=>Assets.carried('shield','fighter')?.img.width)).not.toBe(256);
 expect(await page.evaluate(()=>!!Assets.carried('shield','fighter')?.img)).toBe(true);
});
