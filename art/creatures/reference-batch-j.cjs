'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const {serve}=require('../../test/server');
const {startGame,artReady}=require('../../test/browser/helpers');
(async()=>{
 const output=path.join(__dirname,'batch-j-preview');fs.mkdirSync(output,{recursive:true});
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`});await startGame(page,{seed:'trader-reference'});await artReady(page,Object.fromEntries(['forge_spirit','lastdelver','wisp','prisoner','duelist_ghost','lampfolk_dark','kept_smith','mapmaker','goblin_hurt','mule','ogre_sleep','goblin_toll','stray','cage','hireling','exile','stray_healer'].map(k=>[k,[]])));
  const refs=await page.evaluate(()=>Object.fromEntries(['forge_spirit','lastdelver','wisp','prisoner','duelist_ghost','lampfolk_dark','kept_smith','mapmaker','goblin_hurt','mule','ogre_sleep','goblin_toll','stray','cage','hireling','exile','stray_healer'].map(kind=>{
   const c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').drawImage(Assets.sprites[kind].levels[0],0,0,256,256);return[kind,c.toDataURL('image/png').split(',')[1]];
  })));
  for(const[kind,data]of Object.entries(refs))fs.writeFileSync(path.join(output,`${kind}-reference.png`),Buffer.from(data,'base64'));
  require('node:child_process').execFileSync('python3',['-c',`
from PIL import Image
from pathlib import Path
p=Path('batch-j-preview')
groups={'j1a':['forge_spirit','lastdelver','wisp','prisoner'],'j1b':['duelist_ghost','lampfolk_dark','kept_smith','mapmaker'],'j2a':['goblin_hurt','mule','ogre_sleep'],'j2b':['goblin_toll','stray','cage']}
for g,keys in groups.items():
 cols=2 if len(keys)==4 else 3;rows=2 if len(keys)==4 else 1
 im=Image.new('RGBA',(cols*256,rows*256))
 for i,k in enumerate(keys):im.alpha_composite(Image.open(p/f'{k}-reference.png').convert('RGBA'),((i%cols)*256,(i//cols)*256))
 im.save(p/f'{g}-reference.png')
`],{cwd:__dirname});
  console.log('Captured seventeen encounter references');
 }finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})().catch(e=>{console.error(e);process.exitCode=1;});
