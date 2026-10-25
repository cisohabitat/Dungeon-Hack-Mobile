// Reconcile named identities, actual relic class restrictions and source/delivery coverage.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELICS, relicUsableBy } from '../../js/relics.js';
import { ITEMS, CLASSES } from '../../js/data.js';
import { namedSprite, NAMED_ART } from '../../js/namedart.js';
import { PAINTED } from '../../js/paintedcatalog.js';
const dir=path.dirname(fileURLToPath(import.meta.url));
const sources=[];
for(const file of fs.readdirSync(dir).filter(f=>/^generation-.*\.json$/.test(f)).sort()){
 const m=JSON.parse(fs.readFileSync(path.join(dir,file)));
 for(const c of Object.values(m.cells||{}))if(c.id&&c.cls&&c.pose&&typeof c.two==='boolean')sources.push({...c,manifest:file});
}
const entries=Object.entries(RELICS).map(([key,r])=>{
 const b=ITEMS[r.t],id=namedSprite(key),held=['weapon','shield'].includes(b.kind);
 const source=sources.filter(c=>c.id===id);
 const unique=[...new Map(source.map(c=>[[c.cls,c.pose,!!c.two,!!c.lit].join('|'),{cls:c.cls,pose:c.pose,two:!!c.two,lit:!!c.lit}])).values()];
 return{key,id,name:r.name,t:r.t,kind:b.kind,category:r.mythic?'mythic':r.legend?'legendary':'relic',held_candidate:held,legal_classes:Object.keys(CLASSES).filter(cls=>relicUsableBy(key,cls)),authored_identity:!!NAMED_ART[key],source_states:unique,source_manifests:[...new Set(source.map(c=>c.manifest))].sort(),runtime_held:Object.values(PAINTED.held).filter(c=>c.id===id).map(c=>({cls:c.cls,pose:c.pose,two:c.two,lit:c.lit})),runtime_carried:Object.values(PAINTED.carried).filter(c=>c.id===id).map(c=>c.cls)};
});
const report={scope:'Named equipment identity/class coverage. Weapon/shield held candidates are separate from worn item art. Source scan requires exact id/class/pose/two metadata and covers held frames; carried source review is separate. Source states do not imply native activation; required pose families must still be audited per renderer.',entries,total_named_identities:entries.length,held_candidates:entries.filter(e=>e.held_candidate).length,held_candidates_with_source:entries.filter(e=>e.held_candidate&&e.source_states.length).length,held_candidates_with_delivery:entries.filter(e=>e.held_candidate&&(e.runtime_held.length||e.runtime_carried.length)).length};
const target=path.join(dir,'batch-aa-penitent-preview/named-library-audit.json'),text=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==text)throw Error('Named library audit is stale');}else fs.writeFileSync(target,text);
console.log(`${report.total_named_identities} named identities; ${report.held_candidates} weapon/shield candidates; ${report.held_candidates_with_source} with source; ${report.held_candidates_with_delivery} delivered`);
