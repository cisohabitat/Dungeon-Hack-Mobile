'use strict';
// Native steps onto supplied traps. Low Wisdom is a labelled fixture to expose
// their effects; no dice, trap handler, renderer or art is replaced.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),root=path.resolve(__dirname,'../../..');
const {chromium}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server');
const {startGame,faceOpenGround,watchForErrors,expect}=require(root+'/test/browser/helpers');
const out=path.join(__dirname,'traps');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),records=[];
 try{for(const width of[320,390,740])for(const kind of['dart','needle','pit','alarm','snare']){
  const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:{width,height:width===740?360:844}}),page=await context.newPage(),errors=watchForErrors(page);
  await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});
  await startGame(page,{seed:'interaction-trap-'+kind});expect(await faceOpenGround(page,2)).toBeGreaterThanOrEqual(2);
  await page.evaluate(kind=>{const L=Game.level(),p=Game.player(),[dx,dy]=Dungeon.DIRS[p.dir],x=p.x+dx,y=p.y+dy,key=x+','+y;L.monsters=[];L.npcs=[];L.dressing=[];L.items={};L.puzzle=null;L.fields={};L.traps={[key]:kind};L.snares=kind==='snare'?{[key]:true}:{};delete L.trapsKnown;delete L.trapSpared;p.boons=[];p.stats.wis=1;p.hp=p.maxHp=999;window.__trapSquare={x,y,key};},kind);
  await page.waitForTimeout(2700);await page.screenshot({path:path.join(out,`${width}-${kind}-before.png`)});
  const rows=await page.evaluate(async()=>{Game.input('forward');const rows=[];for(let i=0;i<8;i++){await new Promise(r=>requestAnimationFrame(r));const fx=Game.renderState(performance.now()).fx;rows.push({index:i,kind:fx.trapKind,at:fx.trapAt,dodged:fx.trapDodged,pixels:[0,3,7].includes(i)?document.querySelector('#view').toDataURL():null});}return rows;});
  for(const row of rows)if(row.pixels){row.file=`${width}-${kind}-${row.index}.png`;fs.writeFileSync(path.join(out,row.file),Buffer.from(row.pixels.split(',')[1],'base64'));delete row.pixels;}
  await page.waitForTimeout(1800);await page.screenshot({path:path.join(out,`${width}-${kind}-after.png`)});
  const final=await page.evaluate(()=>{const L=Game.level(),p=Game.player(),q=window.__trapSquare;return{trap:!!L.traps[q.key],snare:!!L.snares[q.key],atSquare:p.x===q.x&&p.y===q.y,hp:p.hp,status:Game.state().status};});
  expect(final.trap).toBe(false);expect(final.snare).toBe(false);expect(final.atSquare).toBe(true);expect(final.status).toBe('playing');expect(rows[0].at).toBeGreaterThan(0);expect(errors).toEqual([]);
  records.push({width,kind,rows,final,errors,scope:'Native forward command/updates/rendering. Supplied nearby trap, 999 HP and Wisdom 1; seeded spotting/dodging remain active.'});await context.close();console.log(width+' '+kind+' passed');
 }fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(records,null,2)+'\n');}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
