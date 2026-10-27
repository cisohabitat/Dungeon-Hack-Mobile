'use strict';
// Executes the actual browser test's activation function, with its native game
// calls and pose predicates. Chromium slowdown is diagnostic, not Safari proof.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),{chromium}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server');
const {startGame,faceOpenGround,placeMonster,artReady,watchForErrors,expect}=require(root+'/test/browser/helpers');
const original=process.argv.includes('--original'),base='a15ec7d3ddfda027086e69759906d4b1c7a05397';
const file='test/browser/painted-world.spec.js',source=original?execFileSync('git',['show',base+':'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,file),'utf8');
const marker="for(const[cls,relic]of[['fighter','ninth_circle'],['mage','heartroot']])",prefix='const born=await page.evaluate(';
const start=source.indexOf(prefix,source.indexOf(marker))+prefix.length,end=source.indexOf(',t);',start);
if(start<prefix.length||end<0)throw Error('Native activation function was not found');
const actionSource=source.slice(start,end),activate=Function('return ('+actionSource+')')();
const out=path.resolve(process.env.STAFF_OUTPUT||path.join(__dirname,original?'original.json':'stable.json'));
const widths=(process.env.STAFF_WIDTHS||'320,390').split(',').map(Number),rates=(process.env.STAFF_RATES||'1,4,8').split(',').map(Number);
const pairs=[['fighter','ninth_circle'],['mage','heartroot']].filter(([cls])=>!process.env.STAFF_CLASSES||process.env.STAFF_CLASSES.split(',').includes(cls));
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),rows=[];
 const save=()=>fs.writeFileSync(out,JSON.stringify({scope:'Native fixture activation extracted from actual spec. Artificial Chromium slowdown; no Safari, balance or asset substitution claim.',mode:original?'original':'stable',runtimeCommit:base,activationSHA256:crypto.createHash('sha256').update(actionSource).digest('hex'),rows},null,2)+'\n');
 try{for(const width of widths)for(const[cls,relic]of pairs)for(const rate of rates){
  const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:{width,height:width===320?667:844}}),errors=watchForErrors(page);
  await startGame(page,{seed:'named-staff-release',cls});await faceOpenGround(page,3);
  const id=await page.evaluate(relic=>{const p=Game.player(),it={t:'staff',u:relic,q:1,e:1};p.hp=p.maxHp=999;p.inv.push(it);if(Game.canEquip(it)||!Game.equip(it))throw Error('Native equip failed');const id=Game.spriteFor(it);Assets.held(id,'rest',p.cls,true,false);return id;},relic);
  await expect.poll(()=>page.evaluate(({id,cls})=>Assets.held(id,'rest',cls,true,false)?.img.width,{id,cls}),{timeout:30000}).toBe(256);
  await page.evaluate(async({id,cls})=>{const{PAINTED}=await import('/js/paintedcatalog.js');window.__frames=Object.entries(PAINTED.held).filter(([,m])=>m.id===id&&m.cls===cls);for(const[,m]of window.__frames)Assets.held(id,m.pose,cls,m.two,m.lit);},{id,cls});
  await expect.poll(()=>page.evaluate(({id,cls})=>window.__frames.every(([,m])=>Assets.held(id,m.pose,cls,m.two,m.lit)?.img.width===256),{id,cls}),{timeout:30000}).toBe(true);
  await page.evaluate(({id,cls})=>{const map=new Map();for(const[key,m]of window.__frames)map.set(Assets.held(id,m.pose,cls,m.two,m.lit).img,key);const ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage;window.__namedStaff=[];ctx.drawImage=function(img,...args){if(map.has(img))window.__namedStaff.push({at:performance.now(),key:map.get(img)});return draw.call(this,img,...args);};},{id,cls});
  if(!original){await placeMonster(page,'orc',1,{hp:9999,maxHp:9999,nextAct:1e12,awake:true,spoke:true});await artReady(page);}
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate});
  for(const[i,type]of['scroll_map','potion_heal'].entries()){
   if(original||i)await placeMonster(page,'orc',1,{hp:9999,maxHp:9999,nextAct:1e12,awake:true,spoke:true});
   const painting=await page.evaluate(()=>Assets.painting()),born=await page.evaluate(activate,type);
   // The same five-second observation window as the real fixture, without
   // changing the game clock, simulation or renderer to retain a missed pose.
   await page.waitForTimeout(5000);
   const trace=await page.evaluate(()=>window.__namedStaff),drive=trace.some(f=>f.at>=born&&f.key.endsWith('-drive-one')),rest=trace.some(f=>f.at>born+1100&&f.key.endsWith('-rest-two'));
   rows.push({width,cls,relic,rate,type,painting,born,drive,rest,trace,errors:[...errors]});save();console.log(JSON.stringify({width,cls,rate,type,painting,drive,rest}));
  }
  expect(errors).toEqual([]);await page.close();
 }
 if(!original&&rows.some(r=>!r.drive||!r.rest))throw Error('A stable native overlap predicate failed');
 }finally{save();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
