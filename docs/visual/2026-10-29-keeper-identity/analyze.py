import collections,json,pathlib,sys,os
root=pathlib.Path(os.environ.get('KEEPER_AUDIT_OUT','/workspace/aaa3b-audit'))/sys.argv[1]
baselines=root.parent/'pilot' if sys.argv[1]=='pilot-narrow' else root
cells=[]
for p in sorted(baselines.glob('baseline-*.json')):
 q=root/p.name.replace('baseline-',(sys.argv[2] if len(sys.argv)>2 else 'candidate')+'-',1)
 if not q.exists():continue
 try:a=json.loads(p.read_text());b=json.loads(q.read_text())
 except json.JSONDecodeError:continue
 cls=next(iter(a['results']));aa=a['results'][cls];bb=b['results'][cls]
 assert a['options']==b['options'] and a['seeds']==b['seeds'] and a['trialsPerSeed']==b['trialsPerSeed']
 assert [(x['seed'],x['bg']) for x in aa]==[(x['seed'],x['bg']) for x in bb]
 level=a['options']['levels'];diff=a['options']['difficulty'];seedset=a['seeds'][0].rstrip('0123456789')
 def stats(rows):
  n=len(rows);deaths=[x for x in rows if x.get('died')];arrived=sum(str(level) in x.get('arrive',{}) for x in rows)
  return {'runs':n,'wins':sum(bool(x.get('won')) for x in rows),'win_rate':100*sum(bool(x.get('won')) for x in rows)/n,'arrivals':arrived,'final_deaths':sum(x.get('deepest')==level for x in deaths),'early_deaths':sum(x.get('level',99)<5 for x in deaths),'floor1_deaths':sum(x.get('deepest')==1 for x in deaths),'average_depth':sum(x.get('deepest',0) for x in rows)/n,'potion_attempts':sum(x.get('potionsDrunk',0) for x in rows)/n,'rests':sum(x.get('rests',0) for x in rows)/n,'gold_remaining':sum(x.get('goldFound',0) for x in rows)/n,'death_causes':dict(collections.Counter(x.get('cause') for x in deaths)),'errors':sum(str(x.get('cause','')).startswith('ERROR') for x in rows),'timeouts':sum(bool(x.get('timedOut')) for x in rows)}
 sa,sb=stats(aa),stats(bb)
 early_diff=sum(any(x.get('arrive',{}).get(str(d))!=y.get('arrive',{}).get(str(d)) for d in range(1,level+1)) for x,y in zip(aa,bb))
 cells.append({'class':cls,'difficulty':diff,'levels':level,'set':seedset,'baseline':sa,'candidate':sb,'delta_pp':sb['win_rate']-sa['win_rate'],'arrival_history_differences':early_diff,'outcome_flips':sum(bool(x.get('won'))!=bool(y.get('won')) for x,y in zip(aa,bb))})
groups=[]
for level,diff,cls in sorted(set((c['levels'],c['difficulty'],c['class']) for c in cells)):
 cc=[c for c in cells if (c['levels'],c['difficulty'],c['class'])==(level,diff,cls)];n=sum(c['baseline']['runs'] for c in cc);a=sum(c['baseline']['wins'] for c in cc);b=sum(c['candidate']['wins'] for c in cc)
 groups.append({'levels':level,'difficulty':diff,'class':cls,'sets':len(cc),'runs_per_variant':n,'baseline_wins':a,'candidate_wins':b,'delta_pp':round((b-a)/n*100,3),'arrival_history_differences':sum(c['arrival_history_differences'] for c in cc)})
out={'paired_cells':len(cells),'runs_per_variant':sum(c['baseline']['runs'] for c in cells),'arrival_history_differences':sum(c['arrival_history_differences'] for c in cells),'groups':groups,'cells':cells}
(root/'comparison.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k!='cells'}))
