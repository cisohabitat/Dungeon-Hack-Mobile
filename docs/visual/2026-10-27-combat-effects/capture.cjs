'use strict';
// Native actions/updates on supplied enemies and hero resources. No image,
// renderer, simulation or dice substitution; selected frames are canvas exports.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../../..'),{chromium}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server');
const {startGame,faceOpenGround,placeMonster,artReady,watchForErrors,expect}=require(root+'/test/browser/helpers');
const offline=process.env.COMBAT_OFFLINE==='1',out=path.resolve(process.env.COMBAT_OUTPUT||path.join(__dirname,offline?'offline':'native'));
fs.mkdirSync(out,{recursive:true});
const groups=process.env.COMBAT_ACTIONS?{fighter:process.env.COMBAT_ACTIONS.split(',')}:offline?{mage:['cone_cold','scroll_fire']}:{fighter:['longsword','mace','longbow','death'],mage:['magic_missile','burning_hands','cone_cold','lightning','scroll_fire'],cleric:['smite','flame_strike'],druid:['thorn_lash','insect_plague']};
(async()=>{let online=true;const server=http.createServer((req,res)=>{if(!online){req.socket.destroy();return;}serve(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),records=[];
try{for(const width of (process.env.COMBAT_WIDTHS?.split(',').map(Number)||(offline?[320,390]:[320,390,740])))for(const[cls,actions]of Object.entries(groups).filter(([cls])=>!process.env.COMBAT_CLASSES||process.env.COMBAT_CLASSES.split(',').includes(cls))){
 online=true;const context=await browser.newContext({baseURL:process.env.COMBAT_BASE_URL||`http://127.0.0.1:${server.address().port}`,viewport:{width,height:width===740?360:width===320?667:844}}),page=await context.newPage(),errors=watchForErrors(page);
 await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});
 await startGame(page,{seed:'combat-clarity',cls,name:'Combat review'});
 await page.evaluate(()=>{Game.level().monsters=[];Game.player().level=10;Game.player().hp=Game.player().maxHp=999;Game.player().sp=Game.player().maxSp=999;Game.save(true);});
 if(offline){await artReady(page);await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));await expect(page.locator('#offline-status')).toHaveAttribute('data-core','true',{timeout:120000});await expect(page.locator('#offline-status')).toHaveAttribute('data-voice','ready',{timeout:120000});online=false;await context.setOffline(true);await page.reload();await page.click('#btn-continue');await expect(page.locator('#screen-game')).toBeVisible();}
 expect(await faceOpenGround(page,3)).toBeGreaterThanOrEqual(3);await artReady(page);await page.waitForTimeout(2800);
 for(const calm of[false,true])for(const action of actions){
  await page.evaluate(({calm,action})=>{localStorage.setItem('deepdelve.calm',calm?'1':'0');document.body.classList.toggle('calm',calm);Renderer.setCalm(calm);Game.level().monsters=[];const p=Game.player();p.nextAttack=0;p.sp=999;Game.state().blowGate=0;if((['longsword','mace','longbow'].includes(action)||action.startsWith('death')))p.eq.weapon={t:action.startsWith('death')?'longsword':action,q:1,e:0};},{calm,action});
  const target=await placeMonster(page,action.startsWith('death-')?action.slice(6):'orc',1,{hp:action.startsWith('death')?1:999,maxHp:999,nextAct:1e12,spoke:true});expect(target).not.toBeNull();
  if(action==='cone_cold'||action==='scroll_fire')await placeMonster(page,'orc',2,{hp:999,maxHp:999,nextAct:1e12,spoke:true});
  const label=[width,cls,action,calm?'calm':'normal'].join('-');
  const result=await page.evaluate(async action=>{
   const p=Game.player(),L=Game.level(),target=L.monsters[0],before={hp:target.hp,sp:p.sp},rows=[];
   let cast=true;
   if((['longsword','mace','longbow'].includes(action)||action.startsWith('death'))){
    for(let tries=0;tries<40&&target.hp===before.hp;tries++){p.nextAttack=0;Game.state().blowGate=0;Game.input('attack');if(target.hp===before.hp)await new Promise(r=>setTimeout(r,action==='longbow'?380:35));}
   }else if(action==='scroll_fire'){const it={t:action,q:1,e:0};p.inv.push(it);Game.useItem(it);cast=!p.inv.includes(it);}
   else cast=!!Game.castSpell(Game.knownSpells().find(s=>s.id===action));
   for(let i=0;i<(action==='scroll_fire'?100:60);i++){await new Promise(r=>requestAnimationFrame(r));const now=performance.now(),rs=Game.renderState(now);rows.push({i,now,hp:target.hp,shown:Renderer.shown,numbers:Renderer.numbers,effects:rs.fx.spells.map(s=>({style:s.style,born:s.born,until:s.until,impact:s.impact})),corpses:rs.fx.corpses.length,reactions:rs.sprites.filter(s=>s.reaction||s.impact||s.death).map(s=>({reaction:!!s.reaction,impact:s.impact,death:s.death})),pixels:[0,18,36,54,72,90].includes(i)?document.querySelector('#view').toDataURL():null});}
   return{cast,before,after:{hp:target.hp,sp:p.sp,status:Game.state().status},rows};
  },action);
  expect(result.cast).toBe(true);expect(result.after.hp).toBeLessThan(result.before.hp);expect(result.after.status).toBe('playing');if(action.startsWith('death'))expect(result.after.hp).toBeLessThanOrEqual(0);
  for(const row of result.rows)if(row.pixels){row.file=label+'-'+row.i+'.png';fs.writeFileSync(path.join(out,row.file),Buffer.from(row.pixels.split(',')[1],'base64'));delete row.pixels;}
  await page.screenshot({path:path.join(out,label+'-after.png')});records.push({width,cls,action,calm,offline,...result});await page.waitForTimeout(1100);console.log(label+' passed');
 }
 expect(errors).toEqual([]);await context.setOffline(false);await context.close();online=true;
}
fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({version:JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,scope:'Native actions and rendering; level10/resources/stationary enemy placement supplied; attack recovery reset between attempts, native hit dice retained; no image or simulation substitution. Fresh installed offline profiles, not upgrade evidence.',records},null,2)+'\n');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
