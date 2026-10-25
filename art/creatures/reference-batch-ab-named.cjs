'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const{chromium}=require('playwright'),{serve}=require('../../test/server'),{startGame}=require('../../test/browser/helpers');
const out=path.join(__dirname,'batch-ab-named-preview'),plan=JSON.parse(fs.readFileSync(path.join(out,'reference-plan.json')));
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({serviceWorkers:'block',baseURL:`http://127.0.0.1:${server.address().port}`});await page.route('**/img/held/**',r=>r.abort());await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});await startGame(page,{seed:'all-named-source-reference'});
 const inventory={...plan,cells:{},legal:[],mode:'Native procedural held/carried source references; painted held delivery and service workers blocked. Class mutations are reference fixtures, not native class creation/action evidence.'};
 for(const[group,keys]of Object.entries(plan.groups)){
  const data=await page.evaluate(async({keys,cells})=>{
   const{HAND_COLORS}=await import('/js/heldart.js');const p=Game.player(),c0=cells[keys[0]];p.cls=c0.cls;p.eq.weapon=null;p.eq.offhand=null;p.eq.shield=null;const it={t:c0.item_t,u:c0.relic,q:1,e:1};const reason=Game.canEquip(it);if(reason)throw Error(reason);if(Game.spriteFor(it)!==c0.id)throw Error('Named routing mismatch');const images={},meta={};
   for(const k of keys){const c=cells[k];if(['left','thrust'].includes(c.pose)&&Game.offhandReason(it))throw Error('Illegal offhand '+k);const fr=c.kind==='carried'?Assets.carried(c.id,c.cls):Assets.held(c.id,c.pose,c.cls,c.two,c.lit);if(!fr)throw Error('Missing native '+k);const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const s=Math.min(220/fr.img.width,220/fr.img.height),x=(256-fr.img.width*s)/2,y=(256-fr.img.height*s)/2,pt=q=>[x+q[0]*s,y+q[1]*s];canvas.getContext('2d').drawImage(fr.img,x,y,fr.img.width*s,fr.img.height*s);images[k]=canvas.toDataURL().split(',')[1];meta[k]={...c,grip:pt([fr.ax,fr.ay]),object_bounds:[...pt(fr.at.min),...pt(fr.at.max)],...(fr.at.tip?{tip:pt(fr.at.tip)}:{}),...(fr.at.top?{nocks:{top:pt(fr.at.top),bot:pt(fr.at.bot)}}:{}),native:[fr.img.width,fr.img.height],palette:HAND_COLORS[c.cls]||HAND_COLORS.fighter};}
   return{meta,images,legal:{group:keys[0],cls:c0.cls,id:c0.id,sprite:Game.spriteFor(it),item:it,canEquip:reason}};
  },{keys,cells:plan.cells});
  for(const[k,v]of Object.entries(data.images))fs.writeFileSync(path.join(out,k+'-reference.png'),Buffer.from(v,'base64'));Object.assign(inventory.cells,data.meta);inventory.legal.push(data.legal);console.log('Native references '+group+' '+keys.length);
 }
 inventory.reuse_audits=[];
 for(const[k,c]of Object.entries(inventory.cells))if(c.registered_reuse){const a=fs.readFileSync(path.join(out,k+'-reference.png')),b=fs.readFileSync(path.join(out,c.registered_reuse+'-reference.png'));if(!a.equals(b))throw Error('Reuse pixels differ '+k);for(const field of ['grip','object_bounds','native','nocks','tip'])if(JSON.stringify(c[field])!==JSON.stringify(inventory.cells[c.registered_reuse][field]))throw Error('Reuse metadata differs '+k+' '+field);inventory.reuse_audits.push({key:k,from:c.registered_reuse,sha256:crypto.createHash('sha256').update(a).digest('hex')});}
 fs.writeFileSync(path.join(out,'reference-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
 require('node:child_process').execFileSync('python3',[path.join(__dirname,'reference-batch-ab-named.py')]);
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
