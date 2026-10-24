'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{serve}=require('../../test/server'),{startGame}=require('../../test/browser/helpers');
const out=path.join(__dirname,'batch-y-preview');fs.mkdirSync(out,{recursive:true});
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`});await page.addInitScript(()=>{localStorage.setItem('deepdelve.sound','off');localStorage.setItem('deepdelve.samples','off');localStorage.setItem('deepdelve.prelude','off');});await startGame(page,{seed:'shield-source-audit'});
const rows=await page.evaluate(async()=>{const{HAND_COLORS}=await import('/js/heldart.js');return [['fighter','shield'],['cleric','shield'],['thief','buckler']].map(([cls,id])=>{const fr=Assets.carried(id,cls),c=document.createElement('canvas');c.width=c.height=256;const s=Math.min(220/fr.img.width,220/fr.img.height),x=(256-fr.img.width*s)/2,y=(256-fr.img.height*s)/2;c.getContext('2d').drawImage(fr.img,x,y,fr.img.width*s,fr.img.height*s);return{key:cls+'-'+id,cls,id,palette:HAND_COLORS[cls],grip:[x+fr.ax*s,y+fr.ay*s],original:{ax:fr.ax,ay:fr.ay,marks:fr.at,size:[fr.img.width,fr.img.height]},data:c.toDataURL().split(',')[1]};});});for(const r of rows){fs.writeFileSync(path.join(out,r.key+'-reference.png'),Buffer.from(r.data,'base64'));delete r.data;}fs.writeFileSync(path.join(out,'reference-inventory.json'),JSON.stringify(rows,null,2)+'\n');
require('node:child_process').execFileSync('python3',['-c',`from PIL import Image
from pathlib import Path
p=Path('batch-y-preview');im=Image.new('RGBA',(768,256))
for i,k in enumerate(['fighter-shield','cleric-shield','thief-buckler']):im.alpha_composite(Image.open(p/(k+'-reference.png')).convert('RGBA'),(i*256,0))
im.save(p/'reference-sheet.png')`],{cwd:__dirname});console.log('Three native rear-shield references captured');
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
