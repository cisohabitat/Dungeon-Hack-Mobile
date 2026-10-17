#!/usr/bin/env python3
"""Check exact passive parity and compare every observed puzzle outcome/resource."""
import argparse, collections, gzip, json, pathlib
p=argparse.ArgumentParser();p.add_argument('archive',type=pathlib.Path);a=p.parse_args()
data=json.loads(gzip.decompress(a.archive.read_bytes()));groups=collections.defaultdict(dict)
for row in data['measurements']:
 c=row['case'];groups[(c['set'],c['diff'],c['cls'],c['levels'],c['size'],c['rung'],row['sentinel'])][row['mode']]=row
summary={'groups':len(groups),'runs':0,'standardRuns':0,'sentinelRuns':0,'offFingerprintMismatches':[], 'outcomeDifferences':[], 'errors':[], 'puzzlesSolved':0,'wins':collections.defaultdict(lambda:collections.Counter()), 'solvedByClass':collections.Counter()}
for key,group in sorted(groups.items()):
 b,o,n=[group[k] for k in ['baseline','off','on']];cls=b['case']['cls']
 if b['fingerprints']!=o['fingerprints']:summary['offFingerprintMismatches'].append(key)
 before=b['data']['results'][cls];off=o['data']['results'][cls];on=n['data']['results'][cls]
 if len(before)!=len(off) or len(before)!=len(on):raise RuntimeError('mismatched counts')
 for mode,row in group.items():
  for r in row['data']['results'][cls]:
   summary['runs']+=1;summary['sentinelRuns' if row['sentinel'] else 'standardRuns']+=1
   if str(r.get('cause','')).startswith('ERROR') or r.get('timedOut'):summary['errors'].append({'key':key,'mode':mode,'seed':r['seed'],'cause':r.get('cause')})
   if not row['sentinel']:summary['wins'][row['case']['diff']][mode]+=bool(r['won'])
 for i,(x,y,z) in enumerate(zip(before,off,on)):
  if x!=y:summary['outcomeDifferences'].append({'key':key,'trial':i,'mode':'off','fields':[k for k in set(x)|set(y) if x.get(k)!=y.get(k)]})
  clean={k:v for k,v in z.items() if k!='puzzlesSolved'}
  if x!=clean:summary['outcomeDifferences'].append({'key':key,'trial':i,'mode':'on','fields':[k for k in set(x)|set(clean) if x.get(k)!=clean.get(k)]})
  summary['puzzlesSolved']+=z.get('puzzlesSolved',0);summary['solvedByClass'][cls]+=z.get('puzzlesSolved',0)
summary['provenance']=data['provenance']
print(json.dumps(summary,indent=2))
if summary['offFingerprintMismatches'] or summary['outcomeDifferences'] or summary['errors']:raise SystemExit(1)
