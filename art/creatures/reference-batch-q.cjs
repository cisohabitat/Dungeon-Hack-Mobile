'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');const {chromium}=require('playwright'),{serve}=require('../../test/server');const {startGame,artReady}=require('../../test/browser/helpers');
(async()=>{const out=path.join(__dirname,'batch-q-preview');fs.mkdirSync(out,{recursive:true});const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`});await startGame(page,{seed:'effects-reference'});await artReady(page,{dress_flames:[],dress_ripple:[],dress_snare:[]});
const refs=await page.evaluate(async()=>{const refs={};for(const k of ['flames','ripple','snare']){const c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').drawImage(Assets.sprites['dress_'+k].levels[0],0,0,256,256);refs[k]=c.toDataURL('image/png').split(',')[1];}const {makeElementFx}=await import('/js/elementfx.js');for(const kind of ['fire','frost'])for(const [i,age]of [.02,.25,.55,.85].entries()){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),q={x:128,y:128,r:160},K={ctx,calm:false,hash:n=>{const s=Math.sin(n*12.9898+78.233)*43758.5453;return s-Math.floor(s);},hexA:(h,a)=>{const n=parseInt(h.slice(1),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${Math.max(0,Math.min(1,a))})`;},glow:()=>{}};const fx=makeElementFx(K);if(kind==='fire')fx.fireImpact(q,age);else fx.cold(q,[q],q,age,0);refs[kind+'_'+i]=c.toDataURL('image/png').split(',')[1];}return refs;});for(const[k,v]of Object.entries(refs))fs.writeFileSync(path.join(out,k+'-reference.png'),Buffer.from(v,'base64'));
require('node:child_process').execFileSync('python3',['-c',`
from PIL import Image,ImageDraw
from pathlib import Path
p=Path('batch-q-preview')
for name,keys in {'q1':['flames','ripple','snare'],'q2':['fire_0','fire_1','fire_2','fire_3'],'q3':['frost_0','frost_1','frost_2','frost_3']}.items():
 cols=3 if name=='q1' else 2;rows=1 if name=='q1' else 2;im=Image.new('RGBA',(cols*256,rows*256))
 for i,k in enumerate(keys):im.alpha_composite(Image.open(p/f'{k}-reference.png').convert('RGBA'),(i%cols*256,i//cols*256))
 im.save(p/f'{name}-reference.png')
`],{cwd:__dirname});console.log('Captured three world sprites and eight actual elemental impact reference phases');
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
