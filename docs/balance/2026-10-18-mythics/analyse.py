#!/usr/bin/env python3
"""Compare complete matched cells; do not pool sentinel settings into win rates."""
import argparse,collections,gzip,json,pathlib,statistics
p=argparse.ArgumentParser();p.add_argument('--baseline',type=pathlib.Path,required=True);p.add_argument('--changed',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args()
def load(root):
 d=json.loads(gzip.decompress((root/'runs.json.gz').read_bytes()));return d,{tuple(r['case'][k] for k in ['prefix','diff','levels','size','cls']):r for r in d['measurements']}
bp,b=load(a.baseline);cp,c=load(a.changed)
assert set(b)==set(c)
classes=['fighter','cleric','mage','thief','ranger','druid'];groups=collections.defaultdict(lambda:[[],[]]);cells=[]
for k in sorted(b):
 br=b[k];cr=c[k];assert br['data']['seeds']==cr['data']['seeds'] and br['data']['trialsPerSeed']==cr['data']['trialsPerSeed']
 old=br['data']['results'][k[-1]];new=cr['data']['results'][k[-1]];assert [(x['seed'],x['bg']) for x in old]==[(x['seed'],x['bg']) for x in new]
 groups[(k[1],k[-1])][0].extend(old);groups[(k[1],k[-1])][1].extend(new);cells.append(dict(case=br['case'],runs=len(old),baselineWins=sum(x['won'] for x in old),changedWins=sum(x['won'] for x in new)))
def metrics(rows):
 n=len(rows);avg=lambda key:round(sum(r.get(key,0) for r in rows)/n,4)
 return dict(runs=n,wins=sum(r['won'] for r in rows),winRate=100*sum(r['won'] for r in rows)/n,depth=avg('deepest'),earlyDeaths=sum(r['died'] and r.get('level',0)<5 for r in rows),deathsBeforePath=sum(r['died'] and not r.get('path') for r in rows),causes=dict(collections.Counter(r['cause'] for r in rows if r['died'])),endingPotions=avg('potsAtEnd'),potionAttempts=avg('potionsDrunk'),rests=avg('rests'),endingCash=avg('goldFound'),casts=round(sum(sum(r.get('casts',{}).values()) for r in rows)/n,4),trials=sum(r.get('mythicTrial',0) for r in rows),trialsWon=sum(r.get('mythicWon',0) for r in rows),wornAtEnd=sum(r.get('mythicWorn',0) for r in rows),used=sum(r.get('mythicTicks',0)>0 for r in rows),ticks=avg('mythicTicks'),errors=sum(r.get('cause','').startswith('ERROR') for r in rows),timeouts=sum(r.get('timedOut',False) for r in rows),paths={path:dict(runs=len(part),wins=sum(r['won'] for r in part)) for path in sorted({(r.get('path') or 'none') for r in rows}) if (part:=[r for r in rows if (r.get('path') or 'none')==path])})
summary={'provenance':{'baseline':bp['provenance'],'changed':cp['provenance']},'cells':cells,'groups':[],'difficulty':[]};lines=['# Matched Mythic comparison','', '| Difficulty | Class | Baseline wins | Mythic-policy wins | Change (pp) | Trials / won / used |','|---|---|---:|---:|---:|---:|'];passed=True
for (diff,cls),(old,new) in sorted(groups.items()):
 om,nm=metrics(old),metrics(new);delta=nm['winRate']-om['winRate'];passed &= abs(delta)<=5 and not nm['errors'] and not nm['timeouts'];summary['groups'].append(dict(difficulty=diff,cls=cls,baseline=om,changed=nm,delta=delta));lines.append(f"| {diff} | {cls} | {om['wins']}/{om['runs']} ({om['winRate']:.2f}%) | {nm['wins']}/{nm['runs']} ({nm['winRate']:.2f}%) | {delta:+.2f} | {nm['trials']} / {nm['trialsWon']} / {nm['used']} |")
for diff in sorted({k[0] for k in groups}):
 rows=[r for r in summary['groups'] if r['difficulty']==diff];old=metrics(sum([groups[(diff,r['cls'])][0] for r in rows],[]));new=metrics(sum([groups[(diff,r['cls'])][1] for r in rows],[]));spread=lambda key:max(r[key]['winRate'] for r in rows)-min(r[key]['winRate'] for r in rows);delta=new['winRate']-old['winRate'];sd=spread('changed')-spread('baseline');passed &= abs(delta)<=3 and sd<=2;summary['difficulty'].append(dict(difficulty=diff,baseline=old,changed=new,delta=delta,spreadBaseline=spread('baseline'),spreadChanged=spread('changed'),spreadDelta=sd));lines.extend(['',f"{diff}: aggregate {delta:+.2f} points; class spread {spread('baseline'):.2f} → {spread('changed'):.2f} ({sd:+.2f})."])
summary['passesDeclaredBars']=passed;a.output.mkdir(parents=True,exist_ok=True);(a.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');(a.output/'summary.md').write_text('\n'.join(lines)+'\n');print('\n'.join(lines));print('Declared bars:',passed)
