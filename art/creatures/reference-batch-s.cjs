'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');const {chromium}=require('playwright'),{serve}=require('../../test/server'),{startGame,artReady}=require('../../test/browser/helpers');
(async()=>{const out=path.join(__dirname,'batch-s-preview');fs.mkdirSync(out,{recursive:true});const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`});await startGame(page,{seed:'secondary-materials'});await artReady(page,{});const data=await page.evaluate(async()=>{const {THEMES}=await import('/js/data.js'),out={},inventory=[];const levelCanvas=a=>{const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),d=ctx.createImageData(64,64);for(let i=0;i<4096;i++){d.data[i*4]=a[i]&255;d.data[i*4+1]=a[i]>>>8&255;d.data[i*4+2]=a[i]>>>16&255;d.data[i*4+3]=255;}ctx.putImageData(d,0,0);return c;};for(const[i,t]of Assets.themes.entries()){const keys={};for(let k=1;k<7;k++)keys['floor'+k]=levelCanvas(t.floorOf(k)[0]);for(let k=1;k<4;k++)keys['ceil'+k]=levelCanvas(t.ceilOf(k)[0]);for(const k of ['wallB','wallDamp','wallCracked','rock','fallen','rockPillar','fountain','fountainDry'])keys[k]=t[k];for(let k=0;k<3;k++)keys['torch'+k]=t.torchFrames[k];for(const[k,img]of Object.entries(keys)){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(img,0,0,256,256);out[i+'-'+k]=c.toDataURL().split(',')[1];}inventory.push({theme:THEMES[i].name,index:i,keys:Object.keys(keys),decoration_count:t.decor.length,decorations:t.theme.decor});}return{images:out,inventory};});for(const[k,v]of Object.entries(data.images))fs.writeFileSync(path.join(out,k+'-reference.png'),Buffer.from(v,'base64'));delete data.images;fs.writeFileSync(path.join(out,'reference-inventory.json'),JSON.stringify(data,null,2)+'\n');
require('node:child_process').execFileSync('python3',['-c',`
from PIL import Image,ImageDraw
from pathlib import Path
p=Path('batch-s-preview')
groups={'s1':['floor1','floor2','floor3'],'s2':['floor4','floor5','floor6'],'s3':['ceil1','ceil2','ceil3'],'s4':['wallB','wallDamp','wallCracked','rock','fallen','rockPillar'],'s5':['fountain','fountainDry'],'s6':['torch0','torch1','torch2']}
keys=[]
for name,items in groups.items():
 cols=2 if name=='s5' else 3;im=Image.new('RGB',(cols*256,((len(items)+cols-1)//cols)*256))
 for i,k in enumerate(items):im.paste(Image.open(p/f'0-{k}-reference.png'),(i%cols*256,i//cols*256))
 im.save(p/f'{name}-reference.png');keys+=items
im=Image.new('RGB',(len(keys)*96,13*120),'#20242c');d=ImageDraw.Draw(im)
for row in range(13):
 for col,k in enumerate(keys):
  v=Image.open(p/f'{row}-{k}-reference.png').resize((96,96),Image.Resampling.NEAREST);im.paste(v,(col*96,row*120));d.text((col*96,row*120+98),f'{row} {k}',fill='white')
im.save(p/'inventory-overview.png')
`],{cwd:__dirname});console.log('Captured260 material/detail references across13 themes; grouped six baseline sheets');
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
