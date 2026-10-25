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
 for(const m of Object.values(PAINTED.held))paintedHeld(m.id,m.pose,m.cls,m.two,!!m.lit);
 for(const meta of Object.values(PAINTED.carried))paintedCarried(meta.id,meta.cls);
 for(const f of ['fire','frost'])paintedImpact(f,0);
 for(const cls of ['mage','cleric','ranger','thief','druid','spellblade']){const s=Assets.sprites.shade.elite['shade_'+cls];if(!s)throw Error('Missing shade '+cls);paintedCreature(s);}
 for(const key of ['dog','wolf','scrag','sellsword','mender','renegade']){paintedCreature(Assets.sprites[key]);paintedCreature(Assets.sprites[key].sit);}
 paintedCreature(Assets.sprites.mender.heal);
 });
 await expect.poll(()=>page.evaluate(async()=>{const {PAINTED}=await import('/js/paintedcatalog.js'),{paintedWorldState}=await import('/js/paintedworld.js');return Object.keys(PAINTED.static).every(k=>Assets.sprites[k].url===PAINTED.static[k])&&Object.values(paintedWorldState()).every(s=>s==='ready');}),{timeout:30000}).toBe(true);
 await expect.poll(()=>page.evaluate(async()=>{const {paintedCreature}=await import('/js/paintedcreatures.js');return ['mage','cleric','ranger','thief','druid','spellblade'].every(c=>{const s=Assets.sprites.shade.elite['shade_'+c];return paintedCreature(s)!==s;})&&['dog','wolf','scrag','sellsword','mender','renegade'].every(k=>paintedCreature(Assets.sprites[k].sit)!==Assets.sprites[k].sit)&&paintedCreature(Assets.sprites.mender.heal)!==Assets.sprites.mender.heal;})).toBe(true);
 const result=await page.evaluate(async()=>{const {PAINTED}=await import('/js/paintedcatalog.js'),{paintedHeld,paintedCarried}=await import('/js/paintedworld.js');return {statics:Object.keys(PAINTED.static).length,held:Object.values(PAINTED.held).every(m=>!!paintedHeld(m.id,m.pose,m.cls,m.two,!!m.lit)),guards:[paintedHeld('longsword','rest','mage',false,false),paintedHeld('longsword','rest','fighter',false,true),paintedHeld('legend_longsword','rest','fighter',false,false),paintedCarried('runeshield','mage')].every(v=>v===null),surfaces:Assets.themes.every(t=>t.floorOf(0).length===8&&t.ceilOf(0).length===8&&t.floorOf(0)[7].every(v=>v===0xff000000)),url:Assets.sprites.dress_ripple.url};});
 expect(result.statics).toBeGreaterThan(70);expect(result.held&&result.guards&&result.surfaces).toBe(true);expect(result.url).toBe('img/world/dress_ripple.png');expect(errors).toEqual([]);
});

test('boss equipment and class shades follow live state without revealing concealed creatures @mobile',async({page})=>{
 const errors=watchForErrors(page);await startGame(page,{seed:'combat-clarity'});await faceOpenGround(page,3);await artReady(page,{shade:['windup'],warlord:['windup','strike'],heartforged:['windup'],mimic:['windup']});await page.waitForFunction(()=>!!Assets.sprites.shade.elite?.shade_mage?.windup);await page.evaluate(()=>{Game.update=()=>{};Game.level().monsters=[];});
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

test('painted starter and wider weapons retain exact grips and survive native offline reload @mobile',async({browser,browserName},testInfo)=>{
 test.setTimeout(120000);let connected=true;const http=require('node:http'),{serve}=require('../server');
 const server=http.createServer((req,res)=>{if(!connected){req.socket.destroy();return;}serve(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:testInfo.project.use.viewport,isMobile:true,hasTouch:true}),page=await context.newPage();
 try{const errors=watchForErrors(page);await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});await startGame(page,{seed:'painted-held-delivery'});
 const pairs=[['cleric','mace'],['thief','shortsword'],['ranger','shortbow'],['druid','spear'],['thief','dagger'],['fighter','battleaxe'],['cleric','hammer'],['fighter','greatsword'],['fighter','hammer'],['fighter','flail'],['cleric','flail'],['mage','dagger'],['fighter','dagger'],['ranger','dagger'],['druid','dagger'],['spellblade','dagger'],['fighter','club'],['cleric','club'],['thief','club'],['druid','club'],['fighter','mace'],['fighter','shortsword'],['ranger','shortsword'],['spellblade','shortsword'],['thief','longsword'],['ranger','longsword'],['spellblade','longsword'],['fighter','staff'],['cleric','staff'],['druid','staff'],['fighter','spear'],['ranger','spear']];
 for(const[cls,id]of pairs){await page.evaluate(({cls,id})=>{const p=Game.player(),it={t:id,q:1,e:0};p.cls=cls;p.inv.push(it);if(Game.canEquip(it))throw Error('Illegal test weapon');Game.equip(it);},{cls,id});
  await expect.poll(()=>page.evaluate(()=>{const p=Game.player(),v=Game.renderState(performance.now()).fx.view;return v.weapon===p.eq.weapon.t&&Assets.held(v.weapon,'rest',v.cls,v.drawn?false:v.two,v.cls==='spellblade'&&v.shield==='wayfarer_lantern')?.img.width;})).toBe(256);
 }
 const guards=await page.evaluate(async()=>{const{paintedHeld}=await import('/js/paintedworld.js');return [['dagger','rest','cleric',false,false],['dagger','rest','fighter',false,true],['dagger','rest','spellblade',true,true],['dagger','left','spellblade',false,true],['dagger','left','thief',false,false],['hammer','rest','cleric',false,true],['dwarfhammer','rest','cleric',false,false],['battleaxe','rest','fighter',true,false],['greatsword','rest','fighter',false,false],['spear','drive','druid',true,false],['spear','channel','druid',false,false],['shortbow','rest','fighter',false,false],['mythic_horizon','rest','ranger',false,false]].every(a=>paintedHeld(...a)===null);});expect(guards).toBe(true);
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
