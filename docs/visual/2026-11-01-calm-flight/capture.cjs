const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../..'),{chromium}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server'),{startGame,artReady,watchForErrors}=require(root+'/test/browser/helpers');
const historical=process.env.FLIGHT_BASELINE==='1',oldSha='1c27ef7e7a13a6884fe5447749700fd72fe36b85',motion=historical?require('child_process').execFileSync('git',['show',oldSha+':js/motion.js'],{cwd:root,encoding:'utf8'}):fs.readFileSync(root+'/js/motion.js','utf8');
const out=process.env.FLIGHT_OUT||path.join(__dirname,'native');fs.mkdirSync(out,{recursive:true});
const cases=[{key:'bat',seed:'flight-native-0',depth:1,id:'bat',uid:1004},{key:'moth',seed:'flight-native-0',depth:1,id:'moth',uid:1007},{key:'orla',seed:'flight-native-0',depth:6,id:'orla',uid:6018},{key:'wraith',seed:'flight-native-0',depth:7,id:'wraith',uid:7012},{key:'bat-group',seed:'flight-native-1',depth:2,id:'bat',uid:2002}];
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const records=[];try{
for(const c of cases.filter(c=>!process.env.FLIGHT_KEYS||process.env.FLIGHT_KEYS.split(',').includes(c.key))){
 const width=Number(process.env.FLIGHT_WIDTH||390),calm=process.env.FLIGHT_CALM==='1',height=width===740?360:width===320?667:844;
 const ctx=await browser.newContext({baseURL:process.env.FLIGHT_URL||`http://127.0.0.1:${server.address().port}`,viewport:{width,height}}),page=await ctx.newPage(),errors=watchForErrors(page);
 await page.addInitScript(calm=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off',firstSeen:'1',tipsOff:'1',...(calm?{calm:'1',textSize:'4'}:{})}))localStorage.setItem('deepdelve.'+k,v);},calm);
 if(historical)await page.route('**/js/motion.js',r=>r.fulfill({contentType:'application/javascript',body:motion}));
 await startGame(page,{seed:c.seed,levels:'12',name:'Flight inspection',buy:true});
 if(process.env.FLIGHT_EXPECT_SHA)await page.evaluate(sha=>{if(document.querySelector('meta[name="commit"]').content!==sha)throw Error('Wrong live commit');},process.env.FLIGHT_EXPECT_SHA);
 const setup=await page.evaluate(c=>{
  Game.setTesting({hp:true});if(c.depth!==1)Game.testFloor(c.depth);const L=Game.level(),m=L.monsters.find(m=>m.uid===c.uid&&m.id===c.id);if(!m)throw Error('Generated target missing');
  const floor=(x,y)=>x>=0&&y>=0&&x<L.w&&y<L.h&&[Dungeon.T.FLOOR,Dungeon.T.DOOR_OPEN].includes(L.tiles[y*L.w+x]),blocked=(x,y)=>L.dressing.some(d=>d.x===x&&d.y===y&&['barrel','crate','urn'].includes(d.k));const poses=[];
  for(let dir=0;dir<4;dir++)for(const distance of [4,3,2]){const[dx,dy]=Dungeon.DIRS[dir],x=m.x-dx*distance,y=m.y-dy*distance;if(!floor(x,y)||blocked(x,y)||L.monsters.some(q=>q.x===x&&q.y===y)||L.npcs.some(q=>q.x===x&&q.y===y))continue;let clear=true;for(let k=1;k<distance;k++)if(!floor(x+dx*k,y+dy*k)||blocked(x+dx*k,y+dy*k))clear=false;if(clear)poses.push({x,y,dir,distance});}
  if(!poses.length)throw Error('No legal inspection pose');const pose=poses[0];Object.assign(Game.player(),{x:pose.x,y:pose.y,dir:pose.dir});Game.save(true);if(!Game.load())throw Error('Inspection load failed');return{pose,target:{id:m.id,uid:m.uid,x:m.x,y:m.y,n:1+(m.pack?.length||0)},theme:THEMES[L.theme].name};
 },c);
 // Pause through the player's real control before waiting on art. The drawing
 // clock keeps advancing; AI and game time pause. No creature stats are edited.
 await page.locator('[data-open="menu"]').click();await page.waitForFunction(()=>UI.paused());await artReady(page);
 await page.evaluate(async uid=>{window.__flightPaint=(await import('/js/paintedcreatures.js')).paintedCreature;window.__flightBase=()=>{const m=Game.level().monsters.find(m=>m.uid===uid),b=Assets.sprites[MONSTERS[m.id].sprite],t=m.elite||(MONSTERS[m.id].named?m.id:'');return t&&b.elite?.[t]||b;};},c.uid);
 await page.waitForFunction(()=>{const b=window.__flightBase();return window.__flightPaint(b)!==b;},null,{timeout:45000});await page.waitForTimeout(300);
 const probe=await page.evaluate(async()=>{
  const base=window.__flightBase(),frames=[base,...['stepA','stepB','blink','windup','special','strike','recover','hurt'].map(k=>base[k]).filter(Boolean)],images=new Set();
  for(const frame of frames)for(const art of [frame,window.__flightPaint(frame)])for(const img of art.levels)images.add(img);
  const ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage,start=performance.now(),gameTime=Game.state().t,rows=[];let calls=[];
  ctx.drawImage=function(img,...args){if(images.has(img))calls.push(args[5]);return draw.call(this,img,...args);};
  try{while(performance.now()-start<1150){await new Promise(r=>requestAnimationFrame(r));if(calls.length){const rs=Game.renderState(performance.now());rows.push({at:performance.now(),top:Math.min(...calls),draws:calls.length,cam:[rs.cam.x,rs.cam.y,rs.cam.angle],offsets:rs.sprites.filter(s=>!s.onFloor&&s.img&&images.has(s.img.levels[0])).map(s=>({yOff:s.yOff,stillYOff:s.stillYOff}))});calls=[];}}}finally{ctx.drawImage=draw;}
  if(rows.length<5||!UI.paused()||Game.state().t!==gameTime||new Set(rows.map(r=>JSON.stringify(r.cam))).size!==1)throw Error('Invalid native pause probe');
  return{pausedThroughMenu:true,gameTimeStart:gameTime,realElapsed:performance.now()-start,gameTimeAdvanced:Game.state().t-gameTime,topSpan:Math.max(...rows.map(r=>r.top))-Math.min(...rows.map(r=>r.top)),rows};
 });
 if(c.id==='bat'){if(calm&&!historical&&probe.topSpan>1e-7)throw Error('Calm bat still bobs: '+probe.topSpan);if((!calm||historical)&&probe.topSpan<.25)throw Error('Normal/reference probe did not exercise bobbing');}
 await page.screenshot({path:path.join(out,c.key+'-paused.png')});await page.locator('#ov-menu .close').click();
 if(await page.locator('#ov-boss.open').count())await page.locator('#ov-boss .big[data-close]').click();await page.waitForTimeout(200);await page.screenshot({path:path.join(out,c.key+'-play.png')});
 const actions=[];for(const action of ['right','left']){const before=await page.evaluate(()=>({x:Game.player().x,y:Game.player().y,dir:Game.player().dir}));await page.evaluate(action=>Game.input(action),action);await page.waitForTimeout(400);const after=await page.evaluate(()=>({x:Game.player().x,y:Game.player().y,dir:Game.player().dir}));const file=c.key+'-'+action+'.png';await page.screenshot({path:path.join(out,file)});actions.push({action,before,after,changed:JSON.stringify(before)!==JSON.stringify(after),file});}
 const state=await page.evaluate(()=>({status:Game.state().status,paused:UI.paused(),time:Game.state().t,shown:Renderer.shown,intent:Renderer.intent,monsters:Game.level().monsters.map(m=>({id:m.id,uid:m.uid,x:m.x,y:m.y,awake:m.awake,windup:m.windup,pack:1+(m.pack?.length||0)}))}));
 if(state.status!=='playing'||state.paused||state.time<=probe.gameTimeStart||errors.length)throw Error('Native resumed view failed: '+errors.join('\n'));
 records.push({...c,width,height,calm,identity:await page.evaluate(()=>({version:UI.version(),commit:document.querySelector('meta[name="commit"]').content})),url:process.env.FLIGHT_URL||'local controlled server',setup,probe,actions,state,motionSha256:crypto.createHash('sha256').update(motion).digest('hex'),sourceHashes:Object.fromEntries(['renderer.js','game.js','data.js','paintedcreatures.js','release.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(root+'/js/'+f)).digest('hex')])),variant:historical?'Historical v0.9.75 motion module routed; shared current dependencies/metadata, not an untouched historical build':'Prepared current runtime; no source module routing',scope:'Generated creatures; supplied legal hero pose and safety HP; real Menu pause with running rendering clock, followed by native resume/turn inputs. Not unassisted play, balance or physical-device evidence.'});
 await ctx.close();fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(records,null,2)+'\n');console.log(c.key+' captured');
}
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});
