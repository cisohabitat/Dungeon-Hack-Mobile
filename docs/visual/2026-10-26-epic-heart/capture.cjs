'use strict';
// Native final-floor/Pack/encounter captures with supplied positions/resources.
// No image substitutions and no frozen or replacement renderer.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../../..');
const {chromium}=require(path.join(root,'node_modules/playwright'));
const {serve}=require(path.join(root,'test/server'));
const {startGame,descendTo,clearBoons,faceOpenGround,watchForErrors,expect}=require(path.join(root,'test/browser/helpers'));
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const evidence=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  for(const width of[390,320])for(const ending of['take','keep']){
   const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`,viewport:{width,height:width===390?844:667},serviceWorkers:'block',acceptDownloads:true});
   const page=await context.newPage(),errors=watchForErrors(page);
   await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',prelude:'off',calm:'1',tipsOff:'1',firstSeen:'1'}))localStorage.setItem('deepdelve.'+k,v);});
   await startGame(page,{seed:'end-won',levels:'4',name:'Mira'});
   await page.evaluate(()=>{Game.player().maxHp=900;Game.player().hp=900;});
   expect(await descendTo(page,4)).toBe(4);await clearBoons(page);await faceOpenGround(page,3);
   const metrics=await page.evaluate(async()=>{
    Game.recordRuns(false);const L=Game.level(),p=Game.player(),D=Dungeon.DIRS[p.dir];L.monsters=[];L.npcs=[];
    const x=p.x+D[0],y=p.y+D[1];L.items={[`${x},${y}`]:[{t:'artifact',q:1,e:0}]};
    const art=Assets.sprites.artifact;void art.url;
    const {Dice,Odds}=await import('/js/rng.js');const before=JSON.stringify(Game.state()),dice=[Dice.s,Odds.s],rs=Game.renderState(performance.now()),s=rs.sprites.find(s=>s.img===art);
    if(!s||s.scale!==.4||!s.onFloor)throw Error('Native Heart floor route/scale changed');
    if(before!==JSON.stringify(Game.state())||Dice.s!==dice[0]||Odds.s!==dice[1])throw Error('Reading the Heart changed state/dice '+JSON.stringify({keys:Object.keys(Game.state()).filter(k=>JSON.stringify(JSON.parse(before)[k])!==JSON.stringify(Game.state()[k])),beforeDice:dice,afterDice:[Dice.s,Odds.s]}));
    return{scale:s.scale,onFloor:s.onFloor,state_read_unchanged:true,dice_read_unchanged:true};
   });
   await expect.poll(()=>page.evaluate(()=>Assets.sprites.artifact.levels[0].width)).toBe(256);
   await page.screenshot({path:path.join(__dirname,`${width}-${ending}-floor.png`)});
   await page.evaluate(()=>{Game.player().inv=[{t:'artifact',q:1,e:0}];});
   await page.click('[data-open="inv"]');await page.locator('#inv-grid button.slot.filled').first().click();
   await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#ov-inv')).opacity)>=.999);
   const pack=await page.evaluate(async()=>{
    const image=document.querySelector('#item-detail .item-showcase img'),slot=document.querySelector('#inv-grid button.slot.filled img');
    await slot.decode();if(image){await image.decode();await Promise.all(image.getAnimations().map(a=>a.finished));}
    if(slot.getAttribute('src')!==Assets.sprites.artifact.url)throw Error('Pack Heart does not use native art');
    return{slot:slot.getAttribute('src'),detail:image?.getAttribute('src'),name:document.querySelector('#item-detail-title').textContent};
   });
   await page.screenshot({path:path.join(__dirname,`${width}-${ending}-pack.png`)});
   await page.click('#ov-inv [data-close]');await page.waitForFunction(()=>!document.querySelector('#ov-inv').classList.contains('closing'));
   await page.evaluate(()=>{
    const G=Game.state(),p=Game.player(),L=Game.level(),entry=Object.entries(L.items).find(([,items])=>items.some(i=>i.t==='artifact'));
    G.threads.smithway=true;p.inv=[{t:'quench',q:1,e:0}];[p.x,p.y]=entry[0].split(',').map(Number);Game.takeItem(entry[1][0]);
   });
   await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
   await expect(page.locator('#enc-art')).toHaveAttribute('src','img/world/heart_dais.webp');
   await page.locator('#enc-art').evaluate(async image=>{await image.decode();await Promise.all(image.getAnimations().map(a=>a.finished));});
   await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#ov-encounter')).opacity)>=.999);
   await page.screenshot({path:path.join(__dirname,`${width}-${ending}-choice.png`)});
   await page.waitForTimeout(700);await page.locator('.enc-choice').nth(ending==='take'?2:1).click();
   await expect(page.locator('#screen-end')).toBeVisible();
   const[download]=await Promise.all([page.waitForEvent('download'),page.click('#end-card')]);
   await download.saveAs(path.join(__dirname,`${width}-${ending}-share.png`));
   await page.screenshot({path:path.join(__dirname,`${width}-${ending}-end.png`)});
   if(errors.length)throw Error(errors.join('\n'));
   evidence.push({width,ending,generated_depth:4,fixture:'Supplied defeated keeper, floor item position, inventory and ending knowledge; recording off for snapshot neutrality; native controls, updates and renderer.',...metrics,pack,console_errors:errors});
   await context.close();
  }
  fs.writeFileSync(path.join(__dirname,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');console.log('Four native Heart sessions captured at390/320px.');
 }finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})().catch(error=>{console.error(error);process.exitCode=1;});
