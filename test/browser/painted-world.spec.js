'use strict';
const {test,expect}=require('@playwright/test');
const {startGame,artReady,watchForErrors,faceOpenGround,placeMonster}=require('./helpers');
const {startOfflineServer}=require('../offline-server.cjs');

test('approved world, equipment and material exports load through their native callers @mobile',async({page})=>{
 test.setTimeout(120000);const errors=watchForErrors(page);await startGame(page,{seed:'painted-delivery'});
 await page.evaluate(()=>{Game.level().monsters=[];Game.update=()=>{};});
 await artReady(page,{shade:['windup','strike','recover','hurt','blink'],dog:['sit','windup','hurt'],wolf:['sit'],scrag:['sit'],sellsword:['sit'],mender:['sit','heal'],renegade:['sit']});
 // Class gear is prepared after the base Shade; WebKit can reach the base readiness first.
 await page.waitForFunction(()=>['mage','cleric','ranger','thief','druid','spellblade'].every(cls=>!!Assets.sprites.shade.elite?.['shade_'+cls]?.windup),null,{timeout:60000,polling:200});
 await page.evaluate(async()=>{const {PAINTED}=await import('/js/paintedcatalog.js'),{paintedHeld,paintedCarried,paintedImpact}=await import('/js/paintedworld.js'),{paintedCreature}=await import('/js/paintedcreatures.js');
 for(const key of Object.keys(PAINTED.static)){if(!Assets.sprites[key]?.url)throw Error('Unbound static '+key);}
 for(const m of Object.values(PAINTED.held))paintedHeld(m.id,m.pose,m.cls,m.two,!!m.lit);
 for(const meta of Object.values(PAINTED.carried))paintedCarried(meta.id,meta.cls);
 for(const f of ['fire','frost'])paintedImpact(f,0);
 for(const cls of ['mage','cleric','ranger','thief','druid','spellblade']){const s=Assets.sprites.shade.elite['shade_'+cls];if(!s)throw Error('Missing shade '+cls);paintedCreature(s);}
 for(const key of ['dog','wolf','scrag','sellsword','mender','renegade']){paintedCreature(Assets.sprites[key]);paintedCreature(Assets.sprites[key].sit);}
 paintedCreature(Assets.sprites.mender.heal);
 });
 await expect.poll(()=>page.evaluate(async()=>{const {PAINTED}=await import('/js/paintedcatalog.js'),{paintedWorldState}=await import('/js/paintedworld.js');return Object.keys(PAINTED.static).every(k=>(/^(mythic|legend|relic)_/.test(k)?Assets.sprites[k].url.startsWith('data:image/'):Assets.sprites[k].url===PAINTED.static[k]))&&Object.values(paintedWorldState()).every(s=>s==='ready');}),{timeout:30000}).toBe(true);
 await expect.poll(()=>page.evaluate(async()=>{const {paintedCreature}=await import('/js/paintedcreatures.js');return ['mage','cleric','ranger','thief','druid','spellblade'].every(c=>{const s=Assets.sprites.shade.elite['shade_'+c];return paintedCreature(s)!==s;})&&['dog','wolf','scrag','sellsword','mender','renegade'].every(k=>paintedCreature(Assets.sprites[k].sit)!==Assets.sprites[k].sit)&&paintedCreature(Assets.sprites.mender.heal)!==Assets.sprites.mender.heal;})).toBe(true);
 const result=await page.evaluate(async()=>{const {PAINTED}=await import('/js/paintedcatalog.js'),{paintedHeld,paintedCarried}=await import('/js/paintedworld.js');return {statics:Object.keys(PAINTED.static).length,held:Object.values(PAINTED.held).every(m=>!!paintedHeld(m.id,m.pose,m.cls,m.two,!!m.lit)),guards:[paintedHeld('longsword','rest','mage',false,false),paintedHeld('longsword','rest','fighter',false,true),paintedHeld('legend_longsword','rest','fighter',false,false),paintedCarried('runeshield','mage')].every(v=>v===null),surfaces:Assets.themes.every(t=>t.floorOf(0).length===8&&t.ceilOf(0).length===8&&t.floorOf(0)[7].every(v=>v===0xff000000)),url:Assets.sprites.dress_ripple.url};});
 expect(result.statics).toBeGreaterThan(70);expect(result.held&&result.guards&&result.surfaces).toBe(true);expect(result.url).toBe('img/world/dress_ripple.png');expect(errors).toEqual([]);
});

test('boss equipment and class shades follow live state without revealing concealed creatures @mobile',async({page})=>{
 const errors=watchForErrors(page);await startGame(page,{seed:'combat-clarity'});await faceOpenGround(page,3);await artReady(page,{shade:['windup'],warlord:['windup','strike'],heartforged:['windup'],mimic:['windup']});await page.waitForFunction(()=>!!Assets.sprites.shade.elite?.shade_mage?.windup&&!!Assets.sprites.shade.elite?.shade_mage?.blink);await page.evaluate(()=>{Game.update=()=>{};Game.level().monsters=[];});
 for(const id of ['heartforged','warlord','mimic','shade']){await page.evaluate(()=>Game.level().monsters=[]);await placeMonster(page,id,1,{hp:999,maxHp:999,awake:true,spoke:true,disguised:false});const rows=await page.evaluate(id=>{const m=Game.level().monsters[0],G=Game.state(),now=performance.now(),read=(at=now)=>Game.renderState(at).sprites.find(s=>s.maxHp===999);if(id==='heartforged')return [0,1,2].map(phase=>{m.phase=phase;return read().paintedKind;});if(id==='mimic'){m.disguise='barrel';const key=read().paintedKind;m.disguised=true;return[key,!read()];}if(id==='shade'){m.shade={cls:'mage'};const art=Assets.sprites.shade.elite.shade_mage,period=3200+(m.uid%5)*450,cycle=Math.ceil((now+m.uid*977)/period)*period-m.uid*977,idle=read(cycle+200),blink=read(cycle+64);return[!idle.procedural,idle.img===art,!blink.procedural,blink.img===art.blink];}m.phase=1;m.throne=true;const a=read().paintedKind;m.throne=false;m.windup={kind:'shot',at:G.t,until:G.t+1000};const b=read().paintedKind;m.windup=null;const interrupted=read().paintedKind;m.windup={kind:'shot',at:G.t,until:G.t+1000};read();m.windup=null;m.lungeAt=now;const release=read().paintedKind,recovery=read(now+200).paintedKind,expired=read(now+300).paintedKind;m.phase=2;return[a,b,interrupted,release,recovery,expired,read().paintedKind];},id);expect(rows).toEqual(id==='heartforged'?['','heartforged_open','heartforged_whitehot']:id==='mimic'?['mimic_barrel',true]:id==='shade'?[true,true,true,true]:['warlord_throne','warlord_spear','','warlord_spear','warlord_spear','','']);}
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
 // Keep full-cache HTTP serving outside the worker recording this trace.
 const server=await startOfflineServer();let context,stage='create context';
 const failures=[],stages=[];
 const step=async(name,action)=>{stage=name;stages.push({name,at:Date.now()});return test.step(name,action);};
 try{
 context=await browser.newContext({baseURL:server.url,viewport:testInfo.project.use.viewport,isMobile:true,hasTouch:true});const page=await context.newPage();
 page.on('requestfailed',request=>failures.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText}));
 const errors=watchForErrors(page);await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});await startGame(page,{seed:'painted-shields'});
 const pairs=[['fighter','shield'],['cleric','shield'],['thief','buckler']];
 for(const[cls,id]of pairs){await page.evaluate(({cls,id})=>{const p=Game.player(),item={t:id,q:1,e:0};p.cls=cls;p.inv.push(item);if(Game.canEquip(item))throw Error('Illegal test kit');Game.equip(item);},{cls,id});
  await expect.poll(()=>page.evaluate(()=>{const p=Game.player();return Assets.carried(p.eq.shield.t,p.cls)?.img.width;})).toBe(256);
  const key=await page.evaluate(()=>Game.renderState(performance.now()).fx.view.shield);expect(key).toBe(id);
 }
 const guards=await page.evaluate(async()=>{const{paintedCarried}=await import('/js/paintedworld.js');return [['mage','shield'],['mage','buckler'],['thief','towershield'],['fighter','holy_symbol'],['cleric','spellbook']].every(([cls,id])=>paintedCarried(id,cls)===null);});expect(guards).toBe(true);
 await step('install and claim native worker',async()=>{await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));await page.waitForFunction(()=>!!navigator.serviceWorker.controller);});
 await expect.poll(()=>page.evaluate(async()=>{for(const key of ['fighter-shield','cleric-shield','thief-buckler'])if(!await caches.match('./img/held/'+key+'.png'))return false;return true;}),{timeout:30000}).toBe(true);
 await step('disconnect actual origin',async()=>{await server.setConnected(false);if(browserName!=='webkit')await context.setOffline(true);});
 await step('native offline reload',()=>page.reload());
 await step('offline module bootstrap',()=>page.waitForFunction(()=>typeof Assets!=='undefined'));
 for(const[cls,id]of pairs)await expect.poll(()=>page.evaluate(({cls,id})=>Assets.carried(id,cls)?.img.width,{cls,id})).toBe(256);
 await server.setConnected(true);if(browserName!=='webkit')await context.setOffline(false);expect(errors).toEqual([]);
 }finally{
  try{await testInfo.attach('shield-offline-stages',{body:JSON.stringify({browser:browserName,version:browser.version(),stage,stages,failures,server:await server.stats()},null,2),contentType:'application/json'});}
  finally{try{await context?.close();}finally{await server.close();}}
 }
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

test('painted starter and wider weapons retain exact grips and survive native offline reload @mobile',async({browser,browserName},testInfo)=>{
 test.setTimeout(120000);let connected=true;const http=require('node:http'),{serve}=require('../server');
 const server=http.createServer((req,res)=>{if(!connected){req.socket.destroy();return;}serve(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:testInfo.project.use.viewport,isMobile:true,hasTouch:true}),page=await context.newPage();
 try{const errors=watchForErrors(page);await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});await startGame(page,{seed:'painted-held-delivery'});
 const pairs=[['cleric','mace'],['thief','shortsword'],['ranger','shortbow'],['druid','spear'],['thief','dagger'],['fighter','battleaxe'],['cleric','hammer'],['fighter','greatsword'],['fighter','hammer'],['fighter','flail'],['cleric','flail'],['mage','dagger'],['fighter','dagger'],['ranger','dagger'],['druid','dagger'],['spellblade','dagger'],['fighter','club'],['cleric','club'],['thief','club'],['druid','club'],['fighter','mace'],['fighter','shortsword'],['ranger','shortsword'],['spellblade','shortsword'],['thief','longsword'],['ranger','longsword'],['spellblade','longsword'],['fighter','staff'],['cleric','staff'],['druid','staff'],['fighter','spear'],['ranger','spear']];
 for(const[cls,id]of pairs){await page.evaluate(({cls,id})=>{const p=Game.player(),it={t:id,q:1,e:0};p.cls=cls;p.inv.push(it);if(Game.canEquip(it))throw Error('Illegal test weapon');Game.equip(it);},{cls,id});
  await expect.poll(()=>page.evaluate(()=>{const p=Game.player(),v=Game.renderState(performance.now()).fx.view;return v.weapon===p.eq.weapon.t&&Assets.held(v.weapon,'rest',v.cls,v.drawn?false:v.two,v.cls==='spellblade'&&v.shield==='wayfarer_lantern')?.img.width;})).toBe(256);
 }
 const guards=await page.evaluate(async()=>{const{paintedHeld}=await import('/js/paintedworld.js');return [['dagger','rest','cleric',false,false],['dagger','rest','fighter',false,true],['dagger','rest','spellblade',true,true],['dagger','left','spellblade',false,true],['dagger','left','thief',false,false],['hammer','rest','cleric',false,true],['dwarfhammer','rest','thief',false,false],['battleaxe','rest','fighter',true,false],['greatsword','rest','fighter',false,true],['spear','drive','druid',true,false],['spear','channel','druid',false,false],['shortbow','rest','mage',false,false],['mythic_horizon','rest','ranger',false,false]].every(a=>paintedHeld(...a)===null);});expect(guards).toBe(true);
 await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await expect.poll(()=>page.evaluate(async()=>{const{PAINTED}=await import('/js/paintedcatalog.js');return(await Promise.all(Object.values(PAINTED.held).map(m=>caches.match('./'+m.path)))).every(Boolean);}),{timeout:30000}).toBe(true);
 connected=false;if(browserName!=='webkit')await context.setOffline(true);await page.reload();await page.waitForFunction(()=>typeof Assets!=='undefined');
 for(const[cls,id]of pairs)await expect.poll(()=>page.evaluate(async({cls,id})=>{const{PAINTED}=await import('/js/paintedcatalog.js');return Object.values(PAINTED.held).filter(m=>m.cls===cls&&m.id===id).every(m=>Assets.held(m.id,m.pose,m.cls,m.two,!!m.lit)?.img.width===256);},{cls,id})).toBe(true);
 connected=true;if(browserName!=='webkit')await context.setOffline(false);expect(errors).toEqual([]);
 }finally{await context.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
});

test('a corrupt wider weapon keeps its whole family procedural without disabling starter art @mobile',async({page})=>{
 await page.route('**/img/held/fighter-greatsword-windup.png',r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));await startGame(page,{seed:'painted-held-fallback'});
 await page.evaluate(()=>{Assets.held('greatsword','rest','fighter',true);Assets.held('spear','drive','druid',false);Assets.held('hammer','rest','cleric',false);});
 await expect.poll(()=>page.evaluate(()=>Assets.held('spear','drive','druid',false)?.img.width)).toBe(256);
 await expect.poll(()=>page.evaluate(()=>Assets.held('hammer','rest','cleric',false)?.img.width)).toBe(256);
 await expect.poll(()=>page.evaluate(async()=>{const{paintedWorldState}=await import('/js/paintedworld.js');return paintedWorldState()['img/held/fighter-greatsword-windup.png'];})).toBe('failed');
 expect(await page.evaluate(async()=>{const{PAINTED}=await import('/js/paintedcatalog.js'),{paintedHeld}=await import('/js/paintedworld.js');return Object.values(PAINTED.held).filter(m=>m.id==='greatsword').every(m=>paintedHeld(m.id,m.pose,m.cls,m.two,!!m.lit)===null&&!!Assets.held(m.id,m.pose,m.cls,m.two,!!m.lit)?.img);})).toBe(true);
});

for(const [cls,id,otherCls,otherId,suffix='']of [['fighter','flail','cleric','flail'],['ranger','dagger','fighter','dagger'],['spellblade','dagger','mage','dagger','-reflected'],['fighter','club','cleric','club'],['ranger','shortsword','fighter','shortsword'],['spellblade','longsword','thief','longsword','-reflected']])test(`a corrupt ${cls} ${id} keeps its family procedural independently @mobile`,async({page})=>{
 await page.route(`**/img/held/${cls}-${id}-windup${suffix}.png`,r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));await startGame(page,{seed:'painted-melee-fallback'});
 await page.evaluate(({cls,id,otherCls,otherId})=>{Assets.held(id,'rest',cls,false);Assets.held(otherId,'rest',otherCls,false);},{cls,id,otherCls,otherId});
 await expect.poll(()=>page.evaluate(({otherCls,otherId})=>Assets.held(otherId,'rest',otherCls,false)?.img.width,{otherCls,otherId})).toBe(256);
 await expect.poll(()=>page.evaluate(async({cls,id,suffix})=>{const{paintedWorldState}=await import('/js/paintedworld.js');return paintedWorldState()[`img/held/${cls}-${id}-windup${suffix}.png`];},{cls,id,suffix})).toBe('failed');
 expect(await page.evaluate(async({cls,id})=>{const{PAINTED}=await import('/js/paintedcatalog.js'),{paintedHeld}=await import('/js/paintedworld.js');const family=Object.values(PAINTED.held).filter(m=>m.id===id&&m.cls===cls);return family.length===(cls==='spellblade'?18:9)&&family.every(m=>paintedHeld(m.id,m.pose,m.cls,m.two,!!m.lit)===null&&!!Assets.held(m.id,m.pose,m.cls,m.two,!!m.lit)?.img);},{cls,id})).toBe(true);
});

test('activated melee paintings fit every pose and lit state without changing the run @mobile',async({page})=>{
 test.setTimeout(120000);const errors=watchForErrors(page);await startGame(page,{seed:'painted-melee-fit'});
 await page.evaluate(async()=>{const{PAINTED}=await import('/js/paintedcatalog.js');const pairs=new Set(['fighter|hammer','fighter|flail','cleric|flail','mage|dagger','fighter|dagger','ranger|dagger','druid|dagger','spellblade|dagger','fighter|club','cleric|club','thief|club','druid|club','fighter|mace','fighter|shortsword','ranger|shortsword','spellblade|shortsword','thief|longsword','ranger|longsword','spellblade|longsword','fighter|staff','cleric|staff','druid|staff','fighter|spear','ranger|spear']);window.__meleeFit=Object.entries(PAINTED.held).filter(([,m])=>pairs.has(m.cls+'|'+m.id));for(const[,m]of window.__meleeFit)Assets.held(m.id,m.pose,m.cls,m.two,m.lit);});
 await expect.poll(()=>page.evaluate(()=>window.__meleeFit.every(([,m])=>Assets.held(m.id,m.pose,m.cls,m.two,m.lit)?.img.width===256))).toBe(true);
 const result=await page.evaluate(async()=>{const{Dice,Odds}=await import('/js/rng.js');const ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage,update=Game.update,height=Renderer.H,calm=Renderer.calm;let current=null,seen=false,checked=0;// Prepare interpolated render state before measuring the renderer's state neutrality.
 const rs=Game.renderState(10000),before=JSON.stringify(Game.state()),dice=[Dice.s,Odds.s],bad=[],poses=['rest','drawback','windup','strike','cut','sweep','through','recover','return'],times=[0,.08,.16,.24,.32,.42,.52,.68,.84];
 try{Game.update=()=>{};Renderer.setCalm(false);ctx.drawImage=function(img,x,y,w,h,...args){if(current&&img===current.fr.img){seen=true;const b=current.fr.at,box=[x+b.min[0]*w/256,y+b.min[1]*h/256,x+b.max[0]*w/256,y+b.max[1]*h/256];if(box[0]<1||box[1]<1||box[2]>Renderer.W-1||box[3]>Renderer.H-1)bad.push({key:current.key,height:Renderer.H,box});}return draw.call(this,img,x,y,w,h,...args);};
 for(const h of [160,360,464]){Renderer.setHeight(h);for(const[key,m]of window.__meleeFit){current={key,fr:Assets.held(m.id,m.pose,m.cls,m.two,m.lit)};seen=false;const fx={...rs.fx,swingAt:m.pose==='rest'||m.pose==='channel'?-1e9:10000-(m.pose==='drive'?.42:times[poses.indexOf(m.pose)])*800,swingMs:800,offAt:-1e9,castAt:m.pose==='channel'?9740:-1e9,readAt:m.id==='staff'&&!m.two&&m.pose==='rest'?9800:-1e9,readKind:'map',readColor:'#8af',useAt:-1e9,throwAt:-1e9,bashAt:-1e9,arriveAt:-1e9,damageUntil:0,view:{weapon:m.id,cls:m.cls,two:m.id==='staff'||m.two,drawn:false,shield:m.lit?'wayfarer_lantern':null,offhand:null,lantern:false,walk:0,steps:0}};Renderer.render(rs.level,rs.cam,rs.sprites,fx,10000);if(!seen)throw Error('Expected painted native binding '+key);checked++;}}
 return{bad,checked,state:JSON.stringify(Game.state())===before,dice:Dice.s===dice[0]&&Odds.s===dice[1]};
 }finally{ctx.drawImage=draw;Game.update=update;Renderer.setHeight(height);Renderer.setCalm(calm);}
 });expect(result).toEqual({bad:[],checked:642,state:true,dice:true});expect(errors).toEqual([]);
});


test('a corrupt released-hand staff frame retains the whole class family independently @mobile',async({page})=>{
 await page.route('**/img/held/cleric-staff-channel-one.png',r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));await startGame(page,{seed:'staff-family-fallback'});
 await page.evaluate(()=>{Assets.held('staff','rest','cleric',true);Assets.held('staff','rest','druid',true);});
 await expect.poll(()=>page.evaluate(()=>Assets.held('staff','channel','druid',false)?.img.width)).toBe(256);
 await expect.poll(()=>page.evaluate(async()=>{const{paintedWorldState}=await import('/js/paintedworld.js');return paintedWorldState()['img/held/cleric-staff-channel-one.png'];})).toBe('failed');
 expect(await page.evaluate(async()=>{const{PAINTED}=await import('/js/paintedcatalog.js'),{paintedHeld}=await import('/js/paintedworld.js');const family=Object.values(PAINTED.held).filter(m=>m.id==='staff'&&m.cls==='cleric');return family.length===4&&family.every(m=>paintedHeld(m.id,m.pose,m.cls,m.two,m.lit)===null&&!!Assets.held(m.id,m.pose,m.cls,m.two,m.lit)?.img);})).toBe(true);
});

test('painted staff tips survive delivery and casting glints respect Calm @mobile',async({page})=>{
 const errors=watchForErrors(page);await startGame(page,{seed:'painted-staff-tips'});
 await page.evaluate(()=>{for(const cls of ['fighter','cleric','druid'])Assets.held('staff','channel',cls,false);});
 await expect.poll(()=>page.evaluate(()=>['fighter','cleric','druid'].every(cls=>Assets.held('staff','channel',cls,false)?.img.width===256))).toBe(true);
 const result=await page.evaluate(async()=>{const{PAINTED}=await import('/js/paintedcatalog.js'),ctx=document.querySelector('#view').getContext('2d'),old={draw:ctx.drawImage,begin:ctx.beginPath,move:ctx.moveTo,line:ctx.lineTo,stroke:ctx.stroke},calm=Renderer.calm,rs=Game.renderState(10000);let current,path=[],tip=null,glint=null;const checks=[];
 try{ctx.drawImage=function(img,x,y,w,h,...args){if(img===current.img)tip=[x+current.at.tip[0]*w/256,y+current.at.tip[1]*h/256];return old.draw.call(this,img,x,y,w,h,...args);};ctx.beginPath=function(){path=[];return old.begin.call(this);};ctx.moveTo=function(x,y){path.push([x,y]);return old.move.call(this,x,y);};ctx.lineTo=function(x,y){path.push([x,y]);return old.line.call(this,x,y);};ctx.stroke=function(){if(this.strokeStyle==='#9bcef1'&&path.length===4)glint=path.slice();return old.stroke.call(this);};
 for(const cls of ['fighter','cleric','druid'])for(const quiet of [false,true]){current=Assets.held('staff','channel',cls,false);const meta=Object.values(PAINTED.held).find(m=>m.id==='staff'&&m.cls===cls&&m.pose==='channel');if(JSON.stringify(current.at.tip)!==JSON.stringify(meta.tip))throw Error('Staff tip metadata lost');tip=glint=null;Renderer.setCalm(quiet);Renderer.render(rs.level,rs.cam,rs.sprites,{...rs.fx,swingAt:-1e9,offAt:-1e9,castAt:9740,readAt:-1e9,useAt:-1e9,throwAt:-1e9,bashAt:-1e9,arriveAt:-1e9,view:{weapon:'staff',cls,two:true,drawn:false,shield:null,offhand:null,lantern:false,walk:0,steps:0}},10000);checks.push(!!tip&&(quiet?!glint:!!glint&&Math.hypot((glint[0][0]+glint[1][0])/2-tip[0],(glint[2][1]+glint[3][1])/2-tip[1])<=1));}
 return checks;}finally{ctx.drawImage=old.draw;ctx.beginPath=old.begin;ctx.moveTo=old.move;ctx.lineTo=old.line;ctx.stroke=old.stroke;Renderer.setCalm(calm);}});expect(result).toEqual([true,true,true,true,true,true]);expect(errors).toEqual([]);
});

// New exact class/identity families must fail independently, including both greatsword hands.
for(const [cls,id,file,count,otherCls,otherId]of [
 ['fighter','sling','fighter-sling-loosed',2,'cleric','sling'],
 ['thief','throwknife','thief-throwknife-rest',1,'mage','throwknife'],
 ['fighter','shortbow','fighter-shortbow-bowfull',3,'thief','shortbow'],
 ['fighter','handxbow','fighter-handxbow-rest',1,'ranger','handxbow'],
 ['spellblade','scimitar','spellblade-scimitar-windup-lit',18,'fighter','scimitar'],
 ['fighter','greatsword','fighter-greatsword-rest-released',18,'fighter','longsword'],
 ['cleric','relic_penitent','cleric-relic_penitent-cut',9,'cleric','flail'],
])test(`a corrupt new ${cls} ${id} preserves independent family fallback @mobile`,async({page})=>{
 await page.route(`**/img/held/${file}.png`,r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));
 await startGame(page,{seed:'new-held-family-fallback'});
 await page.evaluate(async({cls,id,otherCls,otherId})=>{const{PAINTED}=await import('/js/paintedcatalog.js');for(const m of Object.values(PAINTED.held))if(m.cls===cls&&m.id===id||m.cls===otherCls&&m.id===otherId)Assets.held(m.id,m.pose,m.cls,m.two,m.lit);},{cls,id,otherCls,otherId});
 await expect.poll(()=>page.evaluate(({otherCls,otherId})=>Assets.held(otherId,'rest',otherCls,false,false)?.img.width,{otherCls,otherId}),{timeout:30000}).toBe(256);
 await expect.poll(()=>page.evaluate(async({cls,id,count})=>{const{PAINTED}=await import('/js/paintedcatalog.js'),{paintedHeld}=await import('/js/paintedworld.js');const f=Object.values(PAINTED.held).filter(m=>m.cls===cls&&m.id===id);return f.length===count&&f.every(m=>paintedHeld(m.id,m.pose,m.cls,m.two,m.lit)===null&&!!Assets.held(m.id,m.pose,m.cls,m.two,m.lit)?.img);},{cls,id,count})).toBe(true);
});

test('new ranged, rare, named and released-hand bindings fit exact poses without changing run or dice @mobile',async({page})=>{
 test.setTimeout(120000);const errors=watchForErrors(page);await startGame(page,{seed:'new-held-fit'});
 const count=await page.evaluate(async()=>{const{PAINTED}=await import('/js/paintedcatalog.js');const ids=new Set(['sling','throwknife','handxbow','scimitar','dwarfhammer','greatsword','relic_penitent']);window.__newHeldFit=Object.entries(PAINTED.held).filter(([,m])=>ids.has(m.id)||m.id==='shortbow'&&m.cls!=='ranger'||m.id==='longbow'&&m.cls==='fighter');for(const[,m]of window.__newHeldFit)Assets.held(m.id,m.pose,m.cls,m.two,m.lit);return window.__newHeldFit.length;});expect(count).toBe(125);
 await expect.poll(()=>page.evaluate(()=>window.__newHeldFit.every(([,m])=>Assets.held(m.id,m.pose,m.cls,m.two,m.lit)?.img.width===256)),{timeout:30000}).toBe(true);
 const result=await page.evaluate(async()=>{const{Dice,Odds}=await import('/js/rng.js');Game.recordRuns(false);const update=Game.update,height=Renderer.H,calm=Renderer.calm,ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage;Game.update=()=>{};const rs=Game.renderState(10000),before=JSON.stringify(Game.state()),dice=[Dice.s,Odds.s],bad=[];let current=null,seen=false,checked=0;
 try{Renderer.setCalm(false);ctx.drawImage=function(img,x,y,w,h,...a){if(current&&img===current.fr.img){seen=true;const b=current.fr.at,box=[x+b.min[0]*w/256,y+b.min[1]*h/256,x+b.max[0]*w/256,y+b.max[1]*h/256];if(box[0]<1||box[1]<1||box[2]>Renderer.W-1||box[3]>Renderer.H-1)bad.push({key:current.key,height:Renderer.H,box});}return draw.call(this,img,x,y,w,h,...a);};
 const times={rest:undefined,drawback:.08,windup:.16,strike:.24,cut:.32,sweep:.42,through:.52,recover:.68,return:.84,bowdraw:.3,bowfull:.5,loosed:.8};
 for(const h of [160,360,464]){Renderer.setHeight(h);for(const[key,m]of window.__newHeldFit){current={key,fr:Assets.held(m.id,m.pose,m.cls,m.two,m.lit)};seen=false;const u=times[m.pose],released=m.id==='greatsword'&&!m.two,bow=m.id==='shortbow'||m.id==='longbow';const fx={...rs.fx,swingAt:u===undefined?-1e9:10000-u*800,swingMs:800,offAt:-1e9,castAt:-1e9,readAt:released?9700:-1e9,readKind:'map',readColor:'#8af',useAt:-1e9,throwAt:-1e9,bashAt:-1e9,arriveAt:-1e9,damageUntil:0,view:{weapon:m.id,cls:m.cls,two:bow||m.id==='greatsword',drawn:bow,shield:m.lit?'wayfarer_lantern':null,offhand:null,lantern:false,walk:0,steps:0}};Renderer.render(rs.level,rs.cam,rs.sprites,fx,10000);if(!seen)throw Error('Exact new binding not drawn '+key);checked++;}}
 return{bad,checked,state:JSON.stringify(Game.state())===before,dice:Dice.s===dice[0]&&Odds.s===dice[1]};
 }finally{ctx.drawImage=draw;Game.update=update;Renderer.setHeight(height);Renderer.setCalm(calm);}
 });expect(result).toEqual({bad:[],checked:375,state:true,dice:true});expect(errors).toEqual([]);
});

test('native greatsword read and drink overlaps release one hand and restore both @mobile',async({page})=>{
 test.setTimeout(120000);const errors=watchForErrors(page);await startGame(page,{seed:'native-greatsword-hand-release',cls:'fighter'});
 await page.evaluate(()=>{const p=Game.player(),L=Game.level();L.monsters=[];L.npcs=[];p.hp=p.maxHp=999;const it={t:'greatsword',q:1,e:0};p.inv.push(it);if(Game.canEquip(it)||!Game.equip(it))throw Error('Cannot equip native greatsword');});await faceOpenGround(page,3);
 await expect.poll(()=>page.evaluate(()=>Assets.held('greatsword','rest','fighter',true,false)?.img.width),{timeout:30000}).toBe(256);
 await page.evaluate(async()=>{const{PAINTED}=await import('/js/paintedcatalog.js'),map=new Map();for(const[key,m]of Object.entries(PAINTED.held))if(m.cls==='fighter'&&m.id==='greatsword')map.set(Assets.held(m.id,m.pose,m.cls,m.two,m.lit).img,key);window.__greatNative=[];const ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage;ctx.drawImage=function(img,...a){if(map.has(img))window.__greatNative.push({at:performance.now(),key:map.get(img)});return draw.call(this,img,...a);};});
 for(const t of ['scroll_map','potion_heal']){
  await placeMonster(page,'orc',1,{hp:9999,maxHp:9999,nextAct:1e12,awake:true,spoke:true});
  const born=await page.evaluate(async t=>{const p=Game.player(),G=Game.state();p.nextAttack=0;G.blowGate=0;p.hp=700;window.__greatNative=[];Game.input('attack');const fx=Game.renderState(performance.now()).fx;if(fx.swingAt<0)throw Error('Native attack did not start');await new Promise(r=>setTimeout(r,fx.swingMs*.12));const it={t,q:1,e:0};p.inv.push(it);Game.useItem(it);if(p.inv.includes(it))throw Error('Native consumable was not used');return Game.renderState(performance.now()).fx[t==='scroll_map'?'readAt':'useAt'];},t);
  await expect.poll(()=>page.evaluate(b=>window.__greatNative.some(f=>f.at>=b&&f.key.endsWith('-released')&&!f.key.endsWith('-rest-released')),born),{timeout:5000}).toBe(true);
  await expect.poll(()=>page.evaluate(b=>window.__greatNative.some(f=>f.at>b+1100&&f.key==='fighter-greatsword-rest'),born),{timeout:5000}).toBe(true);
 }
 expect(errors).toEqual([]);
});


// All named surfaces use the delivered loader; fixture rendering does not replace
// the independent real equip/action/offline evidence in batch-ab-runtime.
test('all named equipment states fit exact runtime routes without changing run or dice @mobile',async({page})=>{
 test.setTimeout(120000);const errors=watchForErrors(page);await startGame(page,{seed:'named-runtime-fit'});await faceOpenGround(page,3);
 const {setup,cases}=require('./named-equipment.cjs');await setup(page);
 const result=await page.evaluate(async cases=>{const{Dice,Odds}=await import('/js/rng.js'),before=JSON.stringify(Game.state()),dice=[Dice.s,Odds.s],height=Renderer.H,calm=Renderer.calm;let checked=0;try{for(const h of[160,360,464]){Renderer.setHeight(h);for(const c of cases){window.__abDraw(c);checked++;}}}finally{Renderer.setHeight(height);Renderer.setCalm(calm);}return{checked,state:JSON.stringify(Game.state())===before,dice:Dice.s===dice[0]&&Odds.s===dice[1]};},cases);
 expect(result).toEqual({checked:2373,state:true,dice:true});expect(errors).toEqual([]);
});
for(const[cls,id,file,count,otherCls,otherId]of[
 ['spellblade','relic_grimtooth','spellblade-relic_grimtooth-windup-lit',18,'fighter','relic_grimtooth'],
 ['fighter','relic_whisper','fighter-relic_whisper-thrust',11,'thief','relic_whisper'],
 ['mage','legend_heartroot','mage-legend_heartroot-drive-one',5,'cleric','legend_heartroot'],
 ['ranger','mythic_horizon','ranger-mythic_horizon-bowfull',3,'ranger','longbow'],
])test(`a corrupt named ${cls} ${id} preserves its complete family fallback @mobile`,async({page})=>{
 await page.route(`**/img/held/${file}.png`,r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));await startGame(page,{seed:'named-family-fallback'});
 await page.evaluate(async({cls,id,otherCls,otherId})=>{const{PAINTED}=await import('/js/paintedcatalog.js');for(const m of Object.values(PAINTED.held))if(m.cls===cls&&m.id===id||m.cls===otherCls&&m.id===otherId)Assets.held(m.id,m.pose,m.cls,m.two,m.lit);},{cls,id,otherCls,otherId});
 await expect.poll(()=>page.evaluate(({otherCls,otherId})=>Assets.held(otherId,'rest',otherCls,false,false)?.img.width,{otherCls,otherId}),{timeout:30000}).toBe(256);
 expect(await page.evaluate(async({cls,id,count})=>{const{PAINTED}=await import('/js/paintedcatalog.js'),{paintedHeld}=await import('/js/paintedworld.js');const f=Object.values(PAINTED.held).filter(m=>m.cls===cls&&m.id===id);return f.length===count&&f.every(m=>paintedHeld(m.id,m.pose,m.cls,m.two,m.lit)===null&&!!Assets.held(m.id,m.pose,m.cls,m.two,m.lit));},{cls,id,count})).toBe(true);
});
for(const[cls,id,file,otherCls]of[['fighter','relic_kests_bulwark','fighter-relic_kests_bulwark-carried','cleric'],['mage','mythic_bloodstar','mage-mythic_bloodstar-carried','cleric']])test(`a corrupt named carried ${id} preserves exact independent fallback @mobile`,async({page})=>{
 await page.route(`**/img/held/${file}.png`,r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));await startGame(page,{seed:'named-carried-fallback'});
 await page.evaluate(({cls,id,otherCls})=>{Assets.carried(id,cls);Assets.carried('runeshield',otherCls);},{cls,id,otherCls});
 await expect.poll(()=>page.evaluate(otherCls=>Assets.carried('runeshield',otherCls)?.img.width,otherCls),{timeout:30000}).toBe(256);
 expect(await page.evaluate(async({cls,id})=>{const{paintedCarried}=await import('/js/paintedworld.js');return paintedCarried(id,cls)===null&&!!Assets.carried(id,cls)?.img;},{cls,id})).toBe(true);
});

test('named Fighter offhands equip and animate their own blades @mobile',async({page})=>{
 test.setTimeout(120000);const errors=watchForErrors(page);await startGame(page,{seed:'named-offhand-native',cls:'fighter'});await faceOpenGround(page,3);
 for(const[relic,t,id]of[['grimtooth','dagger','relic_grimtooth'],['whisper','shortsword','relic_whisper'],['last_word','dagger','legend_last_word']]){
  await page.evaluate(({relic,t,id})=>{const p=Game.player();Game.level().monsters=[];p.hp=p.maxHp=999;Game.unequip('weapon');Game.unequip('offhand');const sword={t:'longsword',q:1,e:0},it={t,u:relic,q:1,e:1};p.inv.push(sword,it);if(!Game.equip(sword)||Game.offhandReason(it)||!Game.equip(it,false,'offhand')||Game.spriteFor(p.eq.offhand)!==id)throw Error('Legal named offhand did not equip');Assets.held(id,'left','fighter',false,false);},{relic,t,id});
  await expect.poll(()=>page.evaluate(id=>Assets.held(id,'left','fighter',false,false)?.img.width,id),{timeout:30000}).toBe(256);
  await page.evaluate(id=>{window.__namedOffSeen=[];const ctx=document.querySelector('#view').getContext('2d');window.__namedOffDraw=ctx.drawImage;const thrust=Assets.held(id,'thrust','fighter',false,false).img;ctx.drawImage=function(img,...args){if(img===thrust)window.__namedOffSeen.push(performance.now());return window.__namedOffDraw.call(this,img,...args);};},id);
  await placeMonster(page,'orc',1,{hp:9999,maxHp:9999,nextAct:1e12,awake:true,spoke:true});await page.evaluate(()=>{Game.player().nextAttack=0;Game.state().blowGate=0;Game.input('attack');});await expect.poll(()=>page.evaluate(()=>window.__namedOffSeen.length)).toBeGreaterThan(0);
  await page.evaluate(()=>{document.querySelector('#view').getContext('2d').drawImage=window.__namedOffDraw;});
 }
 expect(errors).toEqual([]);
});
for(const[cls,relic]of[['fighter','ninth_circle'],['mage','heartroot']])test(`named ${relic} read and drink overlaps use the released drive and restore both hands @mobile`,async({page})=>{
 test.setTimeout(120000);const errors=watchForErrors(page);await startGame(page,{seed:'named-staff-release',cls});await faceOpenGround(page,3);
 const id=await page.evaluate(relic=>{const p=Game.player(),it={t:'staff',u:relic,q:1,e:1};p.hp=p.maxHp=999;p.inv.push(it);if(Game.canEquip(it)||!Game.equip(it))throw Error('Native named staff equip failed');const id=Game.spriteFor(it);Assets.held(id,'rest',p.cls,true,false);return id;},relic);
 await expect.poll(()=>page.evaluate(({id,cls})=>Assets.held(id,'rest',cls,true,false)?.img.width,{id,cls}),{timeout:30000}).toBe(256);
 await page.evaluate(async({id,cls})=>{const{PAINTED}=await import('/js/paintedcatalog.js');window.__namedStaffFrames=Object.entries(PAINTED.held).filter(([,m])=>m.id===id&&m.cls===cls);for(const[,m]of window.__namedStaffFrames)Assets.held(id,m.pose,cls,m.two,m.lit);},{id,cls});
 // Each pose decodes independently; do not retain a procedural drive frame
 // while the completed rest frame is already painted.
 await expect.poll(()=>page.evaluate(({id,cls})=>window.__namedStaffFrames.every(([,m])=>Assets.held(id,m.pose,cls,m.two,m.lit)?.img.width===256),{id,cls}),{timeout:30000}).toBe(true);
 await page.evaluate(({id,cls})=>{const map=new Map();for(const[key,m]of window.__namedStaffFrames)map.set(Assets.held(id,m.pose,cls,m.two,m.lit).img,key);const ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage;window.__namedStaff=[];ctx.drawImage=function(img,...args){if(map.has(img))window.__namedStaff.push({at:performance.now(),key:map.get(img)});return draw.call(this,img,...args);};},{id,cls});
 // This measures a short native animation, so unrelated raster work must be
 // finished first. A fresh frame also refreshes the game's presentation clock.
 await placeMonster(page,'orc',1,{hp:9999,maxHp:9999,nextAct:1e12,awake:true,spoke:true});
 await artReady(page);
 for(const [i,t] of ['scroll_map','potion_heal'].entries()){
  if(i)await placeMonster(page,'orc',1,{hp:9999,maxHp:9999,nextAct:1e12,awake:true,spoke:true});
  const born=await page.evaluate(t=>new Promise((resolve,reject)=>requestAnimationFrame(()=>{try{const p=Game.player(),G=Game.state();p.nextAttack=0;G.blowGate=0;p.hp=700;window.__namedStaff=[];Game.input('attack');const fx=Game.renderState(performance.now()).fx;if(fx.swingAt<0)throw Error('No native staff attack');if(performance.now()>=fx.swingAt+fx.swingMs)throw Error('Native staff attack ended before overlap');const it={t,q:1,e:0};p.inv.push(it);Game.useItem(it);if(p.inv.includes(it))throw Error('Native consumable did not run');resolve(Game.renderState(performance.now()).fx[t==='scroll_map'?'readAt':'useAt']);}catch(error){reject(error);}})),t);
  await expect.poll(()=>page.evaluate(born=>window.__namedStaff.some(f=>f.at>=born&&f.key.endsWith('-drive-one')),born),{timeout:5000}).toBe(true);
  await expect.poll(()=>page.evaluate(born=>window.__namedStaff.some(f=>f.at>born+1100&&f.key.endsWith('-rest-two')),born),{timeout:5000}).toBe(true);
 }
 expect(errors).toEqual([]);
});

test('pending carried gear and all empty-hand families use exact native bindings @mobile',async({page})=>{
 const errors=watchForErrors(page);await startGame(page,{seed:'all-painted-kits'});
 const pairs=[['mage','spellbook'],['mage','crystal_orb'],['mage','orb_storms'],['cleric','holy_symbol'],['cleric','silver_symbol'],['cleric','reliquary'],['spellblade','wayfarer_lantern'],['fighter','buckler'],['cleric','buckler'],['druid','buckler'],['fighter','towershield'],['cleric','towershield'],['fighter','quillshield'],['cleric','quillshield']];
 for(const[cls,id]of pairs){
  await page.evaluate(({cls,id})=>{const p=Game.player();p.cls=cls;p.eq.weapon=null;p.eq.shield=null;const item={t:id,q:1,e:0};p.inv.push(item);if(Game.canEquip(item))throw Error('Illegal kit '+cls+'/'+id);Game.equip(item);},{cls,id});
  await expect.poll(()=>page.evaluate(()=>{const p=Game.player(),id=Game.renderState(performance.now()).fx.view.shield;return {id,width:Assets.carried(id,p.cls)?.img.width};})).toEqual({id,width:256});
 }
 await page.evaluate(async()=>{const{paintedHeld}=await import('/js/paintedworld.js');for(const cls of ['fighter','cleric','mage','thief','ranger','druid','spellblade','bear'])for(const pose of ['fist','punch','cast'])paintedHeld(null,pose,cls,false,false);});
 await expect.poll(()=>page.evaluate(async()=>{const{paintedHeld}=await import('/js/paintedworld.js');return ['fighter','cleric','mage','thief','ranger','druid','spellblade','bear'].every(cls=>['fist','punch','cast'].every(pose=>paintedHeld(null,pose,cls,false,false)?.img.width===256));})).toBe(true);
 expect(await page.evaluate(async()=>{const{paintedHeld,paintedCarried}=await import('/js/paintedworld.js');return !paintedHeld('null','fist','mage',false,false)&&!paintedHeld(undefined,'fist','mage',false,false)&&!paintedHeld(null,'rest','mage',false,false)&&!paintedHeld(null,'fist','mage',true,false)&&!paintedHeld(null,'cast','mage',false,true)&&!paintedCarried(undefined,'mage')&&!paintedCarried('buckler','mage');})).toBe(true);expect(errors).toEqual([]);
});

test('regional painted composition retains exact native arch masks, gate edges, locks and fixed torch brackets @mobile',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>window.Assets?.themes.length);
 const before=await page.evaluate(async()=>{
  const{Dice,Odds}=await import('/js/rng.js');window.__regionDice=[Dice.s,Odds.s];
  const pixels=(c,x=0,y=0,w=64,h=64)=>Array.from(c.getContext('2d').getImageData(x,y,w,h).data);
  window.__regionPixels=pixels;
  window.__regionBefore=Assets.themes.map(t=>({arch:pixels(t.stairArch).filter((_,i)=>i%4===3),gate:pixels(t.cellDoor),locks:Object.fromEntries(Object.keys(t.locked).map(k=>[k,pixels(t.locked[k],38,27,14,16)])),cells:Object.fromEntries(Object.keys(t.locked).map(k=>[k,pixels(t.cellLocked(k),40,26,12,12)]))}));
  for(const t of Assets.themes){void t.torchFrames;void t.decor;for(let i=0;i<7;i++)t.floorOf(i);for(let i=0;i<4;i++)t.ceilOf(i);}
  window.__regionState=(await import('/js/paintedworld.js')).paintedWorldState;return Assets.themes.length;
 });expect(before).toBe(13);
 await page.waitForFunction(()=>Object.entries(window.__regionState()).filter(([u])=>u.includes('/materials/')).every(([,s])=>s==='ready'));
 const checks=await page.evaluate(async()=>{
  const{Dice,Odds}=await import('/js/rng.js');const p=window.__regionPixels;
  return {dice:[Dice.s,Odds.s],before:window.__regionDice,regions:Assets.themes.map((t,n)=>{
   const old=window.__regionBefore[n],arch=p(t.stairArch).filter((_,i)=>i%4===3),gate=p(t.cellDoor),frames=t.torchFrames.map(c=>p(c,0,30,64,34));
   return {arch:JSON.stringify(arch)===JSON.stringify(old.arch),edges:gate.every((v,i)=>{const x=Math.floor(i/4)%64,y=Math.floor(i/256);return x>=8&&x<56&&y>=4||v===old.gate[i];}),locks:Object.keys(t.locked).every(k=>JSON.stringify(p(t.locked[k],38,27,14,16))===JSON.stringify(old.locks[k])&&JSON.stringify(p(t.cellLocked(k),40,26,12,12))===JSON.stringify(old.cells[k])),torch:frames.every(f=>JSON.stringify(f)===JSON.stringify(frames[0])),decor:t.decor===t.decor,opaque:t.floorOf(4).every(a=>a.every(v=>v>>>24===255))};
  })};
 });expect(checks.dice).toEqual(checks.before);for(const r of checks.regions)expect(Object.values(r).every(Boolean),JSON.stringify(r)).toBe(true);
});

test('new art failures remain independent across hands, items and regional surfaces @mobile',async({page})=>{
 for(const url of ['img/held/fighter-empty-punch.png','img/world/dagger.png','img/materials/region_7-floor6.png'])await page.route('**/'+url,r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));
 await startGame(page,{seed:'new-painting-failures'});
 await page.evaluate(()=>{Assets.held(null,'fist','fighter',false);Assets.held(null,'fist','mage',false);void Assets.sprites.dagger.url;void Assets.sprites.shortsword.url;Assets.themes[7].floorOf(6);Assets.themes[8].floorOf(6);});
 await expect.poll(()=>page.evaluate(async()=>{const{paintedWorldState}=await import('/js/paintedworld.js');const s=paintedWorldState();return ['img/held/fighter-empty-punch.png','img/world/dagger.png','img/materials/region_7-floor6.png'].every(k=>s[k]==='failed')&&s['img/materials/region_8-floor6.png']==='ready';})).toBe(true);
 await expect.poll(()=>page.evaluate(()=>Assets.held(null,'fist','mage',false)?.img.width)).toBe(256);
 await expect.poll(()=>page.evaluate(()=>Assets.sprites.shortsword.url)).toBe('img/world/shortsword.png');
 expect(await page.evaluate(()=>Assets.held(null,'fist','fighter',false)?.img.width)).not.toBe(256);
 expect(await page.evaluate(()=>Assets.sprites.dagger.url.startsWith('data:image/'))).toBe(true);
 expect(await page.evaluate(()=>Assets.themes[7].floorOf(6)[0].length)).toBe(4096);
});

test('small painted treasure caches rarity outlines without changing seeded unidentified appearances @mobile',async({page})=>{
 await startGame(page,{seed:'painted-treasure-outlines'});
 await page.evaluate(()=>{for(const k of ['longsword','relic_longsword','legend_staff','mythic_last_gate'])void Assets.sprites[k].url;});
 await expect.poll(()=>page.evaluate(()=>['longsword','relic_longsword','legend_staff','mythic_last_gate'].every(k=>Assets.sprites[k].w===256))).toBe(true);
 const result=await page.evaluate(()=>{
  const colours={'relic_longsword':[232,184,74],'legend_staff':[255,160,64],'mythic_last_gate':[226,188,255]};
  const edges=Object.entries(colours).map(([key,colour])=>{const s=Assets.sprites[key],a=s.levels[0].getContext('2d').getImageData(0,0,256,256).data;let count=0;for(let i=0;i<a.length;i+=4)if(a[i+3]>128&&colour.every((v,j)=>Math.abs(v-a[i+j])<=1))count++;return {key,count,cached:s.levels===s.levels&&s.flash===s.flash&&s.url===s.url,url:s.url.startsWith('data:image/')};});
  const G=Game.state(),before=JSON.stringify(G.looks),known={...G.known},checks=[];
  for(const t of Object.keys(G.looks)){const it={t,q:1,e:0};G.known[t]=false;const a=Game.spriteFor(it);G.known[t]=true;checks.push(a===Game.spriteFor(it));if(t==='amulet_tooth')checks.push(a!=='amulet_tooth');}G.known=known;
  return{edges,identified:checks.every(Boolean),unchanged:before===JSON.stringify(G.looks),ordinary:Assets.sprites.longsword.url};
 });for(const edge of result.edges){expect(edge.count,edge.key).toBeGreaterThan(100);expect(edge.cached&&edge.url).toBe(true);}expect(result.ordinary).toBe('img/world/longsword.png');expect(result.identified&&result.unchanged).toBe(true);
});

test('all activated art files decode after a native offline reload @mobile',async({browser,browserName},testInfo)=>{
 test.setTimeout(120000);let connected=true;const http=require('node:http'),{serve}=require('../server');
 const server=http.createServer((req,res)=>{if(!connected){req.socket.destroy();return;}serve(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:testInfo.project.use.viewport,isMobile:true,hasTouch:true}),page=await context.newPage();
 try{
  const errors=watchForErrors(page);await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});await startGame(page,{seed:'all-paintings-offline'});
  await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const urls=await page.evaluate(async()=>{const{PAINTED:p}=await import('/js/paintedcatalog.js');return [...new Set([...Object.values(p.static),...Object.values(p.atlases),...Object.values(p.effects),...Object.values(p.decals),...Object.values(p.themes).flatMap(Object.values),...Object.values(p.held).map(m=>m.path),...Object.values(p.carried).map(m=>m.path),...Object.values(p.overlays).map(m=>m.path)])];});
  expect(urls.length).toBeGreaterThan(1500);
  await page.evaluate(async urls=>{for(const url of urls)if(!await caches.match('./'+url))throw Error('Uncached art '+url);},urls);
  connected=false;if(browserName!=='webkit')await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.Assets?.themes.length===13);
  const count=await page.evaluate(async urls=>{let count=0;for(let start=0;start<urls.length;start+=8){await Promise.all(urls.slice(start,start+8).map(async url=>{const im=new Image();im.src=url;await im.decode();if(!im.naturalWidth)throw Error('Empty art '+url);count++;}));}return count;},urls);expect(count).toBe(urls.length);
  for(const[cls,id]of [['mage','spellbook'],['druid','buckler'],['spellblade','wayfarer_lantern']])await expect.poll(()=>page.evaluate(({cls,id})=>Assets.carried(id,cls)?.img.width,{cls,id})).toBe(256);
  await expect.poll(()=>page.evaluate(()=>Assets.held(null,'fist','mage',false)?.img.width)).toBe(256);
  await expect.poll(()=>page.evaluate(async()=>{const{paintedLantern,paintedReadingScroll,paintedGroundDecal}=await import('/js/paintedworld.js');return paintedLantern()?.img.width===256&&paintedReadingScroll()?.img.width===256&&paintedGroundDecal('blood',1)?.width===128&&paintedGroundDecal('ash',1)?.width===128&&paintedGroundDecal('ice',1)?.width===128&&paintedGroundDecal('oil',1)?.width===128;})).toBe(true);
  connected=true;if(browserName!=='webkit')await context.setOffline(false);expect(errors).toEqual([]);
 }finally{await context.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
});

test('amber lantern loads only on demand, upgrades in place and fits native hand placements @mobile',async({page})=>{
 let release,requests=0;const gate=new Promise(r=>release=r);
 await page.route('**/img/overlays/amber-lantern.png',async route=>{requests++;await gate;await route.continue();});
 const errors=watchForErrors(page);await startGame(page,{seed:'combat-clarity'});expect(requests).toBe(0);
 await page.evaluate(()=>{Game.level().monsters=[];Game.level().twist='dark';});
 await expect.poll(()=>page.evaluate(()=>Renderer.lantern)).toBe(1);await expect.poll(()=>requests).toBe(1);
 expect(await page.evaluate(async()=>{const{paintedLantern}=await import('/js/paintedworld.js');return paintedLantern();})).toBeNull();
 release();await page.evaluate(async()=>{window.__paintedLantern=(await import('/js/paintedworld.js')).paintedLantern;});
 await expect.poll(()=>page.evaluate(()=>window.__paintedLantern()?.img.width)).toBe(256);
 const result=await page.evaluate(async()=>{
  const {Dice,Odds}=await import('/js/rng.js'),frame=window.__paintedLantern(),ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage;
  const rs=Game.renderState(10000),before=JSON.stringify(Game.state()),dice=[Dice.s,Odds.s],height=Renderer.H,calm=Renderer.calm,calls=[],bad=[];
  const pixels=frame.img.getContext('2d').getImageData(0,0,256,256).data;let x0=256,y0=256,x1=0,y1=0;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(pixels[(y*256+x)*4+3]>=8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
  ctx.drawImage=function(img,...args){if(img===frame.img)calls.push(args);return draw.call(this,img,...args);};
  try{
   for(const h of [160,360,464])for(const c of [false,true])for(const kit of ['free','shield','two']){
    Renderer.setHeight(h);Renderer.setCalm(c);const fx={...rs.fx,view:{...rs.fx.view,lantern:true,weapon:kit==='two'?'greatsword':null,shield:kit==='shield'?'shield':null,offhand:null,two:kit==='two',walk:0,steps:0}};
    const first=calls.length;for(const now of [10000,11000])Renderer.render(rs.level,rs.cam,rs.sprites,fx,now);
    const pair=calls.slice(first);if(pair.length!==2)bad.push({h,c,kit,count:pair.length});
    for(const[x,y,w,hh]of pair)if(x+x0*w/256<0||y+y0*hh/256<0||x+x1*w/256>Renderer.W||y+y1*hh/256>h)bad.push({h,c,kit,box:[x,y,w,hh]});
    if(c&&JSON.stringify(pair[0])!==JSON.stringify(pair[1]))bad.push({h,c,kit,unstable:true});
    const count=calls.length;fx.view.lantern=false;Renderer.render(rs.level,rs.cam,rs.sprites,fx,10000);if(calls.length!==count)bad.push({unexpected:true});
   }
   return{draws:calls.length,bad,cached:window.__paintedLantern()===frame,holes:[[105,165],[150,165],[127,45]].every(([x,y])=>pixels[(y*256+x)*4+3]===0),state:before===JSON.stringify(Game.state()),dice:dice[0]===Dice.s&&dice[1]===Odds.s};
  }finally{ctx.drawImage=draw;Renderer.setHeight(height);Renderer.setCalm(calm);}
 });expect(result).toEqual({draws:36,bad:[],cached:true,holes:true,state:true,dice:true});expect(requests).toBe(1);expect(errors).toEqual([]);
 // The exact blue lantern excludes the ordinary dark-floor lantern.
 expect(await page.evaluate(()=>{const p=Game.player(),prior=p.eq.shield;p.eq.shield={t:'wayfarer_lantern',q:1,e:0};const excluded=!Game.renderState(performance.now()).fx.view.lantern;p.eq.shield=prior;return excluded;})).toBe(true);
});

test('a corrupt amber lantern keeps its native flame and independent fallback @mobile',async({page})=>{
 await page.route('**/img/overlays/amber-lantern.png',route=>route.fulfill({status:200,contentType:'image/png',body:'corrupt'}));
 const errors=watchForErrors(page);await startGame(page,{seed:'combat-clarity'});await page.evaluate(()=>{Game.level().monsters=[];Game.level().twist='dark';Assets.held(null,'fist','fighter',false);});
 await expect.poll(()=>page.evaluate(async()=>{const{paintedWorldState}=await import('/js/paintedworld.js');return paintedWorldState()['img/overlays/amber-lantern.png'];})).toBe('failed');
 await expect.poll(()=>page.evaluate(()=>Assets.held(null,'fist','fighter',false)?.img.width)).toBe(256);
 expect(await page.evaluate(async()=>{const{paintedLantern}=await import('/js/paintedworld.js');return{fallback:paintedLantern()===null,lantern:Renderer.lantern,status:Game.state().status};})).toEqual({fallback:true,lantern:1,status:'playing'});expect(errors).toEqual([]);
});

test('door leaves exclude surround pixels and cache each decoded source independently @mobile',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>window.Assets?.themes.length);
 const result=await page.evaluate(()=>{
  const source=document.createElement('canvas');source.width=source.height=64;const c=source.getContext('2d');
  c.fillStyle='#ff00ff';c.fillRect(0,0,64,64);c.fillStyle='#00ff00';c.fillRect(8,4,48,60);c.fillStyle='#0000ff';c.fillRect(38,27,14,16);
  const before=Array.from(c.getImageData(0,0,64,64).data),leaf=Assets.doorLeaf(source),pixels=leaf.getContext('2d').getImageData(0,0,64,64).data;let surround=0,lock=0;
  for(let i=0;i<pixels.length;i+=4){if(pixels[i]===255&&pixels[i+2]===255)surround++;if(pixels[i+2]===255&&pixels[i]===0)lock++;}
  const newer=document.createElement('canvas');newer.width=newer.height=64;newer.getContext('2d').fillStyle='#ffff00';newer.getContext('2d').fillRect(0,0,64,64);
  const replacement=Assets.doorLeaf(newer);
  return{surround,lockVisible:lock>0,cached:leaf===Assets.doorLeaf(source),replacement:replacement!==leaf&&replacement.getContext('2d').getImageData(0,0,1,1).data[0]===255,sourceUnchanged:JSON.stringify(before)===JSON.stringify(Array.from(c.getImageData(0,0,64,64).data))};
 });expect(result).toEqual({surround:0,lockVisible:true,cached:true,replacement:true,sourceUnchanged:true});
});

test('closed and sliding doors draw only leaves in every region without changing run or dice @mobile',async({page})=>{
 await startGame(page,{seed:'door-leaf-fit'});
 await page.evaluate(async()=>{for(const t of Assets.themes){void t.door;void t.cellDoor;}window.__doorPaintState=(await import('/js/paintedworld.js')).paintedWorldState;const{PAINTED}=await import('/js/paintedcatalog.js');window.__doorPaintUrls=Object.values(PAINTED.themes).flatMap(t=>[t.door,t.cellDoor]).filter(Boolean);});
 await page.waitForFunction(()=>window.__doorPaintUrls.every(p=>window.__doorPaintState()[p]==='ready'));
 const rows=await page.evaluate(async()=>{
  Game.recordRuns(false);Game.update=()=>{};Game.level().monsters=[];Game.level().npcs=[];const{Dice,Odds}=await import('/js/rng.js');const initial=Game.renderState(10000),before=JSON.stringify(Game.state()),dice=[Dice.s,Odds.s],rows=[],T=Dungeon.T;
  const ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage;
  try{for(let region=0;region<13;region++)for(const cell of[false,true])for(const shut of[null,.75,.25,0]){
   const w=9,h=13,tiles=new Uint8Array(w*h).fill(T.FLOOR);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!x||!y||x===w-1||y===h-1||y===4)tiles[y*w+x]=T.WALL;tiles[4*w+4]=shut===null?T.DOOR:T.DOOR_OPEN;
   const level={...Game.level(),w,h,tiles,theme:region,roomId:new Int16Array(w*h),rooms:[{x:1,y:1,w:7,h:11,shape:'box'}],piece:cell?{kind:'cells',room:0}:null,pieces:[],caved:[],lights:[],dressing:[],remains:[],monsters:[],npcs:[],items:{},explored:new Uint8Array(w*h).fill(1),seen:new Uint8Array(w*h).fill(1),locks:{},doors:{},doorBlows:{},pools:[],twist:null,stairsUp:null,stairsDown:null};
   const raw=cell?Assets.themes[region].cellDoor:Assets.themes[region].door,leaf=Assets.doorLeaf(raw);let rawDraws=0,leafDraws=0;
   ctx.drawImage=function(image,...args){if(image===raw)rawDraws++;if(image===leaf)leafDraws++;return draw.call(this,image,...args);};
   const fx={...initial.fx,arriveAt:-1e9,doorShut:shut===null?{}:{[4*w+4]:{shut,lock:null}},doorFire:{}};
   Renderer.render(level,{x:4.5,y:6.5,angle:-Math.PI/2},[],fx,10000);rows.push({region,cell,shut,rawDraws,leafDraws});
  }}finally{ctx.drawImage=draw;}
  if(JSON.stringify(Game.state())!==before||Dice.s!==dice[0]||Odds.s!==dice[1])throw Error('Door surface rendering changed state/dice '+JSON.stringify({keys:Object.keys(Game.state()).filter(k=>JSON.stringify(Game.state()[k])!==JSON.stringify(JSON.parse(before)[k])),beforeDice:dice,afterDice:[Dice.s,Odds.s]}));return rows;
 });expect(rows).toHaveLength(104);for(const r of rows){expect(r.rawDraws,JSON.stringify(r)).toBe(0);if(r.shut===0)expect(r.leafDraws).toBe(0);else expect(r.leafDraws,JSON.stringify(r)).toBeGreaterThan(0);}
});

for(const cell of [false,true])test(`${cell?'cell gate':'wooden door'} keeps damage and key colour through native opening and closing @mobile`,async({page})=>{
 const errors=watchForErrors(page);await startGame(page,{seed:'door-continuity'});await faceOpenGround(page,2);
 await page.evaluate(async cell=>{
  const G=Game.state();G.levels[G.depth]={...Game.level()};
  const L=Game.level(),p=Game.player(),[dx,dy]=Dungeon.DIRS[p.dir],x=p.x+dx,y=p.y+dy;
  L.monsters=[];L.npcs=[];L.dressing=[];L.puzzle=null;L.items={};L.fields={};L.traps={};
  L.tiles[y*L.w+x]=Dungeon.T.DOOR;L.tiles[(y+dx)*L.w+x-dy]=Dungeon.T.WALL;L.tiles[(y-dx)*L.w+x+dy]=Dungeon.T.WALL;
  if(cell){L.piece={kind:'cells',room:0};L.rooms[0]={x:1,y:1,w:L.w-2,h:L.h-2,shape:'box'};L.roomId.fill(0);}else L.piece=null;
  window.__continuity={x,y,key:x+','+y,cell};const t=Assets.themes[L.theme];void t.door;void t.cellDoor;void t.locked.silver;t.cellLocked('silver');
  window.__continuityState=(await import('/js/paintedworld.js')).paintedWorldState;
  const m=(await import('/js/paintedcatalog.js')).PAINTED.themes[L.theme];window.__continuityUrls=[m.door,m.cellDoor].filter(Boolean);
 },cell);
 await page.waitForFunction(()=>window.__continuityUrls.every(p=>window.__continuityState()[p]==='ready'));
 const result=await page.evaluate(async()=>{
  const {x,y,key,cell}=window.__continuity,L=Game.level(),p=Game.player(),t=Assets.themes[L.theme],ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage;
  const leaf=Assets.doorLeaf(cell?t.cellDoor:t.door),damaged=Assets.crackedDoor(leaf,2);let seen=0;
  const drawCurrent=()=>{const now=performance.now(),rs=Game.renderState(now);Renderer.render(rs.level,rs.cam,rs.sprites,rs.fx,now);};
  ctx.drawImage=function(image,...args){if(image===damaged)seen++;return draw.call(this,image,...args);};
  try{
   L.doorBlows={[key]:2};Game.input('use');drawCurrent();
   const lockBefore=Game.renderState(performance.now()).fx.doorShut?.[y*L.w+x]?.lock;
   const opening=await new Promise(resolve=>{let n=0;function frame(){if(++n<8)requestAnimationFrame(frame);else resolve({seen,tile:L.tiles[y*L.w+x]});}requestAnimationFrame(frame);});
   await new Promise(r=>setTimeout(r,650));seen=0;Game.input('use');drawCurrent();await new Promise(r=>setTimeout(r,650));const closing=seen;
   // A real keyed unlock consumes the key, clears the saved lock and keeps its
   // colour in the transient moving leaf, including the cell's native lock.
   L.tiles[y*L.w+x]=Dungeon.T.DOOR_LOCKED;L.locks[key]='silver';const it={t:'key',color:'silver',q:1,e:0};p.inv.push(it);Game.input('use');
   return{opening,closing,damage:L.doorBlows[key],lockBefore,movingLock:Game.renderState(performance.now()).fx.doorShut?.[y*L.w+x]?.lock,keyConsumed:!p.inv.includes(it),savedLock:Object.hasOwn(L.locks,key),openTile:Dungeon.T.DOOR_OPEN};
  }finally{ctx.drawImage=draw;}
 });
 expect(result.opening.tile).toBe(result.openTile);expect.soft(result.opening.seen,JSON.stringify(result)).toBeGreaterThan(0);expect(result.closing).toBeGreaterThan(0);expect(result.damage).toBe(2);expect(result.lockBefore).toBe(null);expect(result.movingLock).toBe('silver');expect(result.keyConsumed).toBe(true);expect(result.savedLock).toBe(false);expect(errors).toEqual([]);
});

test('a burning door stays charred during its native fall and leaves an empty doorway @mobile',async({page})=>{
 const errors=watchForErrors(page);await startGame(page,{seed:'door-burn-continuity'});await faceOpenGround(page,2);
 await page.evaluate(async()=>{const G=Game.state();G.levels[G.depth]={...Game.level(),monsters:[],npcs:[],dressing:[],items:{},fields:{},puzzle:null,piece:null,doorBlows:{}};const L=Game.level(),p=Game.player(),[dx,dy]=Dungeon.DIRS[p.dir],x=p.x+dx,y=p.y+dy;L.tiles[y*L.w+x]=Dungeon.T.DOOR;L.tiles[(y+dx)*L.w+x-dy]=Dungeon.T.WALL;L.tiles[(y-dx)*L.w+x+dy]=Dungeon.T.WALL;window.__burnDoor={x,y,key:x+','+y};void Assets.themes[L.theme].door;window.__burnDoorState=(await import('/js/paintedworld.js')).paintedWorldState;window.__burnDoorUrl=(await import('/js/paintedcatalog.js')).PAINTED.themes[L.theme].door;});
 await page.waitForFunction(()=>window.__burnDoorState()[window.__burnDoorUrl]==='ready');
 await page.evaluate(()=>{
  const G=Game.state(),L=Game.level(),{x,y,key}=window.__burnDoor,ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage,leaf=Assets.doorLeaf(Assets.themes[L.theme].door),charred=new Set([0,1,2].map(f=>Assets.burningDoor(leaf,2,f)));let charredMoving=0,plainMoving=0;
  ctx.drawImage=function(image,...args){if(L.burntDoors?.[key]){if(charred.has(image))charredMoving++;if(image===leaf)plainMoving++;}return draw.call(this,image,...args);};
  window.__burnDoorResult=()=>({charredMoving,plainMoving,burnt:L.burntDoors?.[key],tile:L.tiles[y*L.w+x],openTile:Dungeon.T.DOOR_OPEN,sliding:Renderer.doorColumns,field:L.fields[key]?.k});window.__burnDoorRestore=()=>{ctx.drawImage=draw;};
  L.fields[key]={k:'fire',fuel:'door',until:G.t+650,spread:1e12,burn:1e12,gen:0};
 });
 try{
  await expect.poll(()=>page.evaluate(()=>!!Game.level().burntDoors?.[window.__burnDoor.key]),{timeout:5000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>Renderer.doorColumns),{timeout:5000}).toBe(0);
  const result=await page.evaluate(()=>window.__burnDoorResult());expect(result.burnt).toBe(true);expect(result.tile).toBe(result.openTile);expect(result.field).toBe('ash');expect(result.sliding).toBe(0);expect(result.charredMoving,JSON.stringify(result)).toBeGreaterThan(0);expect(result.plainMoving).toBe(0);expect(errors).toEqual([]);
 }finally{await page.evaluate(()=>window.__burnDoorRestore());}
});
