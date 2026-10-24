'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{serve}=require('../../test/server'),{startGame}=require('../../test/browser/helpers');
const out=path.join(__dirname,'batch-z-preview');fs.mkdirSync(out,{recursive:true});
const cut=['rest','drawback','windup','strike','cut','sweep','through','recover','return'];
const groups={z1:{cls:'cleric',id:'mace',poses:cut,grid:[3,3]},z2:{cls:'thief',id:'shortsword',poses:cut,grid:[3,3]},z3:{cls:'ranger',id:'shortbow',poses:['rest','bowdraw','bowfull'],grid:[3,1]},z4:{cls:'druid',id:'spear',poses:['rest','drive'],grid:[2,1]}};
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`});await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});await startGame(page,{seed:'starter-held-art'});
const data=await page.evaluate(async groups=>{const{HAND_COLORS}=await import('/js/heldart.js'),images={},cells={},legal=[];
for(const[group,g]of Object.entries(groups)){Game.player().cls=g.cls;const why=Game.canEquip({t:g.id,q:1,e:0});legal.push({cls:g.cls,id:g.id,reason:why});if(why)throw Error(why);for(const pose of g.poses){const fr=Assets.held(g.id,pose,g.cls,false,false),key=g.cls+'-'+g.id+'-'+pose,c=document.createElement('canvas');c.width=c.height=256;const s=Math.min(220/fr.img.width,220/fr.img.height),x=(256-fr.img.width*s)/2,y=(256-fr.img.height*s)/2,pt=q=>[x+q[0]*s,y+q[1]*s];c.getContext('2d').drawImage(fr.img,x,y,fr.img.width*s,fr.img.height*s);images[key]=c.toDataURL().split(',')[1];cells[key]={sheet:group,cls:g.cls,id:g.id,pose,two:false,grip:pt([fr.ax,fr.ay]),object_bounds:[...pt(fr.at.min),...pt(fr.at.max)],...(fr.at.top?{nocks:{top:pt(fr.at.top),bot:pt(fr.at.bot)}}:{}),native:[fr.img.width,fr.img.height]};}}
return{images,cells,legal,palettes:HAND_COLORS,ranger_fighter_palette_fallback:!HAND_COLORS.ranger};},groups);
for(const[k,v]of Object.entries(data.images))fs.writeFileSync(path.join(out,k+'-reference.png'),Buffer.from(v,'base64'));delete data.images;fs.writeFileSync(path.join(out,'reference-inventory.json'),JSON.stringify({groups,...data},null,2)+'\n');
require('node:child_process').execFileSync('python3',['-c',`from pathlib import Path
from PIL import Image
import json
p=Path('batch-z-preview');r=json.loads((p/'reference-inventory.json').read_text())
for g,s in r['groups'].items():
 cols,rows=s['grid'];im=Image.new('RGBA',(cols*256,rows*256))
 for i,pose in enumerate(s['poses']):im.alpha_composite(Image.open(p/(s['cls']+'-'+s['id']+'-'+pose+'-reference.png')).convert('RGBA'),(i%cols*256,i//cols*256))
 im.save(p/(g+'-reference.png'))`],{cwd:__dirname});console.log('23 native starter-weapon reference frames; four legal pairs');
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
