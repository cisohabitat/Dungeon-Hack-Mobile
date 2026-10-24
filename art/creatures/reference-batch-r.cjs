'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{serve}=require('../../test/server'),{startGame,artReady}=require('../../test/browser/helpers');
(async()=>{const out=path.join(__dirname,'batch-r-preview');fs.mkdirSync(out,{recursive:true});const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`});await startGame(page,{seed:'architecture-reference'});await artReady(page,{});
const data=await page.evaluate(async()=>{const {THEMES,KEY_COLORS}=await import('/js/data.js'),out={};for(const [i,t]of Assets.themes.entries()){const keys={door:t.door,cellDoor:t.cellDoor,pillar:t.pillar,stairArch:t.stairArch,stairsUp:t.stairsUp,stairsDown:t.stairsDown,stairsUpBack:t.stairsUpBack,stairsDownBack:t.stairsDownBack};for(const k of Object.keys(KEY_COLORS)){keys['door_'+k]=t.locked[k];keys['cell_'+k]=t.cellLocked(k);}for(const[k,img]of Object.entries(keys)){const c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').imageSmoothingEnabled=false;c.getContext('2d').drawImage(img,0,0,256,256);out[i+'-'+k]=c.toDataURL().split(',')[1];}}return{images:out,themes:THEMES.map(t=>t.name),keys:KEY_COLORS};});
for(const[k,v]of Object.entries(data.images))fs.writeFileSync(path.join(out,k+'-reference.png'),Buffer.from(v,'base64'));delete data.images;require('node:child_process').execFileSync('python3',['-c',`
from PIL import Image,ImageDraw
from pathlib import Path
p=Path('batch-r-preview')
for name,keys,cols in [('r1',['door','cellDoor','pillar'],3),('r2',['stairsUp','stairsDown','stairsUpBack','stairsDownBack'],2)]:
 im=Image.new('RGBA',(cols*256,((len(keys)+cols-1)//cols)*256))
 for i,k in enumerate(keys): im.alpha_composite(Image.open(p/f'0-{k}-reference.png').convert('RGBA'),(i%cols*256,i//cols*256))
 im.save(p/f'{name}-reference.png')
keys=['door','cellDoor','pillar','stairArch','stairsUp','stairsDown','stairsUpBack','stairsDownBack']+['door_'+k for k in ['brass','silver','gold','iron','bone']]+['cell_'+k for k in ['brass','silver','gold','iron','bone']]
im=Image.new('RGB',(1800,13*124),'#20242c');d=ImageDraw.Draw(im)
for row in range(13):
 for col,k in enumerate(keys):
  v=Image.open(p/f'{row}-{k}-reference.png').convert('RGBA');v.thumbnail((96,96));im.paste(v,(col*100,row*124),v);d.text((col*100,row*124+98),f'{row} {k}',fill='white')
im.save(p/'inventory-overview.png')
`],{cwd:__dirname});fs.writeFileSync(path.join(out,'reference-inventory.json'),JSON.stringify(data,null,2)+'\n');console.log(data);
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
