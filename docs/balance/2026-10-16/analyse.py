#!/usr/bin/env python3
"""Reproduce this audit's summary from runs.json.gz (Python standard library only).

The 10 trials on a dungeon share its layout and sometimes repeat an identity.
Resample dungeon-seed clusters within each prefix, rather than treating all
1,200 outcomes per class as independent random samples. Path rates remain
conditional on surviving to choose one, with backgrounds tied to path order.
"""
import collections,gzip,hashlib,json,math,pathlib,random,sys
CLASSES=['cleric','fighter','mage','thief','ranger','druid']
PREFIXES=['bench','alt','third']
DIFFS=['normal','hard']
BG=['oathbroken','tombwise','ashborn','cloistered','deepborn','debtor']
BOOT=5000

def tally(rows,key):
 return dict(sorted(collections.Counter(str(r.get(key,'none')) for r in rows).items()))
def top_causes(rows):
 return dict(sorted(collections.Counter(r.get('cause','?') for r in rows if r.get('died')).items(),key=lambda t:(-t[1],t[0])))
def describe(rows):
 n=len(rows); wins=[r for r in rows if r.get('won')]; dead=[r for r in rows if r.get('died')]
 entries=[r['arrive']['8'] for r in rows if r.get('arrive',{}).get('8')]
 entry_avg=lambda key: sum(r[key] for r in entries)/len(entries) if entries else None
 avg=lambda key,rs=rows: sum(r.get(key,0) or 0 for r in rs)/len(rs) if rs else None
 return {'runs':n,'wins':len(wins),'deaths':len(dead),'timeouts':sum(bool(r.get('timedOut')) for r in rows),
 'errors':sum((r.get('cause') or '').startswith('ERROR') for r in rows),'winRate':len(wins)/n,
 'prePathDeaths':sum(not r.get('path') for r in dead),'floor1Deaths':sum(r.get('deepest')==1 for r in dead),
 'belowLevel5Deaths':sum(r.get('level',0)<5 for r in dead),'avgDepth':avg('deepest'),'avgLevel':avg('level'),
 'avgKills':avg('kills'),'avgRests':avg('rests'),'avgHealingPotionUseAttempts':avg('potionsDrunk'),
 'avgHealingPotionsAtEnd':avg('potsAtEnd'),'avgHealingPotionsAtDeath':avg('potsAtEnd',dead),
 'deathsWithHealingPotions':sum(r.get('potsAtEnd',0)>0 for r in dead),
 'avgGoldAtEnd':avg('goldFound'),'avgGoldOfWinners':avg('goldFound',wins),
 'avgHealingSpellsCast':sum(sum(r.get('casts',{}).get(sp,0) for sp in ['cure_light','cure_serious','mending_moss']) for r in rows)/n,'avgHealingPotionsBought':avg('draughtsBought'),
 'avgOilUseAttempts':avg('oils'),'avgScrollUseAttempts':avg('scrollsRead'),'avgAbilityAttempts':avg('abilities'),
 'avgHealsLeftOfWinners':avg('potsAtEnd',wins),
 'finalFloorArrivals':sum(r.get('deepest',0)>=8 for r in rows),'finalFloorDeaths':sum(r.get('deepest')==8 for r in dead),
 'finalFloorDeathCauses':top_causes([r for r in dead if r.get('deepest')==8]),
 'finalFloorEntryRecords':len(entries),'avgFinalFloorEntryHP':entry_avg('hp'),'avgFinalFloorEntryMaxHP':entry_avg('maxHp'),
 'avgFinalFloorEntryPotions':entry_avg('pots'),'avgFinalFloorEntryLevel':entry_avg('lvl'),
 'avgFinalFloorEntryHealthRatio':sum(r['hp']/r['maxHp'] for r in entries)/len(entries) if entries else None,
 'deathsByFloor':tally(dead,'deepest'),'deathCauses':top_causes(rows),
 'prePathDeathCauses':top_causes([r for r in dead if not r.get('path')]),
 'pathTakenOnFloor':tally([r for r in rows if r.get('path')],'pathAt'),
 'capstoneInWins':sum(bool(r.get('capstone')) for r in wins),
 'pathBackgrounds':{p:tally([r for r in rows if (r.get('path') or 'none')==p],'bg') for p in sorted(set(r.get('path') or 'none' for r in rows))}}
def q(values,p):
 values=sorted(values); pos=(len(values)-1)*p; lo=math.floor(pos); hi=math.ceil(pos)
 return values[lo]+(values[hi]-values[lo])*(pos-lo)

def analyse(archive):
 manifest=archive['provenance']
 assert archive['format']==1 and len(manifest['cells'])==36 and not manifest.get('failures')
 cells={}; raw=list(archive['measurements'])
 assert len(raw)==36
 for data in raw:
  cls=data['cls']; prefix=data['prefix']; diff=data['difficulty']
  key=(prefix,diff,cls)
  assert key not in cells
  assert prefix in PREFIXES and diff in DIFFS and cls in CLASSES
  assert list(data['results'])==[cls]
  rows=data['results'][cls]
  assert len(rows)==400 and data['seeds']==[prefix+str(i) for i in range(40)]
  assert data['fit'] and data['trialsPerSeed']==10
  assert data['options']=={'levels':8,'size':'medium','monsters':'normal','treasure':'normal','lockedDoors':True,'traps':True,'permadeath':False,'difficulty':diff}
  for i,r in enumerate(rows):
   assert not (r.get('cause') or '').startswith('ERROR'), r
   assert r['seed']==prefix+str(i//10) and r['bg']==BG[i%6] and r['cls']==cls
   assert sum(bool(r.get(k)) for k in ['won','died','timedOut'])==1
  cells[key]=rows
 raw.sort(key=lambda c:(PREFIXES.index(c['prefix']),DIFFS.index(c['difficulty']),CLASSES.index(c['cls'])))
 assert sum(len(c['results'][c['cls']]) for c in raw)==manifest['plannedRuns']==14400
 summary={'format':1,'revision':manifest['revision'],'observerSha256':manifest['observerSha256'],
 'rulesTree':manifest['rulesTree'],
 'runs':14400,'seedSets':PREFIXES,'seedsPerSet':40,'trialsPerSeed':10,'runsPerClassAndDifficulty':1200,
 'bootstrap':{'replicates':BOOT,'rngSeed':16102026,'method':'percentile 95%; resample 40 dungeon-seed clusters within each seed prefix; same seed weights across classes'},'difficulty':{},'cells':[]}
 for prefix in PREFIXES:
  for diff in DIFFS:
   for cls in CLASSES:
    rs=cells[prefix,diff,cls]
    summary['cells'].append({'prefix':prefix,'difficulty':diff,'cls':cls,**describe(rs)})
 rng=random.Random(16102026)
 for diff in DIFFS:
  combined={cls:sum([cells[prefix,diff,cls] for prefix in PREFIXES],[]) for cls in CLASSES}
  detail={cls:describe(combined[cls]) for cls in CLASSES}
  for cls in CLASSES:
   detail[cls]['paths']={p:describe([r for r in combined[cls] if r.get('path')==p]) for p in sorted(set(r.get('path') for r in combined[cls] if r.get('path')))}
  seed_wins={cls:[[sum(r['won'] for r in cells[prefix,diff,cls][i*10:(i+1)*10]) for i in range(40)] for prefix in PREFIXES] for cls in CLASSES}
  rates={cls:[] for cls in CLASSES}; overall=[]
  high=max(CLASSES,key=lambda c:detail[c]['winRate']); low=min(CLASSES,key=lambda c:detail[c]['winRate']); gaps=[]
  for b in range(BOOT):
   weights=[collections.Counter(rng.randrange(40) for _ in range(40)) for p in PREFIXES]
   vals={cls:sum(seed_wins[cls][p][i]*w for p in range(3) for i,w in weights[p].items())/1200 for cls in CLASSES}
   for cls in CLASSES: rates[cls].append(vals[cls])
   overall.append(sum(vals.values())/6); gaps.append(vals[high]-vals[low])
  for cls in CLASSES: detail[cls]['seedCluster95']=[q(rates[cls],.025),q(rates[cls],.975)]
  summary['difficulty'][diff]={'overall':describe(sum(combined.values(),[])), 'classes':detail,
   'overallSeedCluster95':[q(overall,.025),q(overall,.975)],'spread':{'high':high,'low':low,'gap':detail[high]['winRate']-detail[low]['winRate'],'seedCluster95':[q(gaps,.025),q(gaps,.975)],'note':'descriptive interval for the observed high/low pair; not adjusted for selecting the pair or multiple comparisons'}}
 summary['datasetOutcomeSha256']=hashlib.sha256(json.dumps(raw,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 return summary

if __name__=='__main__':
 # No game code is imported here. The archive holds every observed outcome;
 # validation and the seeded bootstrap reproduce summary.json without replays.
 source=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).with_name('runs.json.gz')
 archive=json.loads(gzip.decompress(source.read_bytes()))
 print(json.dumps(analyse(archive),indent=2))
