'use strict';
// Observe actual casts and the native animation loop; never replace game updates or renderer functions.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{serve}=require('../../test/server');
const {startGame,faceOpenGround,placeMonster,artReady,watchForErrors}=require('../../test/browser/helpers');
const out=path.join(__dirname,'batch-x-preview');fs.mkdirSync(out,{recursive:true});
const groups=[['Mage',['burning_hands','cone_cold','lightning','scroll_fire']],['Cleric',['flame_strike']],['Druid',['insect_plague']]];
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const captures=[],casts=[];
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const origin=`http://127.0.0.1:${server.address().port}`;
for(const width of [390,320])for(const calm of [false,true]){
 const mode=width+(calm?'-calm-safe':'-normal'),context=await browser.newContext({viewport:{width,height:width===390?844:667},baseURL:origin}),page=await context.newPage(),errors=watchForErrors(page);
 await page.addInitScript(calm=>{localStorage.removeItem('deepdelve.save');for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off',calm:calm?'1':'0',palette:calm?'safe':'standard'}))localStorage.setItem('deepdelve.'+k,v);},calm);
 for(const[cls,ids]of groups){await startGame(page,{seed:'elements-preview',cls});await page.evaluate(()=>{const L=Game.level(),p=Game.player();L.monsters=[];L.npcs=[];p.level=10;p.hp=p.maxHp=999;p.sp=p.maxSp=999;});if(await faceOpenGround(page,2)<2)throw Error('No corridor');await placeMonster(page,'orc',1,{hp:9999,maxHp:9999,nextAct:1e12,awake:true,spoke:true});await artReady(page,{orc:['hurt','windup']});
 await page.evaluate(async()=>{const {paintedImpact,paintedWorldState}=await import('/js/paintedworld.js');window.__impactState=paintedWorldState;for(const f of ['fire','frost'])paintedImpact(f,0);});await page.waitForFunction(()=>['fire','frost'].every(f=>[0,1,2,3].every(i=>window.__impactState()['img/effects/'+f+'_'+i+'.png']==='ready')));
 await page.waitForTimeout(2700);
 for(const id of ids){const result=await page.evaluate(async id=>{
  const p=Game.player(),G=Game.state(),m=Game.level().monsters[0];p.nextAttack=0;G.blowGate=0;p.sp=999;const before={sp:p.sp,hp:m.hp,t:G.t};
  // A long existing melee warning stays visible while the real loop and spell progress.
  m.windup={kind:'melee',at:G.t-300,until:G.t+10000};
  if(id==='scroll_fire'){const item={t:'scroll_fire',q:1,e:0};p.inv.push(item);Game.useItem(item);}else Game.castSpell(Game.knownSpells().find(s=>s.id===id));
  const effect=Game.renderState(performance.now()).fx.spells.at(-1);if(!effect)throw Error('No cast '+id);
  const duration=effect.until-effect.born,hit=effect.impact??(effect.style==='hands'?.45:.5);
  const phases=[{name:hit>0?'travel':'onset',phase:hit*.5},...[.04,.26,.56,.86].map((age,i)=>({name:'impact-'+i,phase:hit+(1-hit)*age})),{name:'expired',phase:1.04}];
  const frames=[];await new Promise((resolve,reject)=>{const deadline=performance.now()+4000;function sample(now){if(now>deadline)return reject(Error('Live capture timeout'));const next=phases[frames.length];if(now>=effect.born+duration*next.phase){const phase=(now-effect.born)/duration;frames.push({name:next.name,phase,post_impact_age:(phase-hit)/(1-hit),data:document.querySelector('#view').toDataURL('image/png'),warnings:Renderer.shown.filter(s=>s.markSize>0).length});}if(frames.length===phases.length)resolve();else requestAnimationFrame(sample);}requestAnimationFrame(sample);});
  if((hit>0&&frames[0].phase>=hit)||frames.slice(1,5).some(f=>f.post_impact_age<0||f.post_impact_age>=1))throw Error('Missed live phase '+id);
  return {id,style:effect.style,duration,impact:hit,damage:before.hp-m.hp,cost:before.sp-p.sp,game_time_advanced:G.t>before.t,calm:Renderer.calm,frames};
 },id);
 if(result.damage<=0||!result.game_time_advanced||result.calm!==calm)throw Error('Native cast did not advance '+id);
 for(const f of result.frames){const file=mode+'-'+id+'-'+f.name+'.png';fs.writeFileSync(path.join(out,file),Buffer.from(f.data.split(',')[1],'base64'));delete f.data;captures.push({mode,id,file,...f});}casts.push({mode,...result,frames:undefined});
 }
 }
 if(errors.length)throw Error(errors.join('\n'));await context.close();console.log('Live casts '+mode);
 const ov=await browser.newPage({viewport:{width:1200,height:300}});await ov.setContent('<style>body{margin:0;background:#20242c;color:white;font:11px monospace;display:grid;align-content:start;grid-template-columns:repeat(6,200px)}figure{margin:0}img{width:200px;image-rendering:pixelated}figcaption{height:30px}</style>'+captures.filter(c=>c.mode===mode).map(c=>`<figure><figcaption>${c.id} ${c.name}<br>t=${c.phase.toFixed(3)}</figcaption><img src="${origin}/art/creatures/batch-x-preview/${c.file}"></figure>`).join(''));await ov.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await ov.screenshot({path:path.join(out,mode+'-overview.png'),fullPage:true});await ov.close();
}
fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify({scope:'Actual native casts and scrolling item use; real Game.update and Renderer.render untouched. Setup raises level/resources, positions one durable Orc, and supplies a long existing melee warning. Native view canvas sampled after normal animation frames; live timestamps retained. Not a complete unassisted run, full HUD or isolated performance audit.',casts,captures,console_errors:[]},null,2)+'\n');
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
