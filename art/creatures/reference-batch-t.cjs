'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');const {chromium}=require('playwright'),{serve}=require('../../test/server'),{startGame}=require('../../test/browser/helpers');
(async()=>{const out=path.join(__dirname,'batch-t-preview');fs.mkdirSync(out,{recursive:true});const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`});await startGame(page,{seed:'held-source-audit'});const data=await page.evaluate(async()=>{const {GRIPS}=await import('/js/itemart.js'),{HAND_COLORS,POSES}=await import('/js/heldart.js');const classes=['fighter','spellblade','cleric','mage','thief','ranger','druid'],images={},frames={},selected=[];const capture=(key,fr)=>{if(!fr)return;const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),s=Math.min(220/fr.img.width,220/fr.img.height),x=(256-fr.img.width*s)/2,y=(256-fr.img.height*s)/2;ctx.drawImage(fr.img,x,y,fr.img.width*s,fr.img.height*s);images[key]=c.toDataURL().split(',')[1];const pt=p=>[x+p[0]*s,y+p[1]*s];frames[key]={anchor:pt([fr.ax,fr.ay]),object_min:fr.at.min&&pt(fr.at.min),object_max:fr.at.max&&pt(fr.at.max),top:fr.at.top&&pt(fr.at.top),bot:fr.at.bot&&pt(fr.at.bot),native:[fr.img.width,fr.img.height]};};const keys=[...Object.keys(GRIPS),'shortbow','longbow'];for(const cls of classes){for(const id of keys)capture('audit-'+cls+'-'+id,Assets.held(id,'rest',cls,/staff|greatsword/.test(id)));for(const pose of ['fist','cast'])capture('audit-'+cls+'-'+pose,Assets.held(null,pose,cls,false));}
for(const pose of ['rest','drawback','windup','strike','cut','sweep','through','recover','return']){const key='fighter-longsword-'+pose;capture(key,Assets.held('longsword',pose,'fighter',false));selected.push({key,id:'longsword',cls:'fighter',pose,two:false});}
for(const [pose,two]of [['rest',true],['drive',true],['rest',false],['channel',false]]){const key='mage-staff-'+pose+(two?'-two':'-one');capture(key,Assets.held('staff',pose,'mage',two));selected.push({key,id:'staff',cls:'mage',pose,two});}
for(const pose of ['rest','bowdraw','bowfull']){const key='ranger-longbow-'+pose;capture(key,Assets.held('longbow',pose,'ranger',false));selected.push({key,id:'longbow',cls:'ranger',pose,two:false});}
return{images,frames,selected,classes,keys,hand_colors:HAND_COLORS,poses:POSES,ranger_uses_fighter_palette:!HAND_COLORS.ranger,runeshield_gap:Assets.carried('runeshield','fighter')===null};});for(const[k,v]of Object.entries(data.images))fs.writeFileSync(path.join(out,k+'-reference.png'),Buffer.from(v,'base64'));delete data.images;fs.writeFileSync(path.join(out,'reference-inventory.json'),JSON.stringify(data,null,2)+'\n');
require('node:child_process').execFileSync('python3',['-c',`
from pathlib import Path
from PIL import Image,ImageDraw
import json
p=Path('batch-t-preview');d=json.loads((p/'reference-inventory.json').read_text());groups={'t1':[v['key'] for v in d['selected'][:9]],'t2':[v['key'] for v in d['selected'][9:13]],'t3':[v['key'] for v in d['selected'][13:]]}
for name,keys in groups.items():
 cols=2 if name=='t2' else 3;im=Image.new('RGBA',(cols*256,((len(keys)+cols-1)//cols)*256))
 for i,k in enumerate(keys):im.alpha_composite(Image.open(p/f'{k}-reference.png').convert('RGBA'),(i%cols*256,i//cols*256))
 im.save(p/f'{name}-reference.png')
keys=d['keys']+['fist','cast'];im=Image.new('RGB',(len(keys)*96,len(d['classes'])*120),'#20242c');c=ImageDraw.Draw(im)
for row,cls in enumerate(d['classes']):
 for col,k in enumerate(keys):
  file=p/f'audit-{cls}-{k}-reference.png'
  if not file.exists():continue
  v=Image.open(file).convert('RGBA');v.thumbnail((96,96));im.paste(v,(col*96,row*120),v);c.text((col*96,row*120+98),cls+' '+k,fill='white')
im.save(p/'inventory-overview.png')
`],{cwd:__dirname});console.log('Captured held inventory and16 selected pose references');
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
