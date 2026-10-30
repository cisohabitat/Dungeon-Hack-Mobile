'use strict';
// Audit only: native running Game/Renderer, supplied presentation fixtures.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,'native');
const {chromium}=require(root+'/node_modules/playwright');
const {serve}=require(root+'/test/server');
const {startGame,artReady,faceOpenGround,watchForErrors,expect}=require(root+'/test/browser/helpers');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}),records=[];
 try{for(const width of [320,390]){
  const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:{width,height:width===320?667:844}}),page=await context.newPage(),errors=watchForErrors(page);
  await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});
  await startGame(page,{seed:'combat-clarity',name:'Wet surface audit'});
  await page.evaluate(()=>{Game.level().monsters=[];Game.player().hp=Game.player().maxHp=9999;});
  expect(await faceOpenGround(page,3)).toBeGreaterThanOrEqual(3);await artReady(page);
  await page.evaluate(()=>{
   const ctx=document.querySelector('#view').getContext('2d'),fill=ctx.fillRect;
   window.__wetGlints=[];
   // Observation only: every native draw still executes with its original args.
   ctx.fillRect=function(...args){if(String(this.fillStyle).startsWith('rgba(150, 190, 220,'))window.__wetGlints.push({args,style:this.fillStyle});return fill.apply(this,args);};
  });
  for(const kind of ['oil','ice','puddle','flooded']){
   const fixture=await page.evaluate(kind=>{
    const p=Game.player(),L=Game.level(),[dx,dy]=Dungeon.DIRS[p.dir],x=p.x+dx*2,y=p.y+dy*2;
    L.twist=kind==='flooded'?'flooded':null;L.fields={};L.dressing=(L.dressing||[]).filter(d=>d.k!=='puddle');
    Game.renderState(performance.now()).fx.stains[L.depth]=[];
    if(kind==='puddle')L.dressing.push({k:'puddle',x,y,ox:0,oy:0,r:.34});
    if(kind==='oil'||kind==='ice')L.fields[x+','+y]={k:kind,until:Game.state().t+60000};
    window.__wetTarget={x,y};
    return{kind,x,y,puddleRadius:kind==='puddle'?.34:null,fields:JSON.parse(JSON.stringify(L.fields)),twist:L.twist};
   },kind);
   for(const calm of [false,true]){
    await page.evaluate(on=>Renderer.setCalm(on),calm);await page.waitForTimeout(400);
    await page.evaluate(()=>{window.__wetGlints=[];});await page.waitForTimeout(600);
    const file=`${width}-${kind}-${calm?'calm':'normal'}.png`;await page.screenshot({path:path.join(out,file)});
    const evidence=await page.evaluate(async()=>{const r=await import('/js/release.js');return{version:r.RELEASE_VERSION,build:r.BUILD_NUMBER,glintDraws:window.__wetGlints.length,uniqueGlints:new Set(window.__wetGlints.map(g=>JSON.stringify(g))).size,glintSamples:window.__wetGlints.slice(0,3),field:Game.fieldAt(window.__wetTarget?.x,window.__wetTarget?.y),status:Game.state().status};});
    if(kind==='oil'||kind==='ice')expect(evidence.field.k).toBe(kind);
    if(kind==='puddle'){expect(evidence.glintDraws).toBeGreaterThan(1);expect(evidence.uniqueGlints)[calm?'toBe':'toBeGreaterThan'](1);}
    records.push({width,calm,file,fixture,...evidence});
   }
  }
  // A supplied short-lived ice field expires on the unchanged native clock.
  const expiry=await page.evaluate(()=>{const p=Game.player(),[dx,dy]=Dungeon.DIRS[p.dir],x=p.x+dx*2,y=p.y+dy*2,L=Game.level();L.twist=null;L.fields={[x+','+y]:{k:'ice',until:Game.state().t+900}};return{x,y,started:Game.state().t,until:L.fields[x+','+y].until};});
  await expect.poll(()=>page.evaluate(({x,y})=>Game.fieldAt(x,y),expiry),{timeout:5000}).toBeNull();
  records.push({width,expiry,expiredAt:await page.evaluate(()=>Game.state().t)});
  expect(errors).toEqual([]);await context.close();
 }
 const sources=Object.fromEntries(['js/renderer.js','js/elements.js','js/looks.js','js/paintedcatalog.js','js/paintedworld.js'].map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
 fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({scope:'Running native renderer and updates, no image/renderer/update/clock substitutions. Supplied cleared monsters/safety, oil/ice fields with60s duration, canonical-sized .34 puddle, flooded twist. Normal/Calm glints observed by forwarding native fillRect calls. Short-lived supplied ice expires on native clock. Not unassisted gameplay or physical-device approval.',sources,records},null,2)+'\n');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
