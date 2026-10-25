import fs from 'node:fs';
import {ITEM_ART} from '../../js/itemart.js';
import {ITEMS,CLASSES} from '../../js/data.js';
import {RELICS} from '../../js/relics.js';
import {namedSprite} from '../../js/namedart.js';
import {PAINTED} from '../../js/paintedcatalog.js';
const dir=new URL('./',import.meta.url);
// This initializes plans; never overwrite registered production provenance.
for (const file of ['generation-batch-ae-hands.json','generation-batch-af-items.json']) {
 if (fs.existsSync(new URL(file,dir))) throw new Error(`Refusing to overwrite existing ${file}; use its recorded manifest.`);
}
const write=(file,data)=>fs.writeFileSync(new URL(file,dir),JSON.stringify(data,null,2)+'\n');
const ae={date:'2026-10-25',tool:'image_gen.imagegen',model:'not disclosed',brief:'REQUEST-batch-ae-hands.md',status:'source production; not activated',sheets:{},cells:{}};
for(const cls of [...Object.keys(CLASSES),'bear']){
 const sheet='ae-'+cls,keys=[];
 for(const pose of ['fist','punch','cast']){const key=cls+'-empty-'+pose;keys.push(key);ae.cells[key]={kind:'held',id:null,cls,pose,two:false,lit:false,base:'empty',sheet,index:keys.length-1,...(cls==='ranger'?{registered_reuse:'fighter-empty-'+pose}:{} )};}
 if(cls!=='ranger')ae.sheets[sheet]={source:sheet+'.png',grid:[3,1],keys,cls};
}
// Ranger uses the Fighter native fallback palette. The reference tool must
// prove every pixel and landmark equal before the exporter may reuse it.
for(const c of Object.values(ae.cells))if(c.registered_reuse){c.sheet='ae-fighter';c.index=ae.cells[c.registered_reuse].index;}
write('generation-batch-ae-hands.json',ae);
const af={date:'2026-10-25',tool:'image_gen.imagegen',model:'not disclosed',brief:'REQUEST-batch-af-items.md',status:'source production; not activated',sheets:{},cells:{}};
const p=JSON.parse(fs.readFileSync(new URL('generation-batch-p.json',dir)));
for(const id of Object.keys(ITEM_ART)){
 const old=p.icons[id];const reuse=!!PAINTED.static[id]||id==='amulet_tooth';
 af.cells[id]={kind:'small-item',id,base:id,named:false,label:Object.values(ITEMS).find(b=>b.sprite===id)?.name||id.replaceAll('_',' '),...(reuse?{approved_reuse:'batch-p-preview/'+id+'.webp',reserve:id==='amulet_tooth'}:{})};
 if(reuse&&!old)throw Error('No approved P source '+id);
}
for(const [relic,r]of Object.entries(RELICS)){const id=namedSprite(relic);af.cells[id]={kind:'small-item',id,base:ITEMS[r.t].sprite,named:true,relic,item_t:r.t,label:r.name};}
let n=0;for(const named of [false,true]){const keys=Object.keys(af.cells).filter(k=>af.cells[k].named===named&&!af.cells[k].approved_reuse);for(let start=0;start<keys.length;start+=8){const selected=keys.slice(start,start+8),sheet='af'+String(++n).padStart(2,'0');af.sheets[sheet]={source:'items-'+sheet+'.png',grid:[4,2],keys:selected,named};selected.forEach((key,index)=>Object.assign(af.cells[key],{sheet,index}));}}
af.inventory={base_keys:Object.keys(ITEM_ART).length,named_keys:Object.keys(RELICS).length,approved_base_reuses:7,new_base_paintings:88,new_named_paintings:47,new_paintings:135,total_small_item_sources:142,reserve:'amulet_tooth remains unbound; seeded amulet appearance persists'};
write('generation-batch-af-items.json',af);
console.log('AE24 hand bindings /21 unique paintings; AF142 small-item sources /135 new paintings /7 approved P reuses.');
