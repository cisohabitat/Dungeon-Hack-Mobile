'use strict';
// Frozen source review. These proxies are never used as activation evidence.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const{chromium}=require('playwright'),{serve}=require('../../test/server'),{startGame,faceOpenGround,watchForErrors}=require('../../test/browser/helpers');
const folder='batch-ab-named-preview',root=path.join(__dirname,folder),out=path.join(root,'dungeon');fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'generation-batch-ab-named.json'))),measure=JSON.parse(fs.readFileSync(path.join(root,'measurements.json')));
const times={rest:undefined,drawback:.08,windup:.16,strike:.24,cut:.32,sweep:.42,through:.52,recover:.68,return:.84,drive:.42,bowdraw:.3,bowfull:.5};
const cases=Object.entries(manifest.cells).map(([key,c])=>({key,...c,u:times[c.pose],expected:key}));
for(const[family,keys]of Object.entries(manifest.groups)){
 for(const lit of [...new Set(keys.map(k=>manifest.cells[k].lit))]){
 const selected=keys.filter(k=>manifest.cells[k].lit===lit),firstKey=selected.find(k=>manifest.cells[k].pose==='rest')||selected[0],first=manifest.cells[firstKey],prefix=family+(lit?'-lit':''),key=firstKey;
 const shaft=['staff','spear'].includes(first.base),blade=['dagger','shortsword','longsword','mace','hammer','battleaxe'].includes(first.base),calmPose=shaft?'drive':blade?'cut':first.pose,calmKey=selected.find(k=>manifest.cells[k].pose===calmPose&&manifest.cells[k].two===first.two)||key;
 cases.push({key:prefix+'-calm',...first,pose:calmPose,u:shaft?.42:blade?.32:['shortbow','longbow'].includes(first.base)?.5:undefined,calm:true,expected:calmKey});
 cases.push({key:prefix+'-recovered',...first,pose:'rest',u:1,expected:key});
 // Each family's actual read/use/cast source selection is checked, including
 // staff hand release. Generic caster FX here are stress fixtures, not skills.
 for(const action of ['read','use','cast']){
  const pose=first.base==='staff'&&action==='cast'?'channel':'rest';
  const expected=first.kind==='carried'?key:selected.find(k=>{const c=manifest.cells[k];return c.pose===pose&&!c.two;});
  if(!expected)throw Error('Missing action state '+prefix+' '+action);
  cases.push({key:prefix+'-'+action,...first,pose:'rest',u:undefined,action,expected,allowLowering:true});
 }
 if(first.kind==='carried'&&['shield','buckler','towershield'].includes(first.base))cases.push({key:prefix+'-bash',...first,pose:'carried',u:undefined,action:'bash',expected:key});
 }
}
if(new Set(cases.map(c=>c.key)).size!==cases.length)throw Error('Duplicate named source capture');
const selectedCases=process.env.AB_BOWS_ONLY==='1'?cases.filter(c=>['shortbow','longbow'].includes(c.base)):cases;
(async()=>{const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const audits=[],captures=[];
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const origin=`http://127.0.0.1:${server.address().port}`;
 for(const width of[390,320]){
  const context=await browser.newContext({baseURL:origin,viewport:{width,height:width===390?844:667},serviceWorkers:'block'}),page=await context.newPage(),errors=watchForErrors(page);
  await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);});await startGame(page,{seed:'all-named-source-review'});await faceOpenGround(page,3);await page.locator('#floor-card').evaluate(el=>el.style.display='none');
  await page.evaluate(async({manifest,measure,folder})=>{
   Game.update=()=>{};Game.recordRuns(false);const L=Game.level();L.monsters=[];L.npcs=[];L.dressing=[];L.remains=[];L.items={};L.fields=[];L.snares=[];
   const held=Assets.held,carried=Assets.carried,frames={},meta=manifest.cells,byImage=new Map();
   for(const[key,c]of Object.entries(meta)){const im=new Image();im.src='/art/creatures/'+folder+'/'+key+'.png';await im.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=256;canvas.getContext('2d').drawImage(im,0,0);const m=measure.cells[key],fr={img:canvas,ax:m.grip[0],ay:m.grip[1],at:{min:m.object_bounds.slice(0,2),max:m.object_bounds.slice(2),...(m.nocks||{}),...(m.tip?{tip:m.tip}:{})}};frames[key]=fr;byImage.set(canvas,{key,fr});}
   const lookup=(kind,id,pose,cls,two,lit)=>Object.keys(meta).find(k=>{const m=meta[k];return m.kind===kind&&m.id===id&&m.cls===cls&&(kind==='carried'||m.pose===pose&&m.two===!!two&&m.lit===!!lit);});
   Assets.held=(id,pose,cls,two,lit=false)=>{const key=lookup('held',id,pose,cls,two,lit);return key?frames[key]:held(id,pose,cls,two,lit);};
   Assets.carried=(id,cls)=>{const key=lookup('carried',id,'carried',cls,false,false);return key?frames[key]:carried(id,cls);};
   const guards=[];
   for(const[id,cls]of[...new Map(Object.values(meta).map(c=>[c.id+'|'+c.cls,[c.id,c.cls]])).values()]){
    for(const a of[[id,'cast',cls,false,false],[id,'rest','bear',false,false],['not_'+id,'rest',cls,false,false],[id,'rest',cls,true,true]]){if(Assets.held(...a)!==held(...a))throw Error('Exact held guard failed '+a);guards.push(a);}
    if(Assets.carried(id,'bear')!==carried(id,'bear'))throw Error('Exact carried class guard failed');
   }
   window.__ab={frames,meta,byImage,held,carried,guards:guards.length};window.__abRender=Renderer.render;
   window.__abDraw=f=>{
    const now=10000,rs=Game.renderState(now),offhand=f.pose==='left'||f.pose==='thrust',staff=f.base==='staff',bow=['shortbow','longbow'].includes(f.base),released=staff&&!f.two;
    const fx={...rs.fx,swingAt:f.u===undefined?-1e9:now-f.u*800,swingMs:800,offAt:offhand&&f.pose==='thrust'?now-.3*380:-1e9,castAt:f.action==='cast'||f.pose==='channel'?now-.5*520:-1e9,readAt:f.action==='read'||released&&f.pose!=='channel'?now-200:-1e9,readKind:'map',readColor:'#8af',useAt:f.action==='use'?now-200:-1e9,useKind:'drink',useSprite:Game.spriteFor({t:'potion_heal',q:1,e:0}),useColor:'#8f8',throwAt:-1e9,bashAt:f.action==='bash'?now-180:-1e9,bashKind:'shield',arriveAt:-1e9,damageUntil:0,view:{weapon:f.kind==='carried'||offhand?null:f.id,cls:f.cls,two:staff||bow,drawn:bow,shield:f.kind==='carried'?f.id:f.lit?'wayfarer_lantern':null,offhand:offhand?f.id:null,lantern:false,walk:0,steps:0}};
    const ctx=document.querySelector('#view').getContext('2d'),draw=ctx.drawImage,stroke=ctx.stroke,begin=ctx.beginPath,move=ctx.moveTo,line=ctx.lineTo,used=[],bounds=[],tips=[],weaponTips=[];let path=[],string=null,glint=null;
    ctx.drawImage=function(img,x,y,w,h,...a){const item=window.__ab.byImage.get(img);if(item){used.push(item.key);const b=item.fr.at,box=[x+b.min[0]*w/256,y+b.min[1]*h/256,x+b.max[0]*w/256,y+b.max[1]*h/256];bounds.push(box);if(!f.allowLowering&&(box[0]<1||box[1]<1||box[2]>Renderer.W-1||box[3]>Renderer.H-1))throw Error('Painted object clipping '+JSON.stringify({key:f.key,height:Renderer.H,box}));if(b.tip)weaponTips.push([x+b.tip[0]*w/256,y+b.tip[1]*h/256]);if(b.top)tips.push({top:[x+b.top[0]*w/256,y+b.top[1]*h/256],bot:[x+b.bot[0]*w/256,y+b.bot[1]*h/256]});}return draw.call(this,img,x,y,w,h,...a);};
    ctx.beginPath=function(){path=[];return begin.call(this);};ctx.moveTo=function(x,y){path.push([x,y]);return move.call(this,x,y);};ctx.lineTo=function(x,y){path.push([x,y]);return line.call(this,x,y);};ctx.stroke=function(){if(path.length===3&&['#e8e0cc','#d1bde7','#aeb9c7'].includes(this.strokeStyle))string=path.map(p=>p.slice());if(path.length===4&&this.lineWidth===1)glint=path.map(p=>p.slice());return stroke.call(this);};
    Renderer.setCalm(!!f.calm);
    try{window.__abRender(rs.level,rs.cam,rs.sprites,fx,now);if(f.expected&&!used.includes(f.expected))throw Error('Expected exact source '+JSON.stringify({key:f.key,expected:f.expected,used}));if(!used.length)throw Error('No source frame drawn '+f.key);if(tips.length){const t=tips[0];if(!string||Math.hypot(string[0][0]-t.top[0],string[0][1]-t.top[1])>1||Math.hypot(string[2][0]-t.bot[0],string[2][1]-t.bot[1])>1)throw Error('Named bow string detached '+f.key);}const gleam=f.kind==='held'&&!offhand&&!bow&&(staff&&(f.action==='cast'||f.pose==='channel')||f.u>.16&&f.u<.52);if(gleam&&weaponTips.length){if(f.calm&&glint)throw Error('Calm retained named glint '+f.key);if(!f.calm){const t=weaponTips[0];if(!glint||Math.hypot((glint[0][0]+glint[1][0])/2-t[0],(glint[2][1]+glint[3][1])/2-t[1])>1)throw Error('Named glint detached '+f.key);}}return{key:f.key,used,bounds,string,glint,height:Renderer.H};}
    finally{ctx.drawImage=draw;ctx.stroke=stroke;ctx.beginPath=begin;ctx.moveTo=move;ctx.lineTo=line;}
   };
  },{manifest,measure,folder});
  // Resolve published fallback paintings before asserting exact guard identity;
  // source bindings remain separate and unsupported calls retain original APIs.
  const fitting=await page.evaluate(async cases=>{const{Dice,Odds}=await import('/js/rng.js'),before=JSON.stringify(Game.state()),dice=[Dice.s,Odds.s],oldH=Renderer.H,oldCalm=Renderer.calm,checks=[];try{for(const height of[160,360,464]){Renderer.setHeight(height);for(const f of cases)checks.push(window.__abDraw(f));}}finally{Renderer.setHeight(oldH);Renderer.setCalm(oldCalm);}if(JSON.stringify(Game.state())!==before||Dice.s!==dice[0]||Odds.s!==dice[1])throw Error('Source review changed run or dice');return{guards:window.__ab.guards,checks,state_unchanged:true,dice_unchanged:true};},selectedCases);
  const canvasBox=await page.locator('#view').boundingBox();
  for(const f of selectedCases){await page.evaluate(f=>{window.__abDraw(f);Renderer.render=()=>window.__abDraw(f);},f);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));const file=width+'-'+f.key+'.png';await page.screenshot({path:path.join(out,file)});captures.push({width,key:f.key,id:f.id,cls:f.cls,kind:f.kind,action:f.action||null,expected:f.expected,canvas_box:canvasBox,file});}
  if(errors.length)throw Error(errors.join('\n'));audits.push({width,...fitting,console_errors:[]});await context.close();console.log('Named source '+width+': '+selectedCases.length+' captures, '+fitting.checks.length+' fits');
 }
 const result={scope:'Frozen exact named id/class/pose/hand/reflection source proxies; native eligibility/routing references recorded separately. Not native actions, activation, offline or performance proof. Generic action FX do not grant abilities. Complete selected source frame fitting and real renderer string attachment; full run and Dice/Odds unchanged.',audits,captures};
 if(process.env.AB_BOWS_ONLY==='1'){
  fs.writeFileSync(path.join(out,'bow-review.json'),JSON.stringify(result,null,2)+'\n');
  const old=JSON.parse(fs.readFileSync(path.join(out,'review.json')));
  for(const a of audits){const target=old.audits.find(x=>x.width===a.width),replacement=new Map(a.checks.map(x=>[x.key+'|'+x.height,x]));target.checks=target.checks.map(x=>replacement.get(x.key+'|'+x.height)||x);}
  const replacement=new Map(captures.map(x=>[x.width+'|'+x.key,x]));old.captures=old.captures.map(x=>replacement.get(x.width+'|'+x.key)||x);old.bow_refresh={reason:'Physical nock review corrected lower anchors that could otherwise select forearm endpoints; final bow families reverified and recaptured only.',captures:captures.length,checks:audits.reduce((n,a)=>n+a.checks.length,0),report:'bow-review.json'};fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(old,null,2)+'\n');
 }else fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(result,null,2)+'\n');
}finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}})().catch(e=>{console.error(e);process.exitCode=1;});
