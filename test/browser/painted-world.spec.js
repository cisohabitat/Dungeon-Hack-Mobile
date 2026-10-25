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
 await page.evaluate(async({id,cls})=>{const{PAINTED}=await import('/js/paintedcatalog.js'),map=new Map();for(const[key,m]of Object.entries(PAINTED.held))if(m.id===id&&m.cls===cls)map.set(Assets.held(id,m.pose,cls,m.two,m.lit).img,key);const ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage;window.__namedStaff=[];ctx.drawImage=function(img,...args){if(map.has(img))window.__namedStaff.push({at:performance.now(),key:map.get(img)});return draw.call(this,img,...args);};},{id,cls});
 for(const t of['scroll_map','potion_heal']){
  await placeMonster(page,'orc',1,{hp:9999,maxHp:9999,nextAct:1e12,awake:true,spoke:true});const born=await page.evaluate(async t=>{const p=Game.player(),G=Game.state();p.nextAttack=0;G.blowGate=0;p.hp=700;window.__namedStaff=[];Game.input('attack');const fx=Game.renderState(performance.now()).fx;if(fx.swingAt<0)throw Error('No native staff attack');await new Promise(r=>setTimeout(r,fx.swingMs*.12));const it={t,q:1,e:0};p.inv.push(it);Game.useItem(it);if(p.inv.includes(it))throw Error('Native consumable did not run');return Game.renderState(performance.now()).fx[t==='scroll_map'?'readAt':'useAt'];},t);
  await expect.poll(()=>page.evaluate(born=>window.__namedStaff.some(f=>f.at>=born&&f.key.endsWith('-drive-one')),born),{timeout:5000}).toBe(true);
  await expect.poll(()=>page.evaluate(born=>window.__namedStaff.some(f=>f.at>born+1100&&f.key.endsWith('-rest-two')),born),{timeout:5000}).toBe(true);
 }
 expect(errors).toEqual([]);
});
