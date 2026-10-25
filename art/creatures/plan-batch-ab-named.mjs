// Exact renderer-facing source scope for the remaining named equipment library.
import fs from 'node:fs';
import {RELICS,relicUsableBy} from '../../js/relics.js';
import {ITEMS,CLASSES} from '../../js/data.js';
import {namedSprite} from '../../js/namedart.js';
const dir=new URL('./batch-ab-named-preview/',import.meta.url);fs.mkdirSync(dir,{recursive:true});
const cut=['rest','drawback','windup','strike','cut','sweep','through','recover','return'];
const sheets={},groups={},cells={};let n=0;
for(const[key,r]of Object.entries(RELICS)){
 const b=ITEMS[r.t];if(!['weapon','shield'].includes(b.kind)||key==='penitent')continue;
 const id=namedSprite(key),classes=Object.keys(CLASSES).filter(c=>relicUsableBy(key,c));
 const kind=b.kind==='shield'?'carried':'held',base=b.sprite;
 const family=[];
 for(const cls of classes){
  const poses=kind==='carried'?[['carried',false,false]]:
   ['shortbow','longbow'].includes(base)?['rest','bowdraw','bowfull'].map(p=>[p,false,false]):
   base==='throwknife'?[['rest',false,false]]:
   base==='staff'?[['rest',true,false],['drive',true,false],['rest',false,false],['drive',false,false],['channel',false,false]]:
   base==='spear'?[['rest',false,false],['drive',false,false]]:
   cut.map(p=>[p,false,false]);
  if(kind==='held'&&['dagger','shortsword','longsword'].includes(base)&&cls==='spellblade')poses.push(...cut.map(p=>[p,false,true]));
  if(kind==='held'&&CLASSES[cls].dualWield&&!b.twoHanded&&!b.range&&b.speed<=550)poses.push(['left',false,false],['thrust',false,false]);
  const keys=poses.map(([pose,two,lit])=>{
   const k=`${cls}-${id}-${pose}${base==='staff'?(two?'-two':'-one'):''}${lit?'-lit':''}`;
   cells[k]={id,cls,pose,two,lit,kind,relic:key,item_t:r.t,base};return k;
  });
  groups[`${key}-${cls}`]=keys;family.push({cls,keys});
 }
 // Ranger's native palette is audited against Fighter before any byte reuse.
 for(const g of family)if(g.cls==='ranger'&&family.some(f=>f.cls==='fighter')){
  for(const k of g.keys){const from=k.replace(/^ranger-/,'fighter-');if(cells[from])cells[k].reuse_candidate=from;}
 }
 const unique=family.map(g=>({...g,keys:g.keys.filter(k=>!cells[k].reuse_candidate)})).filter(g=>g.keys.length);
 const chunks=[];
 if(kind==='carried')chunks.push(unique.flatMap(g=>g.keys));
 else if(base==='staff'||base==='spear'||base==='throwknife'||['shortbow','longbow'].includes(base))chunks.push(unique.flatMap(g=>g.keys));
 else{
  let chunk=[];for(const g of unique){if(chunk.length+g.keys.length>18){chunks.push(chunk);chunk=[];}chunk.push(...g.keys);}if(chunk.length)chunks.push(chunk);
 }
 for(const keys of chunks){
  const s='ab'+String(++n).padStart(2,'0');const cols=base==='staff'?5:base==='spear'?2:keys.length<=4?2:3;
  sheets[s]={name:r.name,relic:key,id,base,kind,grid:[cols,Math.ceil(keys.length/cols)],keys,source:`held-${s}.png`};
  keys.forEach((k,i)=>Object.assign(cells[k],{sheet:s,index:i}));
 }
}
for(const[type,bases]of [['shields',['shield','buckler','towershield']],['foci',['holy_symbol','crystal_orb','spellbook']]]){
 const selected=Object.entries(sheets).filter(([,s])=>s.kind==='carried'&&bases.includes(s.base));
 const keys=selected.flatMap(([,s])=>s.keys);for(const[k]of selected)delete sheets[k];
 const s='ab-'+type;sheets[s]={name:'Named '+type,relic:'multiple exact identities',base:type,kind:'carried',grid:[3,Math.ceil(keys.length/3)],keys,source:`held-${s}.png`};keys.forEach((k,i)=>Object.assign(cells[k],{sheet:s,index:i}));
}
for(const[k,c]of Object.entries(cells))if(c.reuse_candidate){const src=cells[c.reuse_candidate];Object.assign(c,{sheet:src.sheet,index:src.index,registered_reuse:c.reuse_candidate});}
const plan={date:'2026-10-25',scope:'All30 remaining named weapon/shield identities, held and carried separately; native reference/class/hand/reflection/offhand audit required. Source review only.',sheets,groups,cells};
fs.writeFileSync(new URL('reference-plan.json',dir),JSON.stringify(plan,null,2)+'\n');
console.log(`${new Set(Object.values(cells).map(c=>c.relic)).size} identities, ${Object.keys(groups).length} class families, ${Object.keys(cells).length} states, ${Object.keys(sheets).length} source sheets; ${Object.values(cells).filter(c=>c.registered_reuse).length} Ranger reuse candidates`);
