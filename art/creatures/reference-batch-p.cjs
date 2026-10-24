'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{serve}=require('../../test/server');const {startGame,artReady}=require('../../test/browser/helpers');
const groups={p1:['elvenchain','marshhide','dwarfplate','runeshield'],p2:['dwarfhammer','handxbow','amulet_tooth']};
(async()=>{const out=path.join(__dirname,'batch-p-preview');fs.mkdirSync(out,{recursive:true});const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`});await startGame(page,{seed:'equipment-reference'});
const keys=await page.evaluate(async()=>Object.keys((await import('/js/itemart.js')).ITEM_ART));await artReady(page,Object.fromEntries(keys.map(k=>[k,[]])));
const data=await page.evaluate(async({keys,groups})=>{const {ITEMS}=await import('/js/data.js'),{GRIPS,HELD_ART}=await import('/js/itemart.js'),{POSES}=await import('/js/heldart.js');const refs={};for(const k of keys){const c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').drawImage(Assets.sprites[k].levels[0],0,0,256,256);refs[k]=c.toDataURL('image/png').split(',')[1];}const selected=Object.values(groups).flat();return{refs,inventory:{all_item_art:keys,selected:selected.map(k=>({key:k,item:ITEMS[k],grip:GRIPS[k]||null,separate_held:!!HELD_ART[k]})),held_pose_keys:Object.keys(POSES),grip_keys:Object.keys(GRIPS)}};},{keys,groups});
const held=await page.evaluate(()=>Object.fromEntries(['fighter','cleric'].map(cls=>{if(Assets.carried('runeshield',cls)!==null)throw new Error('Rune shield carried gap changed');const f=Assets.carried('towershield',cls),c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').drawImage(f.img,0,0,256,256);return[cls,{reference:c.toDataURL('image/png').split(',')[1],anchor:[f.ax,f.ay],object_marks:f.at}];})));for(const[cls,v]of Object.entries(held)){fs.writeFileSync(path.join(out,`held-${cls}-reference.png`),Buffer.from(v.reference,'base64'));delete v.reference;}data.inventory.held_gap={key:'runeshield',actual_carried_null:true,reference:'existing towershield rear, not an existing Rune-Cut Shield frame',classes:held};
fs.mkdirSync(path.join(out,'inventory'),{recursive:true});for(const[k,b]of Object.entries(data.refs))fs.writeFileSync(path.join(out,'inventory',`${k}.png`),Buffer.from(b,'base64'));fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify(data.inventory,null,2)+'\n');
require('node:child_process').execFileSync('python3',['-c',`
from pathlib import Path
from PIL import Image,ImageDraw
import json,math
p=Path('batch-p-preview');inv=json.loads((p/'inventory.json').read_text());keys=inv['all_item_art']
im=Image.new('RGB',(1000,math.ceil(len(keys)/10)*120),'#20242c');d=ImageDraw.Draw(im)
for i,k in enumerate(keys):
 cell=Image.open(p/'inventory'/f'{k}.png').convert('RGBA').resize((100,100),Image.Resampling.LANCZOS);x=i%10*100;y=i//10*120;im.paste(cell,(x,y),cell);d.text((x+2,y+103),k,fill='white')
im.save(p/'inventory-overview.png')
groups=json.loads('${JSON.stringify(groups)}')
for g,ks in groups.items():
 cols=2 if len(ks)==4 else len(ks);rows=2 if len(ks)==4 else 1;im=Image.new('RGBA',(cols*256,rows*256))
 for i,k in enumerate(ks):im.alpha_composite(Image.open(p/'inventory'/f'{k}.png').convert('RGBA'),(i%cols*256,i//cols*256))
 im.save(p/f'{g}-reference.png')
`],{cwd:__dirname});console.log(`Audited ${keys.length} ordinary item sprites; captured seven regional references`);
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
