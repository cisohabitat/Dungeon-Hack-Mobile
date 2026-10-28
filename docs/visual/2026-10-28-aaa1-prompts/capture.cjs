'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const {chromium,devices,expect}=require(path.join(root,'node_modules/@playwright/test'));
const {start}=require(path.join(root,'test/server'));
const {uiReady,watchForErrors}=require(path.join(root,'test/browser/helpers'));
(async()=>{
  const server=await start(4198),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const evidence=[];
  try{
    for(const viewport of [{width:320,height:667},{width:390,height:844},{width:740,height:390}])for(const large of [false,true]){
      const context=await browser.newContext({...devices['Pixel 5'],viewport});
      try{
        const page=await context.newPage(),errors=watchForErrors(page),label=viewport.width+'-'+(large?'double-calm':'normal');
        if(large)await page.addInitScript(()=>{localStorage.setItem('deepdelve.textSize','4');localStorage.setItem('deepdelve.calm','1');});
        await page.goto('http://127.0.0.1:4198');await page.waitForFunction(()=>!!window.UI);
        if(await page.locator('#ft-close').isVisible())await page.click('#ft-close');
        await page.click('#btn-new');await page.locator('#c-customise > summary').click();
        await page.fill('#c-seed','aaa-review-2026-10-28');await page.locator('.class-card').first().click();
        await page.click('#c-begin');await page.click('#pro-begin');
        const tip=page.locator('#tip'),voice=page.locator('#discovery-voice');
        await expect(tip).toHaveClass(/show/);await expect(tip).toHaveAttribute('data-tip','controls');
        // Observe across several native scheduler checks with shipped audio.
        await page.waitForTimeout(600);await expect(voice).toBeHidden();await uiReady(page);
        await page.screenshot({path:path.join(__dirname,label+'-lesson.png')});
        const lesson=await page.evaluate(()=>({tip:document.querySelector('#tip').getBoundingClientRect().toJSON(),voiceHidden:document.querySelector('#discovery-voice').hidden,playing:UI.voicePlaying()}));
        await tip.click();await expect(tip).not.toHaveClass(/show/);await expect(voice).toBeVisible();
        await page.screenshot({path:path.join(__dirname,label+'-discovery.png')});
        const discovery=await page.evaluate(()=>({caption:document.querySelector('#discovery-voice-caption').textContent,tipVisible:document.querySelector('#tip').classList.contains('show'),voice:document.querySelector('#discovery-voice').getBoundingClientRect().toJSON()}));
        await voice.locator('[data-voice-stop]').click();await expect(voice).toBeHidden();
        expect(errors).toEqual([]);evidence.push({label,viewport,lesson,discovery,errors});
      }finally{await context.close();}
    }
    fs.writeFileSync(path.join(__dirname,'native.json'),JSON.stringify({scope:'Native UI with shipped recordings; only real text/Calm preferences set. No media, image, renderer, enemy, game-clock or safety substitutions. Not physical-device, listening or full-run approval.',runs:evidence},null,2)+'\n');
    console.log(JSON.stringify({runs:evidence.length,frames:evidence.length*2,errors:0}));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
