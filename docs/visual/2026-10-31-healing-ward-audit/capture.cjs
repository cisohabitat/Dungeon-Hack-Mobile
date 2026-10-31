'use strict';
// Actual native casts with supplied resources and a passive warning target.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,'native');
const {chromium}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server');
const {startGame,faceOpenGround,placeMonster,artReady,watchForErrors}=require(root+'/test/browser/helpers');
const sourceFiles=['js/release.js','js/spellfx.js','js/arcanefx.js','js/renderer.js','js/powers.js','js/data.js','js/wild.js','js/spellblade.js'];
const sources=()=>Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const beforeSources=sources(),casts=[],captures=[];
const expected={shield:['buff',600,3],bless:['buff',600,2],protection:['buff',600,5],cure_light:['heal',800,2],cure_serious:['heal',850,5],mending_moss:['heal',800,3],wild_shape:['buff',700,5],spellguard:['buff',500,2]};
const groups=[['Mage',['shield']],['Cleric',['bless','protection','cure_light','cure_serious']],['Druid',['mending_moss','wild_shape']],['Spellblade',['spellguard']]];
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const viewport of [{width:320,height:667},{width:390,height:844},{width:740,height:360}])for(const calm of [false,true]){
   const mode=viewport.width+(calm?'-calm-safe':'-normal');
   const context=await browser.newContext({viewport,baseURL:origin}),page=await context.newPage(),errors=watchForErrors(page);
   await page.addInitScript(calm=>{localStorage.removeItem('deepdelve.save');for(const [k,v] of Object.entries({sound:'off',samples:'off',prelude:'off',wayfarer:'1',calm:calm?'1':'0',palette:calm?'safe':'standard'}))localStorage.setItem('deepdelve.'+k,v);},calm);
   for(const [cls,ids] of groups){
    await startGame(page,{seed:'elements-preview',cls,name:'Restorative art audit'});
    await page.evaluate(()=>{const L=Game.level(),p=Game.player();L.monsters=[];L.npcs=[];p.level=10;p.hp=100;p.maxHp=999;p.sp=p.maxSp=999;});
    if(await faceOpenGround(page,2)<2)throw Error('No corridor');
    await placeMonster(page,'orc',1,{hp:9999,maxHp:9999,nextAct:1e12,awake:true,spoke:true});
    await artReady(page,{orc:['hurt','windup']});await page.waitForTimeout(2700);
    for(const id of ids){
     const result=await page.evaluate(async id=>{
      const p=Game.player(),G=Game.state(),m=Game.level().monsters[0];p.nextAttack=0;G.blowGate=0;p.sp=999;p.hp=100;
      m.windup={kind:'melee',at:G.t-300,until:G.t+10000};
      const before={hp:p.hp,sp:p.sp,t:G.t};
      const accepted=Game.castSpell(Game.knownSpells().find(s=>s.id===id));
      const effect=Game.renderState(performance.now()).fx.spells.at(-1);if(!accepted||!effect)throw Error('No actual cast '+id);
      const applied={hp:p.hp,effects:JSON.parse(JSON.stringify(p.effects)),shape:p.shape?JSON.parse(JSON.stringify(p.shape)):null};
      const duration=effect.until-effect.born,phases=[.04,.18,.36,.6,.86,1.04],frames=[];
      await new Promise((resolve,reject)=>{const deadline=performance.now()+4000;function sample(now){if(now>deadline)return reject(Error('Native capture deadline'));if(now>=effect.born+duration*phases[frames.length]){const phase=(now-effect.born)/duration;frames.push({phase,name:frames.length===5?'expired':'effect-'+frames.length,data:document.querySelector('#view').toDataURL('image/png'),warnings:Renderer.shown.filter(s=>s.markSize>0).length,buffer:{width:document.querySelector('#view').width,height:document.querySelector('#view').height}});}if(frames.length===phases.length)resolve();else requestAnimationFrame(sample);}requestAnimationFrame(sample);});
      return {id,style:effect.style,color:effect.color,duration,impact:effect.impact,cost:before.sp-p.sp,healed:applied.hp-before.hp,applied,game_time_advanced:G.t>before.t,calm:Renderer.calm,status:G.status,frames};
     },id);
     if(JSON.stringify([result.style,result.duration,result.cost])!==JSON.stringify(expected[id])||result.impact!==0)throw Error('Cost/timing changed '+id);
     if(!result.game_time_advanced||result.calm!==calm||result.status!=='playing')throw Error('Native loop/mode failed '+id);
     if(result.style==='heal'&&result.healed<=0)throw Error('No healing '+id);
     if(['shield','protection'].includes(id)&&result.applied.effects.ac?.src!==id)throw Error('Armour effect missing '+id);
     if(id==='bless'&&result.applied.effects.hit?.src!==id)throw Error('Blessing missing');
     if(id==='wild_shape'&&!result.applied.shape)throw Error('Bear shape missing');
     if(id==='spellguard'&&result.applied.effects.spellguard?.src!==id)throw Error('Guard missing');
     if(result.frames.some((f,i)=>f.warnings<1||(i<5&&f.phase>=1))||result.frames.at(-1).phase<=1)throw Error('Missed native sample '+id);
     for(const f of result.frames){const file=mode+'-'+id+'-'+f.name+'.png';fs.writeFileSync(path.join(out,file),Buffer.from(f.data.split(',')[1],'base64'));delete f.data;captures.push({mode,cls,id,file,...f});}
     casts.push({mode,cls,...result,frames:undefined});
    }
   }
   if(errors.length)throw Error(errors.join('\n'));
   await context.close();console.log('Native restorative casts '+mode);
   const gallery=await browser.newPage({viewport:{width:1200,height:300}});
   await gallery.setContent('<style>body{margin:0;background:#20242c;color:white;font:11px monospace;display:grid;align-content:start;grid-template-columns:repeat(6,200px)}figure{margin:0}img{display:block;width:200px;image-rendering:pixelated}figcaption{height:32px}</style>'+captures.filter(c=>c.mode===mode).map(c=>`<figure><figcaption>${c.id} ${c.name}<br>t=${c.phase.toFixed(3)}</figcaption><img src="${origin}/docs/visual/2026-10-31-healing-ward-audit/native/${c.file}"></figure>`).join(''));
   await gallery.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await gallery.screenshot({path:path.join(out,mode+'-overview.png'),fullPage:true});await gallery.close();
  }
  if(JSON.stringify(beforeSources)!==JSON.stringify(sources()))throw Error('Source changed during capture');
  fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify({version:JSON.parse(fs.readFileSync(root+'/package.json')).version,sources:beforeSources,scope:'Actual native Game.castSpell, updates, rendering, effect clocks and dice. Supplies level10/resources, injured hero before each cast, passive durable adjacent Orc with long wind-up, recovery reset between casts and device-local Wayfarer unlock. No game/update/renderer/image/clock substitution. Canvas captures at observed frame times; not unassisted gameplay, full HUD, companion healing, guard absorption, buff-duration expiry, physical-device or performance approval.',casts,captures,browser_errors:[]},null,2)+'\n');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
