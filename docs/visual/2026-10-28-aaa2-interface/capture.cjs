'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const {chromium,devices,expect}=require(path.join(root,'node_modules/@playwright/test'));
const AxeBuilder=require(path.join(root,'node_modules/@axe-core/playwright')).default;
const {start}=require(path.join(root,'test/server'));
const {uiReady,watchForErrors}=require(path.join(root,'test/browser/helpers'));
const TAGS=['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'];
(async()=>{
 const server=await start(4198),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const evidence={version:require(path.join(root,'package.json')).version,native:[],fixtures:[],axe:[]};
 const save=async(page,name,audit=false)=>{await uiReady(page);await page.screenshot({path:path.join(__dirname,name+'.png')});if(audit){const r=await new AxeBuilder({page}).withTags(TAGS).analyze(),bad=r.violations.filter(v=>['serious','critical'].includes(v.impact));evidence.axe.push({screen:name,seriousCritical:bad});assert.equal(bad.length,0,JSON.stringify(bad));}};
 const begin=async page=>{
  await page.goto('http://127.0.0.1:4198');await page.waitForFunction(()=>!!window.UI);
  if(await page.locator('#ft-close').isVisible())await page.click('#ft-close');
  await page.click('#btn-new');await page.locator('#c-customise > summary').click();
  await page.fill('#c-seed','aaa2-equipment');await page.locator('.class-card').first().click();
  await page.click('#c-begin');await page.click('#pro-begin');await expect(page.locator('#screen-game')).toBeVisible();
 };
 try{
  const context=await browser.newContext({...devices['Pixel 5'],viewport:{width:390,height:844}});
  try{
   const page=await context.newPage(),errors=watchForErrors(page);
   await page.goto('http://127.0.0.1:4198');await page.waitForFunction(()=>!!window.UI);await save(page,'native-first-visit');
   await page.click('#ft-close');await save(page,'native-title',true);
   await page.click('#btn-new');await save(page,'native-create',true);
   await page.locator('#c-customise > summary').click();await page.fill('#c-seed','aaa2-equipment');
   await page.click('#c-begin');await page.click('#pro-begin');
   for(const [id,name]of [['inv','pack'],['char','hero'],['journal','journal']]){
    await page.click(`[data-open="${id}"]`);if(id==='inv'){
      await expect(page.locator('.equipment-figure')).toHaveClass(/painted/);
      expect(await page.evaluate(()=>!!document.activeElement.closest('#ov-inv')&&!document.activeElement.closest('svg'))).toBe(true);
    }
    await save(page,'native-'+name,true);await page.locator(`#ov-${id} [data-close]`).first().click();
   }
   assert.deepEqual(errors,[]);evidence.native.push({viewport:{width:390,height:844},errors,scope:'Actual fresh controls and shipped assets/recordings; no inventory, image, renderer, clock or enemy substitutions.'});
  }finally{await context.close();}
  for(const viewport of [{width:320,height:667},{width:390,height:844},{width:740,height:390}])for(const large of [false,true]){
   const context=await browser.newContext({...devices['Pixel 5'],viewport});
   try{
    const page=await context.newPage(),errors=watchForErrors(page),label=viewport.width+'-'+(large?'double-calm':'normal');
    if(large)await page.addInitScript(()=>{localStorage.setItem('deepdelve.textSize','4');localStorage.setItem('deepdelve.calm','1');});
    await begin(page);
    const supplied=await page.evaluate(async()=>{
     const {RELICS}=await import('/js/relics.js');const p=Game.player();
     const entries=Object.entries(RELICS).sort((a,b)=>b[1].name.length-a[1].name.length).slice(0,20);
     p.inv=entries.map(([u,r])=>({t:r.t,e:r.e,q:1,u}));
     for(const it of p.inv)Game.state().known[it.t]=1;
     return {items:entries.map(([id,r])=>({id,name:r.name})),before:JSON.stringify({eq:p.eq,inv:p.inv,gold:p.gold})};
    });
    await page.click('[data-open="inv"]');
    if(!large)await expect(page.locator('.equipment-figure')).toHaveClass(/painted/);
    else await expect(page.locator('.equipment-silhouette')).toBeHidden();
    const closeFind=page.locator('#item-detail .buttons button').filter({hasText:/^Close$/});
    if(await closeFind.isVisible()){
      await save(page,label+'-new-find');await closeFind.click();
    }
    await page.locator('#ov-inv .ov-body').evaluate(el=>{el.scrollTop=0;});
    await expect(page.locator('#inv-grid [data-index]')).toHaveCount(20);
    await save(page,label+'-full-pack',viewport.width===320&&large);
    const sizes=await page.locator('.equipment-figure .slot, #inv-grid [data-index]').evaluateAll(es=>es.map(el=>{const r=el.getBoundingClientRect();return{width:r.width,height:r.height,overflow:el.scrollWidth>el.clientWidth+1};}));
    assert.ok(sizes.every(s=>s.width>=44&&s.height>=44&&!s.overflow));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('#inv-grid [data-index]').last().scrollIntoViewIfNeeded();await save(page,label+'-last-row');
    await page.locator('#inv-grid [data-index]').first().click();await save(page,label+'-details');
    const after=await page.evaluate(()=>{const p=Game.player();return JSON.stringify({eq:p.eq,inv:p.inv,gold:p.gold});});
    assert.equal(after,supplied.before);assert.deepEqual(errors,[]);
    evidence.fixtures.push({label,viewport,supplied:supplied.items,sizes,equipmentInventoryGoldUnchanged:true,errors,scope:'Only a full inventory of twenty valid long-named relics and their type knowledge supplied; actual UI/rules/assets. Not a played-through loot distribution or balance result.'});
   }finally{await context.close();}
  }
  fs.writeFileSync(path.join(__dirname,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({nativeFlows:evidence.native.length,fullPackFixtures:evidence.fixtures.length,axeScans:evidence.axe.length,seriousCritical:0}));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
