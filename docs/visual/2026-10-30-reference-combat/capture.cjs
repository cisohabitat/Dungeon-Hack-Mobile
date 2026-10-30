'use strict';
// Native running combat; supplied enemies/resources, never an unassisted run.
const crypto=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../../..');
const {chromium}=require(root+'/node_modules/playwright');
const {serve}=require(root+'/test/server');
const {startGame,faceOpenGround,placeMonster,artReady,watchForErrors,expect}=require(root+'/test/browser/helpers');
(async()=>{
 const out=path.join(__dirname,'native');fs.mkdirSync(out,{recursive:true});
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const records=[];
 try{for(const width of[320,390])for(const id of['orc','skarrow','heartforged']){
  const context=await browser.newContext({viewport:{width,height:width===320?667:844},baseURL:`http://127.0.0.1:${server.address().port}`});
  const page=await context.newPage(),errors=watchForErrors(page);
  await page.addInitScript(()=>{localStorage.setItem('deepdelve.sound','on');localStorage.setItem('deepdelve.samples','off');localStorage.setItem('deepdelve.prelude','off');});
  await startGame(page,{seed:'combat-clarity'});await page.evaluate(()=>{Game.level().monsters=[];Game.player().hp=Game.player().maxHp=9999;Music.stop();});
  await faceOpenGround(page,4);await artReady(page);
  await placeMonster(page,id,id==='skarrow'?3:1,{hp:999,maxHp:999,spoke:true,nextAct:1e12});
  const record=await page.evaluate(async()=>{
   const G=Game.state(),m=Game.level().monsters[0],rows=[],sounds=[];
   Sound.unlock();const {ctx,master}=Sound.audio();await ctx.resume();
   const dest=ctx.createMediaStreamDestination();master.connect(dest);
   const canvas=document.querySelector('#view');const stream=canvas.captureStream(15);
   for(const t of dest.stream.getAudioTracks())stream.addTrack(t);
   const rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus'}),chunks=[];
   rec.ondataavailable=e=>chunks.push(e.data);rec.start();
   Sound.listen((name,v)=>sounds.push({name,...v,at:performance.now()}));
   m.nextAct=G.t;const begin=performance.now();let last='';
   while(performance.now()-begin<10000){await new Promise(r=>requestAnimationFrame(r));
    const now=performance.now(),s=Game.renderState(now).sprites.find(s=>s.maxHp===999);
    const state=m.windup?'windup':s?.reaction?'reaction':'idle';
    if(state!==last){rows.push({state,at:now,move:m.windup?.move||null,lungeAt:m.lungeAt,pixels:canvas.toDataURL()});last=state;}
   }
   Sound.listen(null);await new Promise(r=>{rec.onstop=r;rec.stop();});master.disconnect(dest);stream.getTracks().forEach(t=>t.stop());
   const video=await new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result);reader.readAsDataURL(new Blob(chunks,{type:rec.mimeType}));});
   return{rows,sounds,video,status:G.status,hp:Game.player().hp};
  });
  const label=width+'-'+id;
  fs.writeFileSync(path.join(out,label+'.webm'),Buffer.from(record.video.slice(record.video.indexOf(';base64,')+8),'base64'));delete record.video;
  for(const[rowIndex,row]of record.rows.entries()){if(rowIndex>=6&&!row.move){delete row.pixels;continue;}row.file=label+'-'+rowIndex+'.png';fs.writeFileSync(path.join(out,row.file),Buffer.from(row.pixels.split(',')[1],'base64'));delete row.pixels;}
  expect(record.status).toBe('playing');expect(record.sounds.some(s=>s.name==='windup'||s.name==='special')).toBe(true);expect(errors).toEqual([]);
  records.push({width,id,...record,errors});await context.close();console.log(label+' captured');
 }
 fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({version:JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,codeHashes:Object.fromEntries(['js/foes.js','js/motion.js','js/sound.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')])),scope:'Native running frames and actual WebAudio master tap (before output limiter). Synth fallback selected; supplied hero HP/enemies/positions/spoken flag. No simulation/dice/image substitution. Not physical-device or human listening approval.',records},null,2)+'\n');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
