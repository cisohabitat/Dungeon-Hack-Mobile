'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{serve}=require('../../test/server');
const {startGame,artReady}=require('../../test/browser/helpers');
(async()=>{const out=path.join(__dirname,'batch-o-preview');fs.mkdirSync(out,{recursive:true});const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`});await startGame(page,{seed:'surface-reference'});await artReady(page,{});
const data=await page.evaluate(async()=>{const {THEMES}=await import('/js/data.js');return THEMES.map((theme,i)=>{const t=Assets.themes[i],c=document.createElement('canvas');c.width=192;c.height=64;const ctx=c.getContext('2d');ctx.drawImage(t.wall,0,0);for(const [j,levels]of [[1,t.floorOf(0)],[2,t.ceilOf(0)]]){const im=ctx.createImageData(64,64);new Uint32Array(im.data.buffer).set(levels[0]);ctx.putImageData(im,j*64,0);}return{index:i,...theme,reference:c.toDataURL('image/png').split(',')[1],format:{tex:Assets.TEX,darkness_levels:Assets.FLOOR_LEVELS,wall:[t.wall.width,t.wall.height]}};});});
for(const t of data){fs.writeFileSync(path.join(out,`theme-${t.index}-reference.png`),Buffer.from(t.reference,'base64'));delete t.reference;}
fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify(data,null,2)+'\n');console.log('Captured thirteen active wall/floor/ceiling sets at native64');
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
