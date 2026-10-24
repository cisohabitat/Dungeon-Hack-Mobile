'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const {serve}=require('../../test/server');
const {startGame,artReady}=require('../../test/browser/helpers');
const groups={"k1a":["spider_altar","heartwell","shrine","runestone"],"k1b":["mirror","statue","idol","heart_dais"],"k2a":["strongbox","lever_door","well","bookcase"],"k2b":["chest","barricade","dwarf_forge","anvil"],"k3a":["wyrmegg","egg_clutch","rubble","fungus"],"k3b":["silk_larder","bones","pool","cookpot"],"k3c":["bone_heap"]},keys=Object.values(groups).flat();
(async()=>{
 const output=path.join(__dirname,'batch-k-preview');fs.mkdirSync(output,{recursive:true});
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`});await startGame(page,{seed:'scenery-reference'});await artReady(page,Object.fromEntries(keys.map(k=>[k,[]])));
  const refs=await page.evaluate(keys=>Object.fromEntries(keys.map(kind=>{const c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').drawImage(Assets.sprites[kind].levels[0],0,0,256,256);return[kind,c.toDataURL('image/png').split(',')[1]];})),keys);
  for(const[kind,data]of Object.entries(refs))fs.writeFileSync(path.join(output,`${kind}-reference.png`),Buffer.from(data,'base64'));
  require('node:child_process').execFileSync('python3',['-c',`
from PIL import Image
from pathlib import Path
import json
p=Path('batch-k-preview')
groups=json.loads('{"k1a":["spider_altar","heartwell","shrine","runestone"],"k1b":["mirror","statue","idol","heart_dais"],"k2a":["strongbox","lever_door","well","bookcase"],"k2b":["chest","barricade","dwarf_forge","anvil"],"k3a":["wyrmegg","egg_clutch","rubble","fungus"],"k3b":["silk_larder","bones","pool","cookpot"],"k3c":["bone_heap"]}')
for g,keys in groups.items():
 cols=2 if len(keys)==4 else 1;rows=2 if len(keys)==4 else 1
 im=Image.new('RGBA',(cols*256,rows*256))
 for i,k in enumerate(keys):im.alpha_composite(Image.open(p/f'{k}-reference.png').convert('RGBA'),((i%cols)*256,(i//cols)*256))
 im.save(p/f'{g}-reference.png')
`],{cwd:__dirname});
  console.log('Captured 25 active prop references and seven grouped references');
 }finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})().catch(e=>{console.error(e);process.exitCode=1;});
