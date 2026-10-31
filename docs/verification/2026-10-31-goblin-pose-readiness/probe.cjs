'use strict';
// Deliberately selected presentation phases, not a recreation of the CI clock.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),{chromium}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server');
const {startGame,artReady,watchForErrors,expect}=require(root+'/test/browser/helpers');
const files=['js/companion.js','js/motion.js','js/game.js','js/assets.js'];
const hashes=()=>Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
(async()=>{const before=hashes(),server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),records=[];
try{for(const viewport of [{width:390,height:844},{width:320,height:667}]){
 const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport}),page=await context.newPage(),errors=watchForErrors(page);
 await page.addInitScript(()=>{for(const k of ['sound','samples','prelude'])localStorage.setItem('deepdelve.'+k,'off');});await startGame(page,{seed:'goblin-ui',cls:'Fighter'});
 await page.evaluate(()=>{const p=Game.player(),G=Game.state();Game.level().monsters=[];Game.level().npcs=[];G.companion={kind:'goblin',name:'Pose probe',depth:G.depth,x:p.x,y:p.y,hp:9,maxHp:9,mode:'follow',nextAct:1e12,kills:0,joined:G.depth};});
 await artReady(page,{scrag:['blink','windup'],dog:['blink','windup']});
 const result=await page.evaluate(()=>{
  const G=Game.state(),c=Game.companion(),art=Assets.sprites.scrag,cycle=Math.ceil((performance.now()+311)/3700)*3700-311;
  const read=(at,expected)=>{const rs=Game.renderState(at),image=expected==='idle'?art:art.blink;return {at,old:rs.sprites.some(s=>s.img===art||s.img===art.windup),exact:rs.sprites.some(s=>s.img===image),pose:rs.sprites.some(s=>s.img===art.blink)?'blink':rs.sprites.some(s=>s.img===art)?'idle':rs.sprites.some(s=>s.img===Assets.sprites.dog||s.img===Assets.sprites.dog.blink)?'hound':'absent'};};
  const idle=read(cycle+200,'idle'),blink=read(cycle+64,'blink');
  let hound,absent;try{c.kind='hound';hound={idle:read(cycle+200,'idle'),blink:read(cycle+64,'blink')};G.companion=null;absent={idle:read(cycle+200,'idle'),blink:read(cycle+64,'blink')};}finally{G.companion=c;c.kind='goblin';}
  return {prelude:Game.preludeOn(),period:3700,idleOffset:200,blinkOffset:64,idle,blink,hound,absent};
 });
 expect(result.prelude).toBe(false);expect(result.idle).toMatchObject({old:true,exact:true,pose:'idle'});expect(result.blink).toMatchObject({old:false,exact:true,pose:'blink'});
 for(const row of [result.hound.idle,result.hound.blink,result.absent.idle,result.absent.blink])expect(row.exact||row.old).toBe(false);
 expect(errors).toEqual([]);records.push({viewport,...result});await context.close();
}
expect(hashes()).toEqual(before);fs.writeFileSync(path.join(__dirname,'probe.json'),JSON.stringify({scope:'Native Game.renderState with supplied goblin/hound/absent companion fixtures and explicit presentation sample times. No update, renderer, clock or image-function replacement. Counterexample to the old predicate, not a claim to reproduce the original CI-selected pose/time. No gameplay or balance change.',sources:before,records},null,2)+'\n');console.log(JSON.stringify(records,null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
