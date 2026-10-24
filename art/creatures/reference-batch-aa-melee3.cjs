'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{serve}=require('../../test/server'),{startGame}=require('../../test/browser/helpers');
const out=path.join(__dirname,'batch-aa-melee3-preview');fs.mkdirSync(out,{recursive:true});
const cut=['rest','drawback','windup','strike','cut','sweep','through','recover','return'];
const groups={aa9:{cls:'fighter',id:'dagger',poses:cut,grid:[3,3],two:false},aa10:{cls:'ranger',id:'dagger',poses:cut,grid:[3,3],two:false},aa11:{cls:'druid',id:'dagger',poses:cut,grid:[3,3],two:false},aa12:{cls:'spellblade',id:'dagger',poses:cut,grid:[3,3],two:false}};
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const inventory={groups,cells:{},legal:[],mode:'fresh browser per family; native procedural geometry; painted held requests blocked to preserve source references after activation'};
try{
 for(const[group,g]of Object.entries(groups)){
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({serviceWorkers:'block',baseURL:`http://127.0.0.1:${server.address().port}`});await page.route('**/img/held/**',route=>route.abort());await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});await startGame(page,{seed:'starter-held-art'});
  const data=await page.evaluate(async({group,g})=>{const{HAND_COLORS}=await import('/js/heldart.js'),images={},cells={};Game.player().cls=g.cls;const reason=Game.canEquip({t:g.id,q:1,e:0});if(reason)throw Error(reason);
   for(const pose of g.poses){const fr=Assets.held(g.id,pose,g.cls,g.two,false),key=g.cls+'-'+g.id+'-'+pose,c=document.createElement('canvas');c.width=c.height=256;const s=Math.min(220/fr.img.width,220/fr.img.height),x=(256-fr.img.width*s)/2,y=(256-fr.img.height*s)/2,pt=q=>[x+q[0]*s,y+q[1]*s];c.getContext('2d').drawImage(fr.img,x,y,fr.img.width*s,fr.img.height*s);images[key]=c.toDataURL().split(',')[1];cells[key]={sheet:group,cls:g.cls,id:g.id,pose,two:g.two,grip:pt([fr.ax,fr.ay]),object_bounds:[...pt(fr.at.min),...pt(fr.at.max)],native:[fr.img.width,fr.img.height]};}
   return{images,cells,legal:{cls:g.cls,id:g.id,reason},palette:HAND_COLORS[g.cls]};},{group,g});
  for(const[k,v]of Object.entries(data.images))fs.writeFileSync(path.join(out,k+'-reference.png'),Buffer.from(v,'base64'));Object.assign(inventory.cells,data.cells);inventory.legal.push(data.legal);(inventory.palettes||={})[g.cls]=data.palette;await page.close();await browser.close();browser=null;
 }
 const matches=[];for(const pose of cut){const a=fs.readFileSync(path.join(out,'fighter-dagger-'+pose+'-reference.png')),b=fs.readFileSync(path.join(out,'ranger-dagger-'+pose+'-reference.png'));if(!a.equals(b))throw Error('Ranger reference differs '+pose);const f=inventory.cells['fighter-dagger-'+pose],r=inventory.cells['ranger-dagger-'+pose];if(JSON.stringify([f.grip,f.object_bounds])!==JSON.stringify([r.grip,r.object_bounds]))throw Error('Ranger grip differs');matches.push({pose,byte_identical:true,sha256:require('node:crypto').createHash('sha256').update(a).digest('hex')});}inventory.ranger_reuse_audit={reason:'native HAND_COLORS has no Ranger entry; same Fighter palette, geometry, grips and bounds',poses:matches};
 fs.writeFileSync(path.join(out,'reference-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
 require('node:child_process').execFileSync('python3',['-c',`from pathlib import Path
from PIL import Image,ImageDraw
import json
p=Path('batch-aa-melee3-preview');r=json.loads((p/'reference-inventory.json').read_text())
for g,s in r['groups'].items():
 im=Image.new('RGBA',(768,768))
 for i,pose in enumerate(s['poses']):im.alpha_composite(Image.open(p/(s['cls']+'-'+s['id']+'-'+pose+'-reference.png')).convert('RGBA'),(i%3*256,i//3*256))
 im.save(p/(g+'-reference.png'))
im=Image.new('RGB',(1536,1596),'#23242d');d=ImageDraw.Draw(im)
for i,g in enumerate(['aa9','aa10','aa11','aa12']):
 x=i%2*768;y=i//2*798;src=Image.open(p/(g+'-reference.png'));im.paste(src,(x,y+30),src);d.text((x+5,y+8),g+' '+{'aa9':'Fighter','aa10':'Ranger (same pixels)','aa11':'Druid','aa12':'Spellblade'}[g],fill='white')
im.save(p/'reference-palettes.png')`],{cwd:__dirname});console.log('36 fresh-family native references; four legal one-hand pairs');
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
