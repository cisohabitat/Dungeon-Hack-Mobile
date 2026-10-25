'use strict';
const manifest=require('../../art/creatures/generation-batch-ab-named.json');
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

module.exports={manifest,cases,setup:async function(page){await page.evaluate(async manifest=>{
   Game.update=()=>{};Game.recordRuns(false);const L=Game.level();L.monsters=[];L.npcs=[];L.dressing=[];L.remains=[];L.items={};L.fields=[];L.snares=[];
   const held=Assets.held,carried=Assets.carried,frames={},meta=manifest.cells,byImage=new Map();
   const {paintedHeld,paintedCarried}=await import('/js/paintedworld.js');
   for(const c of Object.values(meta))if(c.kind==='carried')carried(c.id,c.cls);else held(c.id,c.pose,c.cls,c.two,c.lit);
   const deadline=performance.now()+30000;
   while(!Object.values(meta).every(c=>(c.kind==='carried'?paintedCarried(c.id,c.cls):paintedHeld(c.id,c.pose,c.cls,c.two,c.lit)))){if(performance.now()>deadline)throw Error('Named runtime family loading deadline');await new Promise(r=>setTimeout(r,20));}
   for(const[key,c]of Object.entries(meta)){const fr=c.kind==='carried'?carried(c.id,c.cls):held(c.id,c.pose,c.cls,c.two,c.lit);if(fr.img.width!==256)throw Error('Not a painted named frame '+key);frames[key]=fr;byImage.set(fr.img,{key,fr});}
   const guards=[];
   for(const c of Object.values(meta)){
    if(paintedHeld(c.id,'rest','bear',false,false)||paintedHeld('not_'+c.id,'rest',c.cls,false,false)||paintedHeld(c.id,'rest',c.cls,true,true)||paintedCarried(c.id,'bear'))throw Error('Exact named guard failed');guards.push(c.id);
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
},manifest);}};
