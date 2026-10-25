'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright'),{serve}=require('../../test/server'),{startGame}=require('../../test/browser/helpers');
const root=__dirname,plans=Object.fromEntries(['ae-hands','af-items'].map(b=>[b,JSON.parse(fs.readFileSync(path.join(root,'generation-batch-'+b+'.json')))]));
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({serviceWorkers:'block',baseURL:`http://127.0.0.1:${server.address().port}`});await page.route('**/img/held/**',r=>r.abort());await page.route('**/img/world/**',r=>r.abort());await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});await startGame(page,{seed:'ae-af-native-source-reference'});
 for(const[batch,plan]of Object.entries(plans)){const out=path.join(root,'batch-'+batch+'-preview');fs.mkdirSync(out,{recursive:true});const result=await page.evaluate(async({batch,plan})=>{
 const {HAND_COLORS}=await import('/js/heldart.js');const{ITEMS,KEY_COLORS,POTION_LOOKS,RING_LOOKS,AMULET_LOOKS}=await import('/js/data.js');const rows={};
 for(const[key,c]of Object.entries(plan.cells)){
  const fr=batch==='ae-hands'?Assets.held(null,c.pose,c.cls,false,false):Assets.sprites[key];const img=batch==='ae-hands'?fr.img:fr.levels[0];if(!img)throw Error('Missing native '+key);const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const s=Math.min(220/img.width,220/img.height),x=(256-img.width*s)/2,y=(256-img.height*s)/2,pt=q=>[x+q[0]*s,y+q[1]*s];canvas.getContext('2d').drawImage(img,x,y,img.width*s,img.height*s);
  if(c.named&&Game.spriteFor({t:c.item_t,u:c.relic,q:1,e:1})!==key)throw Error('Named routing '+key);
  rows[key]={...c,native_size:[img.width,img.height],...(batch==='ae-hands'?{grip:pt([fr.ax,fr.ay]),marks:fr.at,palette:HAND_COLORS[c.cls]||HAND_COLORS.fighter}:{}),data:canvas.toDataURL().split(',')[1]};
 }
 return {scope:'Native procedural source geometry/routing fixtures, not gameplay transitions or delivery. Existing held/world painted requests blocked.',rows,...(batch==='af-items'?{seeded_looks:{POTION_LOOKS,RING_LOOKS,AMULET_LOOKS},items:ITEMS,key_colors:KEY_COLORS,looks:Game.state().looks}:{} )};
 },{batch,plan});
 for(const[key,r]of Object.entries(result.rows)){const raw=Buffer.from(r.data,'base64');fs.writeFileSync(path.join(out,key+'-reference.png'),raw);r.reference_sha256=crypto.createHash('sha256').update(raw).digest('hex');delete r.data;}
 if(batch==='ae-hands'){for(const r of Object.values(result.rows))if(r.registered_reuse){const a=result.rows[r.registered_reuse];if(r.reference_sha256!==a.reference_sha256||JSON.stringify(r.grip)!==JSON.stringify(a.grip)||JSON.stringify(r.marks)!==JSON.stringify(a.marks))throw Error('Ranger reuse differs '+r.pose);}result.ranger_reuse='All3 native frame PNGs, grips and marks exactly equal Fighter.';}
 fs.writeFileSync(path.join(out,'reference-inventory.json'),JSON.stringify(result,null,2)+'\n');console.log(batch,Object.keys(result.rows).length,'native references');
 }
 require('node:child_process').execFileSync('python3',[path.join(root,'reference-batch-ae-af.py')]);
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
