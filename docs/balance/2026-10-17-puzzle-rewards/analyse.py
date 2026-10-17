#!/usr/bin/env python3
"""Check declared regression/balance bars; retain all observed resource changes."""
import argparse,collections,gzip,json,pathlib
p=argparse.ArgumentParser();p.add_argument('archive',type=pathlib.Path);a=p.parse_args()
data=json.loads(gzip.decompress(a.archive.read_bytes()));groups=collections.defaultdict(dict)
for row in data['measurements']:
 c=row['case'];groups[tuple(c[k] for k in ['set','diff','cls','levels','size','rung'])+(row['sentinel'],)][row['mode']]=row
summary=dict(provenance={k:v for k,v in data['provenance'].items() if k!='observerSource'},errors=[],regressions=[],bars=[],standard={},sentinels={},rewards=collections.Counter(),pathReview={})
fields=['deepest','level','ticks','kills','rests','potionsDrunk','potsAtEnd','goldFound','bought','hpLow','jobsPaid','relicsWorn']
pooled=collections.defaultdict(list);sentinels=collections.defaultdict(list);paths=collections.defaultdict(list)
for key,group in sorted(groups.items()):
 cls=key[2];base=group['baseline']['data']['results'][cls]
 if not key[-1]:
  off=group['off'];old=group['baseline-off']
  if off['fingerprints']!=old['fingerprints']:summary['regressions'].append(dict(key=key,error='passive fingerprint mismatch'))
  if off['data']['results'][cls]!=old['data']['results'][cls]:summary['regressions'].append(dict(key=key,error='passive outcomes mismatch'))
  gold=group['gold']['data']['results'][cls]
  for i,(b,n) in enumerate(zip(base,gold)):
   clean=lambda r:{k:v for k,v in r.items() if k not in ['puzzlesSolved','puzzleRewards']}
   if clean(b)!=clean(n):summary['regressions'].append(dict(key=key,trial=i,fields=[k for k in set(b)|set(n) if k not in ['puzzlesSolved','puzzleRewards'] and b.get(k)!=n.get(k)]))
 for mode,row in group.items():
  records=row['data']['results'][cls]
  for r in records:
   if r.get('timedOut') or str(r.get('cause','')).startswith('ERROR'):summary['errors'].append(dict(key=key,mode=mode,seed=r.get('seed'),cause=r.get('cause')))
   if mode in ['potion','gear']:summary['rewards'].update(r.get('puzzleRewards',{}))
   if mode not in ['baseline','potion','gear']:continue
   target=sentinels if key[-1] else pooled
   target[(key[1],cls,mode,key[3],key[4],key[5])].append(r)
   if not key[-1]:paths[(key[1],cls,mode,str(r.get('path','none')))].append(r)
def describe(records):
 n=len(records);dead=[r for r in records if r.get('died')]
 return dict(runs=n,wins=sum(bool(r['won']) for r in records),winRate=round(100*sum(bool(r['won']) for r in records)/n,4),earlyDeaths=sum(r.get('died') and r.get('level',0)<5 for r in records),
 causes=dict(collections.Counter(r.get('cause','') for r in dead)),means={f:round(sum(r.get(f,0) for r in records)/n,4) for f in fields},casts=dict(sum((collections.Counter(r.get('casts',{})) for r in records),collections.Counter())))
for name,table in [('standard',pooled),('sentinels',sentinels),('pathReview',paths)]:
 summary[name]={'/'.join(map(str,k)):describe(v) for k,v in sorted(table.items())}
for diff in ['normal','hard']:
 rates={}
 for mode in ['baseline','potion','gear']:
  records=[r for (d,c,m,n,z,rank),rs in pooled.items() if d==diff and m==mode for r in rs]
  vals=[describe(rs)['winRate'] for (d,c,m,n,z,rank),rs in pooled.items() if d==diff and m==mode]
  rates[mode]=dict(aggregate=describe(records)['winRate'],spread=max(vals)-min(vals))
 for mode in ['potion','gear']:
  delta=rates[mode]['aggregate']-rates['baseline']['aggregate'];spread=rates[mode]['spread']-rates['baseline']['spread']
  summary['bars'].append(dict(diff=diff,mode=mode,aggregateDelta=delta,spreadIncrease=spread,passAggregate=abs(delta)<=3,passSpread=spread<=2))
  for cls in ['fighter','cleric','mage','thief','ranger','druid']:
   key=lambda m:f'{diff}/{cls}/{m}/8/medium/0'
   delta=summary['standard'][key(mode)]['winRate']-summary['standard'][key('baseline')]['winRate']
   summary['bars'].append(dict(diff=diff,mode=mode,cls=cls,delta=delta,passClass=abs(delta)<=5))
summary['passed']=not summary['errors'] and not summary['regressions'] and all(v for b in summary['bars'] for k,v in b.items() if k.startswith('pass'))
print(json.dumps(summary,indent=2))
if not summary['passed']:raise SystemExit(1)
