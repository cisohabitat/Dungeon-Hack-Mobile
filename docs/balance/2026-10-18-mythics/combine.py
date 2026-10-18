#!/usr/bin/env python3
"""Replace affected Mage cells; retain every reused measurement's provenance."""
import argparse,gzip,json,pathlib
p=argparse.ArgumentParser();p.add_argument('--original',type=pathlib.Path,required=True);p.add_argument('--mages',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args()
def read(root):return json.loads(gzip.decompress((root/'runs.json.gz').read_bytes()))
def key(row):return tuple(row['case'][k] for k in ['prefix','diff','levels','size','cls'])
old,new=read(a.original),read(a.mages);op,np=old['provenance'],new['provenance']
assert op['suite']==np['suite'] and op['sourceSha256']==np['sourceSha256'] and op['node']==np['node']
o={key(r):r for r in old['measurements']};n={key(r):r for r in new['measurements']}
assert set(n)=={k for k in o if k[-1]=='mage'}
rows=[]
for k in sorted(o):
 prior=o[k];r=n.get(k,prior);provenance=np if k in n else op
 assert prior['data']['seeds']==r['data']['seeds'] and prior['data']['trialsPerSeed']==r['data']['trialsPerSeed']
 assert [(x['seed'],x['bg']) for x in prior['data']['results'][k[-1]]]==[(x['seed'],x['bg']) for x in r['data']['results'][k[-1]]]
 rows.append({**r,'provenance':provenance})
manifest={**op,'observerSha256':None,'finalPolicyObserverSha256':np['observerSha256'],'observerVariants':[op,np],
 'finished':max(op['finished'],np['finished']),'reusedCells':len(o)-len(n),'repeatedMageCells':len(n),
 'reuseReason':'Game source is identical. Observer v4 changes legal-action fallback only for a Mage wearing Bloodstar at <=2 life under MYTHIC=trial. All other class decisions are unchanged; baseline fingerprints match. Per-measurement provenance records the actual observer.'}
a.output.mkdir(parents=True,exist_ok=True);(a.output/'inputs.json').write_text(json.dumps(manifest,indent=2)+'\n');(a.output/'runs.json.gz').write_bytes(gzip.compress((json.dumps(dict(provenance=manifest,measurements=rows),separators=(',',':'))+'\n').encode(),mtime=0));print('Combined',len(rows),'cells;',len(n),'repeated Mage cells; all actual observer hashes retained.')
