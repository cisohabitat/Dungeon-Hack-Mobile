'use strict';
// Native shipped carried frames in frozen presentation states; no asset overrides. Native actions/offline verified separately.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{serve}=require('../../test/server');
const {startGame,faceOpenGround,watchForErrors}=require('../../test/browser/helpers');
const folder='batch-ac-ah-runtime/shields',root=path.join(__dirname,folder),out=path.join(root,'dungeon');fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'generation-batch-ad-shields.json'))),measure=JSON.parse(fs.readFileSync(path.join(__dirname,'batch-ad-shields-preview/measurements.json')));
const states=['rest','walk','hurt','calm','bash','cast','read','use'];
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const audits=[],captures=[];
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const origin=`http://127.0.0.1:${server.address().port}`;
 for(const width of [390,320]){const context=await browser.newContext({baseURL:origin,viewport:{width,height:width===390?844:667},serviceWorkers:'block'}),page=await context.newPage(),errors=watchForErrors(page);
 await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});await startGame(page,{seed:'shield-source-fitting'});await faceOpenGround(page,3);await page.locator('#floor-card').evaluate(e=>e.style.display='none');
 await page.evaluate(async({manifest,measure,folder})=>{
  Game.update=()=>{};Game.recordRuns(false);const L=Game.level();L.monsters=[];L.npcs=[];L.dressing=[];L.remains=[];L.items={};L.fields=[];L.snares=[];
  const original=Assets.carried,render=Renderer.render,frames={},meta=manifest.cells;
  const {paintedCarried}=await import('/js/paintedworld.js');
  for(const c of Object.values(meta))paintedCarried(c.id,c.cls);
  await new Promise((resolve,reject)=>{const until=performance.now()+30000;const poll=()=>{if(Object.values(meta).every(c=>paintedCarried(c.id,c.cls)))resolve();else if(performance.now()>until)reject(Error('Native carried decode timeout'));else setTimeout(poll,20);};poll();});
  for(const[key,c]of Object.entries(meta)){frames[key]=paintedCarried(c.id,c.cls);if(frames[key]!==Assets.carried(c.id,c.cls))throw Error('Native carried route mismatch');}
  const guards=[];for(const id of new Set(Object.values(meta).map(c=>c.id)))for(const cls of ['fighter','cleric','mage','thief','ranger','druid','spellblade','bear'])if(!meta[cls+'-'+id]){if(Assets.carried(id,cls)!==original(id,cls))throw Error('Wrong-class source binding');guards.push([id,cls]);}
  const{PAINTED}=await import('/js/paintedcatalog.js');for(const c of Object.values(PAINTED.carried)){if(Assets.carried(c.id,c.cls)!==original(c.id,c.cls))throw Error('Protected delivered identity changed');guards.push([c.id,c.cls]);}
  for(const[cls,id]of [['mage','spellbook'],['mage','crystal_orb'],['mage','orb_storms'],['cleric','holy_symbol'],['cleric','silver_symbol'],['cleric','reliquary'],['spellblade','wayfarer_lantern']]){if(Assets.carried(id,cls)!==original(id,cls))throw Error('Pending AC identity changed');guards.push([id,cls]);}
  window.__ad={meta,frames,guards};window.__adDraw=(key,state)=>{
   const c=meta[key],fr=frames[key],now=10000,rs=Game.renderState(now),action=['cast','read','use'].includes(state);
   const fx={...rs.fx,swingAt:-1e9,offAt:-1e9,throwAt:-1e9,arriveAt:-1e9,damageUntil:state==='hurt'?now+150:-1e9,castUntil:-1e9,castAt:state==='cast'?now-200:-1e9,readAt:state==='read'?now-200:-1e9,useAt:state==='use'?now-200:-1e9,readKind:'map',readColor:'#8af',useKind:'drink',useColor:'#f88',useSprite:Game.spriteFor({t:'potion_heal',q:1,e:0}),bashAt:state==='bash'?now-180:-1e9,bashKind:'shield',view:{weapon:null,shield:c.id,offhand:null,cls:c.cls,two:false,drawn:false,lantern:false,walk:state==='walk'?.5:0,steps:state==='walk'?1.4:0}};
   Renderer.setCalm(state==='calm');const ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage;let box=null,base=null,drawn=0;
   ctx.drawImage=function(im,x,y,w,h,...args){if(im===fr.img){drawn++;box=[x+fr.at.min[0]*w/256,y+fr.at.min[1]*h/256,x+fr.at.max[0]*w/256,y+fr.at.max[1]*h/256];if(fr.at.base)base=[x+fr.at.base[0]*w/256,y+fr.at.base[1]*h/256];}return draw.call(this,im,x,y,w,h,...args);};
   try{render(rs.level,rs.cam,rs.sprites,fx,now);if(drawn!==1||!box)throw Error('Exact source not drawn once '+key);if(!action&&(box[0]<-.5||box[1]<-.5||box[2]>Renderer.W+.5||box[3]>Renderer.H+.5))throw Error('Source object clipped '+JSON.stringify({key,state,H:Renderer.H,box,base}));if(base&&!action&&base[1]>Renderer.H+.5)throw Error('Lantern base clipped');return{key,state,height:Renderer.H,box,base,intentionally_lowered:action};}finally{ctx.drawImage=draw;}
  };
 },{manifest,measure,folder});
 const fitting=await page.evaluate(async states=>{const{Dice,Odds}=await import('/js/rng.js'),before=JSON.stringify(Game.state()),dice=[Dice.s,Odds.s],h=Renderer.H,calm=Renderer.calm,checks=[];try{for(const height of [160,360,464]){Renderer.setHeight(height);for(const key of Object.keys(window.__ad.meta))for(const state of states)checks.push(window.__adDraw(key,state));}}finally{Renderer.setHeight(h);Renderer.setCalm(calm);}if(JSON.stringify(Game.state())!==before||Dice.s!==dice[0]||Odds.s!==dice[1])throw Error('Source fixtures changed game/dice');return{checks,guards:window.__ad.guards,state_unchanged:true,dice_unchanged:true};},states);audits.push({width,...fitting});
 for(const key of Object.keys(manifest.cells))for(const state of states){await page.evaluate(({key,state})=>{Renderer.render=()=>window.__adDraw(key,state);Renderer.render();},{key,state});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const file=`${width}-${key}-${state}.png`;await page.screenshot({path:path.join(out,file)});captures.push({width,key,state,file});}
 if(errors.length)throw Error(errors.join('\n'));await context.close();
 const ov=await browser.newPage({viewport:{width:1600,height:300}});await ov.setContent('<style>body{margin:0;background:#20242c;color:white;font:11px monospace;display:grid;grid-template-columns:repeat(8,200px)}figure{margin:0}img{width:200px}figcaption{height:28px}</style>'+captures.filter(c=>c.width===width).map(c=>`<figure><figcaption>${c.key} ${c.state}</figcaption><img src="${origin}/art/creatures/${folder}/dungeon/${c.file}"></figure>`).join(''));await ov.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await ov.screenshot({path:path.join(root,width+'-overview.png'),fullPage:true});await ov.close();console.log(`Seven shield frames: ${fitting.checks.length} fitting fixtures and 56 source captures at ${width}px`);
 }
 fs.writeFileSync(path.join(root,'captures.json'),JSON.stringify({scope:'Native shipped class/id frames, no Assets/source-image substitutions; frozen presentation fits with Game/Dice/Odds neutrality. Native actions/offline/performance verified separately.',audits,captures,console_errors:[]},null,2)+'\n');
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
