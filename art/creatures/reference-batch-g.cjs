'use strict';
// Capture current runtime fallback and the older barrel anatomy for art provenance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const {serve}=require('../../test/server');
const {startGame,artReady}=require('../../test/browser/helpers');
(async()=>{
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`});await startGame(page,{seed:'mimic-reference'});await artReady(page,{mimic:['windup','stepA','stepB','hurt','recover']});
  await page.evaluate(()=>{
   const c=document.createElement('canvas');c.id='current-mimic-reference';c.width=960;c.height=210;const ctx=c.getContext('2d');ctx.fillStyle='#20242c';ctx.fillRect(0,0,c.width,c.height);
   ['idle','windup','stepA','stepB','hurt','recover'].forEach((pose,i)=>{const a=pose==='idle'?Assets.sprites.mimic:Assets.sprites.mimic[pose];ctx.drawImage(a.levels[0],i*160,20,160,160);ctx.fillStyle='white';ctx.font='16px monospace';ctx.fillText(pose,i*160+8,200);});document.body.replaceChildren(c);
  });
  await page.locator('#current-mimic-reference').screenshot({path:path.join(__dirname,'batch-g-preview/procedural-reference.png')});
  const src=fs.readFileSync(path.join(__dirname,'../../js/creatures.js'),'utf8'),start=src.indexOf("  mimic: (pose = 'idle') => {");
  if(start<0)throw new Error('Legacy barrel drawer missing');
  const drawer=src.slice(start+'  mimic: '.length,src.indexOf('\n\n  // An eyeless',start)).trim().replace(/,$/,'');
  const parts=await import('../../js/parts.js'),{paintParts}=await import('../../js/painter.js');
  const legacy=new Function(...Object.keys(parts),`return (${drawer});`)(...Object.values(parts));
  const rasters=['idle','windup'].map(pose=>({pose,...paintParts(legacy(pose),64,2,true)}));
  await page.evaluate(rasters=>{
   const c=document.createElement('canvas');c.id='mimic-reference';c.width=512;c.height=280;const ctx=c.getContext('2d');ctx.fillStyle='#20242c';ctx.fillRect(0,0,c.width,c.height);
   rasters.forEach((p,i)=>{const pose=p.pose;for(let y=0;y<p.ah;y++)for(let x=0;x<p.aw;x++){const color=p.color[y*p.aw+x];if(color){ctx.fillStyle=color;ctx.fillRect(i*256+x*2,y*2,2,2);}}ctx.fillStyle='white';ctx.font='16px monospace';ctx.fillText(`legacy barrel / ${pose}`,i*256+8,272);});
   document.body.replaceChildren(c);
  },rasters);
  await page.locator('#mimic-reference').screenshot({path:path.join(__dirname,'batch-g-preview/legacy-barrel-reference.png')});
 }finally{await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})().catch(e=>{console.error(e);process.exitCode=1;});
