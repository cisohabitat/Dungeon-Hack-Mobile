from pathlib import Path
import json,shutil,hashlib,sys
CHECK = "--check" in sys.argv
r=Path(__file__).resolve().parents[1];a=r/'art/creatures';config={'static':{},'themes':{},'held':{},'atlases':{}};delivery=[]
overrides=json.loads((a/'runtime-overrides.json').read_text());used_overrides=set()
def verify_or_write(path,data):
 if CHECK:
  assert path.read_bytes()==data,str(path)
 else:path.write_bytes(data)
def ship(src,dest):
 if dest in overrides:src=Path(overrides[dest]['source']);used_overrides.add(dest)
 src=a/src;dst=r/'img'/dest;dst.parent.mkdir(parents=True,exist_ok=True);verify_or_write(dst,src.read_bytes());delivery.append({'source':str(src.relative_to(r)),'runtime':str(dst.relative_to(r)),'sha256':hashlib.sha256(src.read_bytes()).hexdigest()});return str(dst.relative_to(r))
for b in 'efgh':
 d=json.loads((a/f'generation-batch-{b}.json').read_text())
 for key in d['creatures']:
  config['atlases'][key]=ship(Path(f'batch-{b}-preview/{key}.webp'),f'creatures/{key}.webp')
config['atlases']['mender-heal']=ship(Path('batch-f-preview/mender-heal.webp'),'creatures/mender-heal.webp')
for key in ['merchant','pedlar','wick']:config['static'][key]=ship(Path(f'batch-i-preview/{key}.webp'),f'world/{key}.webp')
for b in 'jklmn':
 d=json.loads((a/f'generation-batch-{b}.json').read_text())
 for key in d['scenes']:
  live=('dress_' if b in 'lmn' else '')+key
  config['static'][live]=ship(Path(f'batch-{b}-preview/{key}.webp'),f'world/{live}.webp')
d=json.loads((a/'generation-batch-p.json').read_text())
for key in d['icons']:
 if key!='amulet_tooth':config['static'][key]=ship(Path(f'batch-p-preview/{key}.webp'),f'world/{key}.webp')
for key in ['flames','ripple','snare']:config['static']['dress_'+key]=ship(Path(f'batch-q-preview/{key}.png'),f'world/dress_{key}.png')
config['effects']={key:ship(Path(f'batch-q-preview/{key}.png'),f'effects/{key}.png') for key in json.loads((a/'generation-batch-q.json').read_text())['effects']}
d=json.loads((a/'generation-batch-o.json').read_text())
for key,s in d['sheets'].items():config['themes'][str(s['theme_index'])]={part:ship(Path(f'batch-o-preview/{key}_{part}.png'),f'materials/{key}_{part}.png') for part in ['wall','floor','ceiling']}
for b in 'rs':
 d=json.loads((a/f'generation-batch-{b}.json').read_text())
 for key in d['cells']:
  if key=='stairArch':continue
  config['themes']['0'][key]=ship(Path(f'batch-{b}-preview/{key}.png'),f'materials/halls_{key}.png')
for batch in ['t','z','aa','aa-melee2','aa-melee3','aa-reflected','aa-melee4','aa-melee5','aa-ranged','aa-bows','aa-rare','aa-greatsword','aa-penitent']:
 d=json.loads((a/f'generation-batch-{batch}.json').read_text());m=json.loads((a/f'batch-{batch}-preview/measurements.json').read_text())['cells']
 for key,c in d['cells'].items():config['held'][key]={'path':ship(Path(f'batch-{batch}-preview/{key}.png'),f'held/{key}.png'),'id':c['id'],'cls':c['cls'],'pose':c['pose'],'two':c['two'],'lit':bool(c.get('lit',False)),'grip':m[key]['grip'],'bounds':m[key]['object_bounds'],**({'nocks':m[key]['nocks']} if 'nocks' in m[key] else {}),**({'tip':m[key]['tip']} if 'tip' in m[key] else {})}
m=json.loads((a/'batch-p-preview/measurements.json').read_text());config['carried']={}
for cls in ['fighter','cleric']:
 key='runeshield_'+cls;config['carried'][cls]={'path':ship(Path(f'batch-p-preview/runeshield-{cls}-held.png'),f'held/runeshield-{cls}.png'),'id':'runeshield','cls':cls,'grip':m[key]['grip'],'bounds':m[key]['object_bounds']}
d=json.loads((a/'generation-batch-y.json').read_text());m=json.loads((a/'batch-y-preview/measurements.json').read_text())['cells']
for key,c in d['cells'].items():
 config['carried'][key]={'path':ship(Path(f'batch-y-preview/{key}.png'),f'held/{key}.png'),'id':c['id'],'cls':c['cls'],'grip':m[key]['grip'],'bounds':m[key]['object_bounds']}
# Named held and carried surfaces retain separate exact identity/class routes.
d=json.loads((a/'generation-batch-ab-named.json').read_text());m=json.loads((a/'batch-ab-named-preview/measurements.json').read_text())['cells']
for key,c in d['cells'].items():
 meta={'path':ship(Path(f'batch-ab-named-preview/{key}.png'),f'held/{key}.png'),'id':c['id'],'cls':c['cls'],'grip':m[key]['grip'],'bounds':m[key]['object_bounds']}
 if c['kind']=='held':
  meta.update({'pose':c['pose'],'two':c['two'],'lit':bool(c.get('lit',False))})
  for field in ['nocks','tip']:
   if field in m[key]:meta[field]=m[key][field]
  config['held'][key]=meta
 else:config['carried'][key]=meta
# AC–AH sources: exact equipment pairs, null-id hands, small items and regions.
for batch in ['ac-casters','ad-shields','ae-hands']:
 d=json.loads((a/f'generation-batch-{batch}.json').read_text());measure=json.loads((a/f'batch-{batch}-preview/measurements.json').read_text());measure=measure.get('cells',measure)
 for key,c in d['cells'].items():
  meta={'path':ship(Path(f'batch-{batch}-preview/{key}.png'),f'held/{key}.png'),'id':c['id'],'cls':c['cls'],'grip':measure[key]['grip'],'bounds':measure[key]['object_bounds'],**({'base':measure[key]['base']}if 'base'in measure[key]else{})}
  if c['kind']=='held':meta.update(pose=c['pose'],two=c['two'],lit=c['lit']);config['held'][key]=meta
  else:config['carried'][key]=meta
small=json.loads((a/'generation-batch-af-items.json').read_text())
for key,c in small['cells'].items():
 if key in ['key','amulet_tooth']:continue
 if not c.get('approved_reuse'):config['static'][key]=ship(Path(f'batch-af-items-preview/{key}.png'),f'world/{key}.png')
# Rarity variants use the same approved painting, with their cached native outline.
import subprocess
grades=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {ITEMS} from './js/data.js';import {RELICS} from './js/relics.js';console.log(JSON.stringify({relic:[...new Set(Object.values(ITEMS).filter(b=>['weapon','armor','shield'].includes(b.kind)||(['ring','amulet'].includes(b.kind)&&b.tier>=99)).map(b=>b.sprite))],legend:[...new Set(Object.values(RELICS).filter(r=>r.legend).map(r=>ITEMS[r.t].sprite))]}));"],cwd=r,text=True))
for grade,keys in grades.items():
 for key in keys:
  if key in small['cells']and key in config['static']:config['static'][grade+'_'+key]=config['static'][key]
regional=json.loads((a/'generation-batch-ag-ah.json').read_text())
for key,c in regional['cells'].items():
 config['themes'][str(c['theme'])][c['key']]=ship(Path(f'batch-ag-ah-preview/{key}.png'),f'materials/region_{key}.png')
m=json.loads((a/'batch-ai-preview/measurements.json').read_text())
config['overlays']={'amber_lantern':{'path':ship(Path('batch-ai-preview/amber-lantern.png'),'overlays/amber-lantern.png'),**{k:m[k] for k in ['anchor','window','unitsPerPixel']}}}
m=json.loads((a/'batch-aj-preview/measurements.json').read_text())
config['overlays']['reading_scroll']={'path':ship(Path('batch-aj-preview/reading-scroll.png'),'overlays/reading-scroll.png'),**{k:m[k] for k in ['anchor','panel','unitsPerPixel']}}
config['decals']={key:ship(Path(f'batch-ak-preview/{key}.png'),f'decals/{key}.png') for key in ['blood','ash']}
assert used_overrides==set(overrides),'Unused runtime art override'
verify_or_write(r/'js/paintedcatalog.js',('// Selected approved exports; generated by tools/export-painted-runtime.py.\nexport const PAINTED = '+json.dumps(config,indent=2)+';\n').encode())
verify_or_write(a/'runtime-delivery.json',(json.dumps({'files':delivery,'exclusions':{'stairArch':'Painted surfaces are composed once within the original exact arch alpha; source candidates remain unchanged.','amulet_tooth':'Reserve source; seeded amulet look must not reveal identity.','reserve poses':'Unused poses are not new gameplay actions.','regional architecture':'Native gate edges and coloured lock plates are retained in cached composition; all regional texture sources are demand-loaded.'}},indent=2)+'\n').encode())
print(len(delivery),'approved exports copied')
