// Observe the actual running loop. No source, images, renderer or clocks are replaced.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../../..'),{chromium}=require(root+'/node_modules/playwright'),{startGame,artReady,watchForErrors}=require(root+'/test/browser/helpers');
const url=process.env.TREASURE_LIVE_URL||'https://dungeon-hack-mobile.vercel.app',sha=process.env.TREASURE_LIVE_SHA;
if(!/^[a-f0-9]{40}$/.test(sha||''))throw Error('Set TREASURE_LIVE_SHA to the deployed commit');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const ctx=await browser.newContext({baseURL:url,viewport:{width:320,height:667}}),page=await ctx.newPage(),errors=watchForErrors(page);
 await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off',firstSeen:'1',tipsOff:'1',calm:'1',textSize:'4'}))localStorage.setItem('deepdelve.'+k,v);});
 await startGame(page,{seed:'aaa3-generated-rooms',levels:'12',name:'Treasure inspection',buy:true});
 const setup=await page.evaluate(()=>{
  Game.setTesting({hp:true});Game.testFloor(4);const L=Game.level(),entry=Object.entries(L.items).find(([,v])=>v.some(it=>it.u));if(!entry)throw Error('No generated relic');
  const [x,y]=entry[0].split(',').map(Number),poses=[];
  for(let dir=0;dir<4;dir++)for(const dist of [2,3,1]){const[dx,dy]=Dungeon.DIRS[dir],px=x-dx*dist,py=y-dy*dist;if(L.tiles[py*L.w+px]!==Dungeon.T.FLOOR||L.monsters.some(m=>m.x===px&&m.y===py)||L.npcs.some(n=>n.x===px&&n.y===py)||L.dressing.some(d=>d.x===px&&d.y===py&&['barrel','crate','urn'].includes(d.k)))continue;let clear=true;for(let k=1;k<dist;k++)if(L.tiles[(py+dy*k)*L.w+px+dx*k]!==Dungeon.T.FLOOR)clear=false;if(clear)poses.push({x:px,y:py,dir});}
  if(!poses.length)throw Error('No clear inspection pose');Object.assign(Game.player(),poses[0]);Game.save(true);if(!Game.load())throw Error('Inspection load failed');return{x,y,pose:poses[0],relic:entry[1].find(it=>it.u).u};
 });
 await artReady(page);
 await page.waitForFunction(({x,y})=>Game.renderState(performance.now()).sprites.some(s=>(s.x|0)===x&&(s.y|0)===y&&s.stillYOff!=null&&s.img.w===256),setup);
 const proof=await page.evaluate(async({setup,sha})=>{
  if(document.querySelector('meta[name="commit"]').content!==sha||!UI.version().startsWith('0.9.75 (')||!Renderer.calm||Game.state().status!=='playing')throw Error('Wrong release or inactive Calm view');
  const ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage,tops=[],offsets=[],cameras=[],start=performance.now(),gameTime=Game.state().t;
  const images=new Set(Game.renderState(performance.now()).sprites.find(s=>(s.x|0)===setup.x&&(s.y|0)===setup.y&&s.stillYOff!=null).img.levels);
  ctx.drawImage=function(img,...args){if(images.has(img))tops.push(args[5]);return draw.call(this,img,...args);};
  try{while(performance.now()-start<1100){await new Promise(r=>requestAnimationFrame(r));const rs=Game.renderState(performance.now()),s=rs.sprites.find(s=>(s.x|0)===setup.x&&(s.y|0)===setup.y&&s.stillYOff!=null);if(!s)throw Error('Relic disappeared');offsets.push(s.yOff);cameras.push([rs.cam.x,rs.cam.y,rs.cam.angle]);}}
  finally{ctx.drawImage=draw;}
  if(tops.length<5||Math.max(...tops)-Math.min(...tops)>1e-7||new Set(cameras.map(c=>JSON.stringify(c))).size!==1||Game.state().t<=gameTime)throw Error('Native probe was not a steady, running Calm view: '+JSON.stringify({draws:tops.length,tops,cameras}));
  return{version:UI.version(),commit:sha,status:Game.state().status,calm:Renderer.calm,draws:tops.length,topSpan:Math.max(...tops)-Math.min(...tops),underlyingBobSpan:Math.max(...offsets)-Math.min(...offsets),elapsedMs:performance.now()-start,gameTimeAdvanced:Game.state().t-gameTime,theme:THEMES[Game.level().theme].name};
 },{setup,sha});
 if(errors.length)throw Error(errors.join('\n'));const out=process.env.TREASURE_LIVE_OUT||'/tmp/treasure-live';fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'calm-relic.png')});fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify({url,setup,...proof,scope:'Actual running loop with forwarded drawing calls, supplied legal inspection pose and safety HP; not unassisted play or physical-device evidence.'},null,2)+'\n');console.log(JSON.stringify(proof));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
