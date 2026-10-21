import json,statistics,collections,hashlib
from pathlib import Path
root=Path(__file__).parent;prior=root.parent/'2026-10-20-wayfarer'
repo=root.resolve().parents[2]
for name,expected in json.loads((root/'source-hashes.json').read_text()).items():
 assert hashlib.sha256((repo/name).read_bytes()).hexdigest()==expected,('source changed',name)
jobs=json.loads((root/'commands.json').read_text());missing=[j['name'] for j in jobs if not (root/(j['name']+'.json')).exists()]
if missing:raise SystemExit('Incomplete cells: '+', '.join(missing))
def rows(path):return [r for group in json.loads(path.read_text())['results'].values() for r in group]
def stats(rs):
 return {'runs':len(rs),'wins':sum(bool(r.get('won')) for r in rs),'winPercent':round(100*sum(bool(r.get('won')) for r in rs)/len(rs),2),'meanDepth':round(statistics.mean(r.get('deepest',0) for r in rs),2),'meanLevel':round(statistics.mean(r.get('level',0) for r in rs),2),'floorOneDeaths':sum(r.get('died') and r.get('deepest')==1 for r in rs),'causes':dict(collections.Counter(r.get('cause','') for r in rs if r.get('died'))),'meanPotions':round(statistics.mean(r.get('potionsDrunk',0) for r in rs),2),'meanRests':round(statistics.mean(r.get('rests',0) for r in rs),2),'casts':dict(sum((collections.Counter(r.get('casts',{})) for r in rs),collections.Counter())),'talents':dict(collections.Counter(t for r in rs for t in r.get('wayfarerLearned',{}).get('talents',[]))),'lessons':dict(collections.Counter(t for r in rs for t in r.get('wayfarerLearned',{}).get('lessons',[])))}
out={'baseline':'64d7949971f2f06a04e36ba0747dfdf8a9953087','cells':{},'comparisons':{}}
for j in jobs:
 name=j['name'];rs=rows(root/(name+'.json'));expected=400 if name.startswith('new-8-') or name.startswith('new-16-') else 24 if '-public-' in name else 10 if name.startswith('baseline-pilot-') else 20
 assert len(rs)==expected,(name,len(rs),expected)
 assert not any('ERROR' in r.get('cause','') or 'TIMEOUT' in r.get('cause','').upper() or r.get('timedOut') for r in rs),name
 out['cells'][name]=stats(rs)
for length in [8,16]:
 for diff in ['normal','hard']:
  before=[];after=[]
  for prefix in ['bench','alt','third']:
   old=rows(prior/(('spellblade-' if length==8 else 'final-16-')+diff+'-'+prefix+'.json'));new=rows(root/f'new-{length}-{diff}-{prefix}.json')
   assert len(old)==len(new)==400
   a=json.loads((prior/(('spellblade-' if length==8 else 'final-16-')+diff+'-'+prefix+'.json')).read_text());b=json.loads((root/f'new-{length}-{diff}-{prefix}.json').read_text());assert a['options']==b['options'] and a['seeds']==b['seeds'] and a['trialsPerSeed']==b['trialsPerSeed']
   pilot=rows(root/f'baseline-pilot-{length}-{diff}-{prefix}.json')
   for a,b in zip(old[:10],pilot):assert all(b.get(k)==v for k,v in a.items()),(length,diff,prefix,'baseline mismatch')
   before+=old;after+=new
  out['comparisons'][f'{length}-{diff}']={'before':stats(before),'after':stats(after)}
pairs=0
for diff in ['normal','hard']:
 for prefix in ['bench','alt','third']:
  a=(root/f'baseline-public-{diff}-{prefix}.log').read_text().splitlines();b=(root/f'new-public-{diff}-{prefix}.log').read_text().splitlines()
  a=[s for s in a if s.startswith('FP ')];b=[s for s in b if s.startswith('FP ')];assert a==b and len(a)==24,(diff,prefix,'public regression');pairs+=len(a)
prototype=[]
for command in json.loads((root/'prototype/commands.json').read_text()):
 f=root/'prototype'/(command['name']+'.json')
 if f.exists():prototype+=rows(f)
assert len(prototype)==3568 and not any('ERROR' in r.get('cause','') or r.get('timedOut') for r in prototype)
tuning=0
for name in ['tuning-memory','tuning-memory-aim','tuning-memory-final']:
 for command in json.loads((root/name/'commands.json').read_text()):
  rs=rows(root/name/(command['name']+'.json'));assert len(rs)==10 and not any('ERROR' in r.get('cause','') or r.get('timedOut') for r in rs)
  tuning+=len(rs)
repeat=rows(root/'tuning-memory/determinism-bench0-repeat.json')
assert repeat==rows(root/'tuning-memory/memory-8-normal-bench0.json')
tuning+=len(repeat)
assert tuning==490
verified=0
for length in [8,16]:
 for diff in ['normal','hard']:
  for prefix in ['bench','alt']:
   pilot=sum((rows(root/'tuning-memory-final'/f'memory-final-{length}-{diff}-{prefix}{i}.json') for i in [0,1]),[])
   assert rows(root/f'new-{length}-{diff}-{prefix}.json')[:20]==pilot,(length,diff,prefix,'selected source changed outcomes')
   verified+=len(pilot)
out['prototypeOutcomes']=len(prototype);out['tuningOutcomes']=tuning;out['selectedPilotMatches']=verified
out['publicPairs']=pairs;out['freshOutcomes']=sum(c['runs'] for c in out['cells'].values());out['reusedBaselineOutcomes']=4800
out['allFreshOutcomes']=out['freshOutcomes']+len(prototype)+tuning
(root/'summary.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'freshOutcomes':out['freshOutcomes'],'publicPairs':pairs,'comparisons':{k:{'before':v['before']['winPercent'],'after':v['after']['winPercent']} for k,v in out['comparisons'].items()}},indent=2))
